"use client";

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { todayIn } from "@/components/layout/hud";
import { Button } from "@/components/ui/button";
import { AlbumIcon, FlameIcon, HeartIcon, SnowflakeIcon, SparkleIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { STREAK_MILESTONES } from "@/content/catalog";
import { useAddMemory, useAnswerLoveQuestion, useDeleteMemory, useLoveHistory, useLoveQuestion, useMemories } from "@/features/love/queries";
import { useAchievements, useProgress } from "@/features/progression/queries";
import { effectiveStreak } from "@/features/progression/streak";
import type { Streak } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { cn } from "@/lib/utils";
import { Mailbox } from "./mailbox";

export function OurStory() {
  const [tab, setTab] = useState<"love" | "mail" | "album" | "progress">("love");
  const tabs = [
    { id: "love" as const, label: "Love Question", vi: "Câu hỏi tình yêu" },
    { id: "mail" as const, label: "Messages", vi: "Tin nhắn" },
    { id: "album" as const, label: "Memory Album", vi: "Album kỷ niệm" },
    { id: "progress" as const, label: "Streaks & Badges", vi: "Chuỗi ngày & huy hiệu" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold">Our Story</h1>
        <Vi>Câu chuyện của chúng mình</Vi>
      </header>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("shrink-0 rounded-2xl px-4 py-2 text-left ring-2", tab === t.id ? "bg-sakura-100 ring-sakura-300" : "bg-white/70 ring-white")}
          >
            <span className="block font-display text-sm font-semibold">{t.label}</span>
            <span lang="vi" className="block text-[11px] text-cocoa-400">{t.vi}</span>
          </button>
        ))}
      </div>
      {tab === "love" ? <LoveQuestionSection /> : null}
      {tab === "mail" ? (
        <Panel>
          <Mailbox />
        </Panel>
      ) : null}
      {tab === "album" ? <MemoryAlbum /> : null}
      {tab === "progress" ? <StreaksAndBadges /> : null}
    </div>
  );
}

