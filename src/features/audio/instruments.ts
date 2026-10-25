export type Output = { ctx: BaseAudioContext; out: AudioNode; reverb: AudioNode; noise: AudioBuffer };

export type InstrumentId =
  | "piano"
  | "epiano"
  | "pad"
  | "strings"
  | "pluck"
  | "harp"
  | "bell"
  | "musicbox"
  | "flute"
  | "square"
  | "pulse"
  | "bass"
  | "subbass"
  | "brass";

export type DrumId = "kick" | "snare" | "hat" | "openhat" | "shaker" | "timpani" | "crackle" | "clap";

type Partial_ = { type: OscillatorType; ratio: number; gain: number; detune?: number };
type Spec = {
  partials: Partial_[];
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  peak: number;
  filter?: { type: BiquadFilterType; from: number; to: number; time: number; q?: number; track?: boolean };
  vibrato?: { rate: number; depth: number; delay: number };
  send: number;
};

const SPECS: Record<InstrumentId, Spec> = {
  piano: {
    partials: [
      { type: "triangle", ratio: 1, gain: 0.7 },
      { type: "sine", ratio: 1, gain: 0.5, detune: 4 },
      { type: "sine", ratio: 2, gain: 0.18 },
      { type: "sine", ratio: 3, gain: 0.05 },
    ],
    attack: 0.004,
    decay: 0.9,
    sustain: 0.18,
    release: 0.7,
    peak: 0.32,
    filter: { type: "lowpass", from: 9, to: 2.6, time: 0.5, q: 0.4, track: true },
    send: 0.32,
  },
  epiano: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.85 },
      { type: "sine", ratio: 2, gain: 0.12, detune: -3 },
      { type: "sine", ratio: 7, gain: 0.035 },
    ],
    attack: 0.006,
    decay: 1.3,
    sustain: 0.25,
    release: 0.6,
    peak: 0.3,
    vibrato: { rate: 4.6, depth: 3, delay: 0.05 },
    send: 0.26,
  },
  pad: {
    partials: [
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: -7 },
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: 7 },
      { type: "sine", ratio: 0.5, gain: 0.25 },
    ],
    attack: 0.9,
    decay: 1.5,
    sustain: 0.8,
    release: 1.6,
    peak: 0.085,
    filter: { type: "lowpass", from: 700, to: 1100, time: 2, q: 0.6 },
    send: 0.5,
  },
  strings: {
    partials: [
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: -9 },
      { type: "sawtooth", ratio: 1, gain: 0.3, detune: 5 },
      { type: "sawtooth", ratio: 1, gain: 0.25, detune: 12 },
    ],
    attack: 0.35,
    decay: 1,
    sustain: 0.85,
    release: 0.9,
    peak: 0.075,
    filter: { type: "lowpass", from: 1400, to: 2200, time: 0.8, q: 0.5 },
    vibrato: { rate: 5.2, depth: 6, delay: 0.3 },
    send: 0.55,
  },
  pluck: {
    partials: [
      { type: "sawtooth", ratio: 1, gain: 0.45 },
      { type: "triangle", ratio: 1, gain: 0.5, detune: 3 },
    ],
    attack: 0.003,
    decay: 0.45,
    sustain: 0.05,
    release: 0.35,
    peak: 0.24,
    filter: { type: "lowpass", from: 10, to: 1.6, time: 0.18, q: 1.2, track: true },
    send: 0.3,
  },
  harp: {
    partials: [
      { type: "triangle", ratio: 1, gain: 0.8 },
      { type: "sine", ratio: 2, gain: 0.2 },
    ],
    attack: 0.003,
    decay: 1.1,
    sustain: 0.05,
    release: 0.9,
    peak: 0.24,
    filter: { type: "lowpass", from: 8, to: 3, time: 0.3, track: true },
    send: 0.5,
  },
  bell: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.7 },
      { type: "sine", ratio: 2.76, gain: 0.22 },
      { type: "sine", ratio: 5.4, gain: 0.08 },
      { type: "sine", ratio: 4, gain: 0.1 },
    ],
    attack: 0.002,
    decay: 1.6,
    sustain: 0.02,
    release: 1.4,
    peak: 0.17,
    send: 0.55,
  },
  musicbox: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.75 },
      { type: "sine", ratio: 3, gain: 0.16 },
      { type: "sine", ratio: 6.2, gain: 0.05 },
    ],
    attack: 0.002,
    decay: 1.2,
    sustain: 0.02,
    release: 1.1,
    peak: 0.17,
    send: 0.6,
  },
  flute: {
    partials: [
      { type: "sine", ratio: 1, gain: 0.85 },
      { type: "triangle", ratio: 2, gain: 0.1 },
      { type: "sine", ratio: 3, gain: 0.04 },
    ],
    attack: 0.07,
    decay: 0.6,
    sustain: 0.75,
    release: 0.25,
    peak: 0.17,
    filter: { type: "lowpass", from: 3200, to: 2600, time: 0.4 },
    vibrato: { rate: 5, depth: 9, delay: 0.25 },
    send: 0.45,
  },
  square: {
    partials: [
      { type: "square", ratio: 1, gain: 0.45 },
      { type: "square", ratio: 1, gain: 0.25, detune: 6 },
    ],
    attack: 0.004,
    decay: 0.25,
    sustain: 0.55,
    release: 0.08,
    peak: 0.075,
    filter: { type: "lowpass", from: 4200, to: 3000, time: 0.2 },
    vibrato: { rate: 6, depth: 10, delay: 0.18 },
    send: 0.18,
  },
  pulse: {
    partials: [{ type: "square", ratio: 1, gain: 0.5 }],
    attack: 0.002,
    decay: 0.12,
    sustain: 0.2,
    release: 0.05,
    peak: 0.05,
    filter: { type: "lowpass", from: 3000, to: 1800, time: 0.1 },
    send: 0.12,
  },
  bass: {
    partials: [
      { type: "triangle", ratio: 1, gain: 0.75 },
      { type: "sine", ratio: 1, gain: 0.6 },
    ],
    attack: 0.006,
    decay: 0.45,
    sustain: 0.55,
    release: 0.12,
    peak: 0.3,
    filter: { type: "lowpass", from: 900, to: 420, time: 0.25, q: 0.7 },
    send: 0.04,
  },
  subbass: {
    partials: [{ type: "sine", ratio: 1, gain: 1 }],
    attack: 0.01,
    decay: 0.6,
    sustain: 0.7,
    release: 0.2,
    peak: 0.28,
    send: 0,
  },
  brass: {
    partials: [
      { type: "sawtooth", ratio: 1, gain: 0.5, detune: -4 },
      { type: "sawtooth", ratio: 1, gain: 0.4, detune: 4 },
    ],
    attack: 0.06,
    decay: 0.5,
    sustain: 0.7,
    release: 0.2,
    peak: 0.07,
    filter: { type: "lowpass", from: 600, to: 2000, time: 0.12, q: 0.8 },
    vibrato: { rate: 5.4, depth: 5, delay: 0.3 },
    send: 0.4,
  },
};

