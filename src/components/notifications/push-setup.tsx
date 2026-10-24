"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BellOff, BellRing, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Vi } from "@/components/ui/panel";
import { currentSubscription, disablePush, enablePush, isIOS, permissionState, pushSupport, vapidPublicKey } from "@/features/notifications/push";
import { notificationKeys } from "@/features/notifications/queries";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toast-store";

type State = "loading" | "needs_install" | "unsupported" | "not_configured" | "denied" | "off" | "on";

async function detect(): Promise<State> {
  const support = pushSupport();
  if (support === "needs_install") return "needs_install";
  if (support === "unsupported") return "unsupported";
  if (!vapidPublicKey()) return "not_configured";
  const permission = permissionState();
  if (permission === "denied") return "denied";
  if (permission === "granted" && (await currentSubscription())) return "on";
  return "off";
}

export function InstallGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-3xl bg-gradient-to-br from-sakura-50 to-lavender-100 ring-2 ring-white", compact ? "p-3" : "p-4")}>
      <p className="font-display text-lg font-semibold text-plum-700">Take TWOGETHER Everywhere 💗</p>
      <p className="text-sm text-plum-500">Add our little world to your Home Screen and never miss a Love Ping.</p>
      <ol className="flex flex-col gap-1.5 text-sm text-plum-700">
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-bold">1</span> Tap the <Share size={16} className="inline text-sky-500" aria-label="Share" /> Share button in Safari.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-bold">2</span> Choose <SquarePlus size={16} className="inline" aria-hidden /> <b>Add to Home Screen</b>.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-bold">3</span> Open TWOGETHER from its new Home Screen icon.
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-bold">4</span> Come back here and tap <b>Enable Love Notifications</b>.
        </li>
      </ol>
      <Vi className="text-xs">Trên iPhone (iOS 16.4 trở lên), thông báo chỉ hoạt động khi mở TWOGETHER từ biểu tượng ngoài màn hình chính — không phải trong tab Safari.</Vi>
    </div>
  );
}

export function PushSetup({ compact = false }: { compact?: boolean }) {
  const client = useQueryClient();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void detect().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      await enablePush();
      setState("on");
      toast({ tone: "love", title: "Love Notifications are on 💌", vi: "Đã bật thông báo trên thiết bị này" });
      client.invalidateQueries({ queryKey: notificationKeys.settings });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "push_denied") setState("denied");
      else if (code === "push_dismissed") setMessage("No problem — you can turn them on any time.");
      else setMessage("Couldn't turn on notifications on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      setState("off");
      client.invalidateQueries({ queryKey: notificationKeys.settings });
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  if (state === "needs_install") return <InstallGuide compact={compact} />;

  return (
    <div className={cn("flex flex-col gap-2 rounded-3xl ring-2 ring-white", compact ? "bg-white/80 p-3" : "bg-gradient-to-br from-sakura-50 to-lavender-100 p-4")} data-push-state={state}>
      {state === "on" ? (
        <div className="flex items-center gap-3">
          <BellRing className="shrink-0 text-sakura-400" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-plum-700">Love Notifications are on for this device</p>
            <p className="text-xs text-plum-500">You&apos;ll get Love Pings even when TWOGETHER is closed (when your device allows it).</p>
          </div>
          {!compact ? (
            <Button size="sm" variant="ghost" onClick={turnOff} loading={busy}>
              Turn off
            </Button>
          ) : null}
        </div>
      ) : state === "off" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-plum-700">Enable Love Notifications 💌</p>
            <p className="text-xs text-plum-500">Get a gentle nudge when your partner sends a Love Ping, even when TWOGETHER is closed.</p>
          </div>
          <Button size="sm" onClick={turnOn} loading={busy}>
            <BellRing size={16} /> Enable
          </Button>
        </div>
      ) : state === "denied" ? (
        <div className="flex items-start gap-3">
          <BellOff className="mt-0.5 shrink-0 text-cocoa-400" />
          <div>
            <p className="font-display font-semibold text-plum-700">Notifications are blocked on this device</p>
            <p className="text-xs text-plum-500">
              {isIOS()
                ? "Open iPhone Settings → Notifications → TWOGETHER and allow notifications."
                : "Click the lock icon next to the address bar → Site settings → Notifications → Allow, then reload."}{" "}
              We won&apos;t ask again — your Love Pings still arrive in the bell 🔔.
            </p>
          </div>
        </div>
      ) : state === "not_configured" ? (
        <p className="text-sm text-plum-500">Phone notifications aren&apos;t set up on this server yet. Your Love Pings still arrive in the bell 🔔.</p>
      ) : (
        <p className="text-sm text-plum-500">This browser doesn&apos;t support push notifications. Your Love Pings still arrive in the bell 🔔 whenever you open TWOGETHER.</p>
      )}
      {message ? <p className="text-xs text-cocoa-400">{message}</p> : null}
    </div>
  );
}
