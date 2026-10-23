"use client";

import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { create } from "zustand";
import { getSupabase } from "@/lib/supabase/client";
import type { Tile } from "@/game/world/room";

export type CharacterAnim =
  | "idle"
  | "walk"
  | "sit"
  | "study"
  | "happy"
  | "celebrate"
  | "sleep"
  | "hug"
  | "wave"
  | "gift"
  | "twirl";

export type Facing = "ne" | "nw" | "se" | "sw";

export type PresenceState = {
  userId: string;
  name: string;
  tile: Tile;
  facing: Facing;
  anim: CharacterAnim;
  away: boolean;
  onlineAt: string;
};

export type BroadcastEvent =
  | { type: "move"; from: Tile; path: Tile[]; then?: { anim: CharacterAnim; facing: Facing; tile?: Tile } }
  | { type: "pose"; tile: Tile; facing: Facing; anim: CharacterAnim }
  | { type: "emote"; emote: "wave" | "heart" | "twirl" | "heart_burst" | "celebrate" };

export type Envelope = BroadcastEvent & { senderId: string; tabId: string; seq: number; sentAt: number };

export type TableChange = { table: string; payload: RealtimePostgresChangesPayload<Record<string, unknown>> };

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

type RealtimeState = {
  status: ConnectionStatus;
  partnerPresence: PresenceState | null;
  setStatus: (status: ConnectionStatus) => void;
  setPartnerPresence: (presence: PresenceState | null) => void;
};

export const useCoupleRealtime = create<RealtimeState>((set) => ({
  status: "idle",
  partnerPresence: null,
  setStatus: (status) => set({ status }),
  setPartnerPresence: (partnerPresence) => set({ partnerPresence }),
}));

const SUBSCRIBED_TABLES = [
  "love_messages",
  "couple_interactions",
  "furniture_placements",
  "couple_progress",
  "memories",
  "daily_love_answers",
  "couple_members",
] as const;

type Listener<T> = (value: T) => void;

class CoupleChannel {
  private channel: RealtimeChannel | null = null;
  private coupleId: string | null = null;
  private userId: string | null = null;
  private seq = 0;
  private readonly tabId = typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random());
  private lastSeqBySender = new Map<string, number>();
  private broadcastListeners = new Set<Listener<Envelope>>();
  private changeListeners = new Set<Listener<TableChange>>();
  private reconnectListeners = new Set<Listener<void>>();
  private presence: PresenceState | null = null;
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPresenceSentAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private hasConnectedBefore = false;

  connect(coupleId: string, userId: string, initial: PresenceState) {
    if (this.coupleId === coupleId && this.userId === userId && this.channel) return;
    this.disconnect();
    this.coupleId = coupleId;
    this.userId = userId;
    this.presence = initial;
    this.retryAttempt = 0;
    this.hasConnectedBefore = false;
    void this.open();
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    if (this.channel) void getSupabase().removeChannel(this.channel);
    this.channel = null;
    this.coupleId = null;
    this.userId = null;
    this.lastSeqBySender.clear();
    useCoupleRealtime.getState().setStatus("idle");
    useCoupleRealtime.getState().setPartnerPresence(null);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = () => {
    if (this.coupleId) this.scheduleReconnect(0);
  };

  private handleOffline = () => {
    useCoupleRealtime.getState().setStatus("offline");
    useCoupleRealtime.getState().setPartnerPresence(null);
  };

  private async open() {
    if (!this.coupleId || !this.userId) return;
    const supabase = getSupabase();
    const coupleId = this.coupleId;
    const userId = this.userId;
    useCoupleRealtime.getState().setStatus(this.hasConnectedBefore ? "reconnecting" : "connecting");

    await supabase.realtime.setAuth();
    if (this.coupleId !== coupleId) return;

    const channel = supabase.channel(`couple:${coupleId}`, {
      config: { private: true, presence: { key: userId, enabled: true }, broadcast: { self: false, ack: false } },
    });

    channel.on("broadcast", { event: "room" }, ({ payload }) => this.receive(payload as Envelope));
    channel.on("presence", { event: "sync" }, () => this.syncPresence(channel));

    for (const table of SUBSCRIBED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `couple_id=eq.${coupleId}` },
        (payload) => this.changeListeners.forEach((l) => l({ table, payload })),
      );
    }

    channel.subscribe(async (status) => {
      if (this.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        const wasReconnect = this.hasConnectedBefore;
        this.hasConnectedBefore = true;
        this.retryAttempt = 0;
        useCoupleRealtime.getState().setStatus("connected");
        if (this.presence) await channel.track(this.presence);
        if (wasReconnect) this.reconnectListeners.forEach((l) => l());
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        useCoupleRealtime.getState().setPartnerPresence(null);
        if (status !== "CLOSED" || this.coupleId) this.scheduleReconnect();
      }
    });
    this.channel = channel;
  }

  private scheduleReconnect(delayOverride?: number) {
    if (!this.coupleId) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = delayOverride ?? Math.min(30_000, 1000 * 2 ** this.retryAttempt) + Math.random() * 500;
    this.retryAttempt++;
    useCoupleRealtime.getState().setStatus(navigator.onLine === false ? "offline" : "reconnecting");
    this.retryTimer = setTimeout(() => {
      const stale = this.channel;
      this.channel = null;
      if (stale) void getSupabase().removeChannel(stale);
      void this.open();
    }, delay);
  }

  private syncPresence(channel: RealtimeChannel) {
    const state = channel.presenceState<PresenceState>();
    const partnerKey = Object.keys(state).find((key) => key !== this.userId);
    const metas = partnerKey ? state[partnerKey] : undefined;
    const latest = metas?.reduce<PresenceState | null>(
      (best, meta) => (!best || meta.onlineAt > best.onlineAt ? meta : best),
      null,
    );
    useCoupleRealtime.getState().setPartnerPresence(latest ?? null);
  }

  private receive(envelope: Envelope) {
    if (!envelope || envelope.senderId === this.userId) return;
    const senderKey = `${envelope.senderId}:${envelope.tabId}`;
    if (envelope.seq <= (this.lastSeqBySender.get(senderKey) ?? 0)) return;
    this.lastSeqBySender.set(senderKey, envelope.seq);
    this.broadcastListeners.forEach((l) => l(envelope));
  }

  send(event: BroadcastEvent) {
    if (!this.channel || !this.userId) return;
    const envelope: Envelope = { ...event, senderId: this.userId, tabId: this.tabId, seq: ++this.seq, sentAt: Date.now() };
    void this.channel.send({ type: "broadcast", event: "room", payload: envelope });
  }

  updatePresence(patch: Partial<PresenceState>) {
    if (!this.presence) return;
    this.presence = { ...this.presence, ...patch };
    const elapsed = Date.now() - this.lastPresenceSentAt;
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    const flush = () => {
      this.lastPresenceSentAt = Date.now();
      if (this.channel && this.presence && useCoupleRealtime.getState().status === "connected") void this.channel.track(this.presence);
    };
    if (elapsed > 300) flush();
    else this.presenceTimer = setTimeout(flush, 300 - elapsed);
  }

  onBroadcast(listener: Listener<Envelope>) {
    this.broadcastListeners.add(listener);
    return () => void this.broadcastListeners.delete(listener);
  }

  onChange(listener: Listener<TableChange>) {
    this.changeListeners.add(listener);
    return () => void this.changeListeners.delete(listener);
  }

  onReconnect(listener: Listener<void>) {
    this.reconnectListeners.add(listener);
    return () => void this.reconnectListeners.delete(listener);
  }
}

export const coupleChannel = new CoupleChannel();
