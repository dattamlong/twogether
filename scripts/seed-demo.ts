import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

if (!url.includes("127.0.0.1") && !url.includes("localhost") && !process.argv.includes("--allow-remote")) {
  console.error("Refusing to seed demo users into a non-local project. Pass --allow-remote if you really mean it.");
  process.exit(1);
}

const PASSWORD = "twogether-demo";
const people = [
  { email: "mai@twogether.local", name: "Mai", avatar: { hair: "long", hairColor: "#5b4256", skin: "#ffe3d3", eyes: "#45365b", outfit: "tee", outfitColor: "#f8bbd0", accessory: "none" } },
  { email: "minh@twogether.local", name: "Minh", avatar: { hair: "spiky", hairColor: "#3e3550", skin: "#f6d2bf", eyes: "#45365b", outfit: "overalls", outfitColor: "#b8ddf5", accessory: "none" } },
];

async function signIn(email: string) {
  const client = createClient<Database>(url, anonKey, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

async function main() {
  const admin = createClient<Database>(url, serviceKey, noSession);
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
  const ids: string[] = [];
  for (const person of people) {
    const found = existing?.users.find((u) => u.email === person.email);
    if (found) {
      ids.push(found.id);
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: person.name },
    });
    if (error) throw error;
    ids.push(data.user.id);
  }

  const [mai, minh] = await Promise.all(people.map((p) => signIn(p.email)));
  for (const [i, client] of [mai, minh].entries()) {
    await client.from("profiles").update({ avatar: people[i].avatar }).eq("id", ids[i]);
  }

  const { data: membership } = await admin.from("couple_members").select("couple_id").eq("user_id", ids[0]).maybeSingle();
  if (!membership) {
    const invite = await mai.rpc("create_invitation");
    if (invite.error) throw invite.error;
    const joined = await minh.rpc("accept_invitation", { invite_code: invite.data.code });
    if (joined.error) throw joined.error;
  }

  for (const id of ids) {
    await admin.rpc("grant_reward", { uid: id, add_xp: 0, add_coins: 600, reason: "demo_seed", ref: id });
  }

  console.log("Demo couple ready:");
  for (const p of people) console.log(`  ${p.name}: ${p.email} / ${PASSWORD}`);
}

main().catch((error) => {
  if (String(error?.message).includes("duplicate_transaction")) {
    console.log("Demo couple already seeded.");
    return;
  }
  console.error(error);
  process.exit(1);
});
