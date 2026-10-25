"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { AMBIENTS, CATEGORY_INFO, TRACKS, trackById, type MusicCategory } from "@/features/audio/manifest";
import { useAudioRuntime, useAudioSettings } from "@/features/audio/store";
import { pinTrack, skipTrack } from "@/features/audio/use-audio-director";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-sakura-400" : "bg-lavender-200")}
    >
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[1.375rem]" : "left-0.5")} />
    </button>
  );
}

function Slider({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-50")}>
      <label htmlFor={id} className="w-16 shrink-0 text-xs font-bold text-plum-500">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-valuetext={`${Math.round(value * 100)}%`}
        className="h-2 w-full cursor-pointer accent-sakura-400"
      />
      <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-plum-500">{Math.round(value * 100)}%</span>
    </div>
  );
}

export function Equalizer({ active, className }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-4 items-end gap-[3px]", className)}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] origin-bottom rounded-full bg-current", active ? "animate-[eq_1s_ease-in-out_infinite]" : "h-1")}
          style={active ? { animationDelay: `${i * -0.23}s`, height: "100%" } : undefined}
        />
      ))}
    </span>
  );
}

function FloatingNotes() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
      {["♪", "♫", "♪", "♬"].map((n, i) => (
        <span
          key={i}
          className="absolute bottom-0 text-sakura-300 opacity-0 motion-safe:animate-[note-float_4s_ease-in_infinite]"
          style={{ left: `${12 + i * 22}%`, animationDelay: `${i * 1}s` }}
        >
          {n}
        </span>
      ))}
    </span>
  );
}

