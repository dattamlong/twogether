import type { Avatar } from "@/features/session/types";

export type ChatChannel = "world" | "english_cafe";

export type PlayerCard = {
  id: string;
  name: string;
  avatar: Avatar;
  level: number;
  coupleId: string | null;
  coupleName: string | null;
  partnerName: string | null;
  tier: number | null;
};

export type WorldMessage = {
  id: string;
  channel: ChatChannel;
  userId: string;
  body: string;
  clientId: string;
  createdAt: string;
  author: PlayerCard | null;
};

export type ChatItem = WorldMessage & { status: "sent" | "sending" | "failed" };

export type Friendship = "none" | "friends" | "outgoing" | "incoming";

export type PlayerProfile = PlayerCard & {
  isSelf: boolean;
  friendship: Friendship;
  blockedByMe: boolean;
  canInteract: boolean;
  lessonsCompleted: number;
  unitsCleared: number;
  streak: number;
  learning: { language: "en" | "zh"; english: string; chinese: string };
  achievements: { id: string; title: string; title_vi: string; icon: string }[];
};

export type CoupleMember = { id: string; name: string; avatar: Avatar };

export type CoupleCard = {
  coupleId: string;
  name: string;
  members: CoupleMember[];
  level: number;
  homeLevel: number;
  tier: number;
  legendPoints: number;
  weeklyScore: number;
  lastActive: string | null;
  items: string[];
  itemCount: number;
  isFriend: boolean;
  isOwn: boolean;
};

export type CoupleWorldProfile = CoupleCard & {
  canVisit: boolean;
  bestRank: number | null;
  achievements: { id: string; title: string; title_vi: string; icon: string }[];
  guestbookCount: number;
};

export type HomeVisit = CoupleCard & {
  placements: { inventoryId: string; itemId: string; x: number; y: number; w: number; h: number; flipped: boolean }[];
};

export type GuestbookEntry = { id: string; coupleId: string; body: string; createdAt: string; author: PlayerCard | null };

export type SocialOverview = {
  friends: PlayerCard[];
  incoming: { id: string; createdAt: string; player: PlayerCard }[];
  outgoing: { id: string; createdAt: string; player: PlayerCard }[];
};

export type GameInvitation = {
  id: string;
  game: "word_duel";
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  language: "en" | "zh";
  createdAt: string;
  expiresAt: string;
  from: PlayerCard;
  to: PlayerCard;
  incoming: boolean;
  results: { userId: string; correct: number | null; total: number; finished: boolean; finishedAt: string | null }[];
};

export type DiscoverSort = "recent" | "level" | "legends" | "friends";

export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";
