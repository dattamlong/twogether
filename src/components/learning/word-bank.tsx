"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useWordBank } from "@/features/learning/queries";
import type { WordCard as Word } from "@/features/learning/types";
import { cn } from "@/lib/utils";
import { SpeakButton } from "./audio-controls";
import { WordCard } from "./word-card";

const BOX_LABEL = ["Relearning", "New", "Familiar", "Good", "Strong", "Mastered"];

function when(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return "Due now";
  const days = Math.round(diff / 86_400_000);
  if (days < 1) return `In ${Math.max(1, Math.round(diff / 3_600_000))}h`;
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

export function WordBank() {
  const { data, isLoading, error, refetch } = useWordBank();
  const [open, setOpen] = useState<Word | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Word Bank</h1>
          <Vi>Những từ bạn đã học — được ôn lại theo lịch thông minh</Vi>
        </div>
        <Button asChild variant="secondary">
          <Link href="/learn/review">Review now</Link>
        </Button>
      </header>
      {isLoading ? <LoadingBlock /> : null}
      {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
      {data && data.length === 0 ? (
        <EmptyState
          title="Your word bank is empty"
          vi="Hãy học bài từ vựng đầu tiên"
          art={<TrophyIcon size={48} />}
          action={
            <Button asChild className="mt-2">
              <Link href="/learn">Start a vocabulary lesson</Link>
            </Button>
          }
        />
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((row) => {
          const word = row.word as unknown as Word;
          return (
            <li key={row.question_id} className="panel flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setOpen(word)}>
                  <p className="font-display text-xl font-semibold">{word.term}</p>
                  <p className="font-mono text-xs text-plum-500">{word.ipa}</p>
                </button>
                <SpeakButton text={word.term} label="" />
              </div>
              <p lang="vi" className="text-sm text-cocoa-400">{word.meaning_vi}</p>
              <div className="mt-auto flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1" aria-label={`Mastery ${row.box} of 5: ${BOX_LABEL[row.box]}`}>
                  {[1, 2, 3, 4, 5].map((b) => (
                    <span key={b} className={cn("size-2.5 rounded-full", b <= row.box ? "bg-mint-400" : "bg-lavender-100")} />
                  ))}
                  <span className="ml-1 text-cocoa-400">{BOX_LABEL[row.box]}</span>
                </span>
                <span className="text-cocoa-400">{when(row.next_review_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)} title={open?.term ?? ""} subtitle="Word card">
        {open ? <WordCard word={open} /> : null}
      </Modal>
    </div>
  );
}