export function RadioPanel({ onClose, compact = false }: { onClose?: () => void; compact?: boolean }) {
  const settings = useAudioSettings();
  const runtime = useAudioRuntime();
  const [showList, setShowList] = useState(false);
  const current = trackById(runtime.currentTrack ?? settings.pinnedTrack);
  const playing = settings.musicOn && runtime.status === "playing" && Boolean(runtime.currentTrack);
  const info = current ? CATEGORY_INFO[current.category] : null;
  const groups = Object.keys(CATEGORY_INFO) as MusicCategory[];

  return (
    <div className="flex flex-col gap-3" data-testid="radio-panel" data-playing={playing} data-track={runtime.currentTrack ?? ""} data-status={runtime.status}>
      {!compact ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-plum-700">TWOGETHER RADIO 💗</h2>
            <p className="text-xs text-cocoa-400">Music for our little world.</p>
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close radio" className="grid size-8 place-items-center rounded-xl text-plum-500 hover:bg-lavender-100">
              <X size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sakura-100 via-lavender-100 to-peach-100 p-3 ring-2 ring-white">
        {playing ? <FloatingNotes /> : null}
        <div className="relative flex items-center gap-3">
          <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-2xl shadow-sm", playing && "motion-safe:animate-[spin_8s_linear_infinite]")} aria-hidden>
            {info?.emoji ?? "🎵"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-plum-700" aria-live="polite">
              {current ? current.name : "Music is resting"}
            </p>
            <p className="truncate text-xs text-plum-500">{info ? info.label : "Press play to begin"}</p>
            {runtime.status === "locked" ? <p className="mt-0.5 text-[11px] font-bold text-sakura-500">Tap anywhere to resume the music</p> : null}
            {runtime.status === "unsupported" ? <p className="mt-0.5 text-[11px] font-bold text-sakura-500">This browser cannot play game audio</p> : null}
          </div>
          <Equalizer active={playing} className="text-sakura-400" />
        </div>
        <div className="relative mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => skipTrack(-1)} aria-label="Previous track" className="grid size-10 place-items-center rounded-2xl bg-white/80 text-plum-700 hover:bg-white">
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            onClick={() => settings.set({ musicOn: !settings.musicOn, invitation: settings.invitation === "pending" ? "accepted" : settings.invitation })}
            aria-label={settings.musicOn ? "Pause music" : "Play music"}
            className="grid size-12 place-items-center rounded-2xl bg-sakura-400 text-white shadow-md hover:bg-sakura-500"
          >
            {settings.musicOn ? <Pause size={22} /> : <Play size={22} className="translate-x-px" />}
          </button>
          <button type="button" onClick={() => skipTrack(1)} aria-label="Next track" className="grid size-10 place-items-center rounded-2xl bg-white/80 text-plum-700 hover:bg-white">
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => settings.set({ musicMuted: !settings.musicMuted })}
          aria-label={settings.musicMuted ? "Unmute music" : "Mute music"}
          aria-pressed={settings.musicMuted}
          className="grid size-8 shrink-0 place-items-center rounded-xl bg-lavender-100 text-plum-700 hover:bg-lavender-200"
        >
          {settings.musicMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <div className="flex-1">
          <Slider label="Music" value={settings.musicVolume} onChange={(v) => settings.setVolume("music", v)} disabled={settings.musicMuted} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/70 px-3 py-2">
        <div>
          <p className="text-sm font-bold text-plum-700">Auto Music</p>
          <p className="text-[11px] text-cocoa-400">Each place plays its own song</p>
        </div>
        <Switch checked={settings.autoMusic} onChange={(v) => settings.set({ autoMusic: v, pinnedTrack: v ? null : (runtime.currentTrack ?? settings.pinnedTrack) })} label="Auto Music" />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-plum-700">Sound Effects</p>
          <Switch
            checked={settings.sfxOn}
            onChange={(v) => {
              settings.set({ sfxOn: v });
              if (v) setTimeout(() => sfx.pop(), 30);
            }}
            label="Sound Effects"
          />
        </div>
        <Slider label="Effects" value={settings.sfxVolume} onChange={(v) => settings.setVolume("sfx", v)} disabled={!settings.sfxOn} />
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-white/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-plum-700">Ambient Sounds</p>
          <Switch checked={settings.ambientOn} onChange={(v) => settings.set({ ambientOn: v })} label="Ambient Sounds" />
        </div>
        <div role="radiogroup" aria-label="Ambient environment" className="grid grid-cols-2 gap-1.5">
          {AMBIENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={settings.ambient === a.id}
              onClick={() => settings.set({ ambient: a.id, ambientOn: true })}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs font-bold ring-2 transition",
                settings.ambient === a.id && settings.ambientOn ? "bg-sakura-100 text-plum-700 ring-sakura-300" : "bg-white text-plum-500 ring-transparent hover:bg-sakura-50",
              )}
            >
              <span aria-hidden>{a.emoji}</span>
              {a.name}
            </button>
          ))}
        </div>
        <Slider label="Ambient" value={settings.ambientVolume} onChange={(v) => settings.setVolume("ambient", v)} disabled={!settings.ambientOn} />
      </div>

      <div className="rounded-2xl bg-white/70">
        <button type="button" onClick={() => setShowList((v) => !v)} aria-expanded={showList} className="flex w-full items-center justify-between px-3 py-2 text-sm font-bold text-plum-700">
          Playlist · {TRACKS.length} songs
          <ChevronDown size={16} className={cn("transition-transform", showList && "rotate-180")} />
        </button>
        {showList ? (
          <div className="max-h-56 overflow-y-auto px-2 pb-2">
            {groups.map((g) => (
              <div key={g} className="mb-1.5">
                <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-cocoa-400">
                  {CATEGORY_INFO[g].emoji} {CATEGORY_INFO[g].label}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {TRACKS.filter((t) => t.category === g).map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => pinTrack(t.id)}
                        aria-current={runtime.currentTrack === t.id ? "true" : undefined}
                        className={cn("flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left text-xs", runtime.currentTrack === t.id ? "bg-sakura-100 font-bold text-plum-700" : "text-plum-500 hover:bg-sakura-50")}
                      >
                        <span>{t.name}</span>
                        <span className="text-[10px] text-cocoa-400">{t.mood}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="px-1 pt-1 text-[10px] text-cocoa-400">Original music composed for TWOGETHER and played live in your browser.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function RadioButton() {
  const [open, setOpen] = useState(false);
  const musicOn = useAudioSettings((s) => s.musicOn);
  const status = useAudioRuntime((s) => s.status);
  const playing = musicOn && status === "playing";
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={playing ? "TWOGETHER Radio, music playing" : "TWOGETHER Radio"}
        data-testid="radio-button"
        className={cn("relative grid size-10 shrink-0 place-items-center rounded-2xl transition", playing ? "bg-sakura-100 text-sakura-500 hover:bg-sakura-200" : "bg-lavender-100 text-plum-700 hover:bg-lavender-200")}
      >
        {playing ? <Equalizer active /> : <Music2 size={19} />}
        {playing ? <span aria-hidden className="absolute inset-0 rounded-2xl ring-2 ring-sakura-300 motion-safe:animate-[radio-pulse_2.4s_ease-out_infinite]" /> : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="TWOGETHER Radio"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed right-3 top-[calc(var(--safe-top)+4.75rem)] z-50 max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-10rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[1.75rem] bg-[#fffaf6]/[0.97] p-3 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur-xl md:max-h-[calc(100dvh-6rem)]"
          >
            <RadioPanel onClose={() => setOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function MusicInvitation() {
  const invitation = useAudioSettings((s) => s.invitation);
  const set = useAudioSettings((s) => s.set);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (invitation !== "pending") return;
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [invitation]);

  const show = visible && invitation === "pending";
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          role="dialog"
          aria-labelledby="music-invite-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+5rem)] z-50 mx-auto max-w-sm rounded-[1.75rem] bg-white/90 p-4 shadow-[var(--shadow-soft)] ring-2 ring-white backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:mx-0"
          data-testid="music-invitation"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sakura-100 text-2xl">🎵</span>
            <div className="min-w-0">
              <p id="music-invite-title" className="font-display text-base font-bold text-plum-700">Make Our World Come Alive</p>
              <p className="text-sm text-plum-500">Turn on music for a cozier adventure.</p>
              <p lang="vi" className="text-xs text-cocoa-400">Bật nhạc để thế giới của hai bạn ấm áp hơn.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => set({ invitation: "accepted", musicOn: true })}
              className="flex-1 rounded-2xl bg-sakura-400 px-4 py-2.5 font-display text-sm font-bold text-white shadow-md hover:bg-sakura-500"
            >
              Enable Music 💗
            </button>
            <button type="button" onClick={() => set({ invitation: "dismissed" })} className="rounded-2xl bg-lavender-100 px-4 py-2.5 font-display text-sm font-bold text-plum-700 hover:bg-lavender-200">
              Maybe Later
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
