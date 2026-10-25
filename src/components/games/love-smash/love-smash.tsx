"use client";

import { ArrowLeft, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CoinIcon, StarIcon } from "@/components/ui/icons";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { botThink, createBotMind, type Difficulty } from "@/features/love-smash/bot";
import { startLoveSmash, submitLoveSmash, useLoveSmashStats, type LoveSmashReward, type PlayableDifficulty } from "@/features/love-smash/queries";
import { createFx, makeCamera, render, snapshot, updateFx } from "@/features/love-smash/render";
import { createMatch, step } from "@/features/love-smash/sim";
import { useInvalidateProgress } from "@/features/progression/queries";
import { qk } from "@/features/query-keys";
import { useSession } from "@/features/session/use-session";
import { DEFAULT_AVATAR, readAvatar, type Avatar } from "@/features/session/types";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { SmashGame, type Competitor, type MatchSummary } from "./smash-game";

const RIVALS: Record<Difficulty, Competitor> = {
  easy: { name: "Sleepy Mochi", avatar: { ...DEFAULT_AVATAR, hair: "bun", hairColor: "#c7b8ea", outfitColor: "#bce5d5" } },
  normal: { name: "Coach Mochi", avatar: { ...DEFAULT_AVATAR, hair: "short", hairColor: "#6a5583", skin: "#f6d0b8", outfitColor: "#b8ddf5", accessory: "beanie" } },
  hard: { name: "Captain Mochi", avatar: { ...DEFAULT_AVATAR, hair: "spiky", hairColor: "#d45a86", outfitColor: "#f5cb78", accessory: "glasses" } },
  feeder: { name: "Coach Mochi", avatar: { ...DEFAULT_AVATAR, hair: "short", hairColor: "#6a5583", skin: "#f6d0b8", outfitColor: "#b8ddf5", accessory: "beanie" } },
};

const LEVELS: { id: PlayableDifficulty; label: string; vi: string; blurb: string }[] = [
  { id: "easy", label: "Easy", vi: "Dễ", blurb: "Slow and forgiving" },
  { id: "normal", label: "Normal", vi: "Vừa", blurb: "Balanced rallies" },
  { id: "hard", label: "Hard", vi: "Khó", blurb: "Smart and fast" },
];

const SOON = [
  { title: "Online 1v1", vi: "Đấu online 1-1", detail: "Real-time matches with server-checked results" },
  { title: "Couple 2v2", vi: "Cặp đôi 2-2", detail: "You and your partner vs another couple" },
  { title: "Private Room", vi: "Phòng riêng", detail: "Invite friends with a room code" },
  { title: "Ranked", vi: "Xếp hạng", detail: "Skill rating and seasons" },
];

type View =
  | { kind: "lobby" }
  | { kind: "playing"; matchId: string; seed: number; difficulty: PlayableDifficulty }
  | { kind: "tutorial"; seed: number }
  | { kind: "results"; summary: MatchSummary; matchId: string; difficulty: PlayableDifficulty };

const submitted = new Map<string, Promise<LoveSmashReward>>();

function submitOnce(matchId: string, log: number[]) {
  let pending = submitted.get(matchId);
  if (!pending) {
    pending = submitLoveSmash(matchId, log);
    submitted.set(matchId, pending);
  }
  return pending;
}

function Preview({ avatar }: { avatar: Avatar }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let seed = 7;
    let match = createMatch({ seed, difficulty: "normal" });
    let mind = createBotMind("normal", seed + 1);
    const fx = createFx();
    let prev = snapshot(match);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = makeCamera(rect.width, rect.height);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);
    const draw = (dt: number) => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      render(ctx, cam, rect.width, rect.height, { match, prev, alpha: acc * 60, avatars: [avatar, RIVALS.normal.avatar], fx, showLanding: false, dt });
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!visible || document.hidden) return;
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        prev = snapshot(match);
        step(match, botThink(match, mind, 0));
        if (match.phase === "over" || match.tick > 60 * 90) {
          seed++;
          match = createMatch({ seed, difficulty: "normal" });
          mind = createBotMind("normal", seed + 1);
          prev = snapshot(match);
        }
      }
      updateFx(fx, dt, true);
      draw(dt);
    };
    if (reduced) {
      for (let i = 0; i < 150; i++) step(match, botThink(match, mind, 0));
      prev = snapshot(match);
      draw(0);
    } else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [avatar, reduced]);
  return <canvas ref={ref} className="h-56 w-full rounded-[1.5rem] sm:h-72" aria-label="Love Smash preview: two chibi players rallying" role="img" />;
}

