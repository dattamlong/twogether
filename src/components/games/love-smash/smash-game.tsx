"use client";

import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { Button } from "@/components/ui/button";
import { botThink, createBotMind, type Difficulty } from "@/features/love-smash/bot";
import { COURT } from "@/features/love-smash/court";
import { predictPath } from "@/features/love-smash/physics";
import { InputRecorder } from "@/features/love-smash/replay";
import { banner, burst, createFx, makeCamera, pop, project, render, snapshot, updateFx, type Camera, type Fx } from "@/features/love-smash/render";
import { createMatch, step, type Input, type Match, type SimEvent } from "@/features/love-smash/sim";
import { FixedStepper } from "@/features/love-smash/stepper";
import type { Avatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { TouchControls, type PressKind } from "./touch-controls";

export type Competitor = { name: string; avatar: Avatar };

export type MatchSummary = { match: Match; log: number[]; ticks: number };

export type TutorialStep = "move" | "hit" | "drop" | "smash" | "score" | "done";

type Props = {
  seed: number;
  difficulty: Difficulty;
  tutorial?: boolean;
  me: Competitor;
  rival: Competitor;
  onFinished: (summary: MatchSummary) => void;
  onRestart: () => void;
  onQuit: () => void;
};

const KEYS: Record<string, "up" | "down" | "left" | "right" | PressKind | "pause"> = {
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
  Escape: "pause",
  KeyP: "pause",
};

const TUTORIAL_TEXT: Record<TutorialStep, { en: string; vi: string }> = {
  move: { en: "Move around your court with W A S D (or the joystick)", vi: "Di chuyển bằng W A S D hoặc cần điều khiển" },
  hit: { en: "Stand under the shuttle and press J / 🏸 HIT when it reaches you (J also serves)", vi: "Đứng dưới quả cầu và nhấn J khi cầu tới gần (J cũng dùng để giao cầu)" },
  drop: { en: "Press L / 🌸 DROP to play a soft drop shot near the net", vi: "Nhấn L để bỏ nhỏ sát lưới" },
  smash: { en: "When the shuttle is high, press K / 🔥 SMASH. Perfect timing = Sakura Smash!", vi: "Khi cầu bay cao, nhấn K để đập cầu" },
  score: { en: "A shuttle landing in scores a point. First to 7, win by 2!", vi: "Cầu rơi trong sân là được điểm. Ai tới 7 điểm (cách 2) thì thắng" },
  done: { en: "You're ready! ", vi: "Bạn đã sẵn sàng!" },
};

declare global {
  interface Window {
    __loveSmash?: { state: () => { phase: string; score: [number, number]; tick: number; winner: number | null; paused: boolean; player: { x: number; y: number } }; autopilot: (on: boolean) => void };
  }
}

export function SmashGame({ seed, difficulty, tutorial = false, me, rival, onFinished, onRestart, onQuit }: Props) {
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<string>());
  const joystick = useRef({ x: 0, y: 0 });
  const presses = useRef<Set<PressKind>>(new Set());
  const pausedRef = useRef(false);
  const autopilot = useRef<ReturnType<typeof createBotMind> | null>(null);
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [server, setServer] = useState<0 | 1>(0);
  const [phase, setPhase] = useState<Match["phase"]>("serve");
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  const [announce, setAnnounce] = useState("");
  const [step_, setStep] = useState<TutorialStep>("move");
  const tutorialRef = useRef<{ step: TutorialStep; moved: number; hits: number }>({ step: "move", moved: 0, hits: 0 });
  const finishedRef = useRef(onFinished);
  const people = useRef({ me, rival });
  const reducedRef = useRef(reduced);

  useEffect(() => {
    finishedRef.current = onFinished;
    people.current = { me, rival };
    reducedRef.current = reduced;
  });

  const setPausedBoth = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPaused(value);
  }, []);

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
  }, [setPausedBoth]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const match = createMatch({ seed, difficulty, tutorial });
    const recorder = new InputRecorder();
    const stepper = new FixedStepper();
    const fx: Fx = createFx();
    let prev = snapshot(match);
    let cam: Camera = makeCamera(1, 1);
    let w = 1;
    let h = 1;
    let raf = 0;
    let last = performance.now();
    let footstep = 0;
    let finishedAt: number | null = null;
    let lastMoveX = match.players[0].x;
    let lastMoveY = match.players[0].y;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cam = makeCamera(w, h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const advanceTutorial = (next: TutorialStep) => {
      tutorialRef.current.step = next;
      setStep(next);
      sfx.correct();
    };

    const screenAt = (x: number, y: number, z: number) => project(cam, { x, y, z });

    const handle = (e: SimEvent) => {
      const count = (n: number) => (reducedRef.current ? Math.ceil(n / 4) : n);
      switch (e.type) {
        case "hit": {
          const p = match.players[e.side];
          const head = screenAt(p.x, p.y, 2.1);
          const at = screenAt(match.shuttle.pos.x, match.shuttle.pos.y, match.shuttle.pos.z);
          fx.trail = [];
          fx.trailSakura = e.sakura;
          if (e.sakura) {
            sfx.sakuraSmash();
            banner(fx, "SAKURA SMASH!", "🌸 Perfect jump smash", "#e7779f", 1.1);
            burst(fx, at.x, at.y, "petal", count(26), 1.4);
            fx.shake = 0.7;
            fx.flash = 0.8;
          } else if (e.shot === "smash") {
            sfx.smashHit();
            fx.shake = Math.max(fx.shake, 0.3);
            burst(fx, at.x, at.y, "spark", count(10), 1.2);
          } else if (e.quality === "perfect") {
            sfx.perfectHit();
            burst(fx, at.x, at.y, "spark", count(8));
          } else sfx.racket(e.quality === "late" ? 0.3 : 0.7);
          if (!e.shot.startsWith("serve")) {
            const label = e.quality === "perfect" ? "PERFECT!" : e.quality === "good" ? "GOOD" : "LATE";
            const color = e.quality === "perfect" ? "#e7779f" : e.quality === "good" ? "#8a73c8" : "#9a8288";
            pop(fx, label, head.x, head.y, color, e.side === 0 ? 24 : 18);
          }
          fx.landing = null;
          if (e.side === 1) {
            const path = predictPath(match.shuttle, 400);
            const end = path[path.length - 1];
            if (end && end.z <= 0.001 && !match.shuttle.netted) fx.landing = end;
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
          const p = match.players[e.side];
          const head = screenAt(p.x, p.y, 2.1);
          if (e.side === 0) pop(fx, "MISS", head.x, head.y, "#9a8288", 20);
          break;
        }
        case "lunge":
          sfx.whiff();
          break;
        case "net": {
          sfx.netHit();
          const at = screenAt(match.shuttle.pos.x, 0, COURT.netHeight + 0.4);
          pop(fx, "NET!", at.x, at.y, "#e0607e", 26);
          fx.landing = null;
          break;
        }
        case "land": {
          sfx.shuttleLand();
          const at = screenAt(e.x, e.y, 0.3);
          pop(fx, e.inside ? "IN!" : "OUT!", at.x, at.y, e.inside ? "#3a9474" : "#e0607e", 26);
          burst(fx, at.x, at.y + 6, "spark", count(5), 0.6);
          fx.landing = null;
          break;
        }
        case "point": {
          setScore(e.score);
          setAnnounce(`${e.winner === 0 ? people.current.me.name : people.current.rival.name} scores. ${e.score[0]} to ${e.score[1]}.`);
          if (e.winner === 0) sfx.pointWon();
          else sfx.pointLost();
          const [a, b] = e.score;
          if (!tutorial && Math.max(a, b) >= 6 && Math.abs(a - b) >= 1 && match.phase !== "over") banner(fx, "MATCH POINT", e.winner === 0 ? "One more for the win!" : `${people.current.rival.name} is close…`, "#8a73c8", 1.2);
          break;
        }
        case "serve_ready":
          setServer(e.server);
          setPhase("serve");
          break;
        case "over": {
          const won = e.winner === 0;
          banner(fx, won ? "YOU WIN!" : "GOOD GAME!", won ? "💗 Smash Together. Win Together." : "Every rally makes you stronger", won ? "#e7779f" : "#8a73c8", 2.4);
          if (won) {
            sfx.victory();
            burst(fx, w / 2, h * 0.4, "confetti", count(60), 2.2);
            burst(fx, w / 2, h * 0.4, "petal", count(30), 1.6);
          } else sfx.defeat();
          setPhase("over");
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
      if (!pausedRef.current && match.winner === null) {
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
      } else if (pausedRef.current) {
        stepper.reset();
      }
      if (!pausedRef.current) updateFx(fx, dt, reducedRef.current);
      const alpha = match.phase === "over" ? 1 : stepper.alpha;
      ctx.clearRect(0, 0, w, h);
      render(ctx, cam, w, h, { match, prev, alpha, avatars: [people.current.me.avatar, people.current.rival.avatar], fx, showLanding: match.lastHitter === 1, offscreenMarker: true, dt: pausedRef.current ? 0 : dt });
      if (finishedAt !== null && now - finishedAt > 2300) {
        finishedAt = null;
        finishedRef.current({ match, log: recorder.toLog(), ticks: recorder.ticks });
      }
    };
    raf = requestAnimationFrame(frame);

    if (process.env.NODE_ENV !== "production") {
      window.__loveSmash = {
        state: () => ({ phase: match.phase, score: [match.score[0], match.score[1]], tick: match.tick, winner: match.winner, paused: pausedRef.current, player: { x: match.players[0].x, y: match.players[0].y } }),
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
  }, [seed, difficulty, tutorial]);

  const yourServe = phase === "serve" && server === 0;

  return (
    <div className="fixed inset-0 z-[70] touch-none select-none overflow-hidden bg-[#fff4f8]" data-testid="love-smash-game" data-phase={phase}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block" role="img" aria-label={`Badminton court. ${me.name} ${score[0]}, ${rival.name} ${score[1]}.`} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <ScoreCard competitor={me} score={score[0]} serving={server === 0 && phase !== "over"} testId="score-me" />
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div className="rounded-2xl bg-white/85 px-3 py-1 font-display text-2xl font-bold tabular-nums text-plum-700 shadow-[var(--shadow-soft)]" data-testid="scoreline">
            {score[0]} <span className="text-cocoa-400">-</span> {score[1]}
          </div>
          <button
            type="button"
            onClick={() => setPausedBoth(!paused)}
            className="grid size-10 place-items-center rounded-full bg-white/85 text-plum-700 shadow-[var(--shadow-soft)]"
            aria-label={paused ? "Resume" : "Pause"}
            data-testid="pause-button"
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
        <ScoreCard competitor={rival} score={score[1]} serving={server === 1 && phase !== "over"} align="right" testId="score-rival" />
      </div>
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
              <Button size="sm" className="mt-2" onClick={onQuit}>
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[38%] z-10 flex justify-center">
          <p className="rounded-full bg-white/85 px-4 py-1.5 font-display text-sm font-semibold text-plum-700 shadow-[var(--shadow-soft)]">{touch ? "Your serve: 🏸 HIT high · 🌸 DROP short" : "Your serve: J high · L short"}</p>
        </div>
      ) : null}
      {touch && !paused ? (
        <TouchControls
          onMove={(x, y) => {
            joystick.current = { x, y };
          }}
          onPress={(kind) => presses.current.add(kind)}
        />
      ) : null}
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

function ScoreCard({ competitor, score, serving, align = "left", testId }: { competitor: Competitor; score: number; serving: boolean; align?: "left" | "right"; testId: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2 rounded-3xl bg-white/85 py-1.5 pl-1.5 pr-3 shadow-[var(--shadow-soft)]", align === "right" && "flex-row-reverse pl-3 pr-1.5")} data-testid={testId}>
      <AvatarFace avatar={competitor.avatar} size={36} />
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="max-w-[6.5rem] truncate font-display text-sm font-semibold text-plum-700 sm:max-w-40">{competitor.name}</p>
        <p className="text-xs font-semibold text-cocoa-400">{serving ? "🏸 Serving" : `${score} pts`}</p>
      </div>
    </div>
  );
}

