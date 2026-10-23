import { create } from "zustand";

export type Toast = {
  id: number;
  tone: "info" | "success" | "error" | "love";
  title: string;
  vi?: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => get().dismiss(id), toast.durationMs ?? 4500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (t: Omit<Toast, "id">) => useToasts.getState().push(t);
