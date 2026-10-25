"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AmbientId } from "./manifest";

export type AudioSettings = {
  musicOn: boolean;
  invitation: "pending" | "accepted" | "dismissed";
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  musicMuted: boolean;
  sfxOn: boolean;
  autoMusic: boolean;
  pinnedTrack: string | null;
  ambient: AmbientId;
  ambientOn: boolean;
};

export type AudioRuntime = {
  status: "idle" | "locked" | "playing" | "unsupported";
  currentTrack: string | null;
  ambientPlaying: boolean;
};

const LEGACY_SFX_KEY = "twogether:sfx";

function legacySfxOn() {
  try {
    return localStorage.getItem(LEGACY_SFX_KEY) !== "off";
  } catch {
    return true;
  }
}

export const DEFAULT_SETTINGS: AudioSettings = {
  musicOn: false,
  invitation: "pending",
  musicVolume: 0.45,
  sfxVolume: 0.65,
  ambientVolume: 0.3,
  musicMuted: false,
  sfxOn: true,
  autoMusic: true,
  pinnedTrack: null,
  ambient: "rain",
  ambientOn: false,
};

const clamp = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

type Actions = {
  set: (patch: Partial<AudioSettings>) => void;
  setVolume: (bus: "music" | "sfx" | "ambient", value: number) => void;
};

export const useAudioSettings = create<AudioSettings & Actions>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      setVolume: (bus, value) => set(bus === "music" ? { musicVolume: clamp(value) } : bus === "sfx" ? { sfxVolume: clamp(value) } : { ambientVolume: clamp(value) }),
    }),
    {
      name: "twogether:audio",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): AudioSettings => {
        const saved: Partial<AudioSettings & Actions> = { ...state };
        delete saved.set;
        delete saved.setVolume;
        return saved as AudioSettings;
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AudioSettings>;
        return { ...current, sfxOn: legacySfxOn(), ...saved };
      },
    },
  ),
);

export const useAudioRuntime = create<AudioRuntime>()(() => ({ status: "idle", currentTrack: null, ambientPlaying: false }));

export function perceived(volume: number) {
  return clamp(volume) ** 2;
}
