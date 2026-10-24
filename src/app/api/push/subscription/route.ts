import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === new URL(request.url).host;
}

async function user() {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: me } = await user();
  if (!me) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; label?: unknown } | null;
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }
  const label = typeof body?.label === "string" ? body.label.slice(0, 80) : null;
  const { data, error } = await supabase.rpc("save_push_subscription", { endpoint, p256dh, auth, device_label: label ?? undefined });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { supabase, user: me } = await user();
  if (!me) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  const { error } = await supabase.rpc("remove_push_subscription", { endpoint: body.endpoint });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
