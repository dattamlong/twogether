"use client";

import type { WordCard as Word } from "@/features/learning/types";
import { RecordYourself, SpeakButton } from "./audio-controls";

export function WordCard({ word, showRecorder = true }: { word: Word; showRecorder?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-3xl bg-gradient-to-br from-lavender-100 to-sakura-50 p-4 ring-2 ring-white">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-2xl font-bold text-plum-700">{word.term}</p>
        <p className="font-mono text-sm text-plum-500">{word.ipa}</p>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-lavender-400">{word.part_of_speech}</span>
      </div>
      <p lang="vi" className="text-plum-500">{word.meaning_vi}</p>
      <div className="rounded-2xl bg-white/80 p-3">
        <p className="font-medium">“{word.example}”</p>
        <p lang="vi" className="text-sm text-cocoa-400">{word.example_vi}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <SpeakButton text={word.term} label="Word" />
        <SpeakButton text={word.example} label="Sentence" />
        <SpeakButton text={word.example} label="Slow" slow />
      </div>
      {showRecorder ? <RecordYourself prompt={word.example} /> : null}
    </div>
  );
}