export function LoveSmash() {
  const { data: session } = useSession();
  const stats = useLoveSmashStats(session?.userId);
  const [view, setView] = useState<View>({ kind: "lobby" });
  const [difficulty, setDifficulty] = useState<PlayableDifficulty>("normal");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const me = useMemo<Competitor>(
    () => ({ name: session?.profile.display_name ?? "You", avatar: session ? readAvatar(session.profile.avatar) : DEFAULT_AVATAR }),
    [session],
  );

  const start = async (level: PlayableDifficulty) => {
    setStarting(true);
    setError(null);
    try {
      const { matchId, seed } = await startLoveSmash(level);
      setView({ kind: "playing", matchId, seed, difficulty: level });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a match");
    } finally {
      setStarting(false);
    }
  };

  if (view.kind === "playing") {
    return (
      <SmashGame
        key={view.matchId}
        seed={view.seed}
        difficulty={view.difficulty}
        me={me}
        rival={RIVALS[view.difficulty]}
        onFinished={(summary) => setView({ kind: "results", summary, matchId: view.matchId, difficulty: view.difficulty })}
        onRestart={() => void start(view.difficulty)}
        onQuit={() => setView({ kind: "lobby" })}
      />
    );
  }
  if (view.kind === "tutorial") {
    return <SmashGame key={`tutorial-${view.seed}`} seed={view.seed} difficulty="feeder" tutorial me={me} rival={RIVALS.feeder} onFinished={() => setView({ kind: "lobby" })} onRestart={() => undefined} onQuit={() => setView({ kind: "lobby" })} />;
  }

  const s = stats.data;
  const winRate = s && s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;

  return (
    <div className="flex flex-col gap-5" data-testid="love-smash-lobby">
      {view.kind === "results" ? <Results view={view} me={me} onAgain={() => void start(view.difficulty)} onLobby={() => setView({ kind: "lobby" })} starting={starting} /> : null}
      <Link href="/games" className="flex w-fit items-center gap-1 text-sm font-semibold text-plum-500 hover:text-plum-700">
        <ArrowLeft size={16} /> Games
      </Link>
      <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-sakura-100 via-lavender-100 to-sky-100 p-5 ring-2 ring-white shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-sakura-500">Twogether</p>
            <h1 className="font-display text-4xl font-bold text-plum-700 sm:text-5xl">Love Smash! 🏸💗</h1>
            <p className="font-display text-lg text-plum-500">Smash Together. Win Together.</p>
            <Vi>Cầu lông chibi — đập cầu cùng nhau, chiến thắng cùng nhau</Vi>
          </div>
        </div>
        <div className="mt-4">
          <Preview avatar={me.avatar} />
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl bg-sakura-50 px-4 py-3 text-sm font-semibold text-rose-err">
          {error === "too_many_open_matches" ? "Too many unfinished matches — finish one or wait a few minutes." : `Could not start a match (${error}).`}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelTitle title="Practice vs Bot" subtitle={<Vi>Đấu với bot — đến 7 điểm, cách 2</Vi>} />
          <div role="radiogroup" aria-label="Bot difficulty" className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={difficulty === l.id}
                onClick={() => setDifficulty(l.id)}
                className={cn("rounded-2xl px-3 py-3 text-left ring-2 transition", difficulty === l.id ? "bg-sakura-100 ring-sakura-300" : "bg-white/70 ring-white hover:bg-white")}
              >
                <p className="font-display font-semibold text-plum-700">{l.label}</p>
                <p lang="vi" className="text-xs text-cocoa-400">
                  {l.vi} · {l.blurb}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => void start(difficulty)} loading={starting} data-testid="start-practice">
              🏸 Play vs {RIVALS[difficulty].name}
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setView({ kind: "tutorial", seed: Date.now() % 100000 })} data-testid="start-tutorial">
              How to Play
            </Button>
          </div>
          <p className="mt-3 text-sm text-cocoa-400">Rewards: +20 XP per match, +50 XP for a win, +100 Love Coins for your first win each day. Results are verified by the server; XP stops after 10 matches a day.</p>
        </Panel>

        <Panel>
          <PanelTitle title="Your Love Smash stats" subtitle={<Vi>Thống kê của bạn</Vi>} />
          <dl className="grid grid-cols-2 gap-2 text-sm" data-testid="love-smash-stats">
            {[
              ["Matches", s?.matches ?? 0],
              ["Win rate", `${winRate}%`],
              ["Wins", s?.wins ?? 0],
              ["Losses", s?.losses ?? 0],
              ["Longest rally", s?.longest_rally ?? 0],
              ["Perfect hits", s?.perfect_hits ?? 0],
              ["Smashes", s?.smashes ?? 0],
              ["Couple wins", s?.couple_wins ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-white/70 px-3 py-2">
                <dt className="text-xs font-semibold text-cocoa-400">{label}</dt>
                <dd className="font-display text-xl font-bold text-plum-700">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel>
        <PanelTitle title="Controls" subtitle={<Vi>Cách điều khiển</Vi>} />
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <ul className="flex flex-col gap-1 text-plum-500">
            <li><Kbd>W A S D</Kbd> move · steer your aim while hitting</li>
            <li><Kbd>J</Kbd> hit (clear, drive or lift — picked by height) · serve high</li>
            <li><Kbd>K</Kbd> smash a high shuttle</li>
            <li><Kbd>L</Kbd> drop shot · short serve</li>
            <li><Kbd>Space</Kbd> dive for far shuttles · <Kbd>Esc</Kbd> pause</li>
          </ul>
          <ul className="flex flex-col gap-1 text-plum-500">
            <li>📱 Left thumb: joystick · right thumb: 🏸 HIT, 🔥 SMASH, 🌸 DROP, 💨 DIVE</li>
            <li>⏱️ Hit when the shuttle is close and high for a PERFECT; low or stretched hits are LATE</li>
            <li>🌸 A perfect jump smash becomes a SAKURA SMASH</li>
          </ul>
        </div>
      </Panel>

      <section aria-labelledby="smash-soon">
        <h2 id="smash-soon" className="text-xl font-semibold">
          More modes
        </h2>
        <Vi>Đang được xây dựng — chưa chơi được</Vi>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOON.map((m) => (
            <li key={m.title} className="flex flex-col gap-1 rounded-3xl bg-white/60 p-4 opacity-80 ring-2 ring-white">
              <div className="flex items-center justify-between">
                <p className="font-display font-semibold text-plum-700">{m.title}</p>
                <span className="flex items-center gap-1 rounded-full bg-lavender-100 px-2 py-0.5 text-xs font-semibold text-plum-500">
                  <Lock size={12} /> Coming soon
                </span>
              </div>
              <p lang="vi" className="text-xs text-cocoa-400">
                {m.vi}
              </p>
              <p className="text-sm text-plum-500">{m.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-lg bg-white px-1.5 py-0.5 font-display text-xs font-semibold text-plum-700 shadow-[0_2px_0_0_rgb(199_184_234/0.7)]">{children}</kbd>;
}

function Results({ view, me, onAgain, onLobby, starting }: { view: Extract<View, { kind: "results" }>; me: Competitor; onAgain: () => void; onLobby: () => void; starting: boolean }) {
  const invalidate = useInvalidateProgress();
  const client = useQueryClient();
  const [reward, setReward] = useState<LoveSmashReward | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { match } = view.summary;
  const won = match.winner === 0;
  const mine = match.stats.sides[0];

  useEffect(() => {
    let alive = true;
    submitOnce(view.matchId, view.summary.log)
      .then((r) => {
        if (!alive) return;
        setReward(r);
        void invalidate();
        void client.invalidateQueries({ queryKey: qk.loveSmashStats });
      })
      .catch((e: unknown) => {
        if (alive) setFailed(e instanceof Error ? e.message : "save_failed");
      });
    return () => {
      alive = false;
    };
  }, [view.matchId, view.summary.log, invalidate, client]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-plum-900/30 p-4 backdrop-blur-sm" role="dialog" aria-label="Match results" data-testid="love-smash-results" data-won={won}>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[2rem] bg-[#fffaf6] p-6 text-center shadow-[var(--shadow-soft)]">
        <p className="font-display text-4xl font-bold text-plum-700">{won ? "You win! 🏆" : "Good game! 💗"}</p>
        <p className="font-display text-2xl font-semibold tabular-nums text-plum-500" data-testid="final-score">
          {me.name} {match.score[0]} – {match.score[1]} {RIVALS[view.difficulty].name}
        </p>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Longest rally", match.stats.longestRally],
            ["Perfect hits", mine.perfectHits],
            ["Smashes", mine.smashes],
            ["Smash winners", mine.smashWinners],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white px-3 py-2">
              <dt className="text-xs font-semibold text-cocoa-400">{label}</dt>
              <dd className="font-display text-xl font-bold text-plum-700">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-2xl bg-sakura-50 px-4 py-3" data-testid="love-smash-reward" data-state={reward ? "saved" : failed ? "failed" : "saving"}>
          {reward ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-4 font-display text-lg font-semibold text-plum-700">
                <span className="flex items-center gap-1">
                  <StarIcon size={20} /> +{reward.xp} XP
                </span>
                {reward.coins > 0 ? (
                  <span className="flex items-center gap-1">
                    <CoinIcon size={20} /> +{reward.coins}
                  </span>
                ) : null}
              </div>
              {reward.firstWinToday ? <p className="text-sm text-sakura-500">First win of the day bonus! 💗</p> : null}
              {reward.dailyLimitReached ? <p className="text-sm text-cocoa-400">Daily XP limit reached — matches still count for your stats.</p> : null}
            </div>
          ) : failed ? (
            <p className="text-sm font-semibold text-rose-err">Result not saved ({failed}). No rewards were given.</p>
          ) : (
            <p className="text-sm text-cocoa-400">Verifying your match on the server…</p>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={onAgain} loading={starting} data-testid="play-again">
            Play again
          </Button>
          <Button variant="soft" onClick={onLobby}>
            Back to lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
