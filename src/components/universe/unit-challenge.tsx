"use client";

import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ItemArt } from "@/components/rewards/item-art";
import { Button } from "@/components/ui/button";
import { CoinIcon, SparkleIcon, StarIcon, TrophyIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock } from "@/components/ui/states";
import { qk } from "@/features/query-keys";
import { useInvalidateProgress } from "@/features/progression/queries";
import { finishUnitChallenge, startUnitChallenge, universeKeys } from "@/features/universe/queries";
import { STAR_RULES, type ChallengeResult, type ChallengeStart } from "@/features/universe/types";
import { SHOP_ITEMS } from "@/content/catalog";
import { sfx } from "@/lib/sfx";
import { celebrate } from "@/stores/celebration-store";
import { useRoomEvents } from "@/stores/room-events";
import { ChallengeRunner } from "./challenge-runner";
import { LocationArt } from "./world-art";

function Guardian({ hp, hit }: { hp: number; hit: number }) {
  return (
    <motion.svg key={hit} viewBox="0 0 120 120" className="h-24 w-24 drop-shadow-lg sm:h-28 sm:w-28" initial={hit ? { x: -6 } : false} animate={{ x: [6, -4, 2, 0] }} transition={{ duration: 0.35 }} aria-hidden>
      <ellipse cx="60" cy="110" rx="34" ry="6" fill="#45365b" opacity=".15" />
      <path d="M28 96 q-6 -44 32 -62 q38 18 32 62 z" fill={hp > 0 ? "#8a73c8" : "#c7b8ea"} />
      <path d="M40 40 l-8 -22 16 12z M80 40 l8 -22 -16 12z" fill="#f4c76b" />
      <circle cx="60" cy="58" r="22" fill="#fde4ee" />
      {hp > 0 ? (
        <>
          <path d="M48 54 l8 4 M72 54 l-8 4" stroke="#45365b" strokeWidth="3" strokeLinecap="round" />
          <circle cx="51" cy="61" r="3" fill="#45365b" />
          <circle cx="69" cy="61" r="3" fill="#45365b" />
          <path d="M54 70 q6 -4 12 0" stroke="#45365b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M47 60 q4 -4 8 0 M65 60 q4 -4 8 0" stroke="#45365b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M54 68 q6 6 12 0" stroke="#45365b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="46" cy="68" r="4" fill="#f8bbd0" />
          <circle cx="74" cy="68" r="4" fill="#f8bbd0" />
        </>
      )}
      <circle cx="60" cy="88" r="7" fill="#f4c76b" stroke="#d9a440" strokeWidth="2" />
    </motion.svg>
  );
}

