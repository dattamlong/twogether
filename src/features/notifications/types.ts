import type { Avatar } from "@/features/session/types";

export type NotificationType =
  | "love_ping"
  | "study_invitation"
  | "game_invitation"
  | "gift_received"
  | "friend_request"
  | "achievement_unlocked"
  | "couple_quest_completed"
  | "guestbook_signed"
  | "world_event";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  destination: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
  pushStatus: string;
  sender: { id: string; name: string; avatar: Avatar } | null;
};

export type NotificationSettings = {
  lovePing: boolean;
  studyInvites: boolean;
  gameInvites: boolean;
  community: boolean;
  sound: boolean;
  messagePreviews: boolean;
  quietStart: number | null;
  quietEnd: number | null;
  devices: { id: string; label: string | null; createdAt: string; lastSuccessAt: string | null }[];
};

export type LovePingKind = "miss_you" | "come_home" | "study" | "play" | "custom";

export type DispatchResult = { id: string; status: "sent" | "skipped" | "failed" | "none"; note: string; devices: number };

export const LOVE_PING_PRESETS: { kind: Exclude<LovePingKind, "custom">; emoji: string; label: string; vi: string; message: string }[] = [
  { kind: "miss_you", emoji: "💗", label: "Miss You", vi: "Nhớ em/anh", message: "I miss you! Come spend some time with me 🥺💕" },
  { kind: "come_home", emoji: "🏡", label: "Come Home", vi: "Về nhà nào", message: "Come home! I'm waiting for you in our little world 🌸" },
  { kind: "study", emoji: "📚", label: "Study Together", vi: "Cùng học nhé", message: "Let's learn something together today! 📖💗" },
  { kind: "play", emoji: "🎮", label: "Play Together", vi: "Cùng chơi nhé", message: "Come play with me! Our adventure is waiting 🎮✨" },
];

export function safeDestination(value: string) {
  return /^\/[A-Za-z0-9/_?=&%.-]*$/.test(value) && !value.startsWith("//") ? value : "/home";
}
