"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LegendCelebration } from "@/components/legends/legend-celebration";
import { CelebrationOverlay } from "@/components/rewards/celebration-overlay";
import { ErrorBlock } from "@/components/ui/states";
import { usePendingHugs, useUnreadCount } from "@/features/messages/queries";
import { promptHug, useRealtimeBridge } from "@/features/realtime/use-realtime-bridge";
import { useSession } from "@/features/session/use-session";
import { SocialSheets } from "@/components/world/social-sheets";
import { useWorldLobbyBridge } from "@/features/world/world-channel";
import { useNotificationBridge } from "@/features/notifications/use-notification-bridge";
import { Hud } from "./hud";
import { Logo } from "./logo";
import { Nav } from "./nav";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Logo size={72} className="animate-float" />
        <p className="font-display text-lg text-plum-500">Opening our little home…</p>
        <p lang="vi" className="text-sm text-cocoa-400">Đang mở ngôi nhà nhỏ…</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session, isLoading, error, refetch } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const unread = useUnreadCount();
  const { data: pendingHugs } = usePendingHugs();

  useRealtimeBridge(session);
  useWorldLobbyBridge(session?.couple ? session : null);
  useNotificationBridge(session?.couple ? session : null);

  useEffect(() => {
    if (isLoading) return;
    if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (session && !session.couple) router.replace("/pair");
  }, [isLoading, session, router, pathname]);

  useEffect(() => {
    for (const hug of pendingHugs ?? []) promptHug(hug.id, session?.partner?.display_name ?? "Your partner");
  }, [pendingHugs, session?.partner?.display_name]);

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <ErrorBlock error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (isLoading || !session || !session.couple) return <Splash />;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Hud session={session} />
      <Nav unread={unread} />
      <main id="main" className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 md:pb-10 md:pl-32">
        {children}
      </main>
      <CelebrationOverlay />
      <LegendCelebration />
      <SocialSheets />
    </>
  );
}
