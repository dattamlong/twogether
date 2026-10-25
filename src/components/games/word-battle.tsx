"use client";

import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CoinIcon, HeartIcon, SparkleIcon, StarIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ErrorBlock } from "@/components/ui/states";
import { submitAnswer } from "@/features/learning/queries";
import type { AnswerFeedback } from "@/features/learning/types";
import { finishGame, startGame, type GameResult, type GameStart } from "@/features/games/session";
import { useInvalidateProgress } from "@/features/progression/queries";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { cn, shuffle } from "@/lib/utils";
import { celebrate } from "@/stores/celebration-store";

const ENEMY_HP = 5;
const PLAYER_HEARTS = 3;
const SECONDS = 15;

function MumbleSlime({ hurt, defeated }: { hurt: boolean; defeated: boolean }) {
  return (
    <svg viewBox="0 0 160 140" className="h-full w-full" aria-hidden>
      <ellipse cx="80" cy="128" rx="54" ry="9" fill="#45365b" opacity=".12" />
      <path d="M22 118c-8-50 18-92 58-92s66 42 58 92c-2 8-14 10-26 6-10 6-22 6-32 0-10 6-22 6-32 0-12 4-24 2-26-6z" fill={hurt ? "#f39bbb" : "#c7b8ea"} stroke="#8a73c8" strokeWidth="3" />
      <ellipse cx="58" cy="52" rx="16" ry="9" fill="#fff" opacity=".45" />
      {defeated ? (
        <g stroke="#45365b" strokeWidth="4" strokeLinecap="round">
          <path d="M52 72l12 10M64 72l-12 10M96 72l12 10M108 72l-12 10" />
        </g>
      ) : hurt ? (
        <g stroke="#45365b" strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M50 76l14-6M110 76l-14-6" />
        </g>
      ) : (
        <g>
          <ellipse cx="60" cy="76" rx="8" ry="10" fill="#45365b" />
          <ellipse cx="100" cy="76" rx="8" ry="10" fill="#45365b" />
          <circle cx="63" cy="72" r="3" fill="#fff" />
          <circle cx="103" cy="72" r="3" fill="#fff" />
        </g>
      )}
      <ellipse cx="46" cy="92" rx="8" ry="4" fill="#f39bbb" opacity=".6" />
      <ellipse cx="114" cy="92" rx="8" ry="4" fill="#f39bbb" opacity=".6" />
      <path d={defeated ? "M70 100q10-6 20 0" : hurt ? "M72 100q8 -4 16 0" : "M70 96q10 8 20 0"} stroke="#45365b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M118 28c4-8 14-10 18-2-6 2-10 6-12 12z" fill="#bce5d5" />
      <text x="128" y="26" fontFamily="Fredoka, sans-serif" fontSize="16" fill="#a995dc">z</text>
    </svg>
  );
}

type Phase = "ready" | "loading" | "battle" | "finishing" | "result";

