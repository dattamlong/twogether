"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { ItemArt } from "@/components/rewards/item-art";
import { Button } from "@/components/ui/button";
import { CoinIcon, StarIcon } from "@/components/ui/icons";
import { Panel, PanelTitle, Vi } from "@/components/ui/panel";
import { CHARACTERS, currentOpponent, entrantName, PLAYER, rivalLine, roundNames, TIERS, type CareerKind, type CareerState, type Entrant, type Outcome } from "@/features/love-smash/career";
import { CAREER_ERRORS, careerKey, chooseTournament, createCareer, createCareerRoom, finishCareerMatch, startCareerMatch, useCareers, type CareerRow } from "@/features/love-smash/career-queries";
import type { MatchConfig } from "@/features/love-smash/net";
import type { LoveSmashReward } from "@/features/love-smash/queries";
import { useInvalidateProgress } from "@/features/progression/queries";
import { qk } from "@/features/query-keys";
import { useSession } from "@/features/session/use-session";
import { DEFAULT_AVATAR, readAvatar } from "@/features/session/types";
import { cn } from "@/lib/utils";
import { SmashGame, type Competitor, type MatchSummary } from "./smash-game";

const KINDS: { kind: CareerKind; label: string; vi: string; blurb: string }[] = [
  { kind: "solo", label: "🏸 Solo Career", vi: "Sự nghiệp đơn", blurb: "Singles tournaments against AI rivals." },
  { kind: "solo_doubles", label: "👥 Doubles Career", vi: "Đánh đôi cùng AI", blurb: "You and Kiko 🤖 against AI doubles teams." },
  { kind: "couple", label: "💗 Couple Career", vi: "Sự nghiệp cặp đôi", blurb: "You and your partner, each on your own device, against AI teams." },
];

const STYLE_LABEL: Record<string, string> = { balanced: "All-rounder", aggressive: "Attacker", defensive: "Defender", trickster: "Deceiver", sleepy: "Sleepy", striker: "Fast striker" };

const character = (id: string): Competitor => (CHARACTERS[id] ? { name: CHARACTERS[id].name, avatar: CHARACTERS[id].avatar } : { name: id, avatar: DEFAULT_AVATAR });

type Playing = { matchId: string; config: MatchConfig; career: CareerRow; opponent: Entrant; seed: number };
type Result = { outcome: Outcome; reward: LoveSmashReward | null; score: [number, number]; error: string | null; state: CareerState | null; tier: number };

const message = (e: unknown) => {
  const raw = e instanceof Error ? e.message : String(e);
  return CAREER_ERRORS[raw] ?? raw;
};

