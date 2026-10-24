"use client";

import { motion } from "motion/react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { tierById } from "@/features/legends/tiers";
import { readAvatar } from "@/features/session/types";
import { useDiscoverCouples } from "@/features/world/queries";
import type { CoupleCard } from "@/features/world/types";
import { useWorldLobby } from "@/features/world/world-channel";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useSocialSheets } from "./social-sheets";

const COLS = 4;

function lotPosition(i: number) {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return { x: 14 + col * 24 + (row % 2 ? 4 : -2), row, col };
}

function House({ couple, lit, index, reduced }: { couple: CoupleCard; lit: boolean; index: number; reduced: boolean }) {
  const tier = tierById(couple.tier);
  const roof = tier.colors.to;
  const wall = couple.homeLevel >= 4 ? "#fff7ed" : couple.homeLevel >= 2 ? "#fdf0e6" : "#fbe9dc";
  return (
    <svg viewBox="0 0 120 110" className="h-full w-full drop-shadow-[0_8px_10px_rgba(69,54,91,0.18)]" aria-hidden>
      <ellipse cx="60" cy="100" rx="48" ry="9" fill="#45365b" opacity=".12" />
      <path d="M18 58 L60 80 L60 104 L18 82 Z" fill={wall} />
      <path d="M102 58 L60 80 L60 104 L102 82 Z" fill="#f1dccd" />
      <path d="M12 60 L60 22 L64 26 L64 84 L60 82 L12 58 Z" fill={roof} opacity=".95" />
      <path d="M108 60 L60 22 L56 26 L56 84 L60 82 L108 58 Z" fill={tier.colors.ring} />
      <path d="M60 22 L12 58 M60 22 L108 58" stroke="#fff" strokeWidth="2" opacity=".55" />
      <rect x="74" y="74" width="12" height="18" rx="2" transform="skewY(-27)" fill="#c49a83" />
      {[0, 1].map((w) => (
        <rect
          key={w}
          x={26 + w * 16}
          y={74 + w * 8}
          width="10"
          height="10"
          rx="2"
          transform={`skewY(27) translate(0 ${-34 - w * 8 + w * 0})`}
          fill={lit ? "#fbe3b1" : "#cfe6f6"}
          style={lit && !reduced ? { animation: `legend-twinkle ${2.4 + w * 0.7}s ease-in-out ${index * 0.2}s infinite` } : undefined}
        />
      ))}
      {couple.homeLevel >= 2 ? <circle cx="104" cy="88" r="6" fill="#6cc3a2" /> : null}
      {couple.homeLevel >= 3 ? <circle cx="16" cy="86" r="5" fill="#f39bbb" /> : null}
      <path d="M58 34 c-4-3-5-5-5-7 0-1.6 1.3-2.8 2.7-2.8 1.1 0 2 .6 2.3 1.4.3-.8 1.2-1.4 2.3-1.4 1.4 0 2.7 1.2 2.7 2.8 0 2-1.3 4-5 7z" fill="#fff" opacity=".9" />
    </svg>
  );
}

function Tree({ x, y, s = 1, kind = "sakura" }: { x: number; y: number; s?: number; kind?: "sakura" | "green" }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="9" ry="3" fill="#45365b" opacity=".1" />
      <rect x="-1.5" y="-12" width="3" height="14" fill="#9a8288" />
      <circle cx="0" cy="-16" r="9" fill={kind === "sakura" ? "#f8bbd0" : "#8fd3b6"} />
      <circle cx="-5" cy="-12" r="6" fill={kind === "sakura" ? "#f39bbb" : "#6cc3a2"} />
    </g>
  );
}