export function UnitChallenge() {
  const { unitId, mode: rawMode } = useParams<{ unitId: string; mode: string }>();
  const mode = rawMode === "boss" ? "boss" : "review";
  const mapParam = useSearchParams().get("map");
  const backHref = mapParam && /^[a-z]+\/[A-Z0-9]+$/.test(mapParam) ? `/learn/world/${mapParam.split("/")[0]}?level=${mapParam.split("/")[1]}` : "/learn";
  const router = useRouter();
  const client = useQueryClient();
  const invalidate = useInvalidateProgress();
  const [challenge, setChallenge] = useState<ChallengeStart | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function begin() {
    setStarting(true);
    setError(null);
    try {
      setChallenge(await startUnitChallenge(unitId, mode));
      setResult(null);
    } catch (e) {
      setError(e);
    } finally {
      setStarting(false);
    }
  }

  async function finish() {
    if (!challenge) return;
    setFinishing(true);
    setError(null);
    try {
      const r = await finishUnitChallenge(challenge.sessionId);
      setResult(r);
      if (r.stars > 0 || mode === "review") sfx.levelUp();
      celebrate(r, mode === "boss" ? (r.stars ? "Boss cleared!" : "Boss challenge") : "Unit review complete!");
      useRoomEvents.getState().emit({ type: "celebrate" });
      client.invalidateQueries({ queryKey: universeKeys.all });
      client.invalidateQueries({ queryKey: qk.reviewQueue });
      if (r.firstClear) client.invalidateQueries({ queryKey: qk.session });
      void invalidate();
    } catch (e) {
      setError(e);
    } finally {
      setFinishing(false);
    }
  }

  if (result && challenge) {
    const cleared = mode === "review" || result.stars > 0;
    const reward = result.rewardItemId ? SHOP_ITEMS.find((i) => i.id === result.rewardItemId) : null;
    return (
      <Panel className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <motion.div initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0.55 }}>
          {mode === "boss" ? <TrophyIcon size={88} /> : <SparkleIcon size={88} />}
        </motion.div>
        <h1 className="text-3xl font-bold">{mode === "review" ? "Review complete!" : cleared ? `${challenge.unit.bossName ?? "The guardian"} is defeated!` : "So close!"}</h1>
        <p className="font-display text-5xl font-bold text-plum-700">
          {result.pct}
          <span className="text-2xl text-cocoa-400">%</span>
        </p>
        <p className="-mt-3 text-xs text-cocoa-400">
          {result.correct}/{result.total} correct on the first try
        </p>
        {mode === "boss" ? (
          <div className="flex gap-1" aria-label={`${result.stars} of 3 stars`}>
            {[1, 2, 3].map((s) => (
              <motion.span key={s} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 + s * 0.15, type: "spring", bounce: 0.6 }}>
                <StarIcon size={44} className={s <= result.stars ? "" : "opacity-25 grayscale"} />
              </motion.span>
            ))}
          </div>
        ) : null}
        {mode === "boss" && !cleared ? (
          <>
            <p className="text-plum-500">You need 80% to clear the unit. Your mistakes are now in Smart Review — try again whenever you&apos;re ready.</p>
            <Vi>Cần 80% để qua unit. Những câu sai đã được thêm vào phần ôn tập.</Vi>
          </>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          <span className="flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 font-display font-bold">
            <StarIcon size={22} /> +{result.xp} XP
          </span>
          {result.coins ? (
            <span className="flex items-center gap-1.5 rounded-full bg-gold-200 px-4 py-2 font-display font-bold">
              <CoinIcon size={22} /> +{result.coins}
            </span>
          ) : null}
        </div>
        {result.firstClear && reward ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex w-full items-center gap-3 rounded-3xl bg-gold-200/60 p-3 text-left">
            <ItemArt itemId={reward.id} size={64} />
            <div>
              <p className="font-display font-semibold">New home decoration: {reward.name}</p>
              <p className="text-xs text-plum-500">It&apos;s in your shared inventory — place it in your room from Decorate.</p>
              <p lang="vi" className="text-xs text-cocoa-400">Đã thêm vào kho đồ chung của hai bạn.</p>
            </div>
          </motion.div>
        ) : null}
        {result.firstClear ? <p className="text-sm font-semibold text-mint-600">The next unit is now unlocked!</p> : null}
        {!result.firstClear && mode === "boss" && cleared && result.coins === 0 ? <p className="text-xs text-cocoa-400">Replays earn a little XP. New stars earn bonus coins.</p> : null}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="soft" className="flex-1" onClick={begin} loading={starting}>
            {mode === "boss" ? "Fight again" : "Review again"}
          </Button>
          <Button className="flex-1" asChild>
            <Link href={backHref}>Back to map</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  if (challenge) {
    const total = challenge.questions.length;
    return (
      <ChallengeRunner
        key={challenge.sessionId}
        sessionId={challenge.sessionId}
        questions={challenge.questions}
        onLeave={() => router.push(backHref)}
        onFinish={finish}
        finishing={finishing}
        error={error}
        header={
          mode === "boss"
            ? ({ correct, wrong }) => {
                const hp = Math.max(0, total - correct);
                return (
                  <div className="relative flex items-center gap-3 overflow-hidden rounded-[1.75rem] bg-gradient-to-r from-lavender-100 to-sakura-100 p-3 ring-2 ring-white">
                    <Guardian hp={hp} hit={correct} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg font-semibold text-plum-700">{challenge.unit.bossName ?? "Guardian"}</p>
                      <div className="mt-1 h-3 overflow-hidden rounded-full bg-white/80" role="meter" aria-label="Guardian HP" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={total}>
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-rose-err to-sakura-400" animate={{ width: `${(hp / total) * 100}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-cocoa-400">
                        {correct} hits · {wrong} misses · 80% to win
                      </p>
                    </div>
                  </div>
                );
              }
            : undefined
        }
      />
    );
  }

  const rules = STAR_RULES.slice().reverse();
  return (
    <Panel className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="h-40 overflow-hidden rounded-3xl bg-gradient-to-b from-lavender-100 to-cream-100">
        <LocationArt location="castle" className="mx-auto h-full" />
      </div>
      {mode === "boss" ? (
        <>
          <h1 className="text-3xl font-bold">Boss Challenge</h1>
          <p className="text-plum-500">Defeat the unit guardian by answering questions from every lesson in this unit. Each correct answer lands a hit!</p>
          <Vi>Trả lời đúng để tấn công boss. Đạt 80% để qua unit.</Vi>
          <ul className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            {rules.map((r) => (
              <li key={r.stars} className="rounded-2xl bg-white/80 p-2">
                <span className="flex justify-center">
                  {Array.from({ length: r.stars }, (_, i) => (
                    <StarIcon key={i} size={16} />
                  ))}
                </span>
                {r.min}%+ · {r.label}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Unit Review</h1>
          <p className="text-plum-500">A mixed review of the unit. Questions you missed before come first. Finish it to unlock the boss.</p>
          <Vi>Ôn tập toàn bộ unit, câu bạn hay sai sẽ xuất hiện trước.</Vi>
        </>
      )}
      {error ? <ErrorBlock error={error} /> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="soft" className="flex-1" asChild>
          <Link href={backHref}>Back to map</Link>
        </Button>
        <Button className="flex-1" size="lg" onClick={begin} loading={starting}>
          {mode === "boss" ? "Begin battle" : "Start review"}
        </Button>
      </div>
    </Panel>
  );
}
