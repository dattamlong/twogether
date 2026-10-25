import { playDrum, playNote, type DrumId, type InstrumentId, type Output } from "./instruments";

export type ScaleName = "major" | "minor" | "dorian" | "mixolydian" | "lydian";
export type Section = "intro" | "a" | "a2" | "break";

export type Layer =
  | { kind: "chords"; inst: InstrumentId; rhythm: string; center: number; velocity?: number; sections?: Section[] }
  | { kind: "arp"; inst: InstrumentId; pattern: string; center: number; velocity?: number; step?: number; sections?: Section[] }
  | { kind: "bass"; inst: InstrumentId; pattern: string; base?: number; velocity?: number; sections?: Section[] }
  | { kind: "drums"; kit: Partial<Record<DrumId, string>>; velocity?: number; tuning?: number; sections?: Section[] }
  | { kind: "crackle"; density: number; sections?: Section[] };

export type Melody = { inst: InstrumentId; notes: string; octave?: number; velocity?: number; alt?: { inst: InstrumentId; octave?: number } };

export type Song = {
  id: string;
  bpm: number;
  key: number;
  scale: ScaleName;
  swing?: number;
  chords: string[];
  layers: Layer[];
  melody: Melody;
  form?: Section[];
  gain?: number;
};

export const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export const DEFAULT_FORM: Section[] = ["intro", "a", "a2", "break", "a", "a2"];
const STEPS_PER_BAR = 8;
const ROMAN = ["vii", "vi", "v", "iv", "iii", "ii", "i"];
const ROMAN_DEGREE: Record<string, number> = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };

export type Chord = { root: number; intervals: number[] };

