"use client";

import { perceived, useAudioSettings } from "./store";

export type Buses = {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  ambient: GainNode;
  reverb: GainNode;
  analyser: AnalyserNode;
  noise: AudioBuffer;
};

let buses: Buses | null = null;
let unsupported = false;

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createBuses(ctx: AudioContext | OfflineAudioContext): Buses {
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  master.connect(compressor).connect(analyser).connect(ctx.destination);

  const convolver = ctx.createConvolver();
  convolver.buffer = impulse(ctx, 2.6, 2.4);
  const reverb = ctx.createGain();
  reverb.gain.value = 0.9;
  reverb.connect(convolver).connect(master);

  const music = ctx.createGain();
  const sfx = ctx.createGain();
  const ambient = ctx.createGain();
  for (const bus of [music, sfx, ambient]) bus.connect(master);
  return { ctx: ctx as AudioContext, master, music, sfx, ambient, reverb, analyser, noise: noiseBuffer(ctx, 3) };
}

export function applyLevels(target: Buses | null = buses) {
  if (!target) return;
  const s = useAudioSettings.getState();
  const now = target.ctx.currentTime;
  const set = (node: GainNode, value: number) => node.gain.setTargetAtTime(value, now, 0.08);
  set(target.music, s.musicMuted ? 0 : perceived(s.musicVolume) * 0.9);
  set(target.sfx, s.sfxOn ? perceived(s.sfxVolume) * 1.2 : 0);
  set(target.ambient, perceived(s.ambientVolume) * 1.1);
}

export function getBuses(): Buses | null {
  if (buses || unsupported || typeof window === "undefined") return buses;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    unsupported = true;
    return null;
  }
  try {
    buses = createBuses(new Ctor());
    applyLevels(buses);
    useAudioSettings.subscribe(() => applyLevels());
  } catch {
    unsupported = true;
    return null;
  }
  return buses;
}

export function audioSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

export async function unlockAudio(): Promise<boolean> {
  const b = getBuses();
  if (!b) return false;
  if (b.ctx.state === "running") return true;
  try {
    await Promise.race([b.ctx.resume(), new Promise((resolve) => setTimeout(resolve, 600))]);
  } catch {
    return false;
  }
  return (b.ctx.state as AudioContextState) === "running";
}

export function audioLevel() {
  if (!buses) return 0;
  const data = new Float32Array(buses.analyser.fftSize);
  buses.analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (const v of data) sum += v * v;
  return Math.sqrt(sum / data.length);
}
