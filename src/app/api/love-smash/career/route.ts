import { NextResponse } from "next/server";
import { careerMatchConfig, currentOpponent, newCareer, startTournament, TIERS, type CareerKind, type CareerState } from "@/features/love-smash/career";
import type { Loadout } from "@/features/love-smash/skills";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

const freshSeed = () => Math.floor(Math.random() * 2147483646) + 1;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const userId = auth.user.id;
  const body = (await request.json().catch(() => null)) as { action?: unknown; kind?: unknown; careerId?: unknown; tier?: unknown; roomId?: unknown } | null;
  const admin = getAdminSupabase();

  if (body?.action === "create") {
    const kind = body.kind as CareerKind;
    if (kind !== "solo" && kind !== "solo_doubles" && kind !== "couple") return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
    let coupleId: string | null = null;
    if (kind === "couple") {
      const { data: member } = await supabase.from("couple_members").select("couple_id").eq("user_id", userId).maybeSingle();
      if (!member) return NextResponse.json({ error: "no_partner" }, { status: 400 });
      const { count } = await admin.from("couple_members").select("user_id", { count: "exact", head: true }).eq("couple_id", member.couple_id);
      if ((count ?? 0) < 2) return NextResponse.json({ error: "no_partner" }, { status: 400 });
      coupleId = member.couple_id;
      const { data: existing } = await supabase.from("love_smash_careers").select("*").eq("couple_id", coupleId).maybeSingle();
      if (existing) return NextResponse.json({ career: existing });
    } else {
      const { data: existing } = await supabase.from("love_smash_careers").select("*").eq("owner_id", userId).eq("kind", kind).maybeSingle();
      if (existing) return NextResponse.json({ career: existing });
    }
    const { data, error } = await admin.from("love_smash_careers").insert({ kind, owner_id: userId, couple_id: coupleId, state: newCareer(kind, freshSeed()) as never }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ career: data });
  }

  if (body?.action === "room_start" && typeof body.roomId === "string") {
    const { data: room } = await supabase.from("love_smash_rooms").select("id, host_id, career_id, status").eq("id", body.roomId).maybeSingle();
    if (!room || !room.career_id) return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    if (room.host_id !== userId) return NextResponse.json({ error: "not_host" }, { status: 403 });
    const { data: linked } = await supabase.from("love_smash_careers").select("state").eq("id", room.career_id).maybeSingle();
    if (!linked) return NextResponse.json({ error: "career_not_found" }, { status: 404 });
    const careerState = linked.state as unknown as CareerState;
    if (!careerState.current || careerState.current.status !== "active") return NextResponse.json({ error: "no_active_tournament" }, { status: 409 });
    const config = careerMatchConfig(careerState, freshSeed(), null, true);
    const { data, error } = await admin.rpc("start_love_smash_room_with_config", { target_room: room.id, host: userId, base_config: config as never });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ room: data });
  }

  if (typeof body?.careerId !== "string") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { data: career } = await supabase.from("love_smash_careers").select("*").eq("id", body.careerId).maybeSingle();
  if (!career) return NextResponse.json({ error: "career_not_found" }, { status: 404 });
  const state = career.state as unknown as CareerState;

  if (body.action === "tournament") {
    const tier = Number(body.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > TIERS.length) return NextResponse.json({ error: "invalid_tier" }, { status: 400 });
    let next: CareerState;
    try {
      next = startTournament(state, tier, freshSeed());
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "invalid_tier" }, { status: 409 });
    }
    const { data, error } = await admin.from("love_smash_careers").update({ state: next as never, updated_at: new Date().toISOString() }).eq("id", career.id).eq("state->>version", String(state.version)).select("*").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "career_conflict" }, { status: 409 });
    return NextResponse.json({ career: data });
  }

  if (body.action === "room") {
    if (career.kind !== "couple") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    if (!state.current || state.current.status !== "active") return NextResponse.json({ error: "no_active_tournament" }, { status: 409 });
    const { data: room, error } = await supabase.rpc("create_love_smash_room", { room_mode: "couple_ai", room_difficulty: "normal", invite_partner: true });
    if (error || !room) return NextResponse.json({ error: error?.message ?? "room_failed" }, { status: 400 });
    const roomId = (room as { id: string }).id;
    await admin.from("love_smash_rooms").update({ career_id: career.id }).eq("id", roomId);
    return NextResponse.json({ roomId });
  }

  if (body.action === "start") {
    if (career.kind === "couple") return NextResponse.json({ error: "use_room" }, { status: 400 });
    if (career.owner_id !== userId) return NextResponse.json({ error: "career_not_found" }, { status: 404 });
    if (!state.current || state.current.status !== "active") return NextResponse.json({ error: "no_active_tournament" }, { status: 409 });
    const { count } = await admin.from("love_smash_matches").select("id", { count: "exact", head: true }).eq("user_id", userId).is("finished_at", null).gte("started_at", new Date(Date.now() - 600_000).toISOString());
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "too_many_open_matches" }, { status: 429 });
    const { data: progress } = await supabase.rpc("get_love_smash_progress");
    const loadout = ((progress as { loadout?: Loadout } | null)?.loadout ?? null) as Loadout | null;
    const seed = freshSeed();
    const config = careerMatchConfig(state, seed, loadout, false);
    const { data: match, error } = await admin
      .from("love_smash_matches")
      .insert({ user_id: userId, seed, difficulty: null, mode: "career", config: config as never, career_id: career.id, loadout: loadout as never })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ matchId: match.id, seed, config, version: state.version, opponent: currentOpponent(state.current), tier: state.current.tier, round: state.current.round });
  }

  return NextResponse.json({ error: "invalid_request" }, { status: 400 });
}
