"use client";

import { NotificationSettingsPanel } from "@/components/notifications/notification-settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { useSignOut } from "@/features/couples/queries";
import { currentLevel } from "@/features/learning/queries";
import { LANGUAGE_INFO, LEVEL_LABELS, type StudyLanguage } from "@/features/learning/types";
import { qk } from "@/features/query-keys";
import { readAvatar, type Avatar } from "@/features/session/types";
import { useRequiredSession } from "@/features/session/use-session";
import { useInventory, useShopItems } from "@/features/shop/queries";
import { friendlyError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase/client";
import { setSoundEnabled, soundEnabled, sfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";
import { TierBadge } from "@/components/legends/legend-art";
import { useLegendStatus } from "@/features/legends/queries";
import { AvatarFace } from "./avatar-face";

const HAIR_STYLES: Avatar["hair"][] = ["bob", "long", "twintails", "bun", "short", "spiky"];
const HAIR_COLORS = ["#5b4256", "#3e3550", "#8a5a44", "#d9a440", "#e7779f", "#8a73c8", "#6fb5e3", "#2c2140"];
const SKIN = ["#ffe3d3", "#f6d2bf", "#e8b996", "#c98e6b", "#9a6b4f"];
const EYES = ["#45365b", "#6a5583", "#3a9474", "#6fb5e3", "#9a6b4f"];
const OUTFIT_COLORS = ["#f8bbd0", "#c7b8ea", "#bce5d5", "#ffd6c2", "#b8ddf5", "#f5cb78"];

function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={cn("size-9 rounded-full ring-2 ring-offset-2 transition", value === c ? "ring-sakura-400" : "ring-white")}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; name: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn("rounded-xl px-3 py-1.5 text-sm font-semibold capitalize ring-2", value === o.id ? "bg-sakura-100 ring-sakura-300" : "bg-white/80 ring-white")}
          >
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ProfileSettings() {
  const session = useRequiredSession();
  const client = useQueryClient();
  const router = useRouter();
  const signOut = useSignOut();
  const inventory = useInventory();
  const items = useShopItems();
  const [avatar, setAvatar] = useState<Avatar>(() => readAvatar(session.profile.avatar));
  const [name, setName] = useState(session.profile.display_name);
  const [timezone, setTimezone] = useState(session.profile.timezone);
  const [learningLanguage, setLearningLanguage] = useState<StudyLanguage>(session.profile.learning_language as StudyLanguage);
  const [coupleName, setCoupleName] = useState(session.couple?.name ?? "Our Little Home");
  const [confirm, setConfirm] = useState<"unpair" | "delete" | null>(null);
  const [sound, setSound] = useState(soundEnabled);
  const legend = useLegendStatus();
  const zones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return [...new Set([session.profile.timezone, ...supported])].sort();
  }, [session.profile.timezone]);

  const owned = (category: string) =>
    (inventory.data ?? [])
      .filter((i) => i.user_id === session.userId)
      .map((i) => items.data?.find((s) => s.id === i.item_id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s) && s!.category === category);

  const outfits = [{ id: "tee", name: "T-shirt" }, { id: "overalls", name: "Overalls" }, ...owned("clothing").map((s) => ({ id: s.id, name: s.name }))];
  const accessories = [{ id: "none", name: "None" }, ...owned("accessories").map((s) => ({ id: s.id, name: s.name }))];

  const save = useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      const profile = await supabase.from("profiles").update({ display_name: name.trim(), timezone, avatar, learning_language: learningLanguage }).eq("id", session.userId);
      if (profile.error) throw profile.error;
      if (session.couple && coupleName.trim() && coupleName !== session.couple.name) {
        const couple = await supabase.from("couples").update({ name: coupleName.trim() }).eq("id", session.couple.id);
        if (couple.error) throw couple.error;
      }
    },
    onSuccess: () => toast({ tone: "success", title: "Saved!", vi: "Đã lưu!" }),
    onError: (e) => {
      const m = friendlyError(e);
      toast({ tone: "error", title: m.en, vi: m.vi });
    },
    onSettled: () => client.invalidateQueries({ queryKey: qk.session }),
  });

  const unpair = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().rpc("leave_couple");
      if (error) throw error;
    },
    onSuccess: () => {
      client.clear();
      router.replace("/pair");
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? "delete_failed");
    },
    onSuccess: () => {
      client.clear();
      router.replace("/");
      router.refresh();
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel>
        <PanelTitle title="Your character" subtitle="Nhân vật của bạn" />
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2 rounded-3xl bg-gradient-to-b from-lavender-100 to-sakura-50 p-6">
            <AvatarFace avatar={avatar} size={140} />
            <p className="font-display text-lg font-semibold">{name || "…"}</p>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <Choices label="Hairstyle" value={avatar.hair} options={HAIR_STYLES.map((h) => ({ id: h, name: h }))} onChange={(hair) => setAvatar({ ...avatar, hair })} />
            <Swatches label="Hair color" value={avatar.hairColor} options={HAIR_COLORS} onChange={(hairColor) => setAvatar({ ...avatar, hairColor })} />
            <Swatches label="Skin tone" value={avatar.skin} options={SKIN} onChange={(skin) => setAvatar({ ...avatar, skin })} />
            <Swatches label="Eyes" value={avatar.eyes} options={EYES} onChange={(eyes) => setAvatar({ ...avatar, eyes })} />
            <Choices label="Outfit" value={avatar.outfit} options={outfits} onChange={(outfit) => setAvatar({ ...avatar, outfit })} />
            <Swatches label="Outfit color" value={avatar.outfitColor} options={OUTFIT_COLORS} onChange={(outfitColor) => setAvatar({ ...avatar, outfitColor })} />
            <Choices label="Accessory" value={avatar.accessory} options={accessories} onChange={(accessory) => setAvatar({ ...avatar, accessory })} />
            <p className="text-xs text-cocoa-400">More outfits and accessories are in the Love Shop.</p>
          </div>
        </div>
      </Panel>

      <div className="flex flex-col gap-4">
        <Panel className="flex flex-col gap-3">
          <PanelTitle title="Settings" subtitle="Cài đặt" />
          <label className="flex flex-col gap-1 text-sm font-bold">
            Display name
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 font-normal outline-none focus:border-sakura-300" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Timezone (daily reset at midnight)
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 font-normal outline-none">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </label>
          {session.couple ? (
            <label className="flex flex-col gap-1 text-sm font-bold">
              Our home&apos;s name
              <input value={coupleName} maxLength={40} onChange={(e) => setCoupleName(e.target.value)} className="h-11 rounded-2xl border-2 border-lavender-100 bg-white px-3 font-normal outline-none focus:border-sakura-300" />
            </label>
          ) : null}
          <label className="flex items-center justify-between gap-2 text-sm font-bold">
            Sound effects
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
                setSoundEnabled(e.target.checked);
                if (e.target.checked) sfx.pop();
              }}
              className="size-5 accent-sakura-400"
            />
          </label>
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">Language I&apos;m learning · Ngôn ngữ đang học</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(LANGUAGE_INFO) as StudyLanguage[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={learningLanguage === code}
                  onClick={() => setLearningLanguage(code)}
                  className={cn("rounded-2xl px-3 py-2 text-left ring-2", learningLanguage === code ? "bg-sakura-100 ring-sakura-300" : "bg-white/80 ring-white")}
                >
                  <span className="block font-display font-semibold">{LANGUAGE_INFO[code].native}</span>
                  <span className="block text-xs text-cocoa-400">
                    {LANGUAGE_INFO[code].vi} · {LANGUAGE_INFO[code].standard}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-cocoa-400">
            Current level: {currentLevel(session.profile)} · {LEVEL_LABELS[currentLevel(session.profile)]?.name} — change it on the Learn page. Your partner can learn a different language; streaks and quests count both.
          </p>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>
            Save changes
          </Button>
        </Panel>

        {legend.data ? (
          <Panel className="flex flex-col gap-3">
            <PanelTitle title="Love Legends" subtitle="Bảng xếp hạng cặp đôi" />
            <TierBadge tier={legend.data.tier} size={44} showLabel />
            <p className="text-xs text-cocoa-400">
              {legend.data.legendPoints.toLocaleString()} legend points{legend.data.bestRank ? ` · best weekly rank #${legend.data.bestRank}` : ""}
            </p>
            <p className="text-[11px] text-cocoa-400">Every couple is ranked automatically. Only names, characters, tier, scores and badges are shown on the leaderboard; messages, answers and memories stay private.</p>
          </Panel>
        ) : null}

        <div id="notifications">
          <NotificationSettingsPanel />
        </div>

        <Panel className="flex flex-col gap-2">
          <PanelTitle title="Account" subtitle="Tài khoản" />
          <p className="text-sm text-plum-500">Signed in as {session.email}</p>
          <Button variant="soft" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </Button>
          {session.couple ? (
            <Button variant="ghost" onClick={() => setConfirm("unpair")}>
              Unpair from {session.partner?.display_name ?? "this home"}
            </Button>
          ) : null}
          <Button variant="ghost" className="text-rose-err" onClick={() => setConfirm("delete")}>
            Delete my account and data
          </Button>
        </Panel>
      </div>

      <Modal open={confirm === "unpair"} onOpenChange={(o) => !o && setConfirm(null)} title="Unpair?" subtitle="Hủy kết đôi?">
        <p className="text-plum-500">This closes your shared home for both of you. Shared memories become inaccessible, and you can create a new invitation afterward. Your own learning progress stays with you.</p>
        {unpair.error ? <p className="mt-2 text-sm text-rose-err">{friendlyError(unpair.error).en}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="soft" className="flex-1" onClick={() => setConfirm(null)}>
            Keep our home
          </Button>
          <Button variant="danger" className="flex-1" loading={unpair.isPending} onClick={() => unpair.mutate()}>
            Unpair
          </Button>
        </div>
      </Modal>
      <Modal open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)} title="Delete your account?" subtitle="Xóa tài khoản?">
        <p className="text-plum-500">
          This permanently deletes your profile, progress, inventory, and the messages and answers you wrote. It cannot be undone.
        </p>
        {deleteAccount.error ? <p className="mt-2 text-sm text-rose-err">Couldn&apos;t delete the account. Please try again.</p> : null}
        <div className="mt-4 flex gap-2">
          <Button variant="soft" className="flex-1" onClick={() => setConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" loading={deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
            Delete forever
          </Button>
        </div>
      </Modal>
    </div>
  );
}
