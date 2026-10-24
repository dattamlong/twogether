"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarFace } from "@/components/couple/avatar-face";
import { ChallengeRunner } from "@/components/universe/challenge-runner";
import { Button } from "@/components/ui/button";
import { TrophyIcon } from "@/components/ui/icons";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import type { QuestionCard } from "@/features/learning/types";
import { readAvatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { finishDuel, startDuel, useGameInvitations, worldKeys } from "@/features/world/queries";
import type { GameInvitation, PlayerCard } from "@/features/world/types";
import { sfx } from "@/lib/sfx";

function Side({ player, result, label }: { player: PlayerCard; result?: GameInvitation["results"][number]; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-3xl bg-white/80 p-3">
      <AvatarFace avatar={readAvatar(player.avatar)} size={64} />
      <p className="font-display font-semibold text-plum-700">{player.name}</p>
      <p className="text-[11px] font-bold uppercase text-cocoa-400">{label}</p>
      <p className="font-display text-3xl font-bold text-plum-700">{result?.finished ? `${result.correct}/${result.total}` : "—"}</p>
      <p className="text-xs text-cocoa-400">{result?.finished ? "finished" : result ? "playing…" : "not started"}</p>
    </div>
  );
}

export function DuelScreen() {
  const { id } = useParams<{ id: string }>();
  const session = useRequiredSession();
  const router = useRouter();
  const client = useQueryClient();
  const invitations = useGameInvitations();
  const [run, setRun] = useState<{ sessionId: string; questions: QuestionCard[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inv = invitations.data?.find((i) => i.id === id);

  if (invitations.isLoading) return <LoadingBlock />;
  if (invitations.error) return <ErrorBlock error={invitations.error} onRetry={() => invitations.refetch()} />;
  if (!inv) return <ErrorBlock error="invitation_not_found" />;

  const me = inv.incoming ? inv.to : inv.from;
  const them = inv.incoming ? inv.from : inv.to;
  const mine = inv.results.find((r) => r.userId === session.userId);
  const theirs = inv.results.find((r) => r.userId !== session.userId);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const started = await startDuel(id);
      setRun({ sessionId: started.sessionId, questions: started.questions });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!run) return;
    setBusy(true);
    try {
      await finishDuel(run.sessionId);
      sfx.levelUp();
      setRun(null);
      await client.invalidateQueries({ queryKey: worldKeys.invitations });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (run) {
    return (
      <ChallengeRunner
        key={run.sessionId}
        sessionId={run.sessionId}
        questions={run.questions}
        onLeave={() => router.push("/world?tab=friends")}
        onFinish={finish}
        finishing={busy}
        error={error}
        header={({ correct }) => (
          <div className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sakura-100 to-lavender-100 px-4 py-2 text-sm font-semibold text-plum-700">
            <Swords size={18} /> Word Duel vs {them.name} · {correct} correct so far
          </div>
        )}
      />
    );
  }

  const bothDone = Boolean(mine?.finished && theirs?.finished);
  const outcome = bothDone ? ((mine!.correct ?? 0) > (theirs!.correct ?? 0) ? "win" : (mine!.correct ?? 0) < (theirs!.correct ?? 0) ? "lose" : "tie") : null;

  return (
    <Panel className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Swords size={40} className="text-sakura-400" />
        <div>
          <h1 className="text-2xl font-bold">Word Duel</h1>
          <Vi>Hai người trả lời cùng 8 câu từ vựng — ai đúng nhiều hơn thắng.</Vi>
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        <Side player={me} result={mine} label="You" />
        <span className="self-center font-display text-xl font-bold text-cocoa-400">vs</span>
        <Side player={them} result={theirs} label="Opponent" />
      </div>
      {outcome ? (
        <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center justify-center gap-2 font-display text-2xl font-bold text-plum-700">
          {outcome === "win" ? (
            <>
              <TrophyIcon size={32} /> You win!
            </>
          ) : outcome === "lose" ? (
            `${them.name} wins — rematch?`
          ) : (
            "It's a tie!"
          )}
        </motion.p>
      ) : null}
      <p className="text-xs text-cocoa-400">Duels are for fun and practice: they don&apos;t give XP or Love Legends points, so they can&apos;t be farmed. Your answers still feed Smart Review.</p>
      {error ? <ErrorBlock error={error} /> : null}
      {inv.status === "accepted" && !mine?.finished ? (
        <Button size="lg" onClick={begin} loading={busy}>
          {mine ? "Continue duel" : "Start duel"}
        </Button>
      ) : inv.status === "pending" ? (
        <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-plum-500">{inv.incoming ? "Accept this duel from the Friends tab to play." : `Waiting for ${them.name} to accept…`}</p>
      ) : inv.status !== "accepted" ? (
        <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-plum-500">This invitation is {inv.status}.</p>
      ) : !theirs?.finished ? (
        <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-plum-500">Waiting for {them.name} to finish. You&apos;ll see the result here.</p>
      ) : null}
      <Button asChild variant="soft">
        <Link href="/world?tab=friends">Back to Friends</Link>
      </Button>
    </Panel>
  );
}
