import { create } from "zustand";

export type RewardResult = {
  xp?: number;
  coins?: number;
  balance?: number;
  level?: number;
  leveledUp?: boolean;
};

type Celebration = RewardResult & { id: number; label?: string };

type CelebrationState = {
  queue: Celebration[];
  celebrate: (reward: RewardResult, label?: string) => void;
  done: (id: number) => void;
};

let nextId = 1;

export const useCelebrations = create<CelebrationState>((set) => ({
  queue: [],
  celebrate: (reward, label) => set((s) => ({ queue: [...s.queue, { ...reward, label, id: nextId++ }] })),
  done: (id) => set((s) => ({ queue: s.queue.filter((c) => c.id !== id) })),
}));

export const celebrate = (reward: unknown, label?: string) =>
  useCelebrations.getState().celebrate((reward ?? {}) as RewardResult, label);
