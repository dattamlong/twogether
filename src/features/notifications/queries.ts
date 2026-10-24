"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { useSession } from "../session/use-session";
import type { AppNotification, DispatchResult, LovePingKind, NotificationSettings } from "./types";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: ["notifications", "list"] as const,
  unread: ["notifications", "unread"] as const,
  settings: ["notifications", "settings"] as const,
};

async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc(name as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

export async function dispatchPending(ids?: string[]): Promise<DispatchResult[]> {
  try {
    const res = await fetch("/api/notifications/dispatch", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    if (!res.ok) return [];
    return ((await res.json()) as { results: DispatchResult[] }).results ?? [];
  } catch {
    return [];
  }
}

export function useNotifications(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    enabled,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => rpc<AppNotification[]>("get_notifications", { before_id: pageParam, max_rows: 20 }),
    getNextPageParam: (last) => (last.length === 20 ? last.at(-1)!.id : undefined),
  });
}

export function useUnreadNotifications() {
  const { data: session } = useSession();
  return useQuery({ queryKey: notificationKeys.unread, enabled: Boolean(session), queryFn: () => rpc<number>("unread_notification_count") });
}

export function useNotificationSettings() {
  const { data: session } = useSession();
  return useQuery({ queryKey: notificationKeys.settings, enabled: Boolean(session), staleTime: 60_000, queryFn: () => rpc<NotificationSettings>("get_notification_settings") });
}

export function useUpdateNotificationSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Omit<NotificationSettings, "devices">>) => rpc<NotificationSettings>("update_notification_settings", { settings: patch }),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: notificationKeys.settings });
      const previous = client.getQueryData<NotificationSettings>(notificationKeys.settings);
      if (previous) client.setQueryData(notificationKeys.settings, { ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.previous) client.setQueryData(notificationKeys.settings, ctx.previous);
    },
    onSuccess: (data) => client.setQueryData(notificationKeys.settings, data),
  });
}

export function useNotificationActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: notificationKeys.all });
  const patchRead = (ids: string[] | null) => {
    client.setQueryData<{ pages: AppNotification[][]; pageParams: unknown[] }>(notificationKeys.list, (old) =>
      old ? { ...old, pages: old.pages.map((p) => p.map((n) => (ids === null || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n))) } : old,
    );
  };
  return {
    markRead: useMutation({
      mutationFn: (ids: string[]) => rpc<number>("mark_notifications_read", { ids }),
      onMutate: (ids) => patchRead(ids),
      onSettled: refresh,
    }),
    markAll: useMutation({
      mutationFn: () => rpc<number>("mark_notifications_read", { ids: null }),
      onMutate: () => {
        patchRead(null);
        client.setQueryData(notificationKeys.unread, 0);
      },
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => rpc<void>("delete_notification", { notification: id }),
      onMutate: (id) =>
        client.setQueryData<{ pages: AppNotification[][]; pageParams: unknown[] }>(notificationKeys.list, (old) =>
          old ? { ...old, pages: old.pages.map((p) => p.filter((n) => n.id !== id)) } : old,
        ),
      onSettled: refresh,
    }),
  };
}

export async function sendLovePing(kind: LovePingKind, message: string | null, clientId: string) {
  const result = await rpc<{ notification: AppNotification; duplicate: boolean }>("send_love_ping", { kind, message, client_id: clientId });
  const [delivery] = await dispatchPending([result.notification.id]);
  return { ...result, delivery: delivery ?? null };
}
