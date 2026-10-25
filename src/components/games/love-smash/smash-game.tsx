"use client";

import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { botThink, createBotMind, type Difficulty } from "@/features/love-smash/bot";
import { createAnim, updateAnim } from "@/features/love-smash/chibi";
import { COURT } from "@/features/love-smash/court";
import { InputRecorder } from "@/features/love-smash/replay";
import { banner, burst, createFx, impact, makeCamera, pop, project, render, snapshot, updateFx, type Camera, type Fx, type Insets } from "@/features/love-smash/render";
import { buildScene, type Scene } from "@/features/love-smash/scene";
import { TARGET_SCORE } from "@/features/love-smash/rules";
import { createMatch, step, type Format, type Input, type Match, type SimEvent } from "@/features/love-smash/sim";
import { FixedStepper } from "@/features/love-smash/stepper";
import type { Avatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { playSkillFx } from "./event-fx";
import { SkillBar, viewOf } from "./skill-bar";
import { TouchControls, type PressKind } from "./touch-controls";
import type { Loadout } from "@/features/love-smash/skills";

export type Competitor = { name: string; avatar: Avatar };

export type MatchSummary = { match: Match; log: number[]; ticks: number };

export type TutorialStep = "move" | "hit" | "drop" | "smash" | "score" | "done";

type Props = {
  seed: number;
  difficulty: Difficulty;
  tutorial?: boolean;
  format?: Format;
  teammates?: [Competitor, Competitor];
  loadout?: Loadout | null;
  quickIntro?: boolean;
  me: Competitor;
  rival: Competitor;
  onFinished: (summary: MatchSummary) => void;
  onRestart: () => void;
  onQuit: () => void;
  onTutorialComplete?: () => void;
};

export const KEYS: Record<string, "up" | "down" | "left" | "right" | PressKind | "pause"> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyJ: "hit",
  KeyZ: "hit",
  KeyK: "smash",
  KeyX: "smash",
  KeyL: "drop",
  KeyC: "drop",
  Space: "lunge",
  ShiftLeft: "lunge",
  KeyQ: "dash",
  KeyE: "special",
  KeyR: "ultimate",
  KeyF: "sync",
  Escape: "pause",
  KeyP: "pause",
};

const TUTORIAL_TEXT: Record<TutorialStep, { en: string; vi: string }> = {
  move: { en: "Move around your court with W A S D (or the joystick)", vi: "Di chuyển bằng W A S D hoặc cần điều khiển" },
  hit: { en: "Stand under the shuttle — when your ring glows pink, press J / 🏸 HIT", vi: "Đứng dưới quả cầu — khi vòng quanh bạn sáng hồng, nhấn J" },
  drop: { en: "Press L / 🌸 DROP to play a soft drop shot near the net", vi: "Nhấn L để bỏ nhỏ sát lưới" },
  smash: { en: "When the shuttle is high, press K / 🔥 SMASH. Perfect timing = Sakura Smash!", vi: "Khi cầu bay cao, nhấn K để đập cầu" },
  score: { en: "A shuttle landing in scores a point. First to 7, win by 2!", vi: "Cầu rơi trong sân là được điểm. Ai tới 7 điểm (cách 2) thì thắng" },
  done: { en: "You're ready!", vi: "Bạn đã sẵn sàng!" },
};

export const INTRO_STEPS = ["title", "versus", "ready", "3", "2", "1", "go"] as const;
const QUICK_STEPS = ["ready", "go"] as const;
export const STEP_MS: Record<(typeof INTRO_STEPS)[number], number> = { title: 900, versus: 1000, ready: 650, "3": 520, "2": 520, "1": 520, go: 520 };

type Toast = { id: number; text: string; tone: "win" | "lose" | "info" };

declare global {
  interface Window {
    __loveSmash?: {
      state: () => { phase: string; score: [number, number]; tick: number; winner: number | null; paused: boolean; intro: boolean; player: { x: number; y: number } };
      autopilot: (on: boolean) => void;
    };
  }
}

export function insetsFor(w: number, h: number, touch: boolean): Insets {
  const portrait = h > w;
  if (touch && portrait) return { top: 92, right: 6, bottom: 290, left: 6 };
  if (touch) return { top: 60, right: 150, bottom: 6, left: 150 };
  return { top: 84, right: 12, bottom: 14, left: 12 };
}

