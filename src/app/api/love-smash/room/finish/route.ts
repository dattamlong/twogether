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
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: { roomId?: unknown; logs?: unknown } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (typeof body?.roomId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { data: room } = await supabase.from("love_smash_rooms").select("id, host_id, status, config, career_id, seed").eq("id", body.roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  if (room.host_id !== auth.user.id) return NextResponse.json({ error: "not_host" }, { status: 403 });
  if (room.status !== "playing" || !room.config) return NextResponse.json({ error: "room_closed" }, { status: 409 });

  const replay = replayWithLogs(room.config as unknown as MatchConfig, body.logs);
  if (!replay.ok) return NextResponse.json({ error: replay.reason }, { status: 422 });
  const m = replay.match;
  const playerStats = Object.fromEntries(m.stats.players.map((p, slot) => [String(slot), p]));
  if (room.career_id) {
    const admin = getAdminSupabase();
    const { data: career } = await admin.from("love_smash_careers").select("state").eq("id", room.career_id).single();
    const state = career!.state as unknown as CareerState;
    let applied;
    try {
      applied = applyResult(state, m.winner === 0, [m.score[0], m.score[1]], room.seed ?? 1);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "career_conflict" }, { status: 409 });
    }
    const { data, error } = await admin.rpc("finish_love_smash_room_career", {
      target_room: room.id,
      winner_team: m.winner!,
      final_scores: [m.score[0], m.score[1]],
      match_ticks: replay.ticks,
      rally_record: m.stats.longestRally,
      player_stats: playerStats,
      expected_version: state.version,
      new_state: applied.state as never,
      trophy: (applied.outcome.trophy ?? null) as unknown as string,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: error.message === "too_fast" ? 422 : 400 });
    return NextResponse.json({ room: data, outcome: applied.outcome });
  }
  const { data, error } = await getAdminSupabase().rpc("finish_love_smash_room", {
    target_room: room.id,
    winner_team: m.winner!,
    final_scores: [m.score[0], m.score[1]],
    match_ticks: replay.ticks,
    rally_record: m.stats.longestRally,
    player_stats: playerStats,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message === "too_fast" ? 422 : 400 });
  return NextResponse.json({ room: data });
}
