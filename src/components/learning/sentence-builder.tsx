"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

export type Token = { id: number; text: string };

function insertionIndex(container: HTMLElement | null, x: number, y: number, draggingId: number) {
  if (!container) return -1;
  const chips = [...container.querySelectorAll<HTMLElement>("[data-token-id]")].filter((el) => Number(el.dataset.tokenId) !== draggingId);
  let index = 0;
  for (const chip of chips) {
    const r = chip.getBoundingClientRect();
    const sameRow = y >= r.top - 6 && y <= r.bottom + 6;
    const before = y < r.top - 6 || (sameRow && x < r.left + r.width / 2);
    if (before) return index;
    index++;
  }
  return index;
}

function inside(el: HTMLElement | null, x: number, y: number) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
}

export function SentenceBuilder({
  tokens,
  placed,
  onChange,
  disabled,
  state,
}: {
  tokens: Token[];
  placed: number[];
  onChange: (placed: number[]) => void;
  disabled?: boolean;
  state?: "correct" | "incorrect" | null;
}) {
  const answerRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const bank = tokens.filter((t) => !placed.includes(t.id));
  const byId = (id: number) => tokens.find((t) => t.id === id)!;

  const dropAt = (id: number, x: number, y: number, fromAnswer: boolean) => {
    if (inside(answerRef.current, x, y)) {
      const without = placed.filter((p) => p !== id);
      const index = insertionIndex(answerRef.current, x, y, id);
      without.splice(index < 0 ? without.length : index, 0, id);
      onChange(without);
    } else if (fromAnswer) {
      onChange(placed.filter((p) => p !== id));
    }
  };

  const chip = (token: Token, fromAnswer: boolean, position?: number) => (
    <motion.button
      key={token.id}
      layout
      layoutId={`token-${token.id}`}
      type="button"
      data-token-id={fromAnswer ? token.id : undefined}
      drag={!disabled}
      dragSnapToOrigin
      dragElastic={0.6}
      dragMomentum={false}
      whileDrag={{ scale: 1.08, zIndex: 20, boxShadow: "0 10px 20px -8px rgba(69,54,91,.35)" }}
      onDragStart={() => {
        justDragged.current = true;
      }}
      onDragEnd={(_, info) => {
        dropAt(token.id, info.point.x - window.scrollX, info.point.y - window.scrollY, fromAnswer);
        setTimeout(() => (justDragged.current = false), 0);
      }}
      onClick={() => {
        if (disabled || justDragged.current) return;
        onChange(fromAnswer ? placed.filter((p) => p !== token.id) : [...placed, token.id]);
      }}
      onKeyDown={(e) => {
        if (!fromAnswer || disabled || position === undefined) return;
        if (e.key === "ArrowLeft" && position > 0) {
          const next = [...placed];
          [next[position - 1], next[position]] = [next[position], next[position - 1]];
          onChange(next);
          e.preventDefault();
        }
        if (e.key === "ArrowRight" && position < placed.length - 1) {
          const next = [...placed];
          [next[position + 1], next[position]] = [next[position], next[position + 1]];
          onChange(next);
          e.preventDefault();
        }
      }}
      aria-label={fromAnswer ? `${token.text}, position ${(position ?? 0) + 1}. Click to remove, arrow keys to move.` : `Add ${token.text}`}
      className={cn(
        "touch-none select-none rounded-2xl px-3.5 py-2.5 font-display text-lg font-semibold shadow-[var(--shadow-pop)] ring-2 transition-colors",
        fromAnswer ? "bg-white ring-lavender-200" : "bg-lavender-100 ring-white hover:bg-white",
        disabled && "cursor-default",
      )}
    >
      {token.text}
    </motion.button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={answerRef}
        aria-label="Your sentence"
        className={cn(
          "flex min-h-20 flex-wrap content-start items-start gap-2 rounded-3xl border-2 border-dashed p-3 transition-colors",
          state === "correct" ? "border-mint-400 bg-mint-100" : state === "incorrect" ? "border-sakura-300 bg-sakura-50" : "border-lavender-200 bg-white/60",
        )}
      >
        {placed.length === 0 ? <span className="self-center px-2 text-sm text-cocoa-400">Tap or drag words here to build the sentence</span> : null}
        {placed.map((id, i) => chip(byId(id), true, i))}
      </div>
      <div className="flex min-h-14 flex-wrap justify-center gap-2" aria-label="Word bank">
        {bank.map((t) => chip(t, false))}
      </div>
    </div>
  );
}
