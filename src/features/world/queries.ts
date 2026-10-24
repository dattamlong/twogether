"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { useSession } from "../session/use-session";
import type {
  ChatChannel,
  CoupleCard,
  CoupleWorldProfile,
  DiscoverSort,
  GameInvitation,
  GuestbookEntry,
  HomeVisit,
  PlayerCard,
  PlayerProfile,
  ReportReason,
  SocialOverview,
  WorldMessage,
} from "./types";

export const worldKeys = {
  all: ["world"] as const,
  profiles: ["world", "profile"] as const,
  profile: (id: string) => ["world", "profile", id] as const,
  couple: (id: string) => ["world", "couple", id] as const,
  discover: (sort: DiscoverSort) => ["world", "discover", sort] as const,
  social: ["world", "social"] as const,
  invitations: ["world", "invitations"] as const,
  guestbook: (coupleId: string) => ["world", "guestbook", coupleId] as const,
  visit: (coupleId: string) => ["world", "visit", coupleId] as const,
  blocked: ["world", "blocked"] as const,
  cards: ["world", "cards"] as const,
};

export async function rpc<T>(name: string, args?: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc(name as never, args as never);
  if (error) throw error;
  return data as unknown as T;
}

export const fetchWorldMessages = (channel: ChatChannel, beforeId?: string, maxRows = 40) =>
  rpc<WorldMessage[]>("get_world_messages", { channel, before_id: beforeId ?? null, max_rows: maxRows });
export const sendWorldMessage = (channel: ChatChannel, body: string, clientId: string) =>
  rpc<WorldMessage>("send_world_message", { channel, body, client_id: clientId });
export const deleteWorldMessage = (message: string) => rpc<void>("delete_world_message", { message });
export const fetchPlayerCards = (ids: string[]) => rpc<PlayerCard[]>("get_player_cards", { ids });

export function usePlayerProfile(id: string | null) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: worldKeys.profile(id ?? ""),
    enabled: Boolean(session && id),
    queryFn: () => rpc<PlayerProfile>("get_player_profile", { target: id }),
  });
}

export function useCoupleWorldProfile(id: string | null) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: worldKeys.couple(id ?? ""),
    enabled: Boolean(session && id),
    queryFn: () => rpc<CoupleWorldProfile>("get_couple_world_profile", { target: id }),
  });
}

export function useDiscoverCouples(sort: DiscoverSort, pageSize = 12) {
  const { data: session } = useSession();
  return useInfiniteQuery({
    queryKey: worldKeys.discover(sort),
    enabled: Boolean(session),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => rpc<{ items: CoupleCard[]; total: number; hasMore: boolean }>("get_discover_couples", { sort, page: pageParam, page_size: pageSize }),
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  });
}

export function useSocialOverview() {
  const { data: session } = useSession();
  return useQuery({ queryKey: worldKeys.social, enabled: Boolean(session), queryFn: () => rpc<SocialOverview>("get_social_overview") });
}

export function useGameInvitations() {
  const { data: session } = useSession();
  return useQuery({ queryKey: worldKeys.invitations, enabled: Boolean(session), queryFn: () => rpc<GameInvitation[]>("get_game_invitations") });
}

export function useBlockedPlayers(enabled: boolean) {
  return useQuery({ queryKey: worldKeys.blocked, enabled, queryFn: () => rpc<PlayerCard[]>("get_blocked_players") });
}

export function useHomeVisit(coupleId: string) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: worldKeys.visit(coupleId),
    enabled: Boolean(session && coupleId),
    staleTime: 30_000,
    retry: false,
    queryFn: () => rpc<HomeVisit>("start_home_visit", { target: coupleId }),
  });
}

export function useGuestbook(coupleId: string | null) {
  return useInfiniteQuery({
    queryKey: worldKeys.guestbook(coupleId ?? ""),
    enabled: Boolean(coupleId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => rpc<GuestbookEntry[]>("get_guestbook", { target: coupleId, before_id: pageParam, max_rows: 20 }),
    getNextPageParam: (last) => (last.length === 20 ? last.at(-1)!.id : undefined),
  });
}

function useInvalidateSocial() {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: worldKeys.social });
    client.invalidateQueries({ queryKey: worldKeys.profiles });
    client.invalidateQueries({ queryKey: ["world", "discover"] });
    client.invalidateQueries({ queryKey: ["world", "couple"] });
  };
}

export function useFriendActions() {
  const invalidate = useInvalidateSocial();
  const client = useQueryClient();
  return {
    request: useMutation({ mutationFn: (target: string) => rpc<string>("send_friend_request", { target }), onSettled: invalidate }),
    respond: useMutation({
      mutationFn: ({ request, accept }: { request: string; accept: boolean }) => rpc<string>("respond_friend_request", { request, accept }),
      onSettled: invalidate,
    }),
    remove: useMutation({ mutationFn: (target: string) => rpc<void>("remove_friend", { target }), onSettled: invalidate }),
    block: useMutation({
      mutationFn: (target: string) => rpc<void>("block_player", { target }),
      onSettled: () => {
        invalidate();
        client.invalidateQueries({ queryKey: worldKeys.blocked });
        client.invalidateQueries({ queryKey: ["world", "chat"] });
        client.invalidateQueries({ queryKey: ["world", "guestbook"] });
        client.invalidateQueries({ queryKey: worldKeys.invitations });
      },
    }),
    unblock: useMutation({
      mutationFn: (target: string) => rpc<void>("unblock_player", { target }),
      onSettled: () => {
        invalidate();
        client.invalidateQueries({ queryKey: worldKeys.blocked });
        client.invalidateQueries({ queryKey: ["world", "chat"] });
      },
    }),
  };
}

export function useReportPlayer() {
  return useMutation({
    mutationFn: (args: { target: string; reason: ReportReason; message?: string; guestbook?: string; details?: string }) =>
      rpc<{ reported: boolean; hidden: boolean }>("report_player", {
        target: args.target,
        reason: args.reason,
        message: args.message ?? null,
        guestbook: args.guestbook ?? null,
        details: args.details ?? null,
      }),
  });
}

export function useInvitationActions() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: worldKeys.invitations });
  return {
    invite: useMutation({ mutationFn: (target: string) => rpc<GameInvitation>("send_game_invitation", { target, game: "word_duel" }), onSettled: invalidate }),
    respond: useMutation({
      mutationFn: ({ invitation, accept }: { invitation: string; accept: boolean }) => rpc<GameInvitation>("respond_game_invitation", { invitation, accept }),
      onSettled: invalidate,
    }),
  };
}

export function useGuestbookActions(coupleId: string) {
  const client = useQueryClient();
  const invalidate = () => {
    client.invalidateQueries({ queryKey: worldKeys.guestbook(coupleId) });
    client.invalidateQueries({ queryKey: worldKeys.couple(coupleId) });
  };
  return {
    sign: useMutation({ mutationFn: (body: string) => rpc<GuestbookEntry>("sign_guestbook", { target: coupleId, body }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (message: string) => rpc<void>("delete_guestbook_message", { message }), onSettled: invalidate }),
  };
}

export const startDuel = (invitation: string) =>
  rpc<{ sessionId: string; invitation: GameInvitation; questions: import("../learning/types").QuestionCard[] }>("start_duel", { invitation });
export const finishDuel = (sessionId: string) => rpc<GameInvitation>("finish_duel", { game_session: sessionId });