export function Neighborhood() {
  const query = useDiscoverCouples("recent", 12);
  const online = useWorldLobby((s) => s.online);
  const openCouple = useSocialSheets((s) => s.openCouple);
  const reduced = usePrefersReducedMotion();
  const couples = query.data?.pages.flatMap((p) => p.items) ?? [];
  const rows = Math.max(2, Math.ceil(couples.length / COLS));
  const height = 140 + rows * 120;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-plum-500">
        Every house is a real couple. Lit windows mean someone is home right now. <span lang="vi" className="text-cocoa-400">· Mỗi ngôi nhà là một cặp đôi thật.</span>
      </p>
      {query.isLoading ? <Skeleton className="h-[520px] rounded-[2rem]" /> : null}
      {query.error ? <ErrorBlock error={query.error} onRetry={() => query.refetch()} /> : null}
      {query.data ? (
        <div className="relative overflow-hidden rounded-[2rem] ring-2 ring-white" style={{ height }}>
          <svg viewBox={`0 0 400 ${height}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="hood-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e5f3fc" />
                <stop offset=".35" stopColor="#fde4ee" />
                <stop offset=".36" stopColor="#d9f1e6" />
                <stop offset="1" stopColor="#c4e8d6" />
              </linearGradient>
            </defs>
            <rect width="400" height={height} fill="url(#hood-sky)" />
            {Array.from({ length: rows }, (_, r) => (
              <path key={r} d={`M0 ${150 + r * 120} Q200 ${130 + r * 120} 400 ${150 + r * 120}`} stroke="#fff7ed" strokeWidth="14" fill="none" strokeLinecap="round" opacity=".9" />
            ))}
            <path d={`M200 80 L200 ${height}`} stroke="#fff7ed" strokeWidth="12" opacity=".8" />
          </svg>
          <svg viewBox="0 0 160 70" className="absolute left-1/2 top-6 w-40 -translate-x-1/2" aria-hidden>
            <ellipse cx="80" cy="44" rx="74" ry="20" fill="#fff7ed" />
            <ellipse cx="80" cy="40" rx="30" ry="10" fill="#b8ddf5" stroke="#fff" strokeWidth="3" />
            <rect x="76" y="18" width="8" height="20" rx="3" fill="#fff" />
            <circle cx="80" cy="16" r="6" fill="#b8ddf5" style={reduced ? undefined : { animation: "legend-float 2.6s ease-in-out infinite" }} />
          </svg>
          {Array.from({ length: rows * 2 + 2 }, (_, i) => (
            <svg key={`tree-${i}`} viewBox="-12 -28 24 32" className="pointer-events-none absolute w-8" style={{ left: i % 2 ? `${93 - ((i * 7) % 5)}%` : `${1 + ((i * 11) % 4)}%`, top: 95 + i * 58 }} aria-hidden>
              <Tree x={0} y={0} kind={i % 3 ? "sakura" : "green"} />
            </svg>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <svg key={`lamp-${r}`} viewBox="-6 -38 12 40" className="pointer-events-none absolute w-3" style={{ left: r % 2 ? "74%" : "26%", top: 128 + r * 120 }} aria-hidden>
              <rect x="-1.5" y="-30" width="3" height="30" fill="#8a73c8" />
              <circle cx="0" cy="-32" r="5" fill="#fbe3b1" />
            </svg>
          ))}
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/85 px-3 py-1 font-display text-xs font-semibold text-plum-700 shadow-[var(--shadow-pop)]">
            ⛲ Sakura Square
          </span>
          {couples.length === 0 ? (
            <p className="absolute inset-x-0 top-1/2 text-center font-display text-plum-500">No neighbors yet — invite friends to build the town!</p>
          ) : null}
          <ul>
            {couples.map((c, i) => {
              const { x, row } = lotPosition(i);
              const lit = c.members.some((m) => online.has(m.id));
              return (
                <motion.li
                  key={c.coupleId}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${x}%`, top: 100 + row * 120, width: "22%", maxWidth: 140, zIndex: row + 1 }}
                  initial={reduced ? false : { opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: Math.min(i, 12) * 0.05, type: "spring", bounce: 0.4 }}
                >
                  <button type="button" onClick={() => openCouple(c.coupleId)} className="group flex w-full flex-col items-center" aria-label={`${c.members.map((m) => m.name).join(" and ")}'s house${lit ? ", someone is home" : ""}`}>
                    <span className="block aspect-[12/11] w-full transition-transform group-hover:-translate-y-1.5 group-active:scale-95">
                      <House couple={c} lit={lit} index={i} reduced={reduced} />
                    </span>
                    <span className="-mt-2 flex max-w-full items-center gap-0.5 rounded-full bg-white/90 py-0.5 pl-0.5 pr-2 shadow-[var(--shadow-pop)]">
                      {c.members.slice(0, 2).map((m) => (
                        <AvatarFace key={m.id} avatar={readAvatar(m.avatar)} size={18} />
                      ))}
                      <span className="truncate text-[10px] font-bold text-plum-700">{c.members.map((m) => m.name).join(" & ")}</span>
                    </span>
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {query.hasNextPage ? (
        <Button variant="soft" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage} className="self-center">
          Explore further down the road
        </Button>
      ) : null}
    </div>
  );
}
