export type Tier = {
  id: number;
  key: "bronze" | "silver" | "gold" | "diamond" | "sakura" | "eternal";
  name: string;
  vi: string;
  threshold: number;
  colors: { from: string; to: string; gem: string; ring: string };
  reward: string;
};

export const TIERS: Tier[] = [
  { id: 1, key: "bronze", name: "Bronze Hearts", vi: "Trái tim đồng", threshold: 0, colors: { from: "#f3c3a0", to: "#c98e6b", gem: "#f6a88a", ring: "#b77a58" }, reward: "Your legend begins" },
  { id: 2, key: "silver", name: "Silver Hearts", vi: "Trái tim bạc", threshold: 500, colors: { from: "#f1f3f8", to: "#b9bfd3", gem: "#c7b8ea", ring: "#9aa1b8" }, reward: "30 Love Coins each" },
  { id: 3, key: "gold", name: "Golden Hearts", vi: "Trái tim vàng", threshold: 1500, colors: { from: "#fbe3b1", to: "#d9a440", gem: "#f39bbb", ring: "#c08a2a" }, reward: "Golden Hearts Trophy + 60 coins" },
  { id: 4, key: "diamond", name: "Diamond Hearts", vi: "Trái tim kim cương", threshold: 3500, colors: { from: "#e5f3fc", to: "#8fb7f0", gem: "#a995dc", ring: "#6f8fd6" }, reward: "Diamond Trophy + 100 coins" },
  { id: 5, key: "sakura", name: "Sakura Master", vi: "Bậc thầy hoa anh đào", threshold: 7000, colors: { from: "#fde4ee", to: "#e7779f", gem: "#fff4f8", ring: "#d45a86" }, reward: "Sakura Trophy + 150 coins" },
  { id: 6, key: "eternal", name: "Eternal Legends", vi: "Huyền thoại vĩnh cửu", threshold: 12000, colors: { from: "#fbe3b1", to: "#a995dc", gem: "#f5cb78", ring: "#8a73c8" }, reward: "Eternal Trophy + 250 coins" },
];

export function tierForPoints(points: number): Tier {
  return [...TIERS].reverse().find((t) => points >= t.threshold) ?? TIERS[0];
}

export function tierById(id: number | null | undefined): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0];
}

export const BOARDS = [
  { id: "weekly", label: "Weekly Legends", vi: "Huyền thoại tuần", unit: "pts", hint: "Learning XP, quests and co-op bonuses this week" },
  { id: "all_time", label: "All-Time Legends", vi: "Huyền thoại mọi thời", unit: "legend pts", hint: "Every point you have ever earned together" },
  { id: "partners", label: "Perfect Partners", vi: "Cặp đôi ăn ý", unit: "balance", hint: "Twice the smaller partner's points — both must shine" },
  { id: "battle", label: "Battle Champions", vi: "Nhà vô địch", unit: "wins", hint: "Word Battle victories this week" },
] as const;

export type BoardId = (typeof BOARDS)[number]["id"];

export const PODIUM_STYLES = {
  1: { title: "The Ultimate Couple", vi: "Cặp đôi tối thượng", name: "Eternal Flames" },
  2: { title: "Diamond Hearts", vi: "Trái tim kim cương", name: "Diamond Hearts" },
  3: { title: "Burning Hearts", vi: "Trái tim rực cháy", name: "Burning Hearts" },
} as const;

export function formatCountdown(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 60_000));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
