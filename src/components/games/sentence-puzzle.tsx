"use client";

import { Lightbulb, RotateCcw, SkipForward } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SentenceBuilder, type Token } from "@/components/learning/sentence-builder";
import { Button } from "@/components/ui/button";
import { CoinIcon, StarIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock } from "@/components/ui/states";
import { submitAnswer } from "@/features/learning/queries";
import type { AnswerFeedback } from "@/features/learning/types";
import { finishGame, startGame, type GameResult, type GameStart } from "@/features/games/session";
import { useInvalidateProgress } from "@/features/progression/queries";
import { cn, shuffle } from "@/lib/utils";
import { celebrate } from "@/stores/celebration-store";

type Outcome = "solved_first" | "solved" | "skipped";

export function SentencePuzzle() {
  const invalidate = useInvalidateProgress();
  const [phase, setPhase] = useState<"ready" | "loading" | "play" | "finishing" | "result">("ready");
  const [game, setGame] = useState<GameStart | null>(null);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<unknown>(null);

  const card = game?.questions[index];
  const tokens = useMemo<Token[]>(() => {
    const raw = (card?.tokens as string[] | null) ?? [];
    return shuffle(raw.map((text, id) => ({ id, text })));
  }, [card]);

  async function begin() {
    setPhase("loading");
    setError(null);
    try {
      setGame(await startGame("sentence_puzzle"));
      setIndex(0);
      setOutcomes([]);
      reset();
      setPhase("play");
    } catch (e) {
      setError(e);
      setPhase("ready");
    }
  }

  function reset() {
    setPlaced([]);
    setFeedback(null);
    setTries(0);
    setHint(false);
  }

  async function check() {
    if (!card || !game) return;
    setPending(true);
    try {
      const answer = placed.map((id) => tokens.find((t) => t.id === id)!.text).join(" ");
      const fb = await submitAnswer({ question: card.id!, answer, gameSession: game.sessionId });
      setFeedback(fb);
      setTries((t) => t + 1);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  async function advance(outcome: Outcome) {
    const nextOutcomes = [...outcomes, outcome];
    setOutcomes(nextOutcomes);
    if (!game) return;
    if (index >= game.questions.length - 1) {
      setPhase("finishing");
      try {
        const r = await finishGame(game.sessionId);
        setResult(r);
        celebrate(r, r.won ? "All puzzles solved!" : "Puzzle time!");
        void invalidate();
      } catch (e) {
        setError(e);
      }
      setPhase("result");
      return;
    }
    setIndex((i) => i + 1);
    reset();
  }

  if (phase === "ready" || phase === "loading") {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        <div className="flex gap-2">
          {["I", "love", "learning", "with", "you."].map((w, i) => (
            <motion.span key={w} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08 }} className="rounded-xl bg-white px-3 py-2 font-display font-semibold shadow-[var(--shadow-pop)]">
              {w}
            </motion.span>
          ))}
        </div>
        <h1 className="text-3xl font-bold">Sentence Puzzle</h1>
        <Vi>Sắp xếp các từ thành câu tiếng Anh đúng</Vi>
        <p className="text-sm text-plum-500">5 puzzles. Tap or drag words into place. Use hints and retries as much as you like — solving on the first try earns the most.</p>
        {error ? <ErrorBlock error={error} /> : null}
        <Button size="lg" onClick={begin} loading={phase === "loading"}>
          Start puzzles
        </Button>
      </Panel>
    );
  }

  if (phase === "finishing" || phase === "result") {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
        {phase === "finishing" ? <p role="status">Checking your puzzles…</p> : null}
        {result ? (
          <>
            <h1 className="text-3xl font-bold">{result.won ? "Puzzle master!" : "Nice work!"}</h1>
            <p className="text-plum-500">
              Solved {result.solved} of {game?.questions.length} · {result.firstTryCorrect} on the first try
            </p>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 font-display font-bold">
                <StarIcon size={22} /> +{result.xp} XP
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-gold-200 px-4 py-2 font-display font-bold">
                <CoinIcon size={22} /> +{result.coins}
              </span>
            </div>
          </>
        ) : error ? (
          <ErrorBlock error={error} />
        ) : null}
        <div className="flex w-full gap-2">
          <Button variant="soft" className="flex-1" onClick={begin}>
            Play again
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/games">All games</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-center gap-2" aria-label={`Puzzle ${index + 1} of ${game?.questions.length}`}>
        {game?.questions.map((q, i) => (
          <span
            key={q.id}
            className={cn(
              "size-3 rounded-full",
              i < outcomes.length ? (outcomes[i] === "skipped" ? "bg-lavender-200" : "bg-mint-400") : i === index ? "bg-sakura-400" : "bg-white",
            )}
          />
        ))}
      </div>
      {card ? (
        <Panel className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-lavender-400">
              {card.level} · Build the sentence
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{card.prompt}</h2>
            {card.prompt_vi ? <Vi>{card.prompt_vi}</Vi> : null}
          </div>
          <SentenceBuilder
            key={card.id}
            tokens={tokens}
            placed={placed}
            onChange={(p) => {
              setPlaced(p);
              if (feedback && !feedback.correct) setFeedback(null);
            }}
            disabled={Boolean(feedback?.correct)}
            state={feedback ? (feedback.correct ? "correct" : "incorrect") : null}
          />
          {hint && card.hint ? (
            <p className="rounded-2xl bg-gold-200/60 px-4 py-2 text-sm">
              {card.hint}
              {card.hint_vi ? <Vi className="text-xs">{card.hint_vi}</Vi> : null}
            </p>
          ) : null}
          {feedback ? (
            <div role="status" className={cn("rounded-2xl p-3", feedback.correct ? "bg-mint-100" : "bg-peach-100")}>
              <p className="font-display font-semibold">{feedback.correct ? (tries === 1 ? "Perfect on the first try!" : "Solved!") : "Not quite — try moving a few words."}</p>
              {feedback.correct ? (
                <>
                  <p className="text-sm">{feedback.explanation}</p>
                  <Vi className="text-xs">{feedback.explanationVi}</Vi>
                </>
              ) : null}
            </div>
          ) : null}
          {error ? <ErrorBlock error={error} /> : null}
          <div className="flex flex-wrap gap-2">
            {feedback?.correct ? (
              <Button onClick={() => advance(tries === 1 ? "solved_first" : "solved")} autoFocus>
                {index >= (game?.questions.length ?? 1) - 1 ? "Finish" : "Next puzzle"}
              </Button>
            ) : (
              <>
                <Button onClick={check} disabled={placed.length !== tokens.length} loading={pending}>
                  Check
                </Button>
                <Button variant="soft" onClick={() => setPlaced([])} disabled={!placed.length}>
                  <RotateCcw size={16} /> Clear
                </Button>
                <Button variant="soft" onClick={() => setHint(true)} disabled={hint || !card.hint}>
                  <Lightbulb size={16} /> Hint
                </Button>
                <Button variant="ghost" className="ml-auto" onClick={() => advance("skipped")}>
                  <SkipForward size={16} /> Skip
                </Button>
              </>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
