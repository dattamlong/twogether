"use client";

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import type { SessionData } from "@/features/session/types";
import { friendlyError } from "@/lib/errors";
import { fetchPlayerCards, fetchWorldMessages, sendWorldMessage } from "./queries";
import type { ChatChannel, ChatItem, PlayerCard, WorldMessage } from "./types";
import { worldLobby, type ChatRow } from "./world-channel";

const PAGE = 40;
const MAX_ITEMS = 300;

type ChannelState = { items: ChatItem[]; hasOlder: boolean; loaded: boolean; loading: boolean; loadingOlder: boolean; error: unknown; errors: Record<string, string> };

type ChatStore = {
  channels: Record<ChatChannel, ChannelState>;
  patch: (channel: ChatChannel, fn: (state: ChannelState) => Partial<ChannelState>) => void;
};

const empty = (): ChannelState => ({ items: [], hasOlder: false, loaded: false, loading: false, loadingOlder: false, error: null, errors: {} });

const useChatStore = create<ChatStore>((set) => ({
  channels: { world: empty(), english_cafe: empty() },
  patch: (channel, fn) => set((s) => ({ channels: { ...s.channels, [channel]: { ...s.channels[channel], ...fn(s.channels[channel]) } } })),
}));

const cards = new Map<string, PlayerCard>();
const pendingCards = new Map<string, Promise<PlayerCard | null>>();

function remember(message: WorldMessage) {
  if (message.author) cards.set(message.userId, message.author);
}

async function cardFor(userId: string) {
  const known = cards.get(userId);
  if (known) return known;
  if (!pendingCards.has(userId)) {
    pendingCards.set(
      userId,
      fetchPlayerCards([userId])
        .then((list) => {
          const card = list[0] ?? null;
          if (card) cards.set(userId, card);
          return card;
        })
        .catch(() => null)
        .finally(() => pendingCards.delete(userId)),
    );
  }
  return pendingCards.get(userId)!;
}

function byTime(a: ChatItem, b: ChatItem) {
  return a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1;
}

function merge(existing: ChatItem[], incoming: WorldMessage[]) {
  const map = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) {
    remember(m);
    const pending = existing.find((p) => p.status !== "sent" && p.clientId === m.clientId && p.userId === m.userId);
    if (pending) map.delete(pending.id);
    map.set(m.id, { ...m, status: "sent" });
  }
  return [...map.values()].sort(byTime);
}

const patch = (channel: ChatChannel, fn: (state: ChannelState) => Partial<ChannelState>) => useChatStore.getState().patch(channel, fn);

async function loadLatest(channel: ChatChannel) {
  patch(channel, () => ({ loading: true, error: null }));
  try {
    const latest = await fetchWorldMessages(channel, undefined, PAGE);
    patch(channel, (s) => {
      const kept = s.loaded ? s.items : s.items.filter((m) => m.status !== "sent");
      return { items: merge(kept, latest), hasOlder: s.loaded ? s.hasOlder : latest.length === PAGE, loaded: true, loading: false };
    });
  } catch (error) {
    patch(channel, () => ({ loading: false, error }));
  }
}

export async function resetChat(channel: ChatChannel) {
  patch(channel, () => empty());
  await loadLatest(channel);
}

async function handleRow(event: "insert" | "update", row: ChatRow) {
  const channel = row.channel as ChatChannel;
  if (channel !== "world" && channel !== "english_cafe") return;
  if (event === "update") {
    if (row.hidden_at) patch(channel, (s) => ({ items: s.items.filter((m) => m.id !== row.id) }));
    return;
  }
  const state = useChatStore.getState().channels[channel];
  if (!state.loaded || state.items.some((m) => m.id === row.id)) return;
  const author = await cardFor(row.user_id);
  const message: WorldMessage = { id: row.id, channel, userId: row.user_id, body: row.body, clientId: row.client_id, createdAt: row.created_at, author };
  patch(channel, (s) => {
    const items = merge(s.items, [message]);
    return items.length > MAX_ITEMS ? { items: items.slice(-MAX_ITEMS), hasOlder: true } : { items };
  });
}

let bridged = 0;
let offChat: (() => void) | null = null;
let offReconnect: (() => void) | null = null;

function bridge() {
  bridged++;
  if (bridged > 1) return;
  offChat = worldLobby.onChat((event, row) => void handleRow(event, row));
  offReconnect = worldLobby.onReconnect(() => {
    for (const channel of ["world", "english_cafe"] as ChatChannel[]) if (useChatStore.getState().channels[channel].loaded) void loadLatest(channel);
  });
}

function unbridge() {
  bridged--;
  if (bridged > 0) return;
  offChat?.();
  offReconnect?.();
}

export function useWorldChat(channel: ChatChannel, session: SessionData) {
  const state = useChatStore((s) => s.channels[channel]);

  useEffect(() => {
    bridge();
    return unbridge;
  }, []);

  useEffect(() => {
    if (!useChatStore.getState().channels[channel].loaded) void loadLatest(channel);
  }, [channel]);

  const deliver = useCallback(
    async (item: ChatItem) => {
      patch(channel, (s) => ({ items: s.items.map((m) => (m.id === item.id ? { ...m, status: "sending" } : m)), errors: { ...s.errors, [item.id]: "" } }));
      try {
        const saved = await sendWorldMessage(channel, item.body, item.clientId);
        patch(channel, (s) => ({ items: merge(s.items.filter((m) => m.id !== item.id), [saved]) }));
        return true;
      } catch (error) {
        const message = friendlyError(error);
        patch(channel, (s) => ({ items: s.items.map((m) => (m.id === item.id ? { ...m, status: "failed" } : m)), errors: { ...s.errors, [item.id]: message.en } }));
        return false;
      }
    },
    [channel],
  );

  const send = useCallback(
    (body: string) => {
      const clientId = crypto.randomUUID();
      const item: ChatItem = {
        id: `local-${clientId}`,
        channel,
        userId: session.userId,
        body: body.trim(),
        clientId,
        createdAt: new Date().toISOString(),
        status: "sending",
        author: cards.get(session.userId) ?? {
          id: session.userId,
          name: session.profile.display_name,
          avatar: session.profile.avatar as PlayerCard["avatar"],
          level: 1,
          coupleId: session.couple?.id ?? null,
          coupleName: session.couple?.name ?? null,
          partnerName: session.partner?.display_name ?? null,
          tier: null,
        },
      };
      patch(channel, (s) => ({ items: [...s.items, item] }));
      return deliver(item);
    },
    [channel, deliver, session],
  );

  const retry = useCallback((id: string) => {
    const item = useChatStore.getState().channels[channel].items.find((m) => m.id === id);
    if (item) void deliver(item);
  }, [channel, deliver]);

  const discard = useCallback((id: string) => patch(channel, (s) => ({ items: s.items.filter((m) => m.id !== id) })), [channel]);

  const loadOlder = useCallback(async () => {
    const current = useChatStore.getState().channels[channel];
    const oldest = current.items.find((m) => m.status === "sent");
    if (!oldest || current.loadingOlder || !current.hasOlder) return;
    patch(channel, () => ({ loadingOlder: true }));
    try {
      const older = await fetchWorldMessages(channel, oldest.id, PAGE);
      patch(channel, (s) => ({ items: merge(s.items, older), hasOlder: older.length === PAGE, loadingOlder: false }));
    } catch (error) {
      patch(channel, () => ({ loadingOlder: false, error }));
    }
  }, [channel]);

  return { ...state, send, retry, discard, loadOlder, reload: () => resetChat(channel) };
}
