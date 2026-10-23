import type { Database } from "@/lib/supabase/database.types";

type Tables = Database["public"]["Tables"];
export type Profile = Tables["profiles"]["Row"];
export type Couple = Tables["couples"]["Row"];
export type UserProgress = Tables["user_progress"]["Row"];
export type CoupleProgress = Tables["couple_progress"]["Row"];
export type Streak = Tables["streaks"]["Row"];

export type Avatar = {
  hair: "bob" | "long" | "spiky" | "twintails" | "bun" | "short";
  hairColor: string;
  skin: string;
  eyes: string;
  outfit: string;
  outfitColor: string;
  accessory: string;
};

export const DEFAULT_AVATAR: Avatar = {
  hair: "bob",
  hairColor: "#5b4256",
  skin: "#ffe3d3",
  eyes: "#45365b",
  outfit: "tee",
  outfitColor: "#f8bbd0",
  accessory: "none",
};

export function readAvatar(raw: unknown): Avatar {
  return { ...DEFAULT_AVATAR, ...(raw && typeof raw === "object" ? (raw as Partial<Avatar>) : {}) };
}

export type SessionData = {
  userId: string;
  email: string | null;
  profile: Profile;
  couple: Couple | null;
  slot: 0 | 1 | null;
  partner: Profile | null;
};
