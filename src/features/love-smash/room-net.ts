"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { NetSnapshot } from "./net";
import type { PressKind } from "./sim";

export type RoomPresence = { userId: string; slot: number; host: boolean; at: number };
export type Report = { slot: number; x: number; y: number; l: boolean; d?: boolean; f?: boolean; s: number };
export type PressMessage = { slot: number; kind: PressKind; view: number; id: number };

type Handlers = {
  onSnapshot?: (snap: NetSnapshot) => void;
  onReport?: (report: Report) => void;
  onPress?: (press: PressMessage) => void;
  onRoomChanged?: () => void;
  onResult?: (room: unknown) => void;
  onAbort?: (reason: string) => void;
  onPresence?: (members: RoomPresence[]) => void;
  onStatus?: (status: "connecting" | "connected" | "reconnecting") => void;
};

export class RoomNet {
  private main: RealtimeChannel | null = null;
  private ups: RealtimeChannel[] = [];
  private closed = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  constructor(
    private roomId: string,
    private me: RoomPresence,
    private handlers: Handlers,
    private upSlots: number[],
    private listenUp: boolean,
  ) {}

  async open() {
    this.closed = false;
    this.handlers.onStatus?.("connecting");
    const supabase = getSupabase();
    await supabase.realtime.setAuth();
    const topic = `love-smash:${this.roomId}`;
    for (const stale of supabase.getChannels().filter((c) => c.topic === `realtime:${topic}` || c.topic.startsWith(`realtime:${topic}:up`))) await supabase.removeChannel(stale);
    if (this.closed) return;

    const main = supabase.channel(topic, { config: { private: true, presence: { key: this.me.userId, enabled: true }, broadcast: { self: false, ack: false } } });
    main.on("broadcast", { event: "snap" }, ({ payload }) => this.handlers.onSnapshot?.(payload as NetSnapshot));
    main.on("broadcast", { event: "room" }, () => this.handlers.onRoomChanged?.());
    main.on("broadcast", { event: "result" }, ({ payload }) => this.handlers.onResult?.(payload));
    main.on("broadcast", { event: "abort" }, ({ payload }) => this.handlers.onAbort?.(String((payload as { reason?: string }).reason ?? "aborted")));
    main.on("presence", { event: "sync" }, () => {
      const state = main.presenceState<RoomPresence>();
      const members = Object.values(state)
        .map((metas) => metas.reduce<RoomPresence | null>((best, m) => (!best || m.at > best.at ? m : best), null))
        .filter((m): m is RoomPresence => Boolean(m));
      this.handlers.onPresence?.(members);
    });
    main.subscribe(async (status) => {
      if (this.main !== main) return;
      if (status === "SUBSCRIBED") {
        this.attempt = 0;
        this.handlers.onStatus?.("connected");
        await main.track({ ...this.me, at: Date.now() });
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!this.closed) this.reconnect();
      }
    });
    this.main = main;

    this.ups = this.upSlots.map((slot) => {
      const up = supabase.channel(`${topic}:up:${slot}`, { config: { private: true, broadcast: { self: false, ack: false } } });
      if (this.listenUp) {
        up.on("broadcast", { event: "rep" }, ({ payload }) => this.handlers.onReport?.(payload as Report));
        up.on("broadcast", { event: "press" }, ({ payload }) => this.handlers.onPress?.(payload as PressMessage));
      }
      up.subscribe((status) => {
        if (!this.ups.includes(up)) return;
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") && !this.closed) this.reconnect();
      });
      return up;
    });
  }

  private reconnect() {
    if (this.retry) clearTimeout(this.retry);
    this.handlers.onStatus?.("reconnecting");
    const delay = Math.min(10_000, 500 * 2 ** this.attempt);
    this.attempt++;
    this.retry = setTimeout(() => {
      const supabase = getSupabase();
      if (this.main) void supabase.removeChannel(this.main);
      for (const up of this.ups) void supabase.removeChannel(up);
      this.main = null;
      this.ups = [];
      void this.open().catch(() => this.reconnect());
    }, delay);
  }

  private send(channel: RealtimeChannel | null, event: string, payload: unknown) {
    if (!channel || channel.state !== "joined") return;
    void channel.send({ type: "broadcast", event, payload });
  }

  snapshot(snap: NetSnapshot) {
    this.send(this.main, "snap", snap);
  }

  report(report: Report) {
    this.send(this.ups[0] ?? null, "rep", report);
  }

  press(press: PressMessage) {
    this.send(this.ups[0] ?? null, "press", press);
  }

  roomChanged() {
    this.send(this.main, "room", {});
  }

  result(room: unknown) {
    this.send(this.main, "result", room);
  }

  abort(reason: string) {
    this.send(this.main, "abort", { reason });
  }

  close() {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    const supabase = getSupabase();
    if (this.main) void supabase.removeChannel(this.main);
    for (const up of this.ups) void supabase.removeChannel(up);
    this.main = null;
    this.ups = [];
  }
}
