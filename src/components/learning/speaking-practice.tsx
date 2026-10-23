"use client";

import { useState } from "react";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { useWordBank } from "@/features/learning/queries";
import type { WordCard } from "@/features/learning/types";
import { cn } from "@/lib/utils";
import { RecordYourself, SpeakButton } from "./audio-controls";

const STARTER_PHRASES = [
  { en: "I miss you so much.", vi: "Anh/Em nhớ em/anh nhiều lắm." },
  { en: "How was your day?", vi: "Hôm nay của bạn thế nào?" },
  { en: "I can't wait to see you again.", vi: "Mình mong được gặp lại bạn quá." },
  { en: "Let's video call tonight.", vi: "Tối nay mình gọi video nhé." },
  { en: "I'm proud of you.", vi: "Mình tự hào về bạn." },
  { en: "Sleep well and sweet dreams.", vi: "Ngủ ngon và mơ đẹp nhé." },
  { en: "Thank you for always being there for me.", vi: "Cảm ơn vì luôn ở bên mình." },
  { en: "What time is it there?", vi: "Ở đó bây giờ là mấy giờ?" },
];

export function SpeakingPractice() {
  const words = useWordBank();
  const learned = (words.data ?? []).map((w) => w.word as unknown as WordCard).filter(Boolean).slice(0, 12);
  const items = [...STARTER_PHRASES, ...learned.map((w) => ({ en: w.example, vi: w.example_vi }))];
  const [index, setIndex] = useState(0);
  const current = items[index] ?? STARTER_PHRASES[0];

  return (
    <Panel>
      <PanelTitle title="Speaking practice" subtitle="Luyện nói: nghe mẫu, nói theo, rồi nghe lại giọng của bạn" />
      <p className="mb-4 rounded-2xl bg-sky-100 px-4 py-2 text-sm text-plum-500">
        Listen to the computer voice, repeat out loud, and record yourself to compare. Automatic pronunciation scoring isn&apos;t available yet.
      </p>
      <div className="flex flex-col gap-3 rounded-3xl bg-white/70 p-5 ring-2 ring-white">
        <p className="font-display text-2xl font-semibold">“{current.en}”</p>
        <Vi>{current.vi}</Vi>
        <div className="flex flex-wrap gap-2">
          <SpeakButton text={current.en} label="Listen" />
          <SpeakButton text={current.en} label="Slow" slow />
        </div>
        <RecordYourself key={current.en} prompt={current.en} />
      </div>
      <ul className="mt-4 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li key={`${item.en}-${i}`}>
            <button
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              className={cn("rounded-2xl px-3 py-1.5 text-left text-sm ring-2", i === index ? "bg-peach-100 ring-peach-400" : "bg-white/80 ring-white hover:ring-peach-200")}
            >
              {item.en}
            </button>
          </li>
        ))}
      </ul>
      {learned.length === 0 ? <p className="mt-3 text-xs text-cocoa-400">Words you learn in vocabulary lessons will appear here too.</p> : null}
    </Panel>
  );
}
