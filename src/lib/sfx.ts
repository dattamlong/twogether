"use client";

type Note = { freq: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const STORAGE_KEY = "twogether:sfx";
let context: AudioContext | null = null;

export function soundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    return;
  }
}

function play(notes: Note[]) {
  if (typeof window === "undefined" || !soundEnabled() || document.hidden) return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const now = context.currentTime;
    for (const n of notes) {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = n.type ?? "sine";
      osc.frequency.value = n.freq;
      const start = now + n.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(n.gain ?? 0.08, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain).connect(context.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.02);
    }
  } catch {
    return;
  }
}

export const sfx = {
  correct: () => play([{ freq: 784, at: 0, dur: 0.18 }, { freq: 1175, at: 0.09, dur: 0.26 }]),
  wrong: () => play([{ freq: 330, at: 0, dur: 0.22, type: "triangle", gain: 0.06 }, { freq: 262, at: 0.1, dur: 0.28, type: "triangle", gain: 0.05 }]),
  coin: () => play([{ freq: 1319, at: 0, dur: 0.1, type: "square", gain: 0.03 }, { freq: 1760, at: 0.07, dur: 0.22, type: "square", gain: 0.03 }]),
  levelUp: () => play([523, 659, 784, 1047].map((freq, i) => ({ freq, at: i * 0.09, dur: 0.3, type: "triangle" as const, gain: 0.07 }))),
  hit: () => play([{ freq: 220, at: 0, dur: 0.12, type: "square", gain: 0.04 }, { freq: 660, at: 0.03, dur: 0.15, gain: 0.06 }]),
  pop: () => play([{ freq: 660, at: 0, dur: 0.08, gain: 0.05 }]),
  love: () => play([{ freq: 880, at: 0, dur: 0.2 }, { freq: 1109, at: 0.08, dur: 0.24 }, { freq: 1319, at: 0.16, dur: 0.3 }]),
};