function LoveQuestionSection() {
  const session = useRequiredSession();
  const { data, isLoading, error, refetch } = useLoveQuestion();
  const history = useLoveHistory();
  const answer = useAnswerLoveQuestion();
  const [draft, setDraft] = useState("");
  const partner = session.partner?.display_name ?? "your partner";

  if (isLoading) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Panel className="bg-gradient-to-br from-sakura-50 to-lavender-100">
        <PanelTitle icon={<HeartIcon size={34} />} title="Daily Love Question" subtitle={new Date(`${data.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
        <p className="font-display text-2xl font-semibold leading-snug sm:text-3xl">{data.question.prompt}</p>
        <Vi className="mt-1 text-base">{data.question.prompt_vi}</Vi>

        {data.myAnswer ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-white/85 p-4">
              <p className="text-xs font-bold text-cocoa-400">You</p>
              <p className="mt-1 whitespace-pre-wrap">{data.myAnswer}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={cn("rounded-3xl p-4", data.partnerAnswer ? "bg-white/85" : "bg-white/50")}>
              <p className="text-xs font-bold text-cocoa-400">{partner}</p>
              {data.partnerAnswer ? (
                <p className="mt-1 whitespace-pre-wrap">{data.partnerAnswer}</p>
              ) : (
                <p className="mt-1 text-sm text-cocoa-400">Not answered yet. Their answer will appear here when they share it.</p>
              )}
            </motion.div>
          </div>
        ) : (
          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (draft.trim()) answer.mutate(draft.trim());
            }}
          >
            {data.partnerAnswered ? <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm font-semibold text-plum-500">{partner} already answered — reply to see their answer!</p> : null}
            <label htmlFor="love-answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="love-answer"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 600))}
              rows={4}
              placeholder={data.question.helper_phrase ?? "Write your answer in English…"}
              className="rounded-3xl border-2 border-white bg-white/85 p-4 outline-none focus:border-sakura-300"
            />
            {data.question.helper_phrase ? <p className="text-xs text-cocoa-400">Try starting with: “{data.question.helper_phrase}”</p> : null}
            <Button type="submit" size="lg" disabled={!draft.trim()} loading={answer.isPending}>
              Share my answer
            </Button>
          </form>
        )}
      </Panel>
      <Panel>
        <PanelTitle title="Past answers" subtitle="Những câu trả lời trước" />
        {history.isLoading ? <LoadingBlock /> : null}
        {history.data?.length === 0 ? <p className="text-sm text-cocoa-400">Your answers will collect here day by day.</p> : null}
        <ul className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto pr-1">
          {history.data?.map((h) => (
            <li key={h.day} className="rounded-2xl bg-white/75 p-3">
              <p className="text-xs font-bold text-cocoa-400">{new Date(`${h.day}T12:00:00`).toLocaleDateString()}</p>
              <p className="font-display font-semibold">{h.prompt}</p>
              <p className="mt-1 text-sm">
                <b>You:</b> {h.my_answer}
              </p>
              <p className="text-sm">
                <b>{partner}:</b> {h.partner_answer ?? <span className="text-cocoa-400">—</span>}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const MEMORY_STYLE: Record<string, string> = {
  milestone: "bg-lavender-100",
  achievement: "bg-gold-200/70",
  streak: "bg-peach-100",
  quest: "bg-mint-100",
  home: "bg-sky-100",
  message: "bg-sakura-100",
  special: "bg-sakura-50",
};

function MemoryIcon({ kind }: { kind: string }) {
  if (kind === "achievement") return <TrophyIcon size={28} />;
  if (kind === "streak") return <FlameIcon size={28} />;
  if (kind === "message" || kind === "special") return <HeartIcon size={28} />;
  if (kind === "quest") return <SparkleIcon size={28} />;
  if (kind === "home") return <AlbumIcon size={28} />;
  return <StarIcon size={28} />;
}

function MemoryAlbum() {
  const { data, isLoading, error, refetch } = useMemories();
  const add = useAddMemory();
  const remove = useDeleteMemory();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Panel>
        <PanelTitle icon={<AlbumIcon size={32} />} title="Memory Album" subtitle="Dòng thời gian của hai bạn" />
        {isLoading ? <LoadingBlock /> : null}
        {error ? <ErrorBlock error={error} onRetry={() => refetch()} /> : null}
        {data?.length === 0 ? <EmptyState title="Your story starts here" vi="Câu chuyện bắt đầu từ đây" /> : null}
        <ol className="relative flex flex-col gap-4 border-l-4 border-dashed border-lavender-200 pl-6">
          {data?.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }} className="relative">
              <span className="absolute -left-[2.35rem] top-2 grid size-9 place-items-center rounded-full bg-white shadow-[var(--shadow-pop)]">
                <MemoryIcon kind={m.kind} />
              </span>
              <div className={cn("rounded-3xl p-4", MEMORY_STYLE[m.kind] ?? "bg-white/80")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-cocoa-400">{new Date(`${m.occurred_on}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                    <p className="font-display text-lg font-semibold">{m.title}</p>
                  </div>
                  {m.kind === "special" || m.kind === "message" ? (
                    <button className="rounded-lg p-1.5 text-cocoa-400 hover:bg-white/70" onClick={() => remove.mutate(m.id)} aria-label={`Delete memory ${m.title}`}>
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
                {m.body ? <p className="mt-1 whitespace-pre-wrap text-plum-500">{m.body}</p> : null}
              </div>
            </motion.li>
          ))}
        </ol>
      </Panel>
      <Panel>
        <h3 className="font-display text-lg font-semibold">Add a special date</h3>
        <Vi>Thêm một ngày đặc biệt</Vi>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ title, body, date }, { onSuccess: () => { setTitle(""); setBody(""); } });
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder="Our first date" required aria-label="Memory title" className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 outline-none focus:border-sakura-300" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 600))} rows={3} placeholder="What happened? (optional)" aria-label="Memory details" className="rounded-2xl border-2 border-lavender-100 bg-white p-3 outline-none focus:border-sakura-300" />
          <Button type="submit" loading={add.isPending} disabled={!title.trim()}>
            Save memory
          </Button>
        </form>
      </Panel>
    </div>
  );
}

