"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SparkleIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ProgressBar } from "@/components/ui/progress-bar";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { submitAnswer, useReviewQueue } from "@/features/learning/queries";
import { useInvalidateProgress } from "@/features/progression/queries";
import { qk } from "@/features/query-keys";
import { QuestionView } from "./question-view";

export function ReviewSession() {
  const client = useQueryClient();
  const invalidate = useInvalidateProgress();
  const queue = useReviewQueue(true);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (queue.isLoading) return <LoadingBlock />;
  if (queue.error) return <ErrorBlock error={queue.error} onRetry={() => queue.refetch()} />;
  const cards = queue.data ?? [];

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Nothing to review right now"
        vi="Hiện chưa có gì để ôn — hãy học bài mới nhé"
        art={<SparkleIcon size={48} />}
        action={
          <Button asChild className="mt-2">
            <Link href="/learn">Find a lesson</Link>
          </Button>
        }
      />
    );
  }

  if (done) {
    return (
      <Panel className="mx-auto flex max-w-lg flex-col items-center gap-3 text-center">
        <SparkleIcon size={72} />
        <h1 className="text-3xl font-bold">Review done!</h1>
        <p className="text-plum-500">
          {correct}/{cards.length} remembered. Items you missed will come back sooner; the ones you knew will wait longer.
        </p>
        <Vi>Từ bạn quên sẽ quay lại sớm hơn, từ bạn nhớ sẽ được giãn cách lâu hơn.</Vi>
        <div className="flex w-full gap-2">
          <Button
            variant="soft"
            className="flex-1"
            onClick={() => {
              setIndex(0);
              setCorrect(0);
              setDone(false);
              client.removeQueries({ queryKey: qk.reviewQueue });
              void queue.refetch();
            }}
          >
            Review more
          </Button>
          <Button asChild className="flex-1">
            <Link href="/home">Go home</Link>
          </Button>
        </div>
      </Panel>
    );
  }

  const card = cards[index];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <SparkleIcon size={28} />
        <ProgressBar value={index} max={cards.length} tone="lavender" label="Review progress" className="h-4" />
        <span className="font-display text-sm font-bold tabular-nums text-cocoa-400">
          {index + 1}/{cards.length}
        </span>
      </div>
      <Panel>
        <AnimatePresence mode="wait">
          <motion.div key={card.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}>
            <QuestionView
              card={card}
              submit={(answer) => submitAnswer({ question: card.id!, answer, review: true })}
              continueLabel={index === cards.length - 1 ? "Finish" : "Next"}
              onDone={({ firstTryCorrect }) => {
                if (firstTryCorrect) setCorrect((c) => c + 1);
                if (index === cards.length - 1) {
                  setDone(true);
                  client.invalidateQueries({ queryKey: [...qk.reviewQueue, "stats"] });
                  void invalidate();
                } else setIndex((i) => i + 1);
              }}
            />
          </motion.div>
        </AnimatePresence>
      </Panel>
    </div>
  );
}
