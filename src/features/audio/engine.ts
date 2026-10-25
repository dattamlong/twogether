"use client";

import { AmbientPlayer } from "./ambient";
import { audioLevel, getBuses, type Buses } from "./core";
import { trackById, type AmbientId } from "./manifest";
import { SongPlayer } from "./sequencer";
import { songById } from "./songs";

export const CROSSFADE_SECONDS = 2;
const AMBIENT_FADE_SECONDS = 1.5;

type MusicVoice = {
  trackId: string;
  gain: GainNode;
  wet: GainNode;
  player: SongPlayer | null;
  element: HTMLAudioElement | null;
  stopped: boolean;
};

type AmbientVoice = { id: AmbientId; gain: GainNode; wet: GainNode; player: AmbientPlayer; stopped: boolean };

export type EngineSnapshot = {
  state: AudioContextState | "unsupported";
  current: string | null;
  voices: number;
  ambient: AmbientId | null;
  ambientVoices: number;
  level: number;
};

class AudioEngine {
  private music: MusicVoice | null = null;
  private fading = new Set<MusicVoice>();
  private ambient: AmbientVoice | null = null;
  private ambientFading = new Set<AmbientVoice>();
  private timer: ReturnType<typeof setInterval> | null = null;

  private lookahead() {
    return typeof document !== "undefined" && document.hidden ? 1.6 : 0.35;
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 60);
  }

  private tick() {
    const b = getBuses();
    if (!b) return;
    const now = b.ctx.currentTime;
    const lookahead = this.lookahead();
    for (const v of [this.music, ...this.fading]) v?.player?.tick(now, lookahead);
    for (const a of [this.ambient, ...this.ambientFading]) a?.player.tick(now, lookahead);
    if (!this.music && !this.fading.size && !this.ambient && !this.ambientFading.size && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private voiceNodes(b: Buses, bus: GainNode, fadeIn: number, level = 1) {
    const now = b.ctx.currentTime;
    const gain = b.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + fadeIn);
    gain.connect(bus);
    const wet = b.ctx.createGain();
    wet.gain.setValueAtTime(0.0001, now);
    wet.gain.linearRampToValueAtTime(level, now + fadeIn);
    wet.connect(b.reverb);
    return { gain, wet };
  }

  private fade(b: Buses, nodes: { gain: GainNode; wet: GainNode }, seconds: number) {
    const now = b.ctx.currentTime;
    for (const node of [nodes.gain, nodes.wet]) {
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
      node.gain.linearRampToValueAtTime(0.0001, now + seconds);
    }
  }

  private retireMusic(b: Buses, voice: MusicVoice, seconds: number) {
    this.fading.add(voice);
    this.fade(b, voice, seconds);
    setTimeout(() => {
      voice.stopped = true;
      if (voice.player) voice.player.stopped = true;
      voice.element?.pause();
      voice.element?.removeAttribute("src");
      setTimeout(() => {
        voice.gain.disconnect();
        voice.wet.disconnect();
      }, 3000);
      this.fading.delete(voice);
    }, seconds * 1000 + 150);
  }

  playTrack(trackId: string, handlers: { onFormEnd: () => void; onError: (trackId: string) => void }) {
    const b = getBuses();
    if (!b) return false;
    if (this.music && this.music.trackId === trackId) return true;
    const track = trackById(trackId);
    if (!track) return false;

    for (const old of this.fading) this.fade(b, old, 0.25);
    if (this.music) this.retireMusic(b, this.music, CROSSFADE_SECONDS);
    this.music = null;

    const fadeIn = CROSSFADE_SECONDS;
    const nodes = this.voiceNodes(b, b.music, fadeIn, track.source.kind === "composed" ? (songById(track.id)?.gain ?? 1) : 1);
    const voice: MusicVoice = { trackId, ...nodes, player: null, element: null, stopped: false };

    if (track.source.kind === "composed") {
      const song = songById(track.id);
      if (!song) {
        nodes.gain.disconnect();
        nodes.wet.disconnect();
        handlers.onError(trackId);
        return false;
      }
      voice.player = new SongPlayer({ ctx: b.ctx, out: nodes.gain, reverb: nodes.wet, noise: b.noise }, song, () => {
        if (this.music === voice) handlers.onFormEnd();
      }, b.ctx.currentTime + 0.12);
    } else {
      const element = new Audio();
      element.preload = "auto";
      element.loop = track.loop;
      element.src = track.source.src;
      element.addEventListener("error", () => {
        if (this.music === voice) handlers.onError(trackId);
      });
      element.addEventListener("ended", () => {
        if (this.music === voice) handlers.onFormEnd();
      });
      try {
        b.ctx.createMediaElementSource(element).connect(nodes.gain);
      } catch {
        handlers.onError(trackId);
        return false;
      }
      voice.element = element;
      void element.play().catch(() => {
        if (this.music === voice) handlers.onError(trackId);
      });
    }

    this.music = voice;
    this.ensureTimer();
    this.tick();
    return true;
  }

  stopMusic(seconds = CROSSFADE_SECONDS) {
    const b = getBuses();
    if (!b || !this.music) return;
    this.retireMusic(b, this.music, seconds);
    this.music = null;
  }

  setAmbient(id: AmbientId | null) {
    const b = getBuses();
    if (!b) return;
    if (this.ambient?.id === id) return;
    if (this.ambient) {
      const old = this.ambient;
      this.ambientFading.add(old);
      this.fade(b, old, AMBIENT_FADE_SECONDS);
      setTimeout(() => {
        old.stopped = true;
        old.player.stop();
        old.gain.disconnect();
        old.wet.disconnect();
        this.ambientFading.delete(old);
      }, AMBIENT_FADE_SECONDS * 1000 + 150);
      this.ambient = null;
    }
    if (!id) return;
    const nodes = this.voiceNodes(b, b.ambient, AMBIENT_FADE_SECONDS);
    const player = new AmbientPlayer({ ctx: b.ctx, out: nodes.gain, reverb: nodes.wet, noise: b.noise }, id, b.ctx.currentTime + 0.05);
    this.ambient = { id, ...nodes, player, stopped: false };
    this.ensureTimer();
    this.tick();
  }

  snapshot(): EngineSnapshot {
    const b = getBuses();
    return {
      state: b ? b.ctx.state : "unsupported",
      current: this.music?.trackId ?? null,
      voices: (this.music ? 1 : 0) + this.fading.size,
      ambient: this.ambient?.id ?? null,
      ambientVoices: (this.ambient ? 1 : 0) + this.ambientFading.size,
      level: audioLevel(),
    };
  }
}

export const engine = new AudioEngine();