export const midiToFreq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function connectOut(o: Output, node: AudioNode, send: number, pan: number) {
  let tail: AudioNode = node;
  if (pan && "createStereoPanner" in o.ctx) {
    const panner = o.ctx.createStereoPanner();
    panner.pan.value = pan;
    node.connect(panner);
    tail = panner;
  }
  tail.connect(o.out);
  if (send > 0) {
    const s = o.ctx.createGain();
    s.gain.value = send;
    tail.connect(s).connect(o.reverb);
  }
}

export function playNote(o: Output, id: InstrumentId, midi: number, time: number, dur: number, velocity = 1, pan = 0) {
  const spec = SPECS[id];
  const ctx = o.ctx;
  const freq = midiToFreq(midi);
  const amp = ctx.createGain();
  const peak = spec.peak * velocity;
  const end = time + dur;
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(peak, time + spec.attack);
  amp.gain.setTargetAtTime(peak * spec.sustain, time + spec.attack, spec.decay / 3);
  amp.gain.setTargetAtTime(0, Math.max(end, time + spec.attack), spec.release / 4);
  const stopAt = Math.max(end, time + spec.attack) + spec.release * 1.3 + 0.05;

  let head: AudioNode = amp;
  if (spec.filter) {
    const f = ctx.createBiquadFilter();
    f.type = spec.filter.type;
    f.Q.value = spec.filter.q ?? 0.7;
    const scale = spec.filter.track ? freq : 1;
    const from = Math.min(18000, spec.filter.from * scale);
    const to = Math.min(18000, spec.filter.to * scale);
    f.frequency.setValueAtTime(from, time);
    f.frequency.setTargetAtTime(to, time, spec.filter.time / 3);
    f.connect(amp);
    head = f;
  }

  let vibrato: OscillatorNode | null = null;
  let vibratoGain: GainNode | null = null;
  if (spec.vibrato) {
    vibrato = ctx.createOscillator();
    vibrato.frequency.value = spec.vibrato.rate;
    vibratoGain = ctx.createGain();
    vibratoGain.gain.setValueAtTime(0, time);
    vibratoGain.gain.linearRampToValueAtTime(spec.vibrato.depth, time + spec.vibrato.delay + 0.2);
    vibrato.connect(vibratoGain);
    vibrato.start(time);
    vibrato.stop(stopAt);
  }

  for (const p of spec.partials) {
    const osc = ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.value = freq * p.ratio;
    if (p.detune) osc.detune.value = p.detune;
    if (vibratoGain) vibratoGain.connect(osc.detune);
    const g = ctx.createGain();
    g.gain.value = p.gain;
    osc.connect(g).connect(head);
    osc.start(time);
    osc.stop(stopAt);
    osc.onended = () => {
      g.disconnect();
      osc.disconnect();
    };
  }
  connectOut(o, amp, spec.send, pan);
}

