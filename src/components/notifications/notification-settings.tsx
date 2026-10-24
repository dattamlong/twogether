"use client";

import { Moon } from "lucide-react";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { ErrorBlock, Skeleton } from "@/components/ui/states";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/features/notifications/queries";
import type { NotificationSettings as Settings } from "@/features/notifications/types";
import { cn } from "@/lib/utils";
import { PushSetup } from "./push-setup";

type ToggleKey = "lovePing" | "studyInvites" | "gameInvites" | "community" | "sound" | "messagePreviews";

const TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "lovePing", label: "Love Pings & gifts", hint: "When your partner calls you home or sends a gift" },
  { key: "studyInvites", label: "Study invitations", hint: "“Let's learn together” pings" },
  { key: "gameInvites", label: "Game invitations", hint: "Word Duel challenges" },
  { key: "community", label: "Community", hint: "Friend requests and guestbook notes" },
  { key: "sound", label: "Sound effects", hint: "A soft chime for in-app notifications" },
  { key: "messagePreviews", label: "Show message previews", hint: "Show custom Love Ping text on the lock screen" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-sakura-400" : "bg-lavender-200")}
    >
      <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", checked ? "left-6" : "left-1")} />
    </button>
  );
}

export function NotificationSettingsPanel() {
  const settings = useNotificationSettings();
  const update = useUpdateNotificationSettings();
  const data = settings.data;
  const set = (patch: Partial<Omit<Settings, "devices">>) => update.mutate(patch);
  const quiet = data?.quietStart !== null && data?.quietStart !== undefined;

  return (
    <Panel>
      <PanelTitle title="Notifications" subtitle="Thông báo · Love Pings, lời mời và hơn thế nữa" />
      <div className="flex flex-col gap-3">
        <PushSetup />
        {settings.isLoading ? <Skeleton className="h-48 rounded-3xl" /> : null}
        {settings.error ? <ErrorBlock error={settings.error} onRetry={() => settings.refetch()} /> : null}
        {data ? (
          <>
            <ul className="flex flex-col divide-y divide-white rounded-3xl bg-white/70">
              {TOGGLES.map((t) => (
                <li key={t.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-plum-700">{t.label}</p>
                    <p className="text-xs text-cocoa-400">{t.hint}</p>
                  </div>
                  <Switch checked={data[t.key]} onChange={(v) => set({ [t.key]: v })} label={t.label} />
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 rounded-3xl bg-white/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <Moon size={18} className="text-lavender-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-plum-700">Quiet hours</p>
                  <p className="text-xs text-cocoa-400">No phone alerts during these hours — everything still waits in the bell.</p>
                </div>
                <Switch checked={quiet} onChange={(v) => set(v ? { quietStart: 23, quietEnd: 7 } : { quietStart: null, quietEnd: null })} label="Quiet hours" />
              </div>
              {quiet ? (
                <div className="flex items-center gap-2 pl-8 text-sm">
                  <label className="flex items-center gap-1">
                    From
                    <select value={data.quietStart ?? 23} onChange={(e) => set({ quietStart: Number(e.target.value), quietEnd: data.quietEnd ?? 7 })} className="rounded-xl bg-white px-2 py-1 ring-2 ring-lavender-100">
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    to
                    <select value={data.quietEnd ?? 7} onChange={(e) => set({ quietStart: data.quietStart ?? 23, quietEnd: Number(e.target.value) })} className="rounded-xl bg-white px-2 py-1 ring-2 ring-lavender-100">
                      {HOURS.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
            <p className="px-1 text-xs text-cocoa-400">
              {data.devices.length
                ? `Phone notifications are on for ${data.devices.length} device${data.devices.length === 1 ? "" : "s"}: ${data.devices.map((d) => d.label ?? "device").join(", ")}.`
                : "No devices have phone notifications on yet."}{" "}
              Turning a category off stops phone alerts and pop-ups; notifications are still kept in the bell so nothing gets lost.
            </p>
          </>
        ) : null}
        {update.error ? <ErrorBlock error={update.error} /> : null}
      </div>
    </Panel>
  );
}