export function parseChord(symbol: string): Chord {
  const match = /^(b|#)?([ivIV]+)(.*)$/.exec(symbol);
  if (!match) throw new Error(`bad chord ${symbol}`);
  const [, accidental, numeral, suffix] = match;
  const lower = numeral.toLowerCase();
  if (!ROMAN.includes(lower)) throw new Error(`bad chord ${symbol}`);
  const root = ROMAN_DEGREE[lower] + (accidental === "b" ? -1 : accidental === "#" ? 1 : 0);
  const minor = numeral === lower;
  let intervals = minor ? [0, 3, 7] : [0, 4, 7];
  switch (suffix) {
    case "":
      break;
    case "maj7":
      intervals = [...intervals, 11];
      break;
    case "7":
      intervals = [...intervals, 10];
      break;
    case "6":
      intervals = [...intervals, 9];
      break;
    case "add9":
      intervals = [...intervals, 14];
      break;
    case "9":
      intervals = [...intervals, 10, 14];
      break;
    case "maj9":
      intervals = [...intervals, 11, 14];
      break;
    case "sus4":
      intervals = [0, 5, 7];
      break;
    case "sus2":
      intervals = [0, 2, 7];
      break;
    case "7sus4":
      intervals = [0, 5, 7, 10];
      break;
    case "dim":
      intervals = [0, 3, 6];
      break;
    default:
      throw new Error(`bad chord ${symbol}`);
  }
  return { root: (root + 12) % 12, intervals };
}

export function voice(key: number, chord: Chord, center: number) {
  const tones = chord.intervals.map((i) => {
    let n = key + chord.root + i;
    while (n < center - 6) n += 12;
    while (n >= center + 6) n -= 12;
    return n;
  });
  return [...new Set(tones)].sort((a, b) => a - b);
}

export type MelodyStep = { kind: "note"; midi: number } | { kind: "hold" } | { kind: "rest" };

export function parseMelody(notes: string, key: number, scale: ScaleName): MelodyStep[] {
  return notes
    .replace(/\|/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token): MelodyStep => {
      if (token === "-") return { kind: "hold" };
      if (token === ".") return { kind: "rest" };
      const m = /^(b|#)?([1-7])([',]*)$/.exec(token);
      if (!m) throw new Error(`bad melody token ${token}`);
      const [, accidental, degree, marks] = m;
      let midi = key + SCALES[scale][Number(degree) - 1] + (accidental === "b" ? -1 : accidental === "#" ? 1 : 0);
      for (const mark of marks) midi += mark === "'" ? 12 : -12;
      return { kind: "note", midi };
    });
}

type Hit = { at: number; dur: number; velocity: number };

export function rhythmHits(pattern: string, stepBeats: number): Hit[] {
  const steps = pattern.replace(/\s+/g, "").split("");
  const hits: Hit[] = [];
  steps.forEach((s, i) => {
    if (s === "x" || s === "o") {
      let len = 1;
      while (steps[i + len] === "-") len++;
      hits.push({ at: i * stepBeats, dur: len * stepBeats, velocity: s === "o" ? 0.55 : 1 });
    }
  });
  return hits;
}

function bassTone(token: string, chord: Chord, root: number) {
  const third = chord.intervals[1] ?? 4;
  const fifth = chord.intervals.find((i) => i === 7 || i === 6) ?? 7;
  const seventh = chord.intervals[3] ?? 10;
  switch (token) {
    case "R":
      return root;
    case "3":
      return root + third;
    case "5":
      return root + fifth;
    case "5,":
      return root + fifth - 12;
    case "7":
      return root + seventh;
    case "8":
      return root + 12;
    default:
      return null;
  }
}

export function validateSong(song: Song) {
  const steps = parseMelody(song.melody.notes, song.key, song.scale);
  if (steps.length !== song.chords.length * STEPS_PER_BAR) throw new Error(`${song.id}: melody has ${steps.length} steps, expected ${song.chords.length * STEPS_PER_BAR}`);
  song.chords.forEach(parseChord);
  for (const layer of song.layers) {
    if (layer.kind === "chords" && layer.rhythm.replace(/\s+/g, "").length !== STEPS_PER_BAR) throw new Error(`${song.id}: chord rhythm must have 8 steps`);
    if (layer.kind === "bass" && layer.pattern.trim().split(/\s+/).length !== STEPS_PER_BAR) throw new Error(`${song.id}: bass pattern must have 8 steps`);
    if (layer.kind === "drums") for (const [piece, p] of Object.entries(layer.kit)) if (p.length !== 16) throw new Error(`${song.id}: ${piece} pattern must have 16 steps`);
  }
  return true;
}

const humanize = (amount: number) => (Math.random() - 0.5) * amount;

export class SongPlayer {
  private readonly beat: number;
  private readonly chords: Chord[];
  private readonly melody: MelodyStep[];
  private readonly form: Section[];
  private bar = 0;
  private nextBarTime = 0;
  private ended = false;
  stopped = false;

  constructor(
    private readonly out: Output,
    readonly song: Song,
    private readonly onFormEnd: () => void,
    startAt: number,
  ) {
    this.beat = 60 / song.bpm;
    this.chords = song.chords.map(parseChord);
    this.melody = parseMelody(song.melody.notes, song.key, song.scale);
    this.form = song.form ?? DEFAULT_FORM;
    this.nextBarTime = startAt;
  }

  get barSeconds() {
    return this.beat * 4;
  }

  tick(now: number, lookahead: number) {
    if (this.stopped) return;
    if (this.nextBarTime < now - this.barSeconds) {
      const skipped = Math.ceil((now - this.nextBarTime) / this.barSeconds);
      this.bar += skipped;
      this.nextBarTime += skipped * this.barSeconds;
    }
    while (this.nextBarTime < now + lookahead) {
      this.scheduleBar(this.bar, this.nextBarTime);
      this.bar++;
      this.nextBarTime += this.barSeconds;
    }
  }

  private section(bar: number): Section {
    const index = Math.floor(bar / this.chords.length);
    if (index >= this.form.length && !this.ended) {
      this.ended = true;
      queueMicrotask(this.onFormEnd);
    }
    const looped = index < this.form.length ? index : 1 + ((index - this.form.length) % (this.form.length - 1));
    return this.form[looped];
  }

  private swingOffset(atBeats: number) {
    const swing = this.song.swing ?? 0;
    const eighth = Math.round(atBeats * 2);
    return Math.abs(atBeats * 2 - eighth) < 0.01 && eighth % 2 === 1 ? swing * this.beat * 0.17 : 0;
  }

  private time(barStart: number, atBeats: number) {
    return barStart + atBeats * this.beat + this.swingOffset(atBeats);
  }

  private scheduleBar(bar: number, start: number) {
    const section = this.section(bar);
    const index = bar % this.chords.length;
    const chord = this.chords[index];
    const key = this.song.key;
    const sectionGain = section === "intro" ? 0.85 : section === "break" ? 0.8 : 1;

    for (const layer of this.song.layers) {
      if (layer.sections && !layer.sections.includes(section)) continue;
      if (!layer.sections && layer.kind === "drums" && (section === "intro" || section === "break")) continue;
      const vel = ("velocity" in layer ? (layer.velocity ?? 1) : 1) * sectionGain;
      switch (layer.kind) {
        case "chords": {
          const tones = voice(key, chord, layer.center);
          for (const hit of rhythmHits(layer.rhythm, 0.5)) {
            tones.forEach((midi, i) => {
              playNote(this.out, layer.inst, midi, this.time(start, hit.at) + i * 0.008 + humanize(0.01), hit.dur * this.beat * 0.98, vel * hit.velocity * (0.9 + humanize(0.12)), (i - tones.length / 2) * 0.12);
            });
          }
          break;
        }
        case "arp": {
          const tones = voice(key, chord, layer.center);
          const step = layer.step ?? 0.5;
          layer.pattern.split(/\s+/).forEach((token, i) => {
            if (token === "." || token === "-") return;
            const n = Number(token);
            const midi = tones[n % tones.length] + 12 * Math.floor(n / tones.length);
            playNote(this.out, layer.inst, midi, this.time(start, i * step) + humanize(0.008), step * this.beat * 1.6, vel * (i % 2 === 0 ? 1 : 0.8) * (0.92 + humanize(0.1)), i % 2 === 0 ? -0.2 : 0.2);
          });
          break;
        }
        case "bass": {
          let root = key + chord.root;
          const base = layer.base ?? 36;
          while (root < base) root += 12;
          while (root >= base + 12) root -= 12;
          const tokens = layer.pattern.trim().split(/\s+/);
          tokens.forEach((token, i) => {
            const midi = bassTone(token, chord, root);
            if (midi === null) return;
            let len = 1;
            while (tokens[i + len] === "-") len++;
            playNote(this.out, layer.inst, midi, this.time(start, i * 0.5), len * 0.5 * this.beat * 0.95, vel * (0.95 + humanize(0.08)));
          });
          break;
        }
        case "drums": {
          for (const [piece, pattern] of Object.entries(layer.kit) as [DrumId, string][]) {
            for (let i = 0; i < 16; i++) {
              const c = pattern[i];
              if (c !== "x" && c !== "o") continue;
              const at = i * 0.25;
              playDrum(this.out, piece, this.time(start, at) + humanize(0.006), vel * (c === "o" ? 0.55 : 1) * (0.9 + humanize(0.15)), layer.tuning ?? key - 24);
            }
          }
          break;
        }
        case "crackle": {
          const count = Math.round(layer.density * (0.6 + Math.random() * 0.8));
          for (let i = 0; i < count; i++) playDrum(this.out, "crackle", start + Math.random() * this.barSeconds, 0.4 + Math.random() * 0.8);
          break;
        }
      }
    }

    if (section === "a" || section === "a2") {
      const m = this.song.melody;
      const alt = section === "a2" && m.alt;
      const inst = alt ? m.alt!.inst : m.inst;
      const octave = (alt ? (m.alt!.octave ?? m.octave) : m.octave) ?? 0;
      for (let s = 0; s < STEPS_PER_BAR; s++) {
        const step = this.melody[index * STEPS_PER_BAR + s];
        if (step.kind !== "note") continue;
        let len = 1;
        const flat = index * STEPS_PER_BAR + s;
        while (this.melody[flat + len]?.kind === "hold") len++;
        playNote(this.out, inst, step.midi + octave * 12, this.time(start, s * 0.5) + humanize(0.01), len * 0.5 * this.beat * 0.96, (m.velocity ?? 1) * (0.9 + humanize(0.12)), 0.05);
      }
    }
  }
}
