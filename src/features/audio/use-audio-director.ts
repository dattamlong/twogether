"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { audioSupported, getBuses, unlockAudio } from "./core";
import type { EngineSnapshot } from "./engine";
import { areaTrack, categoryForPath, nextInCategory, stepTrack, trackById } from "./manifest";
import { useAudioRuntime, useAudioSettings } from "./store";

type Engine = typeof import("./engine").engine;

let enginePromise: Promise<Engine> | null = null;
const loadEngine = () => (enginePromise ??= import("./engine").then((m) => m.engine));
const unavailable = new Set<string>();

declare global {
  interface Window {
    __twogetherAudio?: { snapshot: () => Promise<EngineSnapshot | null> };
  }
}

export function desiredTrack(pathname: string, current: string | null, hour = new Date().getHours()) {
  const s = useAudioSettings.getState();
  if (!s.musicOn) return null;
  if (!s.autoMusic && s.pinnedTrack && trackById(s.pinnedTrack)) return s.pinnedTrack;
  if (pathname.startsWith("/games/love-smash") && !unavailable.has("smash-together")) return "smash-together";
  const category = categoryForPath(pathname);
  if (!category) return current ?? areaTrack("home", hour).id;
  let pick = areaTrack(category, hour, current).id;
  for (let i = 0; unavailable.has(pick) && i < 20; i++) pick = nextInCategory(pick).id;
  return pick;
}

export function skipTrack(direction: 1 | -1) {
  const current = useAudioRuntime.getState().currentTrack ?? useAudioSettings.getState().pinnedTrack;
  let pick = stepTrack(current ?? "", direction);
  for (let i = 0; unavailable.has(pick.id) && i < 20; i++) pick = stepTrack(pick.id, direction);
  useAudioSettings.getState().set({ autoMusic: false, pinnedTrack: pick.id, musicOn: true });
}

export function pinTrack(id: string) {
  useAudioSettings.getState().set({ autoMusic: false, pinnedTrack: id, musicOn: true });
}

export function useAudioDirector() {
  const pathname = usePathname();
  const musicOn = useAudioSettings((s) => s.musicOn);
  const autoMusic = useAudioSettings((s) => s.autoMusic);
  const pinnedTrack = useAudioSettings((s) => s.pinnedTrack);
  const ambientOn = useAudioSettings((s) => s.ambientOn);
  const ambient = useAudioSettings((s) => s.ambient);
  const pathRef = useRef(pathname);
  const waitingForGesture = useRef(false);
  const reconcileRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    window.__twogetherAudio = { snapshot: async () => (enginePromise ? (await enginePromise).snapshot() : null) };
    if (!audioSupported()) useAudioRuntime.setState({ status: "unsupported" });

    const advance = () => {
      const s = useAudioSettings.getState();
      if (!s.autoMusic && s.pinnedTrack) return;
      const current = useAudioRuntime.getState().currentTrack;
      if (!current) return;
      useAudioRuntime.setState({ currentTrack: nextInCategory(current).id });
      void reconcileRef.current();
    };
    const onError = (id: string) => {
      unavailable.add(id);
      if (useAudioSettings.getState().pinnedTrack === id) useAudioSettings.getState().set({ pinnedTrack: null, autoMusic: true });
      useAudioRuntime.setState({ currentTrack: null });
      void reconcileRef.current();
    };

    const waitForGesture = () => {
      if (waitingForGesture.current) return;
      waitingForGesture.current = true;
      const resume = () => {
        for (const ev of ["pointerdown", "keydown", "touchend"]) document.removeEventListener(ev, resume, true);
        waitingForGesture.current = false;
        void reconcileRef.current();
      };
      for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, resume, { capture: true, once: false });
    };

    let bound: AudioContext | null = null;
    const onState = () => {
      if (bound && bound.state !== "running" && useAudioRuntime.getState().status === "playing" && !document.hidden) {
        useAudioRuntime.setState({ status: "locked" });
        waitForGesture();
      }
    };
    const bindState = () => {
      if (bound) return;
      bound = getBuses()?.ctx ?? null;
      bound?.addEventListener("statechange", onState);
    };

    reconcileRef.current = async () => {
      const s = useAudioSettings.getState();
      const wantsSound = s.musicOn || s.ambientOn;
      if (!wantsSound) {
        if (enginePromise) {
          const engine = await enginePromise;
          engine.stopMusic();
          engine.setAmbient(null);
        }
        useAudioRuntime.setState({ status: audioSupported() ? "idle" : "unsupported", currentTrack: null, ambientPlaying: false });
        return;
      }
      if (!audioSupported()) return;
      const unlocked = await unlockAudio();
      if (!unlocked) {
        useAudioRuntime.setState({ status: "locked" });
        waitForGesture();
        return;
      }
      bindState();
      const engine = await loadEngine();
      const latest = useAudioSettings.getState();
      const track = desiredTrack(pathRef.current, useAudioRuntime.getState().currentTrack);
      if (latest.musicOn && track) engine.playTrack(track, { onFormEnd: advance, onError });
      else engine.stopMusic();
      engine.setAmbient(latest.ambientOn ? latest.ambient : null);
      useAudioRuntime.setState({ status: "playing", currentTrack: latest.musicOn ? track : null, ambientPlaying: latest.ambientOn });
    };

    const onVisible = () => {
      if (!document.hidden && useAudioRuntime.getState().status !== "idle") void reconcileRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      bound?.removeEventListener("statechange", onState);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    void reconcileRef.current();
  }, [pathname, musicOn, autoMusic, pinnedTrack, ambientOn, ambient]);
}
