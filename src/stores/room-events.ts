import { create } from "zustand";

export type RoomEvent =
  | { type: "hug" }
  | { type: "gift" }
  | { type: "celebrate" }
  | { type: "self_emote"; emote: "wave" | "heart" | "twirl" | "heart_burst" }
  | { type: "partner_emote"; emote: "heart" }
  | { type: "love_ping_sent" }
  | { type: "love_ping_received" }
  | { type: "reunion"; partnerPresent: boolean };

type RoomEventState = {
  events: (RoomEvent & { id: number })[];
  emit: (event: RoomEvent) => void;
  consume: (id: number) => void;
};

let nextId = 1;

export const useRoomEvents = create<RoomEventState>((set) => ({
  events: [],
  emit: (event) => set((s) => ({ events: [...s.events.slice(-10), { ...event, id: nextId++ }] })),
  consume: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
}));
