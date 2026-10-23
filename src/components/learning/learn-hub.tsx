"use client";

import { Check, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookIcon, SparkleIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { currentLevel, useLessonHistory, useLessons, useReviewStats, useSetLearning } from "@/features/learning/queries";
import { LANGUAGE_INFO, LEVEL_LABELS, type StudyLanguage } from "@/features/learning/types";
import { useRequiredSession } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { SpeakingPractice } from "./speaking-practice";

const CATEGORY_STYLE: Record<string, string> = {
  vocabulary: "bg-sakura-100",
  grammar: "bg-lavender-100",
  listening: "bg-sky-100",
  writing: "bg-mint-100",
  speaking: "bg-peach-100",
};

export function LearnHub() {
  const session = useRequiredSession();
  const lessons = useLessons();
  const history = useLessonHistory();
  const stats = useReviewStats();
  const setLearning = useSetLearning();
  const [category, setCategory] = useState("vocabulary");
  const language = session.profile.learning_language as StudyLanguage;
  const info = LANGUAGE_INFO[language];
  const level = currentLevel(session.profile);

  if (lessons.isLoading) return <LoadingBlock />;
  if (lessons.error) return <ErrorBlock error={lessons.error} onRetry={() => lessons.refetch()} />;
  const data = lessons.data!;
  const inCategory = data.lessons.filter((l) => l.category_id === category && l.language === language);
  const levelIndex = info.levels.indexOf(level);
  const recommended = inCategory.filter((l) => info.levels.indexOf(l.level) <= Math.max(levelIndex, 0) + 1);
  const later = inCategory.filter((l) => !recommended.includes(l));
  const highestAvailable = Math.max(-1, ...data.lessons.filter((l) => l.language === language).map((l) => info.levels.indexOf(l.level)));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Learn {info.name}</h1>
          <Vi>{info.learnVi}</Vi>
          <div className="mt-3 flex gap-1 rounded-2xl bg-white/70 p-1" role="radiogroup" aria-label="Language to learn">
            {(Object.keys(LANGUAGE_INFO) as StudyLanguage[]).map((code) => (
              <button
                key={code}
                role="radio"
                aria-checked={code === language}
                onClick={() => setLearning.mutate({ language: code })}
                className={cn("rounded-xl px-4 py-1.5 text-left", code === language ? "bg-sakura-400 text-white" : "text-plum-500 hover:bg-white")}
              >
                <span className="block font-display text-sm font-semibold">{LANGUAGE_INFO[code].native}</span>
                <span className={cn("block text-[11px]", code === language ? "text-white/85" : "text-cocoa-400")}>{LANGUAGE_INFO[code].standard}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-bold text-cocoa-400">
            Your level ({info.standard}) · Trình độ của bạn
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${info.name} level`}>
            {info.levels.map((l) => (
              <button
                key={l}
                role="radio"
                aria-checked={l === level}
                onClick={() => setLearning.mutate({ level: l })}
                className={cn("rounded-xl px-3 py-1.5 text-sm font-bold ring-2 transition", l === level ? "bg-plum-700 text-white ring-plum-700" : "bg-white/80 ring-white hover:ring-lavender-200")}
                title={`${LEVEL_LABELS[l].name} · ${LEVEL_LABELS[l].vi}`}
              >
                {l.replace("HSK", "")}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-cocoa-400">
            {LEVEL_LABELS[level]?.name} · {LEVEL_LABELS[level]?.vi}
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Panel className="flex items-center gap-4 bg-gradient-to-br from-sakura-50 to-lavender-100">
          <SparkleIcon size={48} />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Smart Review</p>
            <Vi className="text-xs">Ôn lại đúng lúc để nhớ lâu</Vi>
            <p className="mt-1 text-sm text-plum-500">
              {stats.data ? (stats.data.due > 0 ? `${stats.data.due} item${stats.data.due === 1 ? "" : "s"} ready to review` : stats.data.learned > 0 ? "All caught up! Missed items still help." : "Finish a lesson to unlock reviews.") : "…"}
            </p>
          </div>
          <Button asChild variant={stats.data?.due ? "primary" : "soft"}>
            <Link href="/learn/review" aria-disabled={!stats.data?.learned && !stats.data?.due}>
              Review
            </Link>
          </Button>
        </Panel>
        <Panel className="flex items-center gap-4">
          <TrophyIcon size={48} />
          <div className="flex-1">
            <p className="font-display text-lg font-semibold">Word Bank</p>
            <Vi className="text-xs">Kho từ vựng của bạn</Vi>
            <p className="mt-1 text-sm text-plum-500">
              {stats.data?.learned ?? 0} learned · {stats.data?.mastered ?? 0} mastered
            </p>
          </div>
          <Button asChild variant="soft">
            <Link href="/learn/words">Open</Link>
          </Button>
        </Panel>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categories">
        {data.categories.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              "shrink-0 rounded-2xl px-4 py-2 text-left ring-2 transition",
              category === c.id ? `${CATEGORY_STYLE[c.id]} ring-sakura-300` : "bg-white/70 ring-white hover:ring-lavender-200",
            )}
          >
            <span className="block font-display font-semibold">{c.name}</span>
            <span lang="vi" className="block text-xs text-cocoa-400">{c.name_vi}</span>
          </button>
        ))}
      </div>

      {category === "speaking" ? (
        <SpeakingPractice key={language} language={language} />
      ) : (
        <>
          <Panel>
            <PanelTitle icon={<BookIcon size={32} />} title="Recommended for you" subtitle="Gợi ý theo trình độ của bạn" />
            <LessonGrid lessons={recommended} history={history.data} />
            {recommended.length === 0 ? <p className="text-sm text-cocoa-400">No lessons at your level in this category yet — try the ones below.</p> : null}
            {levelIndex > highestAvailable + 1 ? (
              <p className="mt-3 rounded-2xl bg-sky-100 px-4 py-2 text-sm text-plum-500">
                {info.standard} lessons above {info.levels[highestAvailable]} are coming soon. Lessons up to that level are open to you now.
                <span lang="vi" className="block text-xs text-cocoa-400">Bài cấp cao hơn đang được soạn — bạn có thể học các bài hiện có.</span>
              </p>
            ) : null}
          </Panel>
          {later.length ? (
            <Panel>
              <PanelTitle title="More challenging" subtitle="Thử thách hơn" />
              <LessonGrid lessons={later} history={history.data} />
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

type LessonItem = ReturnType<typeof useLessons>["data"] extends infer D ? (D extends { lessons: (infer L)[] } ? L : never) : never;

function LessonGrid({ lessons, history }: { lessons: LessonItem[]; history?: Map<string, { correct: number; total: number; times: number }> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {lessons.map((l) => {
        const done = history?.get(l.id);
        const stars = done ? (done.correct / Math.max(done.total, 1) >= 0.9 ? 3 : done.correct / Math.max(done.total, 1) >= 0.6 ? 2 : 1) : 0;
        return (
          <li key={l.id}>
            <Link
              href={`/learn/${l.id}`}
              className={cn("group flex h-full flex-col gap-2 rounded-3xl p-4 ring-2 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]", CATEGORY_STYLE[l.category_id], done ? "ring-mint-200" : "ring-white")}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{l.level}</span>
                {done ? (
                  <span className="flex items-center gap-0.5" aria-label={`${stars} of 3 stars`}>
                    {[1, 2, 3].map((s) => (
                      <StarIcon key={s} size={18} className={s <= stars ? "" : "opacity-25 grayscale"} />
                    ))}
                  </span>
                ) : null}
              </div>
              <p className="font-display text-lg font-semibold leading-tight">{l.title}</p>
              <p lang="vi" className="-mt-1 text-xs text-cocoa-400">{l.title_vi}</p>
              <p className="text-sm text-plum-500">{l.objectives[0]}</p>
              <div className="mt-auto flex items-center gap-3 text-xs font-semibold text-cocoa-400">
                <span className="flex items-center gap-1">
                  <Clock size={13} /> ~{Math.max(3, Math.round(l.questionCount * 0.7))} min
                </span>
                <span className="flex items-center gap-1">
                  <StarIcon size={14} /> {l.questionCount * 10 + 20} XP
                </span>
                {done ? (
                  <span className="ml-auto flex items-center gap-1 text-mint-600">
                    <Check size={13} /> {done.correct}/{done.total}
                  </span>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
