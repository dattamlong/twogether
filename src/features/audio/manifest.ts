export type MusicCategory = "home" | "learning" | "games" | "world" | "legends";
export type AmbientId = "rain" | "birds" | "fireplace" | "wind";

export type TrackSource = { kind: "composed" } | { kind: "file"; src: string; durationSec?: number };

export type Track = {
  id: string;
  name: string;
  category: MusicCategory;
  mood: string;
  source: TrackSource;
  loop: boolean;
  license: string;
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
};

export const CATEGORY_INFO: Record<MusicCategory, { label: string; vi: string; emoji: string }> = {
  home: { label: "Cozy Home Collection", vi: "Nhạc ngôi nhà nhỏ", emoji: "🏡" },
  learning: { label: "Study Lo-fi Collection", vi: "Nhạc học bài", emoji: "📚" },
  games: { label: "Playtime Collection", vi: "Nhạc mini game", emoji: "🎮" },
  world: { label: "Adventure Collection", vi: "Nhạc phiêu lưu", emoji: "🌸" },
  legends: { label: "Legends Collection", vi: "Nhạc huyền thoại", emoji: "🏆" },
};

const ORIGINAL = "Original composition for TWOGETHER, synthesized in the browser";

const composed = (id: string, name: string, category: MusicCategory, mood: string, timeOfDay?: Track["timeOfDay"]): Track => ({
  id,
  name,
  category,
  mood,
  source: { kind: "composed" },
  loop: true,
  license: ORIGINAL,
  timeOfDay,
});

export const FILE_TRACKS: Track[] = [];

export const TRACKS: Track[] = [
  composed("pink-sunset", "Pink Sunset", "home", "Light morning piano and guitar", "morning"),
  composed("our-little-world", "Our Little World", "home", "Warm afternoon lo-fi", "afternoon"),
  composed("home-with-you", "Home With You", "home", "Romantic evening piano", "evening"),
  composed("sakura-dreams", "Sakura Dreams", "home", "Soft night lullaby", "night"),
  composed("little-steps", "Little Steps", "learning", "Gentle study beat"),
  composed("study-under-the-stars", "Study Under the Stars", "learning", "Calm starlit focus"),
  composed("dreamy-library", "Dreamy Library", "learning", "Quiet piano and pads"),
  composed("morning-notes", "Morning Notes", "learning", "Bright, easy focus"),
  composed("tiny-victory", "Tiny Victory", "games", "Cheerful chiptune"),
  composed("playtime", "Playtime!", "games", "Bouncy and playful"),
  composed("lucky-hearts", "Lucky Hearts", "games", "Sparkly pop"),
  composed("ready-set-love", "Ready, Set, Love!", "games", "Energetic anime pop"),
  composed("beyond-our-home", "Beyond Our Home", "world", "Wandering adventure"),
  composed("sakura-village", "Sakura Village", "world", "Whimsical village stroll"),
  composed("little-adventures", "Little Adventures", "world", "Playful exploration"),
  composed("a-world-for-two", "A World for Two", "world", "Warm and magical"),
  composed("legends-of-love", "Legends of Love", "legends", "Gentle heroic theme"),
  composed("golden-hearts", "Golden Hearts", "legends", "Emotional and proud"),
  composed("eternal-adventure", "Eternal Adventure", "legends", "Brave and hopeful"),
  ...FILE_TRACKS,
];

export const AMBIENTS: { id: AmbientId; name: string; vi: string; emoji: string }[] = [
  { id: "rain", name: "Rainy Night", vi: "Đêm mưa", emoji: "🌧️" },
  { id: "birds", name: "Sunny Morning", vi: "Sáng nắng", emoji: "🐦" },
  { id: "fireplace", name: "Cozy Fireplace", vi: "Lò sưởi", emoji: "🔥" },
  { id: "wind", name: "Sakura Garden", vi: "Vườn hoa anh đào", emoji: "🌸" },
];

export function trackById(id: string | null | undefined) {
  return TRACKS.find((t) => t.id === id) ?? null;
}

export function tracksIn(category: MusicCategory) {
  return TRACKS.filter((t) => t.category === category);
}

export function categoryForPath(pathname: string): MusicCategory | null {
  if (pathname === "/home" || pathname.startsWith("/home/")) return "home";
  if (pathname.startsWith("/world/duel") || pathname.startsWith("/games")) return "games";
  if (pathname.startsWith("/learn")) return "learning";
  if (pathname.startsWith("/world")) return "world";
  if (pathname.startsWith("/legends")) return "legends";
  return null;
}

export function timeOfDay(hour: number): NonNullable<Track["timeOfDay"]> {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function areaTrack(category: MusicCategory, hour: number, previous?: string | null): Track {
  const list = tracksIn(category);
  if (previous) {
    const current = list.find((t) => t.id === previous);
    if (current) return current;
  }
  if (category === "home") {
    const slot = timeOfDay(hour);
    return list.find((t) => t.timeOfDay === slot) ?? list[0];
  }
  return list[0];
}

export function stepTrack(id: string, direction: 1 | -1): Track {
  const index = TRACKS.findIndex((t) => t.id === id);
  const next = (index + direction + TRACKS.length) % TRACKS.length;
  return TRACKS[index === -1 ? 0 : next];
}

export function nextInCategory(id: string): Track {
  const current = trackById(id);
  if (!current) return TRACKS[0];
  const list = tracksIn(current.category);
  return list[(list.indexOf(current) + 1) % list.length];
}
