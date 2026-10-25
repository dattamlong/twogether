"use client";

import { LogOut, Wifi } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { botThink, createBotMind } from "@/features/love-smash/bot";
import { createAnim, updateAnim } from "@/features/love-smash/chibi";
import { applySnapshot, createConfiguredMatch, encodeSnapshot, FrameRecorder, type NetSnapshot } from "@/features/love-smash/net";
import { createFx, makeCamera, project, render, snapshot, toView, updateFx, type Camera, type Fx, type Snapshot } from "@/features/love-smash/render";
import { RoomNet, type PressMessage, type Report, type RoomPresence } from "@/features/love-smash/room-net";
import { abandonRoom, finishRoom, type Room } from "@/features/love-smash/rooms";
import { TARGET_SCORE } from "@/features/love-smash/rules";
import { buildScene, type Scene } from "@/features/love-smash/scene";
import { movePlayer, step, type Frame, type Input, type Player, type SimEvent } from "@/features/love-smash/sim";
import { FixedStepper } from "@/features/love-smash/stepper";
import { readAvatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { playEventFx } from "./event-fx";
import { Intro, INTRO_STEPS, insetsFor, KEYS, ScoreCard, STEP_MS, type Competitor } from "./smash-game";
import { TouchControls, type PressKind } from "./touch-controls";

export const BOT_TEAMMATES: Competitor[] = [
  { name: "Mochi 🤖", avatar: readAvatar({ hair: "short", hairColor: "#6a5583", skin: "#f6d0b8", outfitColor: "#b8ddf5", accessory: "beanie" }) },
  { name: "Sakura 🤖", avatar: readAvatar({ hair: "twintails", hairColor: "#e7779f", outfitColor: "#fbe3b1", accessory: "bow" }) },
];

const SNAPSHOT_EVERY = 5;
const REPORT_MS = 125;
const IDLE_REPORT_MS = 600;
const INTERP_TICKS = 4;
const WAIT_LIMIT_MS = 45_000;
const HOST_SILENCE_MS = 5_000;

export function roomCompetitors(room: Room): Competitor[] {
  let botIndex = 0;
  return [0, 1, 2, 3].map((slot) => {
    const member = room.members.find((m) => m.slot === slot && m.status === "joined");
    if (member) return { name: member.name, avatar: readAvatar(member.avatar) };
    return BOT_TEAMMATES[botIndex++ % BOT_TEAMMATES.length];
  });
}

declare global {
  interface Window {
    __loveSmashOnline?: { state: () => { tick: number; score: [number, number]; winner: number | null; waiting: string[]; host: boolean }; autopilot: (on: boolean) => void };
  }
}

type Props = { room: Room; userId: string; partnerId: string | null; onResult: (room: Room) => void; onLeave: (reason?: string) => void };

export function OnlineGame({ room, userId, partnerId, onResult, onLeave }: Props) {
  const config = room.config!;
  const mySlot = room.members.find((m) => m.userId === userId)!.slot;
  const isHost = room.hostId === userId;
  const flip = mySlot % 2 === 1;
  const competitors = useMemo(() => roomCompetitors(room), [room]);
  const reduced = usePrefersReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef(new Set<string>());
  const joystick = useRef({ x: 0, y: 0 });
  const presses = useRef<Set<PressKind>>(new Set());
  const introRef = useRef(true);
  const reducedRef = useRef(reduced);
  const autopilot = useRef<ReturnType<typeof createBotMind> | null>(null);
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window));
  const [intro, setIntro] = useState<string | null>(INTRO_STEPS[0]);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [serverSlot, setServerSlot] = useState(0);
  const [waiting, setWaitingState] = useState<string[]>([]);
  const waitingRef = useRef<string[]>([]);
  const setWaiting = useCallback((list: string[]) => {
    waitingRef.current = list;
    setWaitingState(list);
  }, []);
  const [status, setStatus] = useState<"connecting" | "connected" | "reconnecting">("connecting");
  const [toast, setToast] = useState<{ id: number; text: string; win: boolean } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [matchPoint, setMatchPoint] = useState<0 | 1 | null>(null);
  const resultRef = useRef(onResult);
  const leaveRef = useRef(onLeave);

  useEffect(() => {
    resultRef.current = onResult;
    leaveRef.current = onLeave;
    reducedRef.current = reduced;
  });

  const endIntro = useCallback(() => {
    introRef.current = false;
    setIntro(null);
  }, []);

  useEffect(() => {
    if (!intro) return;
    const index = INTRO_STEPS.indexOf(intro as (typeof INTRO_STEPS)[number]);
    if (intro === "3" || intro === "2" || intro === "1") sfx.tick();
    if (intro === "go") sfx.perfectHit();
    const timer = setTimeout(() => {
      const next = INTRO_STEPS[index + 1];
      if (next) setIntro(next);
      else endIntro();
    }, STEP_MS[intro as keyof typeof STEP_MS]);
    return () => clearTimeout(timer);
  }, [intro, endIntro]);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    const down = (e: KeyboardEvent) => {
      const action = KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      if (e.repeat || action === "pause") return;
      if (action === "up" || action === "down" || action === "left" || action === "right") held.current.add(action);
      else presses.current.add(action);
    };
    const up = (e: KeyboardEvent) => {
      const action = KEYS[e.code];
      if (action === "up" || action === "down" || action === "left" || action === "right") held.current.delete(action);
    };
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const match = createConfiguredMatch(config);
    const fx: Fx = createFx();
    const anims = match.players.map((_, i) => createAnim(i * 1.3));
    const stepper = new FixedStepper();
    const humanSlots = room.members.filter((m) => m.status === "joined").map((m) => ({ slot: m.slot, userId: m.userId, name: m.name }));
    const remoteSlots = humanSlots.filter((h) => h.userId !== userId);
    let prev: Snapshot = snapshot(match);
    let cam: Camera = makeCamera(1, 1);
    let scene: Scene | null = null;
    let w = 1;
    let h = 1;
    let raf = 0;
    let last = performance.now();
    let toastId = 0;
    let finishedAt: number | null = null;
    let finished = false;
    let presentUsers = new Set<string>([userId]);
    let waitingSince: number | null = null;
    let lastWaitingKey = "";

    const remote = new Map<number, { x: number; y: number; l: boolean; presses: PressMessage[]; seen: Set<number> }>();
    let pendingEvents: SimEvent[] = [];
    const recorder = isHost ? new FrameRecorder(config.controllers, []) : null;

    const queue: NetSnapshot[] = [];
    let lastArrival = 0;
    let latestT = -1;
    let appliedT = -1;
    let prevT = -1;
    let displayedTick = 0;
    const local: Player | null = isHost ? null : { ...match.players[mySlot], lungeDir: { ...match.players[mySlot].lungeDir } };
    let localPrev = local ? { x: local.x, y: local.y } : null;
    let pressId = 0;
    let lastReport = 0;
    let lungeFlag = false;
    const lastSent = { x: Number.NaN, y: Number.NaN };
    let hostSeenAt = performance.now();
    let clientAlpha = 1;
    let lastWaitSnap = 0;

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

    const at = (x: number, y: number, z: number) => project(cam, toView({ x, y, z }, flip));
    const myTeam = mySlot % 2;
    const coupleTeam = (side: 0 | 1) => {
      if (room.mode === "couple_ai") return side === 0;
      const team = humanSlots.filter((hs) => hs.slot % 2 === side).map((hs) => hs.userId);
      return side === myTeam && partnerId !== null && team.includes(partnerId) && team.includes(userId);
    };

    const onEvent = (e: SimEvent) => {
      playEventFx(e, { match, fx, at, reduced: reducedRef.current, mySlot, coupleTeam, width: w, height: h });
      if (e.type === "point") {
        setScore(e.score);
        toastId++;
        const id = toastId;
        const won = e.winner === myTeam;
        setToast({ id, text: `${e.reason === "out" ? "Out" : e.reason === "net" ? "Net fault" : e.reason === "serve_fault" ? "Serve fault" : "In"} · Point ${won ? "us" : "them"}!`, win: won });
        setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1300);
        if (won) sfx.pointWon();
        else sfx.pointLost();
        const [a, b] = e.score;
        const leader: 0 | 1 = a > b ? 0 : 1;
        setMatchPoint(match.winner === null && ((Math.max(a, b) >= TARGET_SCORE - 1 && Math.abs(a - b) >= 1) || Math.max(a, b) >= 10) ? leader : null);
      }
      if (e.type === "serve_ready") {
        setServerSlot(e.serverSlot);
        if (local) {
          const p = match.players[mySlot];
          Object.assign(local, { x: p.x, y: p.y, vx: 0, vy: 0, lunge: 0, recover: 0 });
        }
      }
      if (e.type === "over") {
        sfx[e.winner === myTeam ? "victory" : "defeat"]();
        setMatchPoint(null);
        finishedAt = performance.now();
      }
    };

    const localInput = (): Input => {
      if (autopilot.current) {
        const input = botThink(match, autopilot.current, mySlot);
        return input;
      }
      const k = held.current;
      let mx = (k.has("right") ? 1 : 0) - (k.has("left") ? 1 : 0) + joystick.current.x;
      let my = (k.has("up") ? 1 : 0) - (k.has("down") ? 1 : 0) + joystick.current.y;
      mx = Math.max(-1, Math.min(1, mx)) * (flip ? -1 : 1);
      my = Math.max(-1, Math.min(1, my)) * (flip ? -1 : 1);
      const input: Input = { mx, my };
      for (const press of presses.current) input[press] = true;
      presses.current.clear();
      return input;
    };

    const net = new RoomNet(
      room.id,
      { userId, slot: mySlot, host: isHost, at: Date.now() },
      {
        onStatus: setStatus,
        onPresence: (members: RoomPresence[]) => {
          presentUsers = new Set(members.map((m) => m.userId));
          presentUsers.add(userId);
          if (members.some((m) => m.host)) hostSeenAt = performance.now();
        },
        onReport: (r: Report) => {
          const entry = remote.get(r.slot) ?? { x: r.x, y: r.y, l: false, presses: [], seen: new Set<number>() };
          entry.x = r.x;
          entry.y = r.y;
          entry.l = entry.l || r.l;
          remote.set(r.slot, entry);
        },
        onPress: (p: PressMessage) => {
          const entry = remote.get(p.slot) ?? { x: match.players[p.slot].x, y: match.players[p.slot].y, l: false, presses: [], seen: new Set<number>() };
          if (entry.seen.has(p.id)) return;
          entry.seen.add(p.id);
          entry.presses.push(p);
          remote.set(p.slot, entry);
        },
        onSnapshot: (snap: NetSnapshot) => {
          if (snap.t <= latestT) return;
          latestT = snap.t;
          lastArrival = performance.now();
          hostSeenAt = lastArrival;
          queue.push(snap);
        },
        onResult: (payload) => {
          const r = payload as Room & { error?: string };
          if (r && r.status === "finished") resultRef.current(r);
          else if (r?.error) setSaving(`Result not saved (${r.error})`);
        },
        onAbort: (reason) => leaveRef.current(reason),
      },
      isHost ? remoteSlots.map((r) => r.slot) : [mySlot],
      isHost,
    );
    void net.open();

    const finishAsHost = async () => {
      if (!recorder || finished) return;
      finished = true;
      setSaving("Verifying the match on the server…");
      try {
        const saved = await finishRoom(room.id, recorder.toLogs());
        net.result(saved);
        resultRef.current(saved);
      } catch (e) {
        const reason = e instanceof Error ? e.message : "save_failed";
        setSaving(`Result not saved (${reason}). No rewards were given.`);
        net.result({ error: reason });
      }
    };

    const hostTick = (dt: number) => {
      const missing = remoteSlots.filter((r) => !presentUsers.has(r.userId)).map((r) => r.name);
      const key = missing.join(",");
      if (key !== lastWaitingKey) {
        lastWaitingKey = key;
        setWaiting(missing);
        waitingSince = missing.length ? performance.now() : null;
      }
      if (waitingSince !== null && performance.now() - waitingSince > WAIT_LIMIT_MS && !finished) {
        finished = true;
        void abandonRoom(room.id).catch(() => undefined);
        net.abort("player_left");
        leaveRef.current("player_left");
        return;
      }
      const frozen = introRef.current || missing.length > 0 || match.winner !== null;
      if (frozen) {
        stepper.reset();
        if (performance.now() - lastWaitSnap > 500) {
          lastWaitSnap = performance.now();
          net.snapshot(encodeSnapshot(match, [], { waiting: missing }));
        }
        return;
      }
      const ticks = stepper.advance(dt);
      for (let i = 0; i < ticks && match.winner === null; i++) {
        prev = snapshot(match);
        const frame: Frame = { inputs: { [mySlot]: localInput() }, puppets: {} };
        for (const r of remoteSlots) {
          const p = match.players[r.slot];
          const entry = remote.get(r.slot);
          const press = entry?.presses.shift();
          frame.puppets![r.slot] = {
            x: entry ? entry.x : p.x,
            y: entry ? entry.y : p.y,
            lunge: entry?.l ?? false,
            press: press ? { kind: press.kind, rewind: Math.max(0, match.tick - press.view) } : undefined,
          };
          if (entry) entry.l = false;
        }
        step(match, recorder!.record(frame));
        for (const e of match.events) onEvent(e);
        pendingEvents.push(...match.events);
        if (match.tick % SNAPSHOT_EVERY === 0 || match.winner !== null) {
          net.snapshot(encodeSnapshot(match, pendingEvents, { stats: match.winner !== null }));
          pendingEvents = [];
        }
      }
    };

    const clientTick = (dt: number, now: number) => {
      if (latestT >= 0) {
        const hostNow = latestT + ((now - lastArrival) / 1000) * 60;
        const renderTick = hostNow - INTERP_TICKS;
        while (queue.length && queue[0].t <= renderTick) {
          const snap = queue.shift()!;
          prev = snapshot(match);
          if (localPrev) prev.players[mySlot] = { ...localPrev };
          prevT = appliedT;
          applySnapshot(match, snap);
          appliedT = snap.t;
          if (snap.wait) setWaiting(snap.wait);
          else if (waitingRef.current.length) setWaiting([]);
          for (const e of snap.ev) onEvent(e);
        }
        const nextT = queue.length ? queue[0].t : appliedT + SNAPSHOT_EVERY;
        clientAlpha = prevT < 0 ? 1 : Math.max(0, Math.min(1, (renderTick - appliedT) / Math.max(1, nextT - appliedT)));
        displayedTick = Math.round(prevT < 0 ? appliedT : prevT + clientAlpha * (appliedT - prevT));
      }
      if (!local) return;
      const server = match.players[mySlot];
      if (Math.hypot(server.x - local.x, server.y - local.y) > 1.6) Object.assign(local, { x: server.x, y: server.y, vx: 0, vy: 0 });
      const frozen = introRef.current || match.winner !== null || waitingRef.current.length > 0;
      if (frozen) {
        stepper.reset();
      } else {
        const ticks = stepper.advance(dt);
        for (let i = 0; i < ticks; i++) {
          localPrev = { x: local.x, y: local.y };
          const input = localInput();
          const before = local.lunge;
          movePlayer(match, local, input);
          if (local.lunge > before) lungeFlag = true;
          const kind: PressKind | null = input.smash ? "smash" : input.drop ? "drop" : input.hit ? "hit" : null;
          if (kind) {
            pressId++;
            net.press({ slot: mySlot, kind, view: displayedTick, id: pressId });
          }
        }
      }
      const rx = Math.round(local.x * 100) / 100;
      const ry = Math.round(local.y * 100) / 100;
      const moved = rx !== lastSent.x || ry !== lastSent.y || lungeFlag;
      if ((moved && now - lastReport >= REPORT_MS) || now - lastReport >= IDLE_REPORT_MS) {
        lastReport = now;
        lastSent.x = rx;
        lastSent.y = ry;
        net.report({ slot: mySlot, x: rx, y: ry, l: lungeFlag, s: Math.round(now) });
        lungeFlag = false;
      }
      Object.assign(match.players[mySlot], { x: local.x, y: local.y, vx: local.vx, vy: local.vy, facing: local.facing, moveX: local.moveX, moveY: local.moveY, lunge: local.lunge, lungeDir: local.lungeDir });
      if (now - hostSeenAt > HOST_SILENCE_MS && !finished && match.winner === null) {
        const hostName = room.members.find((m) => m.userId === room.hostId)?.name ?? "Host";
        if (!waitingRef.current.includes(hostName)) setWaiting([hostName]);
        if (now - hostSeenAt > WAIT_LIMIT_MS) {
          finished = true;
          void abandonRoom(room.id).catch(() => undefined);
          leaveRef.current("host_left");
        }
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (isHost) hostTick(dt);
      else clientTick(dt, now);
      updateFx(fx, dt, reducedRef.current, w);
      match.players.forEach((_, i) => updateAnim(anims[i], match, i, dt));
      const alpha = isHost ? (match.winner !== null || introRef.current ? 1 : stepper.alpha) : clientAlpha;
      ctx.clearRect(0, 0, w, h);
      if (scene) render(ctx, cam, w, h, { match, prev, alpha, avatars: competitors.map((c) => c.avatar), names: competitors.map((c, i) => (i === mySlot ? "You" : c.name)), anims, scene, fx, dt, human: mySlot, flip, offscreenMarker: true, markerY: touch && h > w ? 132 : 104 });
      if (isHost && finishedAt !== null && now - finishedAt > 1800) {
        finishedAt = null;
        void finishAsHost();
      }
    };
    raf = requestAnimationFrame(frame);

    if (process.env.NODE_ENV !== "production") {
      window.__loveSmashOnline = {
        state: () => ({ tick: match.tick, score: [match.score[0], match.score[1]], winner: match.winner, waiting: [...waitingRef.current], host: isHost }),
        autopilot: (on) => {
          autopilot.current = on ? createBotMind("hard", 4242 + mySlot) : null;
        },
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      net.close();
      if (window.__loveSmashOnline) delete window.__loveSmashOnline;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const team = (side: 0 | 1): Competitor => {
    const a = competitors[side];
    const b = competitors[side + 2];
    return { name: `${a.name.replace(" 🤖", "")} & ${b.name.replace(" 🤖", "")}`, avatar: a.avatar };
  };
  const myTeam = (mySlot % 2) as 0 | 1;
  const theirTeam = (1 - myTeam) as 0 | 1;

  return (
    <div className="fixed inset-0 z-[70] touch-none select-none overflow-hidden bg-[#fff4f8]" data-testid="love-smash-online" data-host={isHost}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block" role="img" aria-label={`Doubles court. ${team(myTeam).name} ${score[myTeam]}, ${team(theirTeam).name} ${score[theirTeam]}.`} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 px-2 pt-[max(env(safe-area-inset-top),8px)] sm:px-4">
        <ScoreCard competitor={team(myTeam)} score={score[myTeam]} serving={serverSlot % 2 === myTeam} matchPoint={matchPoint === myTeam} testId="score-me" />
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-1 shadow-[var(--shadow-soft)] ring-2 ring-white" data-testid="scoreline">
            <span key={`a${score[myTeam]}`} className="animate-[score-bump_.35s_ease-out] font-display text-2xl font-bold tabular-nums text-sakura-500">
              {score[myTeam]}
            </span>
            <span className="text-cocoa-400">-</span>
            <span key={`b${score[theirTeam]}`} className="animate-[score-bump_.35s_ease-out] font-display text-2xl font-bold tabular-nums text-lavender-400">
              {score[theirTeam]}
            </span>
          </div>
          <div className="flex gap-1">
            <span className={cn("grid size-9 place-items-center rounded-full bg-white/90 shadow-[var(--shadow-soft)]", status === "connected" ? "text-mint-600" : "text-rose-err")} aria-label={`Connection ${status}`} data-testid="connection" data-status={status}>
              <Wifi size={16} />
            </span>
            <button type="button" onClick={() => onLeave("left")} className="grid size-9 place-items-center rounded-full bg-white/90 text-plum-700 shadow-[var(--shadow-soft)]" aria-label="Leave match">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <ScoreCard competitor={team(theirTeam)} score={score[theirTeam]} serving={serverSlot % 2 === theirTeam} matchPoint={matchPoint === theirTeam} align="right" testId="score-rival" />
      </div>
      {toast ? (
        <div key={toast.id} className="pointer-events-none absolute inset-x-0 top-[5.5rem] z-10 flex justify-center px-4">
          <p className={cn("animate-[toast-in_.25s_ease-out] rounded-full px-4 py-1.5 font-display text-sm font-semibold text-white shadow-[var(--shadow-soft)]", toast.win ? "bg-sakura-400" : "bg-lavender-300")}>{toast.text}</p>
        </div>
      ) : null}
      {serverSlot === mySlot && !intro && score[0] + score[1] >= 0 ? (
        <div className={cn("pointer-events-none absolute inset-x-0 z-10 flex justify-center", touch ? "bottom-[232px]" : "bottom-8")}>
          <p className="rounded-full bg-white/90 px-4 py-1.5 font-display text-sm font-semibold text-plum-700 shadow-[var(--shadow-soft)]">{touch ? "Your serve: 🏸 HIT high · 🌸 DROP short" : "Your serve: J high · L short"}</p>
        </div>
      ) : null}
      {waiting.length ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-plum-900/25 backdrop-blur-[2px]" role="dialog" aria-label="Waiting for players" data-testid="waiting-overlay">
          <div className="max-w-xs rounded-[1.75rem] bg-[#fffaf6] p-6 text-center shadow-[var(--shadow-soft)]">
            <p className="font-display text-xl font-bold text-plum-700">Waiting for {waiting.join(" & ")}…</p>
            <p className="mt-1 text-sm text-cocoa-400">The match is paused until they reconnect. It ends without rewards after 45 seconds.</p>
            <Button variant="soft" className="mt-3" onClick={() => onLeave("left")}>
              Leave match
            </Button>
          </div>
        </div>
      ) : null}
      {saving ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <p className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-semibold text-plum-700 shadow-[var(--shadow-soft)]" data-testid="online-saving">
            {saving}
          </p>
        </div>
      ) : null}
      {touch && !intro ? (
        <TouchControls
          onMove={(x, y) => {
            joystick.current = { x, y };
          }}
          onPress={(kind) => presses.current.add(kind)}
        />
      ) : null}
      {intro ? <Intro step={intro} me={team(myTeam)} rival={team(theirTeam)} onSkip={endIntro} /> : null}
    </div>
  );
}
