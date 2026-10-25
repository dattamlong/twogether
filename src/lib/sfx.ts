"use client";

import { getBuses } from "@/features/audio/core";
import { playDrum, playNote, type DrumId, type InstrumentId, type Output } from "@/features/audio/instruments";
import { useAudioSettings } from "@/features/audio/store";

type Step = [InstrumentId | DrumId, number, number, number?, number?];

const DRUMS = new Set<string>(["kick", "snare", "hat", "openhat", "shaker", "timpani", "crackle", "clap"]);

export function soundEnabled() {
  return useAudioSettings.getState().sfxOn;
}

export function setSoundEnabled(enabled: boolean) {
  useAudioSettings.getState().set({ sfxOn: enabled });
}

function output(): Output | null {
  if (typeof window === "undefined" || !soundEnabled() || document.hidden) return null;
  const b = getBuses();
  if (!b) return null;
  if (b.ctx.state === "suspended") void b.ctx.resume().catch(() => undefined);
  return { ctx: b.ctx, out: b.sfx, reverb: b.reverb, noise: b.noise };
}

function play(steps: Step[]) {
  const o = output();
  if (!o) return;
  try {
    const now = o.ctx.currentTime + 0.01;
    for (const [inst, midi, at, dur = 0.3, velocity = 1] of steps) {
      if (DRUMS.has(inst)) playDrum(o, inst as DrumId, now + at, velocity, midi);
      else playNote(o, inst as InstrumentId, midi, now + at, dur, velocity, 0);
    }
  } catch {
    return;
  }
}

const sparkle = (from: number, start: number, count: number, gap = 0.05): Step[] =>
  Array.from({ length: count }, (_, i) => ["bell", from + [0, 4, 7, 12, 16, 19, 24][i % 7], start + i * gap, 0.4, 0.55] as Step);

export const sfx = {
  correct: () => play([["bell", 88, 0, 0.3, 0.9], ["bell", 95, 0.08, 0.5, 0.8]]),
  wrong: () => play([["epiano", 64, 0, 0.25, 0.7], ["epiano", 60, 0.12, 0.4, 0.6]]),
  coin: () => play([["bell", 95, 0, 0.12, 0.7], ["bell", 100, 0.07, 0.35, 0.7]]),
  levelUp: () => play([["piano", 72, 0, 0.3], ["piano", 76, 0.09, 0.3], ["piano", 79, 0.18, 0.3], ["piano", 84, 0.27, 0.7], ...sparkle(96, 0.36, 5)]),
  lessonComplete: () => play([["bell", 79, 0, 0.2], ["bell", 84, 0.12, 0.2], ["bell", 88, 0.24, 0.2], ["bell", 91, 0.36, 0.7], ["pad", 60, 0.36, 0.8, 0.7], ["pad", 64, 0.36, 0.8, 0.7], ["pad", 67, 0.36, 0.8, 0.7]]),
  hit: () => play([["kick", 0, 0, 0.1, 0.6], ["pluck", 76, 0.02, 0.15, 0.7]]),
  pop: () => play([["bell", 84, 0, 0.12, 0.5]]),
  click: () => play([["hat", 0, 0, 0.03, 0.6]]),
  tick: () => play([["pluck", 91, 0, 0.05, 0.35]]),
  love: () => play([["bell", 81, 0, 0.2, 0.8], ["bell", 85, 0.08, 0.25, 0.8], ["bell", 88, 0.16, 0.4, 0.8]]),
  pingSent: () => play([["harp", 76, 0, 0.3, 0.7], ["harp", 81, 0.07, 0.3, 0.7], ...sparkle(88, 0.14, 4, 0.06)]),
  gift: () => play([...[72, 76, 79, 84, 88, 91].map((m, i) => ["harp", m, i * 0.045, 0.5, 0.7] as Step), ["bell", 96, 0.3, 0.8, 0.7]]),
  rare: () => play([...sparkle(84, 0, 7, 0.07), ["pad", 72, 0.1, 1.2, 0.8], ["pad", 76, 0.1, 1.2, 0.8], ["pad", 79, 0.1, 1.2, 0.8], ["bell", 103, 0.55, 1, 0.6]]),
  place: () => play([["kick", 0, 0, 0.1, 0.35], ["pluck", 67, 0.01, 0.12, 0.6]]),
  interact: () => play([["musicbox", 79, 0, 0.15, 0.7], ["musicbox", 84, 0.07, 0.25, 0.7]]),
  victory: () => play([["square", 72, 0, 0.12], ["square", 76, 0.12, 0.12], ["square", 79, 0.24, 0.12], ["square", 84, 0.36, 0.5], ["bell", 88, 0.36, 0.6, 0.6], ["clap", 0, 0.36, 0.1, 0.6]]),
  defeat: () => play([["epiano", 67, 0, 0.3, 0.7], ["epiano", 64, 0.18, 0.3, 0.65], ["epiano", 60, 0.36, 0.7, 0.6]]),
  rankUp: () => play([["bell", 79, 0, 0.2], ["bell", 84, 0.1, 0.2], ["bell", 88, 0.2, 0.6], ...sparkle(96, 0.3, 3)]),
  personalBest: () => play([["brass", 72, 0, 0.18, 0.9], ["brass", 76, 0.15, 0.18, 0.9], ["brass", 79, 0.3, 0.6, 0.9], ["timpani", 48, 0.3, 0.6, 0.7], ...sparkle(91, 0.45, 6)]),
  reunion: () => play([["piano", 60, 0, 1.2, 0.6], ["piano", 64, 0.08, 1.1, 0.6], ["piano", 67, 0.16, 1, 0.6], ["piano", 71, 0.24, 1, 0.6], ["bell", 88, 0.4, 0.8, 0.6], ["bell", 91, 0.55, 0.9, 0.55]]),
};
