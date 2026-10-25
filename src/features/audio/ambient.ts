import { playNote, type Output } from "./instruments";
import type { AmbientId } from "./manifest";

function shapedNoise(ctx: BaseAudioContext, seconds: number, kind: "pink" | "brown") {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "pink") {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
      } else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
    }
    const fade = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }
  }
  return buffer;
}

type Bed = { stop: () => void };

function bed(o: Output, buffer: AudioBuffer, filters: { type: BiquadFilterType; freq: number; q?: number }[], gain: number, lfo?: { rate: number; depth: number; target: "gain" | "freq" }): Bed {
  const ctx = o.ctx;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  let node: AudioNode = src;
  const nodes: BiquadFilterNode[] = [];
  for (const f of filters) {
    const biquad = ctx.createBiquadFilter();
    biquad.type = f.type;
    biquad.frequency.value = f.freq;
    biquad.Q.value = f.q ?? 0.7;
    node.connect(biquad);
    node = biquad;
    nodes.push(biquad);
  }
  const g = ctx.createGain();
  g.gain.value = gain;
  node.connect(g).connect(o.out);
  let mod: OscillatorNode | null = null;
  if (lfo) {
    mod = ctx.createOscillator();
    mod.frequency.value = lfo.rate;
    const depth = ctx.createGain();
    depth.gain.value = lfo.depth;
    mod.connect(depth);
    if (lfo.target === "gain") depth.connect(g.gain);
    else if (nodes[0]) depth.connect(nodes[0].frequency);
    mod.start();
  }
  src.start(0, Math.random() * buffer.duration);
  return {
    stop: () => {
      try {
        src.stop();
        mod?.stop();
      } catch {
        return;
      }
      src.disconnect();
      g.disconnect();
    },
  };
}

function droplet(o: Output, time: number) {
  const ctx = o.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = 1800 + Math.random() * 2600;
  osc.frequency.setValueAtTime(f, time);
  osc.frequency.exponentialRampToValueAtTime(f * 1.6, time + 0.03);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.012 + Math.random() * 0.018, time + 0.002);
  g.gain.setTargetAtTime(0, time + 0.003, 0.012);
  const pan = "createStereoPanner" in ctx ? ctx.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
  osc.connect(g);
  (pan ? g.connect(pan) : g).connect(o.out);
  osc.start(time);
  osc.stop(time + 0.08);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
    pan?.disconnect();
  };
}

function chirp(o: Output, time: number, base: number, notes: number, pan: number) {
  const ctx = o.ctx;
  for (let i = 0; i < notes; i++) {
    const t = time + i * (0.09 + Math.random() * 0.05);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = base * (0.9 + Math.random() * 0.25);
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(start * (1.25 + Math.random() * 0.4), t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(start * 0.95, t + 0.09);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.setTargetAtTime(0, t + 0.05, 0.02);
    const p = "createStereoPanner" in ctx ? ctx.createStereoPanner() : null;
    if (p) p.pan.value = pan;
    osc.connect(g);
    (p ? g.connect(p) : g).connect(o.out);
    const s = ctx.createGain();
    s.gain.value = 0.35;
    g.connect(s).connect(o.reverb);
    osc.start(t);
    osc.stop(t + 0.16);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
      s.disconnect();
      p?.disconnect();
    };
  }
}

function crackle(o: Output, time: number, strength: number) {
  const ctx = o.ctx;
  const src = ctx.createBufferSource();
  src.buffer = o.noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1500 + Math.random() * 3500;
  f.Q.value = 1.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(strength, time + 0.001);
  g.gain.setTargetAtTime(0, time + 0.002, 0.004 + Math.random() * 0.01);
  src.connect(f).connect(g).connect(o.out);
  src.start(time, Math.random() * 2, 0.06);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
}

const CHIME = [0, 2, 4, 7, 9, 12, 14].map((n) => 84 + n);

export class AmbientPlayer {
  private beds: Bed[] = [];
  private nextEvent = 0;
  stopped = false;

  constructor(private readonly o: Output, readonly id: AmbientId, startAt: number) {
    const ctx = o.ctx;
    this.nextEvent = startAt;
    switch (id) {
      case "rain":
        this.beds.push(bed(o, shapedNoise(ctx, 6, "pink"), [{ type: "lowpass", freq: 2600 }, { type: "highpass", freq: 260 }], 0.55, { rate: 0.07, depth: 0.08, target: "gain" }));
        this.beds.push(bed(o, shapedNoise(ctx, 5, "brown"), [{ type: "lowpass", freq: 500 }], 0.35));
        break;
      case "birds":
        this.beds.push(bed(o, shapedNoise(ctx, 6, "pink"), [{ type: "bandpass", freq: 700, q: 0.4 }], 0.18, { rate: 0.05, depth: 250, target: "freq" }));
        break;
      case "fireplace":
        this.beds.push(bed(o, shapedNoise(ctx, 6, "brown"), [{ type: "lowpass", freq: 380 }], 0.55, { rate: 0.3, depth: 0.12, target: "gain" }));
        this.beds.push(bed(o, shapedNoise(ctx, 5, "pink"), [{ type: "bandpass", freq: 900, q: 0.5 }], 0.05));
        break;
      case "wind":
        this.beds.push(bed(o, shapedNoise(ctx, 7, "pink"), [{ type: "bandpass", freq: 600, q: 0.9 }], 0.9, { rate: 0.09, depth: 320, target: "freq" }));
        this.beds.push(bed(o, shapedNoise(ctx, 6, "brown"), [{ type: "lowpass", freq: 300 }], 0.4, { rate: 0.06, depth: 0.1, target: "gain" }));
        break;
    }
  }

  tick(now: number, lookahead: number) {
    if (this.stopped) return;
    if (this.nextEvent < now) this.nextEvent = now + 0.05;
    while (this.nextEvent < now + lookahead) {
      const t = this.nextEvent;
      switch (this.id) {
        case "rain":
          droplet(this.o, t);
          this.nextEvent += 0.04 + Math.random() * 0.18;
          break;
        case "birds":
          chirp(this.o, t, 2400 + Math.random() * 1800, 2 + Math.floor(Math.random() * 4), Math.random() * 1.4 - 0.7);
          this.nextEvent += 1.2 + Math.random() * 4.5;
          break;
        case "fireplace":
          crackle(this.o, t, 0.04 + Math.random() * (Math.random() < 0.08 ? 0.18 : 0.06));
          this.nextEvent += Math.random() < 0.3 ? 0.02 + Math.random() * 0.05 : 0.12 + Math.random() * 0.45;
          break;
        case "wind": {
          const midi = CHIME[Math.floor(Math.random() * CHIME.length)];
          if (Math.random() < 0.55) playNote(this.o, "bell", midi, t, 0.4, 0.18 + Math.random() * 0.2, Math.random() * 1.2 - 0.6);
          this.nextEvent += 0.6 + Math.random() * 3.4;
          break;
        }
      }
    }
  }

  stop() {
    this.stopped = true;
    for (const b of this.beds) b.stop();
    this.beds = [];
  }
}

