"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { create } from "zustand";
import type { ConnectionStatus } from "@/features/realtime/couple-channel";
import type { SessionData } from "@/features/session/types";
import { getSupabase } from "@/lib/supabase/client";
import { sfx } from "@/lib/sfx";
import { toast } from "@/stores/toast-store";
import { worldKeys } from "./queries";

export type ChatRow = { id: string; channel: string; user_id: string; body: string; client_id: string; created_at: string; hidden_at: string | null };

type LobbyState = {
  status: ConnectionStatus;
  online: Set<string>;
  setStatus: (status: ConnectionStatus) => void;
  setOnline: (online: Set<string>) => void;
};

export const useWorldLobby = create<LobbyState>((set) => ({
  status: "idle",
  online: new Set(),
  setStatus: (status) => set({ status }),
  setOnline: (online) => set({ online }),
}));

export const useIsOnline = (userId: string | null | undefined) => useWorldLobby((s) => (userId ? s.online.has(userId) : false));

type ChatListener = (event: "insert" | "update", row: ChatRow) => void;
type RowListener = (table: string, row: Record<string, unknown>) => void;

class WorldLobby {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private coupleId: string | null = null;
  private chatListeners = new Set<ChatListener>();
  private rowListeners = new Set<RowListener>();
  private reconnectListeners = new Set<() => void>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private connectedBefore = false;

  connect(userId: string, coupleId: string | null) {
    if (this.userId === userId && this.coupleId === coupleId && this.channel) return;
    this.disconnect();
    this.userId = userId;
    this.coupleId = coupleId;
    this.connectedBefore = false;
    void this.open().catch(() => this.scheduleReconnect());
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const stale = this.channel;
    this.channel = null;
    this.userId = null;
    if (stale) void getSupabase().removeChannel(stale);
    useWorldLobby.getState().setStatus("idle");
    useWorldLobby.getState().setOnline(new Set());
  }

  private async open() {
    const userId = this.userId;
    if (!userId) return;
    const supabase = getSupabase();
    await supabase.realtime.setAuth();
    const stale = supabase.getChannels().filter((c) => c.topic === "realtime:world:lobby");
    await Promise.all(stale.map((c) => supabase.removeChannel(c)));
    if (this.userId !== userId) return;
    useWorldLobby.getState().setStatus(this.connectedBefore ? "reconnecting" : "connecting");

    const channel = supabase.channel("world:lobby", { config: { private: true, presence: { key: userId, enabled: true } } });
    channel.on("presence", { event: "sync" }, () => {
      useWorldLobby.getState().setOnline(new Set(Object.keys(channel.presenceState())));
    });
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "world_chat_messages" }, (p) =>
      this.chatListeners.forEach((l) => l("insert", p.new as ChatRow)),
    );
    channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "world_chat_messages" }, (p) =>
      this.chatListeners.forEach((l) => l("update", p.new as ChatRow)),
    );
    channel.on("broadcast", { event: "chat_removed" }, ({ payload }) => void this.verifyRemoved(payload as { id?: unknown; channel?: unknown }));
    const watch = (table: string, filter: string) =>
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, (p) =>
        this.rowListeners.forEach((l) => l(table, (p.new && Object.keys(p.new).length ? p.new : p.old) as Record<string, unknown>)),
      );
    watch("friendships", `addressee_id=eq.${userId}`);
    watch("friendships", `requester_id=eq.${userId}`);
    watch("game_invitations", `to_user=eq.${userId}`);
    watch("game_invitations", `from_user=eq.${userId}`);
    watch("notifications", `recipient_user_id=eq.${userId}`);
    if (this.coupleId) watch("home_guestbook_messages", `couple_id=eq.${this.coupleId}`);

    channel.subscribe(async (status) => {
      if (this.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        const wasReconnect = this.connectedBefore;
        this.connectedBefore = true;
        this.retryAttempt = 0;
        useWorldLobby.getState().setStatus("connected");
        await channel.track({ userId, onlineAt: new Date().toISOString() });
        if (wasReconnect) this.reconnectListeners.forEach((l) => l());
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.scheduleReconnect();
      }
    });
    this.channel = channel;
  }

  private scheduleReconnect() {
    if (!this.userId) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(30_000, 1000 * 2 ** this.retryAttempt) + Math.random() * 500;
    this.retryAttempt++;
    useWorldLobby.getState().setStatus("reconnecting");
    this.retryTimer = setTimeout(() => {
      const stale = this.channel;
      this.channel = null;
      if (stale) void getSupabase().removeChannel(stale);
      void this.open().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private async verifyRemoved(payload: { id?: unknown; channel?: unknown }) {
    if (typeof payload?.id !== "string" || typeof payload.channel !== "string") return;
    const { data, error } = await getSupabase().from("world_chat_messages").select("id").eq("id", payload.id).maybeSingle();
    if (error || data) return;
    const row = { id: payload.id, channel: payload.channel, hidden_at: new Date().toISOString() } as ChatRow;
    this.chatListeners.forEach((l) => l("update", row));
  }

  announceRemoved(id: string, channel: string) {
    const row = { id, channel, hidden_at: new Date().toISOString() } as ChatRow;
    this.chatListeners.forEach((l) => l("update", row));
    void this.channel?.send({ type: "broadcast", event: "chat_removed", payload: { id, channel } });
  }

  onChat(listener: ChatListener) {
    this.chatListeners.add(listener);
    return () => void this.chatListeners.delete(listener);
  }

  onRow(listener: RowListener) {
    this.rowListeners.add(listener);
    return () => void this.rowListeners.delete(listener);
  }

  onReconnect(listener: () => void) {
    this.reconnectListeners.add(listener);
    return () => void this.reconnectListeners.delete(listener);
  }
}

export const worldLobby = new WorldLobby();

export function useWorldLobbyBridge(session: SessionData | null | undefined) {
  const client = useQueryClient();
  const userId = session?.userId;
  const coupleId = session?.couple?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    worldLobby.connect(userId, coupleId);
    const offRow = worldLobby.onRow((table, row) => {
      if (table === "friendships") {
        client.invalidateQueries({ queryKey: worldKeys.social });
        client.invalidateQueries({ queryKey: worldKeys.profiles });
        if (row.addressee_id === userId && row.status === "pending") {
          sfx.pop();
          toast({ tone: "love", title: "New friend request!", vi: "Bạn có lời mời kết bạn mới!" });
        }
      } else if (table === "game_invitations") {
        client.invalidateQueries({ queryKey: worldKeys.invitations });
        if (row.to_user === userId && row.status === "pending") {
          sfx.pop();
          toast({ tone: "love", title: "You've been invited to a Word Duel!", vi: "Bạn được mời đấu từ vựng!" });
        }
      } else if (table === "home_guestbook_messages") {
        client.invalidateQueries({ queryKey: worldKeys.guestbook(coupleId ?? "") });
      }
    });
    const offReconnect = worldLobby.onReconnect(() => {
      client.invalidateQueries({ queryKey: worldKeys.social });
      client.invalidateQueries({ queryKey: worldKeys.invitations });
    });
    return () => {
      offRow();
      offReconnect();
      worldLobby.disconnect();
    };
  }, [userId, coupleId, client]);
}
