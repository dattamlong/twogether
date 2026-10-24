"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import type { BroadcastEvent, CharacterAnim, ConnectionStatus, Envelope, Facing } from "@/features/realtime/couple-channel";
import type { Tile } from "@/game/world/room";
import { getSupabase } from "@/lib/supabase/client";

export const HOME_GUEST_CAPACITY = 8;

export type HomePresence = {
  userId: string;
  role: "host" | "guest";
  tile: Tile;
  facing: Facing;
  anim: CharacterAnim;
  onlineAt: string;
};

type HomeState = {
  coupleId: string | null;
  status: ConnectionStatus | "full";
  members: HomePresence[];
  setStatus: (status: HomeState["status"]) => void;
  setMembers: (members: HomePresence[]) => void;
  setCouple: (coupleId: string | null) => void;
};

export const useHomeRealtime = create<HomeState>((set) => ({
  coupleId: null,
  status: "idle",
  members: [],
  setStatus: (status) => set({ status }),
  setMembers: (members) => set({ members }),
  setCouple: (coupleId) => set({ coupleId, members: [], status: coupleId ? "connecting" : "idle" }),
}));

type Listener = (envelope: Envelope) => void;

class HomeChannel {
  private channel: RealtimeChannel | null = null;
  private coupleId: string | null = null;
  private userId: string | null = null;
  private presence: HomePresence | null = null;
  private seq = 0;
  private readonly tabId = typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random());
  private lastSeq = new Map<string, number>();
  private listeners = new Set<Listener>();
  private presenceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPresenceAt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private checkedCapacity = false;

  connect(coupleId: string, userId: string, initial: HomePresence) {
    if (this.coupleId === coupleId && this.userId === userId && this.channel) return;
    this.disconnect();
    this.coupleId = coupleId;
    this.userId = userId;
    this.presence = initial;
    this.retryAttempt = 0;
    this.checkedCapacity = initial.role === "host";
    useHomeRealtime.getState().setCouple(coupleId);
    void this.open().catch(() => this.scheduleReconnect());
  }

  disconnect() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    const stale = this.channel;
    this.channel = null;
    this.coupleId = null;
    this.userId = null;
    this.lastSeq.clear();
    if (stale) void getSupabase().removeChannel(stale);
    useHomeRealtime.getState().setCouple(null);
  }

  private async open() {
    if (!this.coupleId || !this.userId) return;
    const supabase = getSupabase();
    const coupleId = this.coupleId;
    const userId = this.userId;
    await supabase.realtime.setAuth();
    const topic = `home:${coupleId}`;
    const stale = supabase.getChannels().filter((c) => c.topic === `realtime:${topic}`);
    await Promise.all(stale.map((c) => supabase.removeChannel(c)));
    if (this.coupleId !== coupleId || this.userId !== userId) return;

    const channel = supabase.channel(topic, {
      config: { private: true, presence: { key: userId, enabled: true }, broadcast: { self: false, ack: false } },
    });
    channel.on("broadcast", { event: "room" }, ({ payload }) => this.receive(payload as Envelope));
    channel.on("presence", { event: "sync" }, () => this.sync(channel));
    channel.subscribe(async (status) => {
      if (this.channel !== channel) return;
      if (status === "SUBSCRIBED") {
        this.retryAttempt = 0;
        useHomeRealtime.getState().setStatus("connected");
        if (this.presence) await channel.track(this.presence);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        useHomeRealtime.getState().setMembers([]);
        this.scheduleReconnect();
      }
    });
    this.channel = channel;
  }

  private scheduleReconnect() {
    if (!this.coupleId) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.min(30_000, 1000 * 2 ** this.retryAttempt) + Math.random() * 500;
    this.retryAttempt++;
    useHomeRealtime.getState().setStatus("reconnecting");
    this.retryTimer = setTimeout(() => {
      const stale = this.channel;
      this.channel = null;
      if (stale) void getSupabase().removeChannel(stale);
      void this.open().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private sync(channel: RealtimeChannel) {
    const state = channel.presenceState<HomePresence>();
    const members: HomePresence[] = [];
    for (const [key, metas] of Object.entries(state)) {
      if (key === this.userId) continue;
      const latest = metas.reduce<HomePresence | null>((best, meta) => (!best || meta.onlineAt > best.onlineAt ? meta : best), null);
      if (latest && latest.userId === key) members.push(latest);
    }
    if (!this.checkedCapacity && this.presence) {
      this.checkedCapacity = true;
      const earlierGuests = members.filter((m) => m.role === "guest" && m.onlineAt <= this.presence!.onlineAt);
      if (earlierGuests.length >= HOME_GUEST_CAPACITY) {
        void channel.untrack();
        useHomeRealtime.getState().setStatus("full");
        return;
      }
    }
    useHomeRealtime.getState().setMembers(members);
  }

  private receive(envelope: Envelope) {
    if (!envelope || envelope.senderId === this.userId || typeof envelope.senderId !== "string") return;
    const key = `${envelope.senderId}:${envelope.tabId}`;
    if (typeof envelope.seq !== "number" || envelope.seq <= (this.lastSeq.get(key) ?? 0)) return;
    this.lastSeq.set(key, envelope.seq);
    this.listeners.forEach((l) => l(envelope));
  }

  send(event: BroadcastEvent) {
    if (!this.channel || !this.userId || useHomeRealtime.getState().status !== "connected") return;
    const envelope: Envelope = { ...event, senderId: this.userId, tabId: this.tabId, seq: ++this.seq, sentAt: Date.now() };
    void this.channel.send({ type: "broadcast", event: "room", payload: envelope });
  }

  updatePresence(patch: Partial<HomePresence>) {
    if (!this.presence) return;
    this.presence = { ...this.presence, ...patch, userId: this.presence.userId, role: this.presence.role };
    const elapsed = Date.now() - this.lastPresenceAt;
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    const flush = () => {
      this.lastPresenceAt = Date.now();
      if (this.channel && this.presence && useHomeRealtime.getState().status === "connected") void this.channel.track(this.presence);
    };
    if (elapsed > 300) flush();
    else this.presenceTimer = setTimeout(flush, 300 - elapsed);
  }

  onBroadcast(listener: Listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}

export const homeChannel = new HomeChannel();
