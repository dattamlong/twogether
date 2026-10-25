"use client";

import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CoinIcon, StarIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { submitAnswer, useLessonCards } from "@/features/learning/queries";
import { LEVEL_LABELS } from "@/features/learning/types";
import { universeKeys } from "@/features/universe/queries";
import { useInvalidateProgress } from "@/features/progression/queries";
import { qk } from "@/features/query-keys";
import { getSupabase } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { celebrate } from "@/stores/celebration-store";
import { useRoomEvents } from "@/stores/room-events";
import { QuestionView } from "./question-view";
import { sfx } from "@/lib/sfx";

type IntroCard = { title: string; body: string; body_vi: string; examples: { text: string; translation_vi: string; note?: string }[] };

type Summary = { xp: number; coins: number; correct: number; total: number; firstCompletion: boolean; leveledUp: boolean; level: number };

export function LessonPlayer() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;
  const router = useRouter();
  const mapParam = useSearchParams().get("map");
  const backHref = mapParam && /^[a-z]+\/[A-Z0-9]+$/.test(mapParam) ? `/learn/world/${mapParam.split("/")[0]}?level=${mapParam.split("/")[1]}` : "/learn/free";
  const client = useQueryClient();
  const invalidate = useInvalidateProgress();
  const { data, isLoading, error, refetch } = useLessonCards(lessonId);
  const [attempt, setAttempt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"intro" | "discover" | "playing" | "finishing" | "summary">("intro");
  const [discoverIndex, setDiscoverIndex] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [starting, setStarting] = useState(false);

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={() => refetch()} />;
  if (!data?.lesson) return <ErrorBlock error="lesson_not_found" />;
  const { lesson, cards } = data;
  const card = cards[index];
  const intro = (Array.isArray(lesson.intro) ? lesson.intro : []) as unknown as IntroCard[];

  async function start() {
    setStarting(true);
    setActionError(null);
    const { data: attemptId, error: startError } = await getSupabase().rpc("start_lesson", { target_lesson: lessonId });
    setStarting(false);
    if (startError) {
      setActionError(startError);
      return;
    }
    setAttempt(attemptId);
    setIndex(0);
    setPhase("playing");
  }

  async function finish() {
    setPhase("finishing");
    const { data: result, error: completeError } = await getSupabase().rpc("complete_lesson", { lesson_attempt: attempt! });
    if (completeError) {
      setActionError(completeError);
      setPhase("playing");
      return;
    }
    const r = result as unknown as Summary;
    setSummary(r);
    setPhase("summary");
    sfx.lessonComplete();
    celebrate(r, r.firstCompletion ? "Lesson complete!" : "Practice complete!");
    useRoomEvents.getState().emit({ type: "celebrate" });
    client.invalidateQueries({ queryKey: qk.lessonHistory });
    client.invalidateQueries({ queryKey: qk.reviewQueue });
    client.invalidateQueries({ queryKey: universeKeys.all });
    void invalidate();
  }

  if (phase === "intro") {
    return (
      <Panel className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-lavender-100 px-3 py-1 text-xs font-bold">
            {lesson.level} · {LEVEL_LABELS[lesson.level]?.name ?? lesson.level}
          </span>
          <Link href={backHref} className="text-sm font-semibold text-cocoa-400 hover:text-plum-700">
            Back
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold">{lesson.title}</h1>
          <Vi className="text-base">{lesson.title_vi}</Vi>
        </div>
        <div className="rounded-3xl bg-white/70 p-4">
          <p className="mb-2 font-display font-semibold">In this lesson you will</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-plum-500">
            {lesson.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-cocoa-400">
          <span>{cards.length} questions</span>
          <span className="flex items-center gap-1">
            <StarIcon size={16} /> up to {cards.length * 10 + 20} XP
          </span>
          <span className="flex items-center gap-1">
            <CoinIcon size={16} /> Love Coins
          </span>
        </div>
        {actionError ? <ErrorBlock error={actionError} /> : null}
        {intro.length ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="flex-1" onClick={() => { setDiscoverIndex(0); setPhase("discover"); }}>
              Discover first
            </Button>
            <Button size="lg" variant="soft" className="flex-1" onClick={start} loading={starting}>
              Skip to questions
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={start} loading={starting}>
            Start lesson
          </Button>
        )}
      </Panel>
    );
  }

  if (phase === "discover" && intro.length) {
    const step = intro[Math.min(discoverIndex, intro.length - 1)];
    const last = discoverIndex >= intro.length - 1;
    return (
      <Panel className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-sakura-100 px-3 py-1 text-xs font-bold">Discover</span>
          <ProgressBar value={discoverIndex + 1} max={intro.length} label="Discover progress" className="h-2" />
          <span className="text-xs font-bold text-cocoa-400">
            {discoverIndex + 1}/{intro.length}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={discoverIndex} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">{step.title}</h2>
            <p className="text-plum-600">{step.body}</p>
            <Vi>{step.body_vi}</Vi>
            <ul className="flex flex-col gap-2">
              {step.examples.map((ex) => (
                <li key={ex.text} className="rounded-2xl bg-white/80 px-4 py-3 ring-2 ring-white">
                  <p lang={lesson.language ?? "en"} className="font-display text-lg font-semibold text-plum-700">{ex.text}</p>
                  <p lang="vi" className="text-sm text-cocoa-400">{ex.translation_vi}</p>
                  {ex.note ? <p className="mt-1 text-xs text-lavender-400">{ex.note}</p> : null}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        {actionError ? <ErrorBlock error={actionError} /> : null}
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={() => (discoverIndex === 0 ? setPhase("intro") : setDiscoverIndex((i) => i - 1))}>
            Back
          </Button>
          {last ? (
            <Button className="flex-1" onClick={start} loading={starting}>
              Practice now
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setDiscoverIndex((i) => i + 1)}>
              Next
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  if (phase === "summary" && summary) {
    const ratio = summary.correct / Math.max(summary.total, 1);
    const message =
      ratio >= 0.9 ? "Amazing work! You're glowing." : ratio >= 0.6 ? "Great progress — keep it up!" : "Every mistake is a step forward. Your review will help!";
    return (
      <Panel className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <motion.div initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.5 }}>
          <StarIcon size={88} />
        </motion.div>
        <h1 className="text-3xl font-bold">{summary.firstCompletion ? "Lesson complete!" : "Practice complete!"}</h1>
        <p className="text-plum-500">{message}</p>
        <p className="font-display text-5xl font-bold text-plum-700">
          {summary.correct}
          <span className="text-2xl text-cocoa-400">/{summary.total}</span>
        </p>
        <p className="-mt-3 text-xs text-cocoa-400">correct on the first try</p>
        <div className="flex gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 font-display font-bold">
            <StarIcon size={22} /> +{summary.xp} XP
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-gold-200 px-4 py-2 font-display font-bold">
            <CoinIcon size={22} /> +{summary.coins}
          </span>
        </div>
        {!summary.firstCompletion ? <p className="text-xs text-cocoa-400">Replays earn half XP — new lessons earn the most.</p> : null}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="soft" className="flex-1" onClick={() => setPhase("intro")}>
            Practice again
          </Button>
          <Button variant="secondary" className="flex-1" asChild>
            <Link href={backHref}>{mapParam ? "Back to map" : "More lessons"}</Link>
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/home">Go home</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Leave lesson"
          onClick={() => {
            if (window.confirm("Leave this lesson? Your answers so far still count toward reviews.")) router.push(backHref);
          }}
        >
          <X />
        </Button>
        <ProgressBar value={index} max={cards.length} label="Lesson progress" className="h-4" />
        <span className="font-display text-sm font-bold tabular-nums text-cocoa-400">
          {Math.min(index + 1, cards.length)}/{cards.length}
        </span>
      </div>
      <Panel>
        <AnimatePresence mode="wait">
          {card ? (
            <motion.div key={card.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
              <QuestionView
                card={card}
                submit={(answer) => submitAnswer({ question: card.id!, answer, lessonAttempt: attempt! })}
                continueLabel={index === cards.length - 1 ? "Finish" : "Continue"}
                onDone={() => {
                  if (index === cards.length - 1) void finish();
                  else setIndex((i) => i + 1);
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        {phase === "finishing" ? <p className="mt-4 text-center text-sm text-cocoa-400" role="status">Counting your rewards…</p> : null}
        {actionError ? <p role="alert" className="mt-3 text-sm text-rose-err">{friendlyError(actionError).en}</p> : null}
      </Panel>
    </div>
  );
}
