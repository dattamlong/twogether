import type { Difficulty } from "./bot";
import { TICK_RATE } from "./court";
import { createMatch, step, type Input, type Match } from "./sim";

export const MAX_MATCH_TICKS = TICK_RATE * 60 * 20;
const AXIS_LEVELS = 4;

const quantize = (v: number) => Math.max(-AXIS_LEVELS, Math.min(AXIS_LEVELS, Math.round(v * AXIS_LEVELS)));

export function encodeInput(input: Input) {
  const bits = (input.hit ? 1 : 0) | (input.smash ? 2 : 0) | (input.drop ? 4 : 0) | (input.lunge ? 8 : 0);
  return quantize(input.mx) + AXIS_LEVELS + 9 * (quantize(input.my) + AXIS_LEVELS) + 81 * bits;
}

export function decodeInput(code: number): Input {
  const bits = Math.floor(code / 81);
  const rest = code % 81;
  const mx = ((rest % 9) - AXIS_LEVELS) / AXIS_LEVELS;
  const my = (Math.floor(rest / 9) - AXIS_LEVELS) / AXIS_LEVELS;
  const input: Input = { mx, my };
  if (bits & 1) input.hit = true;
  if (bits & 2) input.smash = true;
  if (bits & 4) input.drop = true;
  if (bits & 8) input.lunge = true;
  return input;
}

export class InputRecorder {
  private runs: number[] = [];
  private last = -1;
  private count = 0;
  ticks = 0;

  record(input: Input) {
    const code = encodeInput(input);
    this.ticks++;
    if (code === this.last) {
      this.count++;
      return decodeInput(code);
    }
    this.flush();
    this.last = code;
    this.count = 1;
    return decodeInput(code);
  }

  private flush() {
    if (this.count > 0) this.runs.push(this.last, this.count);
  }

  toLog() {
    const out = [...this.runs];
    if (this.count > 0) out.push(this.last, this.count);
    return out;
  }
}

export type ReplayResult =
  | { ok: true; match: Match; ticks: number }
  | { ok: false; reason: "invalid_log" | "too_long" | "unfinished" };

export function replayMatch(seed: number, difficulty: Difficulty, log: unknown): ReplayResult {
  if (!Array.isArray(log) || log.length % 2 !== 0) return { ok: false, reason: "invalid_log" };
  let total = 0;
  for (let i = 0; i < log.length; i += 2) {
    const code = log[i];
    const count = log[i + 1];
    if (!Number.isInteger(code) || code < 0 || code >= 81 * 16 || !Number.isInteger(count) || count < 1) return { ok: false, reason: "invalid_log" };
    total += count;
    if (total > MAX_MATCH_TICKS) return { ok: false, reason: "too_long" };
  }
  const match = createMatch({ seed, difficulty });
  let ticks = 0;
  const done = () => match.winner !== null;
  for (let i = 0; i < log.length && !done(); i += 2) {
    const input = decodeInput(log[i] as number);
    for (let n = 0; n < (log[i + 1] as number) && !done(); n++) {
      step(match, input);
      ticks++;
    }
  }
  if (match.winner === null) return { ok: false, reason: "unfinished" };
  return { ok: true, match, ticks };
}