export function CareerHub() {
  const { data: session } = useSession();
  const careers = useCareers(session?.userId);
  const client = useQueryClient();
  const router = useRouter();
  const invalidate = useInvalidateProgress();
  const [kind, setKind] = useState<CareerKind>("solo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const me = useMemo<Competitor>(() => ({ name: session?.profile.display_name ?? "You", avatar: session ? readAvatar(session.profile.avatar) : DEFAULT_AVATAR }), [session]);
  const career = careers.data?.find((c) => c.kind === kind) ?? null;
  const state = career?.state ?? null;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await client.invalidateQueries({ queryKey: careerKey });
    } catch (e) {
      setError(message(e));
      await client.invalidateQueries({ queryKey: careerKey });
    } finally {
      setBusy(false);
    }
  };

  const play = async () => {
    if (!career) return;
    setBusy(true);
    setError(null);
    try {
      if (career.kind === "couple") {
        const { roomId } = await createCareerRoom(career.id);
        router.push(`/games/love-smash?room=${roomId}&view=room`);
        return;
      }
      const started = await startCareerMatch(career.id);
      setPlaying({ matchId: started.matchId, config: started.config, career, opponent: started.opponent, seed: started.seed });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (summary: MatchSummary) => {
    const current = playing!;
    setPlaying(null);
    const tier = current.career.state.current!.tier;
    try {
      const done = await finishCareerMatch(current.matchId, { inputs: { 0: summary.log }, puppets: {} });
      setResult({ outcome: done.outcome, reward: done.reward, score: done.score, error: null, state: done.state, tier });
      void invalidate();
      void client.invalidateQueries({ queryKey: qk.loveSmashStats });
    } catch (e) {
      setResult({ outcome: { won: summary.match.winner === 0, champion: false, trophy: null, title: null, unlockedTier: null, roundName: "", nextOpponent: null }, reward: null, score: [summary.match.score[0], summary.match.score[1]], error: message(e), state: null, tier });
    }
    await client.invalidateQueries({ queryKey: careerKey });
  };

  if (playing) {
    const b = playing.career.state.current!;
    const tier = TIERS[b.tier - 1];
    const opp = playing.opponent;
    const doubles = opp.members.length > 1;
    const roundName = roundNames(tier.size)[b.round];
    const lead = CHARACTERS[opp.members[0]];
    return (
      <SmashGame
        key={playing.matchId}
        seed={playing.seed}
        difficulty="normal"
        config={playing.config}
        format={doubles ? "doubles" : "singles"}
        teammates={doubles ? [character("kiko"), character(opp.members[1])] : undefined}
        arena={tier.arena}
        introInfo={{ title: `${tier.emoji} ${tier.name.toUpperCase()}`, round: roundName.toUpperCase(), rivalTitle: opp.story === "boss" && lead?.title ? lead.title : lead?.title, lines: rivalLine(playing.career.state, opp) }}
        me={me}
        rival={character(opp.members[0])}
        onFinished={(summary) => void finish(summary)}
        onRestart={() => setPlaying(null)}
        onQuit={() => setPlaying(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="career-hub">
      <Link href="/games/love-smash" className="flex w-fit items-center gap-1 text-sm font-semibold text-plum-500 hover:text-plum-700">
        <ArrowLeft size={16} /> Love Smash
      </Link>
      <header className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-gold-200 via-sakura-100 to-lavender-100 p-6 ring-2 ring-white shadow-[var(--shadow-soft)]">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.25em] text-gold-500">Love Smash</p>
        <h1 className="font-display text-4xl font-bold text-plum-700 sm:text-5xl">🏆 ROAD TO LEGEND</h1>
        <p className="font-display text-lg text-plum-500">Your Journey to World Champion</p>
        <Vi>Từ tân binh đến nhà vô địch thế giới</Vi>
        <div role="tablist" aria-label="Career type" className="mt-4 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="tab"
              aria-selected={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setError(null);
              }}
              className={cn("rounded-2xl px-4 py-2 font-display font-semibold ring-2 transition", kind === k.kind ? "bg-white text-plum-700 ring-sakura-300 shadow-[var(--shadow-pop)]" : "bg-white/50 text-plum-500 ring-white")}
              data-testid={`career-tab-${k.kind}`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p role="alert" className="rounded-2xl bg-sakura-50 px-4 py-3 text-sm font-semibold text-rose-err">
          {error}
        </p>
      ) : null}

      {result ? <CareerResult result={result} me={me} onClose={() => setResult(null)} onNext={() => {
        setResult(null);
        void play();
      }} /> : null}

      {!career ? (
        <Panel className="flex flex-col items-start gap-3" data-testid="career-empty">
          <PanelTitle title={KINDS.find((k) => k.kind === kind)!.label} subtitle={<Vi>{KINDS.find((k) => k.kind === kind)!.vi}</Vi>} />
          <p className="text-plum-500">{KINDS.find((k) => k.kind === kind)!.blurb} Seven championships from the Sakura Rookie Cup to the Legends Championship. Your progress is saved on the server and continues on any device.</p>
          <Button size="lg" loading={busy} onClick={() => void act(() => createCareer(kind))} data-testid="career-create">
            {kind === "couple" ? "Begin our journey 💗" : "Begin the journey"}
          </Button>
        </Panel>
      ) : (
        <>
          <TournamentMap state={state!} busy={busy} onPick={(tier) => void act(() => chooseTournament(career.id, tier))} />
          {kind === "couple" ? <CoupleCareerNotice /> : null}
          {state!.current ? <TournamentPanel state={state!} me={me} busy={busy} onPlay={() => void play()} /> : null}
          <TrophyRoom state={state!} />
        </>
      )}
    </div>
  );
}

function CoupleCareerNotice() {
  return (
    <Panel data-testid="career-couple">
      <PanelTitle title="💗 Couple Career" subtitle={<Vi>Sự nghiệp cặp đôi</Vi>} />
      <p className="text-plum-500">One shared journey: either of you can pick the tournament, and progress, rewards and trophies belong to you both.</p>
      <p className="mt-2 rounded-2xl bg-lavender-100 px-3 py-2 text-sm font-semibold text-plum-500">Press Play to open a match room — your partner gets an invite, joins on their own device, and you face the AI team together.</p>
    </Panel>
  );
}

function TournamentMap({ state, busy, onPick }: { state: CareerState; busy: boolean; onPick: (tier: number) => void }) {
  return (
    <Panel data-testid="tournament-map">
      <PanelTitle title="Championship map" subtitle={<Vi>Bản đồ giải đấu</Vi>} />
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {TIERS.map((t) => {
          const champion = state.champions.includes(t.tier);
          const active = state.current?.tier === t.tier && state.current.status === "active";
          const locked = t.tier > state.unlocked;
          const status = champion ? (active ? "In progress" : "Champion") : active ? "In progress" : locked ? "Locked" : "Available";
          return (
            <li key={t.tier}>
              <button
                type="button"
                disabled={locked || busy || active}
                onClick={() => onPick(t.tier)}
                className={cn(
                  "flex h-full w-full flex-col items-center gap-1 rounded-3xl p-3 text-center ring-2 transition",
                  locked ? "cursor-not-allowed bg-white/40 ring-white opacity-60" : active ? "bg-white ring-sakura-400 shadow-[var(--shadow-pop)]" : champion ? "bg-gold-200/60 ring-gold-300" : "bg-white/80 ring-white hover:-translate-y-0.5",
                )}
                data-testid={`tier-${t.tier}`}
                data-status={status}
                aria-label={`${t.name}, ${status}`}
              >
                <span className="text-3xl" aria-hidden>
                  {locked ? "🔒" : t.emoji}
                </span>
                <span className="font-display text-sm font-semibold leading-tight text-plum-700">{t.name}</span>
                <span className="text-[0.65rem] text-cocoa-400">{"★".repeat(t.tier)}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", champion ? "bg-gold-300 text-plum-900" : active ? "bg-sakura-400 text-white" : locked ? "bg-lavender-100 text-plum-500" : "bg-mint-100 text-mint-600")}>
                  {champion ? "🏆 Champion" : status}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-cocoa-400">Win a championship to unlock the next one. Champions can replay any unlocked tournament.</p>
    </Panel>
  );
}

function TournamentPanel({ state, me, busy, onPlay }: { state: CareerState; me: Competitor; busy: boolean; onPlay: () => void }) {
  const b = state.current!;
  const tier = TIERS[b.tier - 1];
  const names = roundNames(tier.size);
  const opponent = currentOpponent(b);
  const lines = rivalLine(state, opponent);
  const label = (e: Entrant) => entrantName(e, me.name);
  return (
    <Panel data-testid="tournament-panel" data-round={b.round} data-status={b.status}>
      <PanelTitle title={`${tier.emoji} ${tier.name}`} subtitle={<Vi>{tier.subtitle}</Vi>} />
      {b.status === "champion" ? (
        <p className="mb-3 rounded-2xl bg-gold-200/60 px-4 py-3 font-display font-semibold text-plum-700">🏆 You are the {tier.name} champion! Pick the next tournament on the map.</p>
      ) : opponent ? (
        <div className="mb-4 flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-sakura-50 to-lavender-100 p-4 ring-2 ring-white" data-testid="next-match">
          <div className="flex -space-x-3">
            {opponent.members.map((id) => (
              <AvatarFace key={id} avatar={CHARACTERS[id]?.avatar ?? DEFAULT_AVATAR} size={56} className="rounded-full ring-4 ring-white" />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-sakura-500">{names[b.round]}{b.attempts ? ` · retry ${b.attempts}` : ""}</p>
            <p className="font-display text-xl font-bold text-plum-700" data-testid="next-opponent">
              {label(opponent)}
            </p>
            <p className="text-sm text-cocoa-400">
              {opponent.members.map((id) => CHARACTERS[id]?.title ?? STYLE_LABEL[CHARACTERS[id]?.style ?? "balanced"]).join(" · ")}
              {opponent.story === "boss" ? " · 👑 Final boss" : ""}
            </p>
            {lines.map((line) => (
              <p key={line} className="mt-1 text-sm italic text-plum-500">
                {line}
              </p>
            ))}
          </div>
          <Button size="lg" loading={busy} onClick={onPlay} data-testid="career-play">
            ▶ Play {names[b.round]}
          </Button>
        </div>
      ) : null}
      <div className="overflow-x-auto" data-testid="bracket">
        <div className="flex min-w-max gap-4">
          {names.map((name, r) => {
            const matches = b.rounds[r];
            return (
              <section key={name} className="flex w-44 flex-col gap-2">
                <p className={cn("text-xs font-semibold uppercase tracking-wider", r === b.round && b.status === "active" ? "text-sakura-500" : "text-cocoa-400")}>{name}</p>
                {matches ? (
                  matches.map((m, i) => (
                    <div key={i} className={cn("rounded-2xl bg-white/80 p-2 text-xs ring-2", m.a === 0 || m.b === 0 ? "ring-sakura-300" : "ring-white")}>
                      {[m.a, m.b].map((idx, k) => {
                        const e = b.entrants[idx];
                        const winner = m.winner === idx;
                        return (
                          <p key={k} className={cn("flex items-center justify-between gap-1 truncate", winner ? "font-bold text-plum-700" : m.winner !== undefined ? "text-cocoa-400 line-through" : "text-plum-500", e.members.includes(PLAYER) && "text-sakura-500")}>
                            <span className="truncate">{label(e)}</span>
                            {m.score ? <span className="tabular-nums">{m.score[k]}</span> : null}
                          </p>
                        );
                      })}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white/40 p-2 text-xs text-cocoa-400">To be decided</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-cocoa-400">
        Career record {state.stats.wins}W – {state.stats.losses}L · Losing never resets your progress — just retry the match.
      </p>
    </Panel>
  );
}

function TrophyRoom({ state }: { state: CareerState }) {
  return (
    <Panel data-testid="trophy-room">
      <PanelTitle title="🏆 Trophy Room" subtitle={<Vi>Phòng cúp — cúp cũng xuất hiện trong Our Home → Decorate</Vi>} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {TIERS.map((t) => {
          const won = state.champions.includes(t.tier);
          return (
            <li key={t.tier} className={cn("flex flex-col items-center gap-1 rounded-3xl p-3 text-center ring-2", won ? "bg-gold-200/50 ring-gold-300" : "bg-white/50 ring-white opacity-60")} data-testid={`trophy-${t.tier}`} data-won={won}>
              {won ? <ItemArt itemId={t.trophy} size={56} /> : <Lock size={40} className="my-2 text-lavender-300" aria-hidden />}
              <p className="font-display text-xs font-semibold text-plum-700">{t.name}</p>
              <p className="text-[0.65rem] text-cocoa-400">{won ? t.title : "Not won yet"}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function CareerResult({ result, me, onClose, onNext }: { result: Result; me: Competitor; onClose: () => void; onNext: () => void }) {
  const { outcome, reward, score, error } = result;
  const tier = TIERS[result.tier - 1];
  const next = outcome.nextOpponent;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-plum-900/30 p-4 backdrop-blur-sm" role="dialog" aria-label="Career match result" data-testid="career-result" data-won={outcome.won} data-champion={outcome.champion}>
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[2rem] bg-[#fffaf6] p-6 text-center shadow-[var(--shadow-soft)]">
        {outcome.champion ? (
          <>
            <ItemArt itemId={tier.trophy} size={96} className="animate-[legend-hop_.8s_ease-in-out_infinite]" />
            <p className="font-display text-3xl font-bold text-plum-700">🏆 {tier.name.toUpperCase()} CHAMPIONS!</p>
            <p className="font-display text-lg text-sakura-500">{me.name} — {outcome.title}</p>
          </>
        ) : (
          <p className="font-display text-4xl font-bold text-plum-700">{outcome.won ? "Victory! 🎉" : "Defeat 💧"}</p>
        )}
        <p className="font-display text-2xl tabular-nums text-plum-500" data-testid="career-score">
          {score[0]} – {score[1]}
        </p>
        {outcome.roundName ? <p className="text-sm text-cocoa-400">{tier.name} · {outcome.roundName}</p> : null}
        {error ? (
          <p className="text-sm font-semibold text-rose-err">Result not saved ({error}). Your career did not change.</p>
        ) : reward ? (
          <div className="flex items-center gap-4 font-display text-lg font-semibold text-plum-700" data-testid="career-reward">
            <span className="flex items-center gap-1">
              <StarIcon size={20} /> +{reward.xp} XP
            </span>
            {reward.coins > 0 ? (
              <span className="flex items-center gap-1">
                <CoinIcon size={20} /> +{reward.coins}
              </span>
            ) : null}
            {outcome.trophy ? (
              <span className="flex items-center gap-1">
                <Trophy size={20} /> Trophy
              </span>
            ) : null}
          </div>
        ) : null}
        {outcome.unlockedTier ? <p className="rounded-full bg-mint-100 px-3 py-1 text-sm font-semibold text-mint-600">🔓 {TIERS[outcome.unlockedTier - 1].name} unlocked!</p> : null}
        {!outcome.won && !error ? <p className="text-sm text-plum-500">No progress lost — you can retry this match right away.</p> : null}
        {next && outcome.won ? (
          <p className="text-sm text-plum-500" data-testid="career-next">
            Next: <strong>{entrantName(next, me.name)}</strong>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {!outcome.champion && !error ? (
            <Button onClick={onNext} data-testid="career-continue">
              {outcome.won ? "▶ Next match" : "🔄 Retry"}
            </Button>
          ) : null}
          <Button variant="soft" onClick={onClose}>
            Career hub
          </Button>
        </div>
      </div>
    </div>
  );
}
