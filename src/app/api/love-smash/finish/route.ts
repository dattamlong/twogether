import { NextResponse } from "next/server";
import { replayMatch } from "@/features/love-smash/replay";
import type { Difficulty } from "@/features/love-smash/bot";
import type { Loadout } from "@/features/love-smash/skills";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

const MAX_LOG_LENGTH = 60_000;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await getServerSupabase();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { matchId?: unknown; log?: unknown } | null;
  if (typeof body?.matchId !== "string" || !Array.isArray(body.log) || body.log.length > MAX_LOG_LENGTH) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabase
    .from("love_smash_matches")
    .select("id, seed, difficulty, finished_at, loadout")
    .eq("id", body.matchId)
    .maybeSingle();
  if (matchError || !match) return NextResponse.json({ error: "invalid_match" }, { status: 404 });
  if (match.finished_at) return NextResponse.json({ error: "already_finished" }, { status: 409 });

  const replay = replayMatch(match.seed, match.difficulty as Difficulty, body.log, (match.loadout as unknown as Loadout | null) ?? null);
  if (!replay.ok) return NextResponse.json({ error: replay.reason }, { status: 422 });

  const m = replay.match;
  const mine = m.stats.sides[0];
  const { data, error } = await getAdminSupabase().rpc("finish_love_smash", {
    match_id: match.id,
    player: auth.user.id,
    player_won: m.winner === 0,
    final_player_score: m.score[0],
    final_bot_score: m.score[1],
    match_ticks: replay.ticks,
    rally_record: m.stats.longestRally,
    perfect_count: mine.perfectHits,
    smash_count: mine.smashes,
    drop_count: m.stats.players[0].drops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === "too_fast" ? 422 : 400 });
  return NextResponse.json({ result: data, score: m.score, winner: m.winner });
}