export function WordBattle() {
  const invalidate = useInvalidateProgress();
  const reduced = usePrefersReducedMotion();
  const enemyControls = useAnimationControls();
  const arenaControls = useAnimationControls();
  const [phase, setPhase] = useState<Phase>("ready");
  const [game, setGame] = useState<GameStart | null>(null);
  const [index, setIndex] = useState(0);
  const [enemyHp, setEnemyHp] = useState(ENEMY_HP);
  const [hearts, setHearts] = useState(PLAYER_HEARTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [damage, setDamage] = useState<{ id: number; text: string; target: "enemy" | "player" } | null>(null);
  const [hurt, setHurt] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const answering = useRef(false);

  const card = game?.questions[index];
  const options = useMemo(() => shuffle((card?.options as string[] | null) ?? []), [card]);

  const begin = async () => {
    setPhase("loading");
    setError(null);
    try {
      const started = await startGame("word_battle");
      setGame(started);
      setIndex(0);
      setEnemyHp(ENEMY_HP);
      setHearts(PLAYER_HEARTS);
      setFeedback(null);
      setSelected(null);
      setTimeLeft(SECONDS);
      setPhase("battle");
    } catch (e) {
      setError(e);
      setPhase("ready");
    }
  };

  const end = useCallback(
    async (sessionId: string) => {
      setPhase("finishing");
      try {
        const r = await finishGame(sessionId);
        setResult(r);
        if (r.won) sfx.victory();
        else sfx.defeat();
        celebrate(r, r.won ? "Victory!" : "Good fight!");
        void invalidate();
      } catch (e) {
        setError(e);
      }
      setPhase("result");
    },
    [invalidate],
  );

  const answer = useCallback(
    async (choice: string) => {
      if (!game || !card || answering.current || feedback) return;
      answering.current = true;
      setSelected(choice);
      try {
        const fb = await submitAnswer({ question: card.id!, answer: choice, gameSession: game.sessionId });
        setFeedback(fb);
        if (fb.correct) {
          sfx.hit();
          setEnemyHp((hp) => Math.max(0, hp - 1));
          setDamage({ id: Date.now(), text: "-1", target: "enemy" });
          setHurt(true);
          if (!reduced) void enemyControls.start({ x: [0, 14, -10, 6, 0], scale: [1, 0.9, 1.05, 1], transition: { duration: 0.45 } });
          setTimeout(() => setHurt(false), 450);
        } else {
          sfx.wrong();
          setHearts((h) => Math.max(0, h - 1));
          setDamage({ id: Date.now(), text: "-1", target: "player" });
          if (!reduced) {
            void enemyControls.start({ y: [0, -24, 0], scale: [1, 1.1, 1], transition: { duration: 0.4 } });
            void arenaControls.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
          }
        }
      } catch (e) {
        setError(e);
      } finally {
        answering.current = false;
      }
    },
    [game, card, feedback, reduced, enemyControls, arenaControls],
  );

  useEffect(() => {
    if (phase !== "battle" || feedback || !card || timeLeft <= 0) return;
    const id = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
      if (timeLeft - 1 > 0 && timeLeft - 1 <= 3) sfx.tick();
      if (timeLeft - 1 <= 0) void answer("");
    }, 1000);
    return () => clearTimeout(id);
  }, [phase, feedback, card, timeLeft, answer]);

  const next = () => {
    if (!game) return;
    const over = enemyHp <= 0 || hearts <= 0 || index >= game.questions.length - 1;
    if (over) {
      void end(game.sessionId);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setFeedback(null);
    setTimeLeft(SECONDS);
  };

  if (phase === "ready" || phase === "loading") {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        <div className="h-40 w-48">
          <MumbleSlime hurt={false} defeated={false} />
        </div>
        <h1 className="text-3xl font-bold">Word Battle</h1>
        <Vi>Đánh bại Slime Lẩm Bẩm bằng từ vựng đúng!</Vi>
        <ul className="text-left text-sm text-plum-500">
          <li>• Each correct answer hits the slime ({ENEMY_HP} hits to win).</li>
          <li>• Wrong answers or running out of time cost a heart ({PLAYER_HEARTS} hearts).</li>
          <li>• You have {SECONDS} seconds per word. Words due for review appear first.</li>
        </ul>
        {error ? <ErrorBlock error={error} /> : null}
        <Button size="lg" onClick={begin} loading={phase === "loading"}>
          Start battle
        </Button>
      </Panel>
    );
  }

  if (phase === "result" || phase === "finishing") {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        {phase === "finishing" ? (
          <p role="status">Tallying the battle…</p>
        ) : result ? (
          <>
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="h-36 w-44">
              <MumbleSlime hurt={false} defeated={result.won} />
            </motion.div>
            <h1 className="text-3xl font-bold">{result.won ? "Victory!" : "The slime got away…"}</h1>
            <Vi>{result.won ? "Bạn đã chiến thắng!" : "Lần sau sẽ thắng thôi!"}</Vi>
            <p className="text-plum-500">{result.firstTryCorrect} correct answers</p>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 font-display font-bold">
                <StarIcon size={22} /> +{result.xp} XP
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-gold-200 px-4 py-2 font-display font-bold">
                <CoinIcon size={22} /> +{result.coins}
              </span>
            </div>
          </>
        ) : (
          <ErrorBlock error={error} />
        )}
        <div className="flex w-full gap-2">
          <Button variant="soft" className="flex-1" onClick={begin}>
            Battle again
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/games">All games</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <motion.div animate={arenaControls} className="mx-auto flex max-w-2xl flex-col gap-4">
      <Panel className="relative overflow-hidden bg-gradient-to-b from-lavender-100 via-sakura-50 to-cream-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-label={`${hearts} hearts left`}>
            {Array.from({ length: PLAYER_HEARTS }, (_, i) => (
              <motion.span key={i} animate={{ scale: i < hearts ? 1 : 0.7, opacity: i < hearts ? 1 : 0.25 }}>
                <HeartIcon size={28} />
              </motion.span>
            ))}
          </div>
          <div className="w-1/2">
            <p className="mb-1 text-right text-xs font-bold text-plum-500">Mumble Slime</p>
            <ProgressBar value={enemyHp} max={ENEMY_HP} tone="sakura" label="Enemy health" className="h-4" />
          </div>
        </div>
        <div className="relative mx-auto mt-2 h-40 w-48">
          <motion.div animate={enemyControls} className="h-full w-full">
            <MumbleSlime hurt={hurt} defeated={enemyHp <= 0} />
          </motion.div>
          <AnimatePresence>
            {damage ? (
              <motion.span
                key={damage.id}
                initial={{ opacity: 0, y: 0, scale: 0.6 }}
                animate={{ opacity: 1, y: -40, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                onAnimationComplete={() => setDamage(null)}
                className={cn("absolute font-display text-3xl font-bold", damage.target === "enemy" ? "right-0 top-4 text-sakura-500" : "left-0 top-16 text-plum-500")}
              >
                {damage.target === "enemy" ? (
                  <span className="flex items-center gap-1">
                    <SparkleIcon size={24} />
                    {damage.text}
                  </span>
                ) : (
                  "Ouch!"
                )}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <ProgressBar value={timeLeft} max={SECONDS} tone={timeLeft <= 5 ? "sakura" : "mint"} label="Time left" className="h-2" />
          <span className="w-8 text-right font-display text-sm font-bold tabular-nums">{timeLeft}s</span>
        </div>
      </Panel>

      {card ? (
        <Panel>
          <p className="text-xs font-bold text-cocoa-400">
            Word {index + 1} of {game!.questions.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{card.prompt}</h2>
          {card.prompt_vi ? <Vi>{card.prompt_vi}</Vi> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {options.map((option) => {
              const isCorrect = feedback && feedback.correctAnswer === option;
              const isChosenWrong = feedback && !feedback.correct && selected === option;
              return (
                <motion.button
                  key={option}
                  whileTap={{ scale: 0.96 }}
                  disabled={Boolean(feedback)}
                  onClick={() => answer(option)}
                  className={cn(
                    "min-h-14 rounded-2xl px-4 py-3 text-left text-lg font-semibold ring-2 transition-colors",
                    isCorrect ? "bg-mint-100 text-mint-600 ring-mint-400" : isChosenWrong ? "bg-sakura-50 ring-sakura-300" : "bg-white/85 ring-white hover:ring-lavender-200",
                  )}
                >
                  {option}
                </motion.button>
              );
            })}
          </div>
          {feedback ? (
            <div role="status" className={cn("mt-4 rounded-2xl p-3", feedback.correct ? "bg-mint-100" : "bg-peach-100")}>
              <p className="font-display font-semibold">{feedback.correct ? "Critical hit!" : selected ? `It's “${feedback.correctAnswer}”.` : `Time's up — it's “${feedback.correctAnswer}”.`}</p>
              <p className="text-sm">{feedback.explanation}</p>
              <Vi className="text-xs">{feedback.explanationVi}</Vi>
              <Button className="mt-3" onClick={next} autoFocus>
                {enemyHp <= 0 || hearts <= 0 || index >= game!.questions.length - 1 ? "See results" : "Next word"}
              </Button>
            </div>
          ) : null}
          {error ? <ErrorBlock error={error} className="mt-3" /> : null}
        </Panel>
      ) : null}
    </motion.div>
  );
}
