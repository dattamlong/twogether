"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { ItemArt } from "@/components/rewards/item-art";
import { Button } from "@/components/ui/button";
import { HeartIcon, MailIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { qk } from "@/features/query-keys";
import { useInvalidateProgress } from "@/features/progression/queries";
import { finishAdventurePart, startAdventurePart, universeKeys, useCoupleAdventures } from "@/features/universe/queries";
import type { ChallengeStart, CoupleAdventure } from "@/features/universe/types";
import { readAvatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { sfx } from "@/lib/sfx";
import { celebrate } from "@/stores/celebration-store";
import { ChallengeRunner } from "./challenge-runner";

type Running = Omit<ChallengeStart, "unit"> & { part: CoupleAdventure["parts"][number] };
type PartResult = Awaited<ReturnType<typeof finishAdventurePart>>;

export function CoupleAdventures() {
  const session = useRequiredSession();
  const adventures = useCoupleAdventures();
  const client = useQueryClient();
  const invalidate = useInvalidateProgress();
  const [running, setRunning] = useState<{ adventure: CoupleAdventure; run: Running } | null>(null);
  const [partResult, setPartResult] = useState<PartResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  if (!session.couple || !session.partner) {
    return (
      <Panel className="mx-auto max-w-lg text-center">
        <HeartIcon size={48} className="mx-auto" />
        <p className="mt-2 font-display text-lg font-semibold">Couple Adventures need two players</p>
        <Vi>Hãy kết đôi với người ấy để cùng phiêu lưu.</Vi>
      </Panel>
    );
  }

  async function begin(adventure: CoupleAdventure) {
    setBusy(adventure.id);
    setError(null);
    setPartResult(null);
    try {
      setRunning({ adventure, run: await startAdventurePart(adventure.id) });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function finish() {
    if (!running) return;
    setBusy("finish");
    try {
      const r = await finishAdventurePart(running.run.sessionId);
      setPartResult(r);
      setRunning(null);
      if (r.passed) sfx.love();
      if (r.adventureCompleted) celebrate(r, "Adventure complete!");
      client.invalidateQueries({ queryKey: universeKeys.adventures });
      client.invalidateQueries({ queryKey: qk.memories });
      void invalidate();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (running) {
    return (
      <ChallengeRunner
        key={running.run.sessionId}
        sessionId={running.run.sessionId}
        questions={running.run.questions}
        onLeave={() => setRunning(null)}
        onFinish={finish}
        finishing={busy === "finish"}
        error={error}
        header={() => (
          <p className="rounded-2xl bg-sakura-50 px-4 py-2 text-sm font-semibold text-plum-700">
            {running.run.part.title} <span lang="vi" className="font-normal text-cocoa-400">· {running.run.part.title_vi}</span>
          </p>
        )}
      />
    );
  }

  const me = session.profile;
  const partner = session.partner;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <Link href="/learn" className="text-sm font-semibold text-cocoa-400 hover:text-plum-700">
          ← Learning Universe
        </Link>
        <h1 className="text-3xl font-bold">Couple Adventures</h1>
        <Vi>Mỗi người hoàn thành một phần ở trình độ của mình — chỉ khi cả hai cùng xong, câu chuyện mới mở ra.</Vi>
      </header>

      {partResult ? (
        <Panel className={partResult.passed ? "bg-mint-100/70" : "bg-peach-100/70"} role="status">
          <p className="font-display text-lg font-semibold">
            {partResult.passed ? (partResult.adventureCompleted ? "You did it together! The letter is restored." : "Your part is done! Waiting for your partner…") : "Not quite — you need 60% to finish your part."}
          </p>
          <p className="text-sm text-plum-500">
            {partResult.correct}/{partResult.total} correct
            {partResult.passed && !partResult.adventureCompleted ? " · We'll reveal the letter once your partner finishes their part." : ""}
          </p>
        </Panel>
      ) : null}
      {error && !running ? <ErrorBlock error={error} /> : null}
      {adventures.isLoading ? <LoadingBlock /> : null}
      {adventures.error ? <ErrorBlock error={adventures.error} onRetry={() => adventures.refetch()} /> : null}

      {adventures.data?.map((a) => {
        const mineDone = Boolean(a.progress[session.userId]);
        const partnerDone = Boolean(a.progress[partner.id]);
        const myPart = a.parts.find((p) => p.slot === a.mySlot);
        const theirPart = a.parts.find((p) => p.slot !== a.mySlot);
        return (
          <Panel key={a.id} className="flex flex-col gap-4 overflow-hidden">
            <div className="flex items-start gap-3">
              <MailIcon size={48} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-semibold">{a.title}</h2>
                <p lang="vi" className="text-xs text-cocoa-400">{a.titleVi}</p>
                <p className="mt-2 text-plum-500">{a.story}</p>
                <Vi>{a.storyVi}</Vi>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { who: me, part: myPart, done: mineDone, mine: true },
                { who: partner, part: theirPart, done: partnerDone, mine: false },
              ].map(({ who, part, done, mine }) => (
                <div key={who.id} className={`flex items-center gap-3 rounded-3xl p-3 ring-2 ${done ? "bg-mint-100 ring-mint-200" : "bg-white/70 ring-white"}`}>
                  <AvatarFace avatar={readAvatar(who.avatar)} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-cocoa-400">{mine ? "You" : who.display_name}</p>
                    <p className="truncate font-display font-semibold">{part?.title}</p>
                    <p className="flex items-center gap-1 text-xs text-plum-500">
                      {done ? (
                        <>
                          <Check size={12} /> Done
                        </>
                      ) : (
                        <>
                          <Clock size={12} /> {mine ? "Your turn" : "Waiting"}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {a.completed ? (
              <motion.div initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0.3 }} className="rounded-3xl bg-[#fffaf0] p-5 shadow-inner ring-2 ring-gold-200">
                <p className="font-display text-lg italic leading-relaxed text-plum-700">“{a.letter}”</p>
                <p lang="vi" className="mt-2 text-sm italic text-cocoa-400">“{a.letterVi}”</p>
                <p className="mt-3 text-xs font-semibold text-mint-600">Completed together · saved to your memories</p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 text-sm text-plum-500">
                  {a.rewardItemId ? <ItemArt itemId={a.rewardItemId} size={36} /> : null}
                  <span>
                    Reward: +{a.coupleXp} couple XP, +{a.loveEnergy} love energy and a keepsake for your room.
                  </span>
                </div>
                <Button onClick={() => begin(a)} loading={busy === a.id} disabled={mineDone}>
                  {mineDone ? "Waiting for partner" : "Play my part"}
                </Button>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
