"use client";

import { ArrowRight, Lock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { BookIcon, HeartIcon, SparkleIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { useReviewStats } from "@/features/learning/queries";
import { useUniverse } from "@/features/universe/queries";
import type { SubjectSummary } from "@/features/universe/types";
import { cn } from "@/lib/utils";
import { WorldIcon, WorldScene, WORLD_THEMES } from "./world-art";

const PLANNED_TOPICS: Record<string, string[]> = {
  science: ["Matter & Energy", "Living Things", "Our Universe", "Scientific reasoning"],
  money: ["Budgeting basics", "Saving together", "Interest & inflation", "Avoiding scams"],
  tech: ["How computers work", "First code", "AI basics", "Staying safe online"],
};

function levelLabel(subject: SubjectSummary) {
  if (subject.id === "chinese") return subject.currentLevel.replace("HSK", "HSK ");
  if (subject.id === "english") return `CEFR ${subject.currentLevel}`;
  return `Level ${subject.currentLevel.replace("L", "")}`;
}

function WorldCard({ subject, index, onLocked }: { subject: SubjectSummary; index: number; onLocked: (s: SubjectSummary) => void }) {
  const locked = subject.status !== "available";
  const theme = WORLD_THEMES[subject.id];
  const pct = subject.lessonsTotal ? Math.round((subject.lessonsDone / subject.lessonsTotal) * 100) : 0;
  const body = (
    <>
      <div className="relative h-36 overflow-hidden sm:h-40">
        <WorldScene subject={subject.id} locked={locked} />
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/85 py-1 pl-1 pr-3 shadow-[var(--shadow-pop)]">
          <WorldIcon subject={subject.id} size={26} />
          <span className="font-display text-xs font-semibold text-plum-700">{locked ? "Coming soon" : levelLabel(subject)}</span>
        </div>
        {locked ? (
          <div className="absolute inset-0 grid place-items-center bg-white/25">
            <span className="grid size-12 place-items-center rounded-full bg-white/90 shadow-[var(--shadow-pop)]">
              <Lock size={20} className="text-plum-500" />
            </span>
          </div>
        ) : subject.stars > 0 ? (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-xs font-bold">
            <StarIcon size={16} /> {subject.stars}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h2 className="font-display text-xl font-semibold" style={{ color: theme.accent }}>
            {subject.name}
          </h2>
          <p lang="vi" className="text-xs text-cocoa-400">{subject.nameVi}</p>
        </div>
        <p className="text-sm text-plum-500">{subject.description}</p>
        {locked ? (
          <p className="mt-auto text-xs font-semibold text-cocoa-400">Lessons are being written — tap to see what&apos;s planned.</p>
        ) : (
          <div className="mt-auto">
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-cocoa-400">
              <span>
                {subject.lessonsDone}/{subject.lessonsTotal} lessons · {subject.unitsCleared} units cleared
              </span>
              <span>{pct}%</span>
            </div>
            <ProgressBar value={subject.lessonsDone} max={Math.max(subject.lessonsTotal, 1)} tone="sakura" label={`${subject.name} progress`} className="h-2" />
            <span className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl py-2 font-display font-semibold text-white shadow-[var(--shadow-pop)]" style={{ background: theme.accent }}>
              Enter World <ArrowRight size={16} />
            </span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: "spring", bounce: 0.3 }}
      whileHover={{ y: -6 }}
      className="h-full"
    >
      {locked ? (
        <button onClick={() => onLocked(subject)} className="panel flex h-full w-full flex-col overflow-hidden p-0 text-left opacity-90">
          {body}
        </button>
      ) : (
        <Link href={`/learn/world/${subject.id}`} className="panel flex h-full flex-col overflow-hidden p-0 transition-shadow hover:shadow-[0_18px_40px_-14px_rgba(69,54,91,0.45)]">
          {body}
        </Link>
      )}
    </motion.li>
  );
}

export function UniversePage() {
  const universe = useUniverse();
  const stats = useReviewStats();
  const [preview, setPreview] = useState<SubjectSummary | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <header className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_120%_at_0%_0%,#fde4ee_0%,#efeafb_50%,#e5f3fc_100%)] p-5 ring-2 ring-white sm:p-6">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="absolute size-1.5 rounded-full bg-white"
            style={{ left: `${(i * 29) % 95}%`, top: `${(i * 37) % 80}%`, animation: `legend-twinkle ${2 + (i % 3)}s ease-in-out ${i * 0.3}s infinite` }}
            aria-hidden
          />
        ))}
        <p className="relative font-display text-xs font-bold uppercase tracking-[0.25em] text-lavender-400">Learning Universe</p>
        <h1 className="relative text-3xl font-bold text-plum-700 sm:text-4xl">Learn Together. Explore Forever.</h1>
        <Vi className="relative">Cùng học — khám phá mãi mãi. Chọn một thế giới để bắt đầu cuộc phiêu lưu.</Vi>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Link href="/learn/review" className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-pop)] hover:bg-white">
            <SparkleIcon size={18} /> Smart Review{stats.data?.due ? <span className="rounded-full bg-sakura-400 px-1.5 text-[11px] text-white">{stats.data.due}</span> : null}
          </Link>
          <Link href="/learn/free" className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-pop)] hover:bg-white">
            <BookIcon size={18} /> Free Learning
          </Link>
          <Link href="/learn/adventures" className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-pop)] hover:bg-white">
            <HeartIcon size={18} /> Couple Adventures
          </Link>
          <Link href="/learn/words" className="flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-pop)] hover:bg-white">
            <TrophyIcon size={18} /> Word Bank
          </Link>
        </div>
      </header>

      {universe.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-[1.5rem]" />
          ))}
        </div>
      ) : null}
      {universe.error ? <ErrorBlock error={universe.error} onRetry={() => universe.refetch()} /> : null}
      {universe.data ? (
        <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
          {universe.data.map((subject, i) => (
            <WorldCard key={subject.id} subject={subject} index={i} onLocked={setPreview} />
          ))}
        </ul>
      ) : null}

      <Modal open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} title={preview?.name ?? ""} subtitle={`${preview?.nameVi ?? ""} · Coming soon`}>
        {preview ? (
          <div className="flex flex-col gap-3">
            <div className="h-36 overflow-hidden rounded-3xl">
              <WorldScene subject={preview.id} />
            </div>
            <p className="text-plum-500">{preview.description}</p>
            <Vi>{preview.descriptionVi}</Vi>
            <p className="font-display font-semibold">Planned first units</p>
            <ul className="flex flex-wrap gap-2">
              {(PLANNED_TOPICS[preview.id] ?? []).map((t) => (
                <li key={t} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-xs text-cocoa-400">This world has no playable lessons yet, so it is locked rather than shown as complete.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
