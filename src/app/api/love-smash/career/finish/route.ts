import { NextResponse } from "next/server";
import { applyResult, type CareerState } from "@/features/love-smash/career";
import { replayWithLogs, type MatchConfig } from "@/features/love-smash/net";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

const MAX_BODY = 400_000;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const body = (() => {
    try {
      return JSON.parse(raw) as { matchId?: unknown; logs?: unknown };
    } catch {
      return null;
    }
  })();
  if (typeof body?.matchId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { data: match } = await supabase.from("love_smash_matches").select("id, seed, config, career_id, finished_at").eq("id", body.matchId).maybeSingle();
  if (!match || !match.career_id || !match.config) return NextResponse.json({ error: "invalid_match" }, { status: 404 });
  if (match.finished_at) return NextResponse.json({ error: "already_finished" }, { status: 409 });
  const { data: career } = await supabase.from("love_smash_careers").select("id, state").eq("id", match.career_id).maybeSingle();
  if (!career) return NextResponse.json({ error: "career_not_found" }, { status: 404 });

  const replay = replayWithLogs(match.config as unknown as MatchConfig, body.logs);
  if (!replay.ok) return NextResponse.json({ error: replay.reason }, { status: 422 });
  const m = replay.match;
  const state = career.state as unknown as CareerState;
  const won = m.winner === 0;
  let applied;
  try {
    applied = applyResult(state, won, [m.score[0], m.score[1]], match.seed);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "career_conflict" }, { status: 409 });
  }
  const mine = m.stats.players[0];
  const { data, error } = await getAdminSupabase().rpc("finish_love_smash_career", {
    match_id: match.id,
    player: auth.user.id,
    player_won: won,
    final_player_score: m.score[0],
    final_bot_score: m.score[1],
    match_ticks: replay.ticks,
    rally_record: m.stats.longestRally,
    perfect_count: mine.perfectHits,
    smash_count: mine.smashes,
    drop_count: mine.drops,
    target_career: career.id,
    expected_version: state.version,
    new_state: applied.state as never,
    trophy: (applied.outcome.trophy ?? null) as unknown as string,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === "too_fast" ? 422 : 409 });
  return NextResponse.json({ ...(data as object), outcome: applied.outcome, score: m.score, stats: m.stats });
}
