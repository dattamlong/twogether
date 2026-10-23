import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const admin = getAdminSupabase();
  const deleted = await admin.auth.admin.deleteUser(data.user.id);
  if (deleted.error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