function StreakCard({ title, vi, streak, timezone, tone }: { title: string; vi: string; streak: Streak | null; timezone: string; tone: string }) {
  const view = streak
    ? effectiveStreak({ current: streak.current, longest: streak.longest, lastActiveDate: streak.last_active_date, freezes: streak.freezes }, todayIn(timezone))
    : { days: 0, status: "none" as const };
  const statusText = {
    none: "Start today — any lesson, game, or 5 reviews counts.",
    done_today: "Done for today. Lovely!",
    pending_today: "Learn something today to keep it going.",
    protected: "A freeze is protecting your streak. Welcome back anytime.",
    broken: "A fresh start is waiting — no pressure.",
  }[view.status];
  const next = STREAK_MILESTONES.find((m) => m > view.days);
  return (
    <div className={cn("flex flex-col gap-2 rounded-3xl p-4", tone)}>
      <div className="flex items-center gap-3">
        <FlameIcon size={44} lit={view.status === "done_today"} />
        <div>
          <p className="font-display text-3xl font-bold leading-none">{view.days}</p>
          <p className="text-sm font-semibold">{title}</p>
          <p lang="vi" className="text-[11px] text-cocoa-400">{vi}</p>
        </div>
      </div>
      <p className="text-xs text-plum-500">{statusText}</p>
      <div className="flex items-center justify-between text-xs font-semibold text-cocoa-400">
        <span className="flex items-center gap-1" title="Streak freezes cover a missed day automatically">
          <SnowflakeIcon size={18} /> {streak?.freezes ?? 0} freeze{streak?.freezes === 1 ? "" : "s"}
        </span>
        <span>Best {streak?.longest ?? 0}</span>
        {next ? <span>Next: {next} days</span> : null}
      </div>
    </div>
  );
}

function StreaksAndBadges() {
  const session = useRequiredSession();
  const progress = useProgress();
  const achievements = useAchievements();
  const tz = session.profile.timezone;

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelTitle icon={<FlameIcon size={32} />} title="Learning streaks" subtitle="Chuỗi ngày học — nghỉ ngơi cũng không sao" />
        <div className="grid gap-3 md:grid-cols-3">
          <StreakCard title="Your streak" vi="Chuỗi của bạn" streak={progress.data?.myStreak ?? null} timezone={tz} tone="bg-peach-100" />
          <StreakCard title={`${session.partner?.display_name ?? "Partner"}'s streak`} vi="Chuỗi của người ấy" streak={progress.data?.partnerStreak ?? null} timezone={session.partner?.timezone ?? tz} tone="bg-lavender-100" />
          <StreakCard title="Couple streak" vi="Chuỗi cặp đôi" streak={progress.data?.coupleStreak ?? null} timezone={session.couple?.timezone ?? tz} tone="bg-sakura-100" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Streak milestones">
          {STREAK_MILESTONES.map((m) => {
            const reached = (progress.data?.myStreak?.longest ?? 0) >= m;
            return (
              <span key={m} className={cn("rounded-full px-3 py-1 text-xs font-bold", reached ? "bg-gold-300 text-plum-900" : "bg-white/70 text-cocoa-400")}>
                {m} days {reached ? "✓" : ""}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-cocoa-400">
          A day counts when you finish a lesson, a mini-game, or 5 review answers (midnight in your timezone). You start with one freeze and earn more at weekly milestones (max 2).
        </p>
      </Panel>
      <Panel>
        <PanelTitle icon={<TrophyIcon size={32} />} title="Achievements" subtitle="Huy hiệu" />
        {achievements.isLoading ? <LoadingBlock /> : null}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {achievements.data?.map((a) => {
            const unlocked = Boolean(a.unlockedByMe);
            return (
              <li key={a.id} className={cn("flex flex-col gap-1 rounded-3xl p-3 ring-2", unlocked ? "bg-gold-200/60 ring-gold-300" : "bg-white/60 ring-white opacity-70")}>
                <div className="flex items-center justify-between">
                  {a.scope === "couple" ? <HeartIcon size={26} className={unlocked ? "" : "grayscale"} /> : <StarIcon size={26} className={unlocked ? "" : "grayscale"} />}
                  {unlocked ? <span className="text-[11px] font-bold text-mint-600">{new Date(a.unlockedByMe!).toLocaleDateString()}</span> : null}
                </div>
                <p className="font-display text-sm font-semibold leading-tight">{a.title}</p>
                <p lang="vi" className="text-[11px] text-cocoa-400">{a.title_vi}</p>
                <p className="text-xs text-plum-500">{a.description}</p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