export function SmashGame({ seed, difficulty, tutorial = false, format = "singles", teammates, loadout = null, quickIntro = false, me, rival, onFinished, onRestart, onQuit, onTutorialComplete }: Props) {
  const doubles = format === "doubles" && Boolean(teammates);
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<string>());
  const joystick = useRef({ x: 0, y: 0 });
  const presses = useRef<Set<PressKind>>(new Set());
  const pausedRef = useRef(false);
  const introRef = useRef(!tutorial);
  const autopilot = useRef<ReturnType<typeof createBotMind> | null>(null);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [server, setServer] = useState<0 | 1>(tutorial ? 1 : 0);
  const [phase, setPhase] = useState<Match["phase"]>("serve");
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  const [announce, setAnnounce] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [matchPoint, setMatchPoint] = useState<0 | 1 | null>(null);
  const [intro, setIntro] = useState<string | null>(tutorial ? null : quickIntro ? QUICK_STEPS[0] : INTRO_STEPS[0]);
  const [step_, setStep] = useState<TutorialStep>("move");
  const tutorialRef = useRef<{ step: TutorialStep; moved: number; hits: number }>({ step: "move", moved: 0, hits: 0 });
  const finishedRef = useRef(onFinished);
  const people = useRef({ me, rival, teammates });
  const reducedRef = useRef(reduced);
  const loadoutRef = useRef(loadout);
  const matchRef = useRef<Match | null>(null);
  const readSkills = useCallback(() => {
    const m = matchRef.current;
    return m ? viewOf(m.players[0], { doubles: m.format === "doubles", teamEnergy: m.teamEnergy[0], teamCooldown: m.teamCooldown[0], syncActive: m.sync[0] > 0, syncAllowed: m.teamSync[0], couple: false }) : null;
  }, []);

  useEffect(() => {
    finishedRef.current = onFinished;
    people.current = { me, rival, teammates };
    reducedRef.current = reduced;
  });

  const setPausedBoth = useCallback((value: boolean) => {
    if (introRef.current) return;
    pausedRef.current = value;
    setPaused(value);
  }, []);

  const endIntro = useCallback(() => {
    introRef.current = false;
    setIntro(null);
  }, []);

  useEffect(() => {
    if (!intro) return;
    const steps: readonly string[] = quickIntro ? QUICK_STEPS : INTRO_STEPS;
    const index = steps.indexOf(intro);
    if (intro === "3" || intro === "2" || intro === "1") sfx.tick();
    if (intro === "go") sfx.perfectHit();
    const timer = setTimeout(() => {
      const next = steps[index + 1];
      if (next) setIntro(next);
      else endIntro();
    }, STEP_MS[intro as keyof typeof STEP_MS]);
    return () => clearTimeout(timer);
  }, [intro, quickIntro, endIntro]);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const action = KEYS[e.code];
      if (!action) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.repeat) return;
      if (introRef.current) {
        endIntro();
        return;
      }
      if (action === "pause") {
        setPausedBoth(!pausedRef.current);
        return;
      }
      if (action === "up" || action === "down" || action === "left" || action === "right") held.current.add(action);
      else presses.current.add(action);
    };
    const up = (e: KeyboardEvent) => {
      const action = KEYS[e.code];
      if (action === "up" || action === "down" || action === "left" || action === "right") held.current.delete(action);
    };
    const blur = () => held.current.clear();
    const visibility = () => {
      if (document.hidden) setPausedBoth(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [setPausedBoth, endIntro]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const match = createMatch({ seed, difficulty, tutorial, format: doubles ? "doubles" : "singles", loadouts: [loadoutRef.current, null, null, null] });
    matchRef.current = match;
    const recorder = new InputRecorder();
    const stepper = new FixedStepper();
    const fx: Fx = createFx();
    const anims = match.players.map((_, i) => createAnim(i * 1.7));
    let prev = snapshot(match);
    let cam: Camera = makeCamera(1, 1);
    let scene: Scene | null = null;
    let w = 1;
    let h = 1;
    let raf = 0;
    let last = performance.now();
    let footstep = 0;
    let finishedAt: number | null = null;
    let lastMoveX = match.players[0].x;
    let lastMoveY = match.players[0].y;
    let toastId = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam = makeCamera(w, h, insetsFor(w, h, touch));
      scene = buildScene(cam, w, h, dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const advanceTutorial = (next: TutorialStep) => {
      tutorialRef.current.step = next;
      setStep(next);
      sfx.correct();
    };

    const showToast = (text: string, tone: Toast["tone"]) => {
      toastId++;
      const id = toastId;
      setToast({ id, text, tone });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1300);
    };

    const screenAt = (x: number, y: number, z: number) => project(cam, { x, y, z });

    const handle = (e: SimEvent) => {
      const count = (n: number) => (reducedRef.current ? Math.ceil(n / 4) : n);
      playSkillFx(e, { match, fx, at: screenAt, reduced: reducedRef.current, mySlot: 0, coupleTeam: () => false, width: w, height: h });
      switch (e.type) {
        case "hit": {
          const p = match.players[e.slot];
          const head = screenAt(p.x, p.y, 2.3);
          const at = screenAt(match.shuttle.pos.x, match.shuttle.pos.y, match.shuttle.pos.z);
          fx.trail = [];
          if (!e.skill && !e.sync) fx.trailKind = e.sakura ? "sakura" : e.shot === "smash" ? "smash" : "normal";
          if (e.sakura && e.skill !== "sakura_meteor") {
            sfx.sakuraSmash();
            banner(fx, "SAKURA SMASH!", "🌸 Perfect jump smash", "#e7779f", 1.1);
            burst(fx, at.x, at.y, "petal", count(26), 1.4);
            impact(fx, at.x, at.y, "#e7779f", 1.4);
            fx.shake = 0.7;
            fx.flash = 0.8;
            fx.cheer = 1;
          } else if (e.shot === "smash") {
            sfx.smashHit();
            fx.shake = Math.max(fx.shake, 0.3);
            impact(fx, at.x, at.y, "#f5cb78", 1);
            burst(fx, at.x, at.y, "spark", count(10), 1.2);
          } else if (e.quality === "perfect") {
            sfx.perfectHit();
            burst(fx, at.x, at.y, "spark", count(9));
            impact(fx, at.x, at.y, "#ffffff", 0.55);
          } else sfx.racket(e.quality === "late" ? 0.3 : 0.7);
          if (e.shot === "drop") burst(fx, at.x, at.y, "petal", count(5), 0.5);
          if (e.save) {
            burst(fx, at.x, at.y, "streak", count(7), 0.8);
            pop(fx, "SAVE!", head.x, head.y - 22, "#3a9474", e.side === 0 ? 24 : 18);
          }
          if (!e.shot.startsWith("serve")) {
            const label = e.quality === "perfect" ? "PERFECT!" : e.quality === "good" ? "GOOD" : "LATE";
            const color = e.quality === "perfect" ? "#e7779f" : e.quality === "good" ? "#8a73c8" : "#9a8288";
            pop(fx, e.shot === "smash" && !e.sakura ? "SMASH!" : e.shot === "drop" && e.quality !== "late" ? "DROP" : label, head.x, head.y, e.shot === "smash" ? "#d9825f" : color, e.side === 0 ? 24 : 18);
          }
          if (tutorial && e.side === 0) {
            const t = tutorialRef.current;
            t.hits++;
            if (t.step === "hit" && t.hits >= 2) advanceTutorial("drop");
            else if (t.step === "drop" && e.shot === "drop") advanceTutorial("smash");
            else if (t.step === "smash" && e.shot === "smash") advanceTutorial("score");
          }
          break;
        }
        case "whiff": {
          sfx.whiff();
          const p = match.players[e.slot];
          const head = screenAt(p.x, p.y, 2.3);
          if (e.side === 0) pop(fx, "MISS", head.x, head.y, "#9a8288", 20);
          break;
        }
        case "lunge": {
          sfx.whiff();
          const p = match.players[e.slot];
          const at = screenAt(p.x, p.y, 0.8);
          burst(fx, at.x, at.y, "streak", count(5), 0.6);
          break;
        }
        case "net": {
          sfx.netHit();
          const at = screenAt(match.shuttle.pos.x, 0, COURT.netHeight + 0.5);
          pop(fx, "NET!", at.x, at.y, "#e0607e", 28);
          break;
        }
        case "land": {
          sfx.shuttleLand();
          const at = screenAt(e.x, e.y, 0.4);
          pop(fx, e.inside ? "IN!" : "OUT!", at.x, at.y, e.inside ? "#3a9474" : "#e0607e", 28);
          burst(fx, at.x, at.y + 6, "spark", count(5), 0.6);
          break;
        }
        case "point": {
          setScore(e.score);
          const { me: mine, rival: theirs } = people.current;
          setAnnounce(`${e.winner === 0 ? mine.name : theirs.name} scores. ${e.score[0]} to ${e.score[1]}.`);
          fx.cheer = Math.max(fx.cheer, 0.7);
          const reason = e.reason === "out" ? "Out" : e.reason === "net" ? "Net fault" : e.reason === "serve_fault" ? "Serve fault" : "In";
          showToast(`${reason} · Point ${e.winner === 0 ? mine.name : theirs.name}!`, e.winner === 0 ? "win" : "lose");
          if (e.winner === 0) sfx.pointWon();
          else sfx.pointLost();
          const [a, b] = e.score;
          const leader: 0 | 1 = a > b ? 0 : 1;
          const point = !tutorial && match.winner === null && ((Math.max(a, b) >= TARGET_SCORE - 1 && Math.abs(a - b) >= 1) || Math.max(a, b) >= 10) ? leader : null;
          setMatchPoint(point);
          if (point !== null) banner(fx, "MATCH POINT", point === 0 ? "One more for the win!" : `${theirs.name} is close…`, "#8a73c8", 1.2);
          break;
        }
        case "combo":
          banner(fx, e.kind === "love_combo" ? "✨ DUO COMBO!" : e.kind === "sakura_duo" ? "🌸 DUO SMASH!" : "PERFECT TEAMWORK!", "Teamwork pays off", "#8a73c8", 1.2);
          burst(fx, w / 2, h * 0.42, "petal", count(14), 1.1);
          sfx.love();
          break;
        case "serve_ready":
          setServer(e.server);
          setPhase("serve");
          break;
        case "over": {
          const won = e.winner === 0;
          banner(fx, won ? "YOU WIN!" : "GOOD GAME!", won ? "💗 Smash Together. Win Together." : "Every rally makes you stronger", won ? "#e7779f" : "#8a73c8", 2.4);
          fx.cheer = 1.6;
          if (won) {
            sfx.victory();
            burst(fx, w / 2, h * 0.4, "confetti", count(60), 2.2);
            burst(fx, w / 2, h * 0.4, "petal", count(30), 1.6);
          } else sfx.defeat();
          setPhase("over");
          setMatchPoint(null);
          finishedAt = performance.now();
          break;
        }
      }
    };

    const buildInput = (): Input => {
      if (autopilot.current) return botThink(match, autopilot.current, 0);
      const k = held.current;
      let mx = (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0) + joystick.current.x;
      let my = (k.has("up") ? 1 : 0) - (k.has("down") ? 1 : 0) + joystick.current.y;
      mx = Math.max(-1, Math.min(1, mx));
      my = Math.max(-1, Math.min(1, my));
      const input: Input = { mx, my };
      for (const press of presses.current) input[press] = true;
      presses.current.clear();
      return input;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const frozen = pausedRef.current || introRef.current;
      if (!frozen && match.winner === null) {
        const ticks = stepper.advance(dt);
        for (let i = 0; i < ticks && match.winner === null; i++) {
          prev = snapshot(match);
          const recorded = recorder.record(buildInput());
          step(match, recorded);
          for (const e of match.events) handle(e);
          if (match.phase === "rally" || match.phase === "point") setPhase(match.phase);
        }
        const me0 = match.players[0];
        const moved = Math.hypot(me0.x - lastMoveX, me0.y - lastMoveY);
        lastMoveX = me0.x;
        lastMoveY = me0.y;
        if (tutorial && tutorialRef.current.step === "move") {
          tutorialRef.current.moved += moved;
          if (tutorialRef.current.moved > 2.5) advanceTutorial("hit");
        }
        footstep += moved;
        if (footstep > 1.3) {
          footstep = 0;
          sfx.footstep();
        }
      } else {
        stepper.reset();
        presses.current.clear();
      }
      const animDt = pausedRef.current ? 0 : dt;
      if (!pausedRef.current) {
        updateFx(fx, dt, reducedRef.current, w);
        match.players.forEach((_, i) => updateAnim(anims[i], match, i, animDt));
      }
      const alpha = match.winner !== null || frozen ? 1 : stepper.alpha;
      ctx.clearRect(0, 0, w, h);
      const crew = people.current;
      const slots = doubles && crew.teammates ? [crew.me, crew.rival, crew.teammates[0], crew.teammates[1]] : [crew.me, crew.rival];
      if (scene) render(ctx, cam, w, h, { match, prev, alpha, avatars: slots.map((c) => c.avatar), names: doubles ? slots.map((c, i) => (i === 0 ? "You" : c.name)) : undefined, anims, scene, fx, dt: animDt, human: 0, offscreenMarker: true, markerY: touch && h > w ? 132 : 104 });
      if (finishedAt !== null && now - finishedAt > 2300) {
        finishedAt = null;
        finishedRef.current({ match, log: recorder.toLog(), ticks: recorder.ticks });
      }
    };
    raf = requestAnimationFrame(frame);

    if (process.env.NODE_ENV !== "production") {
      window.__loveSmash = {
        state: () => ({ phase: match.phase, score: [match.score[0], match.score[1]], tick: match.tick, winner: match.winner, paused: pausedRef.current, intro: introRef.current, player: { x: match.players[0].x, y: match.players[0].y } }),
        autopilot: (on) => {
          autopilot.current = on ? createBotMind("hard", seed ^ 0x1234) : null;
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (window.__loveSmash) delete window.__loveSmash;
    };
  }, [seed, difficulty, tutorial, touch, doubles]);

  const yourServe = phase === "serve" && server === 0 && !intro;

  return (
    <div className="fixed inset-0 z-[70] touch-none select-none overflow-hidden bg-[#fff4f8]" data-testid="love-smash-game" data-phase={phase}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block" role="img" aria-label={`Badminton court. ${me.name} ${score[0]}, ${rival.name} ${score[1]}.`} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-[max(env(safe-area-inset-top),8px)] sm:px-4">
        <ScoreCard competitor={doubles && teammates ? { name: `${me.name} & ${teammates[0].name.replace(" 🤖", "")}`, avatar: me.avatar } : me} score={score[0]} serving={server === 0 && phase !== "over"} matchPoint={matchPoint === 0} testId="score-me" />
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1 shadow-[var(--shadow-soft)] ring-2 ring-white" data-testid="scoreline">
            <span key={`a${score[0]}`} className="animate-[score-bump_.35s_ease-out] font-display text-2xl font-bold tabular-nums text-sakura-500">
              {score[0]}
            </span>
            <span className="text-cocoa-400">-</span>
            <span key={`b${score[1]}`} className="animate-[score-bump_.35s_ease-out] font-display text-2xl font-bold tabular-nums text-lavender-400">
              {score[1]}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPausedBoth(!paused)}
            className="grid size-9 place-items-center rounded-full bg-white/90 text-plum-700 shadow-[var(--shadow-soft)]"
            aria-label={paused ? "Resume" : "Pause"}
            data-testid="pause-button"
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
        <ScoreCard competitor={doubles && teammates ? { name: `${rival.name} & ${teammates[1].name.replace(" 🤖", "")}`, avatar: rival.avatar } : rival} score={score[1]} serving={server === 1 && phase !== "over"} matchPoint={matchPoint === 1} align="right" testId="score-rival" />
      </div>
      {toast ? (
        <div key={toast.id} className="pointer-events-none absolute inset-x-0 top-[5.5rem] z-10 flex justify-center px-4" data-testid="point-toast">
          <p className={cn("animate-[toast-in_.25s_ease-out] rounded-full px-4 py-1.5 font-display text-sm font-semibold shadow-[var(--shadow-soft)]", toast.tone === "win" ? "bg-sakura-400 text-white" : toast.tone === "lose" ? "bg-lavender-300 text-white" : "bg-white text-plum-700")}>{toast.text}</p>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {tutorial ? (
        <div className="absolute inset-x-0 top-24 z-10 flex justify-center px-4" data-testid="tutorial-step" data-step={step_}>
          <div className="max-w-md rounded-3xl bg-white/90 px-5 py-3 text-center shadow-[var(--shadow-soft)]">
            <p className="font-display font-semibold text-plum-700">{TUTORIAL_TEXT[step_].en}</p>
            <p lang="vi" className="text-sm text-cocoa-400">
              {TUTORIAL_TEXT[step_].vi}
            </p>
            {step_ === "score" || step_ === "done" ? (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  onTutorialComplete?.();
                  onQuit();
                }}
              >
                Finish tutorial
              </Button>
            ) : (
              <button type="button" onClick={onQuit} className="mt-1 text-xs font-semibold text-cocoa-400 underline">
                Skip tutorial
              </button>
            )}
          </div>
        </div>
      ) : yourServe ? (
        <div className={cn("pointer-events-none absolute inset-x-0 z-10 flex justify-center", touch ? "bottom-[300px]" : "bottom-24")}>
          <p className="animate-[toast-in_.25s_ease-out] rounded-full bg-white/90 px-4 py-1.5 font-display text-sm font-semibold text-plum-700 shadow-[var(--shadow-soft)]">
            {touch ? "Your serve: 🏸 HIT high · 🌸 DROP short" : "Your serve: J high · L short"}
          </p>
        </div>
      ) : null}
      {!tutorial && !intro && !paused && phase !== "over" ? <SkillBar read={readSkills} onPress={(action) => presses.current.add(action)} touch={touch} /> : null}
      {touch && !paused && !intro ? (
        <TouchControls
          onMove={(x, y) => {
            joystick.current = { x, y };
          }}
          onPress={(kind) => presses.current.add(kind)}
        />
      ) : null}
      {intro ? <Intro step={intro} me={me} rival={rival} onSkip={endIntro} /> : null}
      {paused ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-plum-900/30 backdrop-blur-sm" role="dialog" aria-label="Paused">
          <div className="flex w-72 flex-col gap-3 rounded-[1.75rem] bg-[#fffaf6] p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="font-display text-2xl font-bold text-plum-700">Paused</p>
            <Button onClick={() => setPausedBoth(false)}>
              <Play size={18} /> Resume
            </Button>
            {!tutorial ? (
              <Button variant="secondary" onClick={onRestart}>
                <RotateCcw size={18} /> Restart
              </Button>
            ) : null}
            <Button variant="soft" onClick={onQuit}>
              <X size={18} /> Quit to lobby
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Intro({ step, me, rival, onSkip }: { step: string; me: Competitor; rival: Competitor; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-plum-900/20 backdrop-blur-[2px]" role="dialog" aria-label="Match intro" data-testid="match-intro" data-step={step} onPointerDown={onSkip}>
      <div key={step} className="flex animate-[intro-pop_.35s_ease-out] flex-col items-center gap-3 px-6 text-center">
        {step === "title" ? (
          <>
            <p className="font-display text-5xl font-bold text-white drop-shadow-[0_4px_0_#c2527c] sm:text-7xl">🏸 LOVE SMASH!</p>
            <p className="font-display text-lg text-white drop-shadow">Smash Together. Win Together.</p>
          </>
        ) : step === "versus" ? (
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-2">
              <AvatarFace avatar={me.avatar} size={84} className="rounded-full ring-4 ring-white" />
              <p className="max-w-32 truncate font-display text-xl font-bold text-white drop-shadow">{me.name}</p>
            </div>
            <p className="font-display text-4xl font-bold text-gold-300 drop-shadow-[0_3px_0_#45365b]">VS</p>
            <div className="flex flex-col items-center gap-2">
              <AvatarFace avatar={rival.avatar} size={84} className="rounded-full ring-4 ring-white" />
              <p className="max-w-32 truncate font-display text-xl font-bold text-white drop-shadow">{rival.name}</p>
            </div>
          </div>
        ) : step === "ready" ? (
          <p className="font-display text-6xl font-bold text-white drop-shadow-[0_4px_0_#8a73c8]">READY?</p>
        ) : step === "go" ? (
          <p className="font-display text-7xl font-bold text-white drop-shadow-[0_5px_0_#c2527c]">SMASH!</p>
        ) : (
          <p className="font-display text-8xl font-bold text-white drop-shadow-[0_5px_0_#8a73c8]">{step}</p>
        )}
      </div>
      <button type="button" onClick={onSkip} className="absolute bottom-[max(env(safe-area-inset-bottom),20px)] right-5 rounded-full bg-white/85 px-4 py-2 font-display text-sm font-semibold text-plum-700 shadow-[var(--shadow-soft)]">
        Skip ›
      </button>
    </div>
  );
}

export function ScoreCard({ competitor, score, serving, matchPoint, align = "left", testId }: { competitor: Competitor; score: number; serving: boolean; matchPoint: boolean; align?: "left" | "right"; testId: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2 rounded-3xl bg-white/90 py-1 pl-1 pr-3 shadow-[var(--shadow-soft)] ring-2", matchPoint ? "ring-gold-300" : "ring-white", align === "right" && "flex-row-reverse pl-3 pr-1")} data-testid={testId}>
      <div className="relative">
        <AvatarFace avatar={competitor.avatar} size={38} />
        {serving ? (
          <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-sakura-400 text-[0.6rem] shadow" aria-label="Serving">
            🏸
          </span>
        ) : null}
      </div>
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="max-w-[5.5rem] truncate font-display text-sm font-semibold text-plum-700 sm:max-w-40">{competitor.name}</p>
        <p className="text-[0.7rem] font-semibold text-cocoa-400">{matchPoint ? <span className="text-gold-500">Match point</span> : serving ? "Serving" : `${score} pts`}</p>
      </div>
    </div>
  );
}
