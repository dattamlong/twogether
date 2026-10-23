"use client";

import { Lightbulb, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Vi } from "@/components/ui/panel";
import { displayAnswer, speechLang, type AnswerFeedback, type QuestionCard } from "@/features/learning/types";
import { friendlyError } from "@/lib/errors";
import { sfx } from "@/lib/sfx";
import { t } from "@/lib/i18n";
import { cn, shuffle } from "@/lib/utils";
import { ListeningPlayer } from "./audio-controls";
import { SentenceBuilder, type Token } from "./sentence-builder";
import { WordCard } from "./word-card";

const PRAISE = ["Nice!", "Great job!", "You got it!", "Perfect!", "Wonderful!"];
const COMFORT = ["Not quite — that's okay!", "Almost! Let's look at why.", "Good try! Here's the trick."];

export type QuestionResult = { firstTryCorrect: boolean; feedback: AnswerFeedback };

export function QuestionView({
  card,
  submit,
  onDone,
  continueLabel = t("learn.continue"),
}: {
  card: QuestionCard;
  submit: (answer: string) => Promise<AnswerFeedback>;
  onDone: (result: QuestionResult) => void;
  continueLabel?: string;
}) {
  const options = useMemo(() => shuffle((card.options as string[] | null) ?? []), [card.options]);
  const tokens = useMemo<Token[]>(() => ((card.tokens as string[] | null) ?? []).map((text, id) => ({ id, text })), [card.tokens]);
  const [selected, setSelected] = useState<string | null>(null);
  const [placed, setPlaced] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [firstFeedback, setFirstFeedback] = useState<AnswerFeedback | null>(null);
  const [wrongOptions, setWrongOptions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const [comfort] = useState(() => COMFORT[Math.floor(Math.random() * COMFORT.length)]);

  const isOrder = card.kind === "sentence_order";
  const answer = isOrder ? placed.map((id) => tokens[id].text).join(" ") : selected;
  const ready = isOrder ? placed.length === tokens.length : Boolean(selected);
  const locked = Boolean(feedback);

  async function check() {
    if (!answer || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await submit(answer);
      setFeedback(result);
      if (result.correct) sfx.correct();
      else sfx.wrong();
      if (!firstFeedback) setFirstFeedback(result);
      if (!result.correct && selected) setWrongOptions((w) => [...w, selected]);
    } catch (e) {
      setError(friendlyError(e).en);
    } finally {
      setPending(false);
    }
  }

  function retry() {
    setFeedback(null);
    setSelected(null);
    if (isOrder) setPlaced([]);
  }

  function finish() {
    onDone({ firstTryCorrect: Boolean(firstFeedback?.correct), feedback: feedback ?? firstFeedback! });
  }

  const shownCorrect = feedback?.correct ? feedback.correctAnswer : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-lavender-400">
          {card.level} · {card.kind === "listening" ? "Listening" : card.kind === "sentence_order" ? "Build the sentence" : "Choose the answer"}
        </p>
        <h2 className="mt-1 text-2xl font-semibold leading-snug text-plum-700 sm:text-3xl">{card.prompt}</h2>
        {card.prompt_vi ? <Vi className="mt-1 text-base">{card.prompt_vi}</Vi> : null}
      </div>

      {card.kind === "listening" && card.audio_text ? <ListeningPlayer text={card.audio_text} lang={speechLang(card.language)} /> : null}

      {isOrder ? (
        <>
          <SentenceBuilder tokens={tokens} placed={placed} onChange={setPlaced} disabled={locked} state={feedback ? (feedback.correct ? "correct" : "incorrect") : null} />
          {card.hint ? (
            <div className="flex flex-col items-start gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowHint((s) => !s)} aria-expanded={showHint}>
                <Lightbulb size={16} /> {showHint ? "Hide hint" : "Need a hint?"}
              </Button>
              {showHint ? (
                <p className="rounded-2xl bg-gold-200/60 px-4 py-2 text-sm">
                  {card.hint}
                  {card.hint_vi ? <Vi className="text-xs">{card.hint_vi}</Vi> : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Answer choices">
          {options.map((option, i) => {
            const isSelected = selected === option;
            const isRight = shownCorrect === option;
            const isWrong = wrongOptions.includes(option);
            return (
              <motion.button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={option}
                disabled={locked || isWrong}
                onClick={() => setSelected(option)}
                whileTap={{ scale: 0.97 }}
                animate={feedback && isSelected && !feedback.correct ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-semibold ring-2 transition-colors",
                  isRight || (feedback?.correct && isSelected)
                    ? "bg-mint-100 text-mint-600 ring-mint-400"
                    : isWrong
                      ? "bg-sakura-50 text-cocoa-400 line-through ring-sakura-200"
                      : isSelected
                        ? "bg-lavender-100 ring-lavender-300"
                        : "bg-white/85 ring-white hover:ring-lavender-200",
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/90 font-display text-sm text-lavender-400">{String.fromCharCode(65 + i)}</span>
                <span>{option}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {error ? <p role="alert" className="text-sm text-rose-err">{error}</p> : null}

      <AnimatePresence mode="wait">
        {feedback ? (
          <motion.div
            key={`${feedback.correct}-${feedback.attemptNo}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
            className={cn("flex flex-col gap-3 rounded-3xl p-4 ring-2", feedback.correct ? "bg-mint-100 ring-mint-200" : "bg-peach-100 ring-peach-200")}
          >
            <p className="font-display text-xl font-semibold">{feedback.correct ? praise : comfort}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-lavender-400">Goal: {card.objective}</p>
            {!feedback.correct ? (
              <p>
                Correct answer: <b className="text-mint-600">{displayAnswer(feedback.correctAnswer, card.language)}</b>
                {feedback.acceptedAnswers && feedback.acceptedAnswers.length > 1 ? (
                  <span className="block text-xs text-cocoa-400">
                    Also accepted: {feedback.acceptedAnswers.slice(1).map((a) => displayAnswer(a, card.language)).join(" · ")}
                  </span>
                ) : null}
              </p>
            ) : null}
            <p>{feedback.explanation}</p>
            <Vi>{feedback.explanationVi}</Vi>
            {feedback.word ? <WordCard word={feedback.word} showRecorder={feedback.correct} /> : null}
            {card.kind === "listening" && card.audio_text ? <p className="text-sm text-plum-500">Transcript: “{card.audio_text}”</p> : null}
            <div className="flex flex-wrap gap-2">
              {!feedback.correct ? (
                <Button variant="soft" onClick={retry}>
                  <RotateCcw size={16} /> {t("learn.tryAgain")}
                </Button>
              ) : null}
              <Button variant={feedback.correct ? "mint" : "primary"} onClick={finish} autoFocus>
                {continueLabel}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button size="lg" className="w-full sm:w-auto" disabled={!ready} loading={pending} onClick={check}>
              {t("learn.check")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
