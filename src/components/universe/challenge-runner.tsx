"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { QuestionView } from "@/components/learning/question-view";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { submitAnswer } from "@/features/learning/queries";
import type { QuestionCard } from "@/features/learning/types";
import { friendlyError } from "@/lib/errors";

export function ChallengeRunner({
  sessionId,
  questions,
  onLeave,
  onFinish,
  header,
  finishing,
  error,
}: {
  sessionId: string;
  questions: QuestionCard[];
  onLeave: () => void;
  onFinish: () => void;
  header?: (state: { index: number; correct: number; wrong: number }) => ReactNode;
  finishing?: boolean;
  error?: unknown;
}) {
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const answered = useRef(new Set<string>());
  const card = questions[index];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Leave challenge"
          onClick={() => {
            if (window.confirm("Leave this challenge? You can try again any time.")) onLeave();
          }}
        >
          <X />
        </Button>
        <ProgressBar value={index} max={questions.length} label="Challenge progress" className="h-4" />
        <span className="font-display text-sm font-bold tabular-nums text-cocoa-400">
          {Math.min(index + 1, questions.length)}/{questions.length}
        </span>
      </div>
      {header?.({ index, correct, wrong })}
      <Panel>
        <AnimatePresence mode="wait">
          {card ? (
            <motion.div key={card.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
              <QuestionView
                card={card}
                submit={async (answer) => {
                  const feedback = await submitAnswer({ question: card.id!, answer, gameSession: sessionId });
                  if (!answered.current.has(card.id!)) {
                    answered.current.add(card.id!);
                    if (feedback.correct) setCorrect((c) => c + 1);
                    else setWrong((w) => w + 1);
                  }
                  return feedback;
                }}
                continueLabel={index === questions.length - 1 ? "Finish" : "Continue"}
                onDone={() => {
                  if (index === questions.length - 1) onFinish();
                  else setIndex((i) => i + 1);
                }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        {finishing ? (
          <p className="mt-4 text-center text-sm text-cocoa-400" role="status">
            Checking your results…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose-err">
            {friendlyError(error).en}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