function noiseHit(o: Output, time: number, opts: { type: BiquadFilterType; freq: number; q?: number; gain: number; decay: number; send?: number; pan?: number }) {
  const ctx = o.ctx;
  const src = ctx.createBufferSource();
  src.buffer = o.noise;
  const f = ctx.createBiquadFilter();
  f.type = opts.type;
  f.frequency.value = opts.freq;
  f.Q.value = opts.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(opts.gain, time + 0.002);
  g.gain.setTargetAtTime(0, time + 0.003, opts.decay / 3);
  src.connect(f).connect(g);
  connectOut(o, g, opts.send ?? 0.08, opts.pan ?? 0);
  const offset = Math.random() * (o.noise.duration - 0.5);
  src.start(time, offset, opts.decay * 1.6 + 0.05);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
}

function tone(o: Output, time: number, from: number, to: number, glide: number, gain: number, decay: number, type: OscillatorType = "sine", send = 0.05) {
  const ctx = o.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), time + glide);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.003);
  g.gain.setTargetAtTime(0, time + 0.004, decay / 3);
  osc.connect(g);
  connectOut(o, g, send, 0);
  osc.start(time);
  osc.stop(time + decay * 1.6 + 0.05);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

export function playDrum(o: Output, id: DrumId, time: number, velocity = 1, midi = 41) {
  const v = velocity;
  switch (id) {
    case "kick":
      tone(o, time, 140, 44, 0.12, 0.55 * v, 0.28, "sine", 0);
      break;
    case "snare":
      noiseHit(o, time, { type: "bandpass", freq: 1900, q: 0.6, gain: 0.16 * v, decay: 0.16, send: 0.18 });
      tone(o, time, 210, 160, 0.05, 0.08 * v, 0.09, "triangle", 0.1);
      break;
    case "clap":
      for (const d of [0, 0.012, 0.024]) noiseHit(o, time + d, { type: "bandpass", freq: 1400, q: 1.2, gain: 0.11 * v, decay: 0.12, send: 0.25 });
      break;
    case "hat":
      noiseHit(o, time, { type: "highpass", freq: 7600, gain: 0.05 * v, decay: 0.035, send: 0.02, pan: 0.25 });
      break;
    case "openhat":
      noiseHit(o, time, { type: "highpass", freq: 7000, gain: 0.04 * v, decay: 0.22, send: 0.05, pan: 0.25 });
      break;
    case "shaker":
      noiseHit(o, time, { type: "bandpass", freq: 6200, q: 1.1, gain: 0.05 * v, decay: 0.07, send: 0.04, pan: -0.3 });
      break;
    case "timpani": {
      const f = midiToFreq(midi);
      tone(o, time, f * 1.06, f, 0.08, 0.32 * v, 1.1, "sine", 0.35);
      tone(o, time, f * 1.5, f * 1.48, 0.1, 0.07 * v, 0.6, "sine", 0.35);
      noiseHit(o, time, { type: "lowpass", freq: 300, gain: 0.08 * v, decay: 0.12, send: 0.2 });
      break;
    }
    case "crackle":
      noiseHit(o, time, { type: "highpass", freq: 2500, gain: 0.025 * v, decay: 0.006, send: 0, pan: Math.random() - 0.5 });
      break;
  }
}
