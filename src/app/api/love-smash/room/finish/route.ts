import { NextResponse } from "next/server";
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

  const { data: room } = await supabase.from("love_smash_rooms").select("id, host_id, status, config").eq("id", body.roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "room_not_found" }, { status: 404 });
  if (room.host_id !== auth.user.id) return NextResponse.json({ error: "not_host" }, { status: 403 });
  if (room.status !== "playing" || !room.config) return NextResponse.json({ error: "room_closed" }, { status: 409 });

  const replay = replayWithLogs(room.config as unknown as MatchConfig, body.logs);
  if (!replay.ok) return NextResponse.json({ error: replay.reason }, { status: 422 });
  const m = replay.match;
  const playerStats = Object.fromEntries(m.stats.players.map((p, slot) => [String(slot), p]));
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
