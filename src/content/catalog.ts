export type ShopCategory = "furniture" | "plants" | "decorations" | "clothing" | "accessories" | "animations" | "gifts";

export type ShopItem = {
  id: string;
  name: string;
  name_vi: string;
  description: string;
  category: ShopCategory;
  price: number;
  asset_key: string;
  footprint_w: number;
  footprint_h: number;
  min_home_level: number;
  shop_visible: boolean;
};

const placeable = (
  id: string,
  category: ShopCategory,
  name: string,
  name_vi: string,
  description: string,
  price: number,
  options: { w?: number; h?: number; minHomeLevel?: number; shopVisible?: boolean } = {},
): ShopItem => ({
  id,
  name,
  name_vi,
  description,
  category,
  price,
  asset_key: id,
  footprint_w: options.w ?? 1,
  footprint_h: options.h ?? 1,
  min_home_level: options.minHomeLevel ?? 1,
  shop_visible: options.shopVisible ?? true,
});

const wearable = (id: string, category: ShopCategory, name: string, name_vi: string, description: string, price: number): ShopItem => ({
  id,
  name,
  name_vi,
  description,
  category,
  price,
  asset_key: id,
  footprint_w: 0,
  footprint_h: 0,
  min_home_level: 1,
  shop_visible: true,
});

export const SHOP_ITEMS: ShopItem[] = [
  placeable("floor_lamp", "furniture", "Paper Floor Lamp", "Đèn giấy đứng", "A tall lamp with a warm, papery glow.", 120),
  placeable("armchair", "furniture", "Cloud Armchair", "Ghế bành mây", "Sink in and read something lovely.", 220),
  placeable("side_table", "furniture", "Round Side Table", "Bàn tròn nhỏ", "Perfect for two cups of tea.", 90),
  placeable("beanbag", "furniture", "Peach Beanbag", "Ghế lười màu đào", "Squishy, soft and slightly lopsided.", 150),
  placeable("aquarium", "furniture", "Tiny Aquarium", "Bể cá mini", "Two little fish who always swim together.", 320, { w: 2, minHomeLevel: 3 }),
  placeable("cactus", "plants", "Happy Cactus", "Xương rồng vui vẻ", "Low maintenance, high cheer.", 40),
  placeable("monstera", "plants", "Monstera", "Cây trầu bà lá xẻ", "Big leaves for a big heart.", 80),
  placeable("sunflower_pot", "plants", "Sunflower Pot", "Chậu hoa hướng dương", "Always faces toward you.", 60),
  placeable("bonsai", "plants", "Little Bonsai", "Cây bonsai nhỏ", "Grows patiently, like us.", 140, { minHomeLevel: 2 }),
  placeable("teddy_bear", "decorations", "Teddy Bear", "Gấu bông", "Keeps your seat warm while you're away.", 100),
  placeable("star_lamp", "decorations", "Star Night Light", "Đèn ngủ ngôi sao", "Projects tiny stars on the ceiling.", 130),
  placeable("photo_stand", "decorations", "Photo Stand", "Khung ảnh để bàn", "For our favorite picture.", 70),
  placeable("cat_bed", "decorations", "Sleepy Cat", "Mèo ngủ", "A round cat in a round bed. Purrs softly.", 260, { minHomeLevel: 5 }),
  placeable("cushion_pile", "decorations", "Cushion Pile", "Đống gối êm", "For lazy movie nights.", 50),
  placeable("golden_lamp", "decorations", "Golden Streak Lamp", "Đèn chuỗi ngày vàng", "Earned by keeping a 7-day learning streak.", 0, { shopVisible: false }),
  placeable("heart_lantern", "decorations", "Heart Lantern", "Đèn lồng trái tim", "Earned by a 7-day couple streak.", 0, { shopVisible: false }),
  placeable("magic_bookshelf", "furniture", "Magical Bookshelf", "Kệ sách phép thuật", "Glowing books from the English Kingdom. Earned in A1 · First Steps.", 0, { shopVisible: false }),
  placeable("vintage_lamp", "decorations", "Vintage Study Lamp", "Đèn học cổ điển", "Earned in English A1 · Daily Life.", 0, { shopVisible: false }),
  placeable("fantasy_globe", "decorations", "Fantasy Globe", "Quả địa cầu kỳ ảo", "Earned in English A1 · Home & Things.", 0, { shopVisible: false }),
  placeable("vintage_typewriter", "decorations", "Vintage Typewriter", "Máy đánh chữ cổ", "Earned in English A2 · Feelings & Plans.", 0, { shopVisible: false }),
  placeable("paper_lantern", "decorations", "Paper Lantern", "Đèn lồng giấy", "Earned in Chinese HSK 1 · Sounds & Strokes.", 0, { shopVisible: false }),
  placeable("bamboo_pot", "plants", "Lucky Bamboo", "Cây trúc may mắn", "Earned in Chinese HSK 1 · First Sentences.", 0, { shopVisible: false }),
  placeable("scroll_stand", "decorations", "Calligraphy Scroll", "Tranh thư pháp", "Earned in Chinese HSK 2 · Life Together.", 0, { shopVisible: false }),
  placeable("puzzle_cube", "decorations", "Puzzle Sculpture", "Tượng khối câu đố", "Earned in Brain Academy · First Puzzles.", 0, { shopVisible: false }),
  placeable("treasure_map_table", "furniture", "Explorer's Map Table", "Bàn bản đồ thám hiểm", "Earned in World Explorer · Around the World.", 0, { shopVisible: false }),
  placeable("love_letter_box", "decorations", "Love Letter Box", "Hộp thư tình", "Earned together in the couple adventure The Lost Love Letter.", 0, { shopVisible: false }),
  wearable("hoodie_lavender", "clothing", "Lavender Hoodie", "Áo hoodie oải hương", "Cozy hoodie for late-night study.", 150),
  wearable("sweater_mint", "clothing", "Mint Sweater", "Áo len bạc hà", "Hand-knit look, extra soft.", 150),
  wearable("yukata_sakura", "clothing", "Sakura Yukata", "Yukata hoa anh đào", "For festival nights together.", 300),
  wearable("bow", "accessories", "Ribbon Bow", "Nơ ruy băng", "A big, bouncy bow.", 60),
  wearable("glasses", "accessories", "Round Glasses", "Kính tròn", "Smart-looking study glasses.", 80),
  wearable("flower_crown", "accessories", "Flower Crown", "Vòng hoa", "Tiny blossoms in your hair.", 120),
  wearable("beanie", "accessories", "Warm Beanie", "Mũ len", "Snug and cute.", 90),
  wearable("emote_twirl", "animations", "Happy Twirl", "Xoay vòng vui vẻ", "Unlocks a twirl you can do in the room.", 200),
  wearable("emote_heart_burst", "animations", "Heart Burst", "Bùng nổ trái tim", "Unlocks a burst of hearts.", 160),
  wearable("gift_chocolate", "gifts", "Chocolate Box", "Hộp sô-cô-la", "Send a sweet treat to your partner.", 30),
  wearable("gift_rose", "gifts", "Single Rose", "Một bông hồng", "Classic, simple, lovely.", 25),
  wearable("gift_letter_charm", "gifts", "Letter Charm", "Bùa thư tình", "A tiny sealed letter that sparkles.", 40),
  wearable("gift_bunny", "gifts", "Plush Bunny", "Thỏ bông", "Soft bunny to hug when you miss each other.", 80),
];

export type QuestEvent =
  | "word_learned"
  | "lesson_completed"
  | "review_answered"
  | "game_completed"
  | "battle_won"
  | "puzzle_solved"
  | "love_answered"
  | "message_sent"
  | "vocab_correct"
  | "love_letter"
  | "world_lesson"
  | "boss_attempted"
  | "unit_review_done";

export type DailyQuestTemplate = {
  id: string;
  slot: "learn" | "lesson" | "review" | "play" | "explore";
  title: string;
  title_vi: string;
  event: QuestEvent;
  category: string | null;
  target: number;
  xp_reward: number;
  coin_reward: number;
};

export const DAILY_QUESTS: DailyQuestTemplate[] = [
  { id: "learn_words_5", slot: "learn", title: "Learn 5 new words", title_vi: "Học 5 từ mới", event: "word_learned", category: null, target: 5, xp_reward: 25, coin_reward: 10 },
  { id: "learn_words_8", slot: "learn", title: "Learn 8 new words", title_vi: "Học 8 từ mới", event: "word_learned", category: null, target: 8, xp_reward: 35, coin_reward: 15 },
  { id: "any_lesson_1", slot: "lesson", title: "Finish any lesson", title_vi: "Hoàn thành một bài học bất kỳ", event: "lesson_completed", category: null, target: 1, xp_reward: 20, coin_reward: 10 },
  { id: "grammar_lesson_1", slot: "lesson", title: "Complete a grammar lesson", title_vi: "Hoàn thành một bài ngữ pháp", event: "lesson_completed", category: "grammar", target: 1, xp_reward: 30, coin_reward: 15 },
  { id: "listening_lesson_1", slot: "lesson", title: "Complete a listening lesson", title_vi: "Hoàn thành một bài nghe", event: "lesson_completed", category: "listening", target: 1, xp_reward: 30, coin_reward: 15 },
  { id: "review_5", slot: "review", title: "Answer 5 review questions", title_vi: "Trả lời 5 câu ôn tập", event: "review_answered", category: null, target: 5, xp_reward: 20, coin_reward: 10 },
  { id: "review_10", slot: "review", title: "Answer 10 review questions", title_vi: "Trả lời 10 câu ôn tập", event: "review_answered", category: null, target: 10, xp_reward: 30, coin_reward: 15 },
  { id: "minigame_1", slot: "play", title: "Play a mini-game", title_vi: "Chơi một trò chơi nhỏ", event: "game_completed", category: null, target: 1, xp_reward: 20, coin_reward: 10 },
  { id: "battle_win_1", slot: "play", title: "Win a Word Battle", title_vi: "Thắng một trận Word Battle", event: "battle_won", category: null, target: 1, xp_reward: 30, coin_reward: 15 },
  { id: "world_lesson_1", slot: "explore", title: "Finish a lesson in Brain Academy or World Explorer", title_vi: "Hoàn thành 1 bài ở Học viện Trí tuệ hoặc Nhà thám hiểm", event: "world_lesson", category: null, target: 1, xp_reward: 25, coin_reward: 12 },
  { id: "boss_attempt_1", slot: "explore", title: "Challenge a unit boss", title_vi: "Thách đấu một Boss", event: "boss_attempted", category: null, target: 1, xp_reward: 25, coin_reward: 12 },
  { id: "unit_review_1", slot: "explore", title: "Complete a unit review", title_vi: "Hoàn thành một bài ôn tập unit", event: "unit_review_done", category: null, target: 1, xp_reward: 20, coin_reward: 10 },
  { id: "puzzle_3", slot: "play", title: "Solve 3 sentence puzzles", title_vi: "Giải 3 câu đố sắp xếp câu", event: "puzzle_solved", category: null, target: 3, xp_reward: 25, coin_reward: 12 },
];

export type CoupleQuestTemplate = {
  id: string;
  title: string;
  title_vi: string;
  description: string;
  mode: "each" | "combined" | "same_day";
  event: QuestEvent;
  target: number;
  couple_xp: number;
  love_energy: number;
  coin_reward: number;
};

export const COUPLE_QUESTS: CoupleQuestTemplate[] = [
  { id: "study_together", title: "Study Together", title_vi: "Cùng nhau học", description: "Each of you finishes a lesson this week.", mode: "each", event: "lesson_completed", target: 1, couple_xp: 60, love_energy: 15, coin_reward: 15 },
  { id: "vocab_partners", title: "Vocabulary Partners", title_vi: "Cặp đôi từ vựng", description: "Together, answer 10 vocabulary questions correctly.", mode: "combined", event: "vocab_correct", target: 10, couple_xp: 50, love_energy: 10, coin_reward: 10 },
  { id: "love_letter", title: "Love Letter", title_vi: "Thư tình", description: "Write your partner a message in English (12+ words).", mode: "combined", event: "love_letter", target: 1, couple_xp: 40, love_energy: 15, coin_reward: 10 },
  { id: "our_future", title: "Our Future", title_vi: "Tương lai của chúng mình", description: "Each of you answers two Daily Love Questions.", mode: "each", event: "love_answered", target: 2, couple_xp: 50, love_energy: 20, coin_reward: 10 },
  { id: "perfect_study_date", title: "Perfect Study Date", title_vi: "Buổi hẹn học hoàn hảo", description: "Both finish a lesson on the same day.", mode: "same_day", event: "lesson_completed", target: 1, couple_xp: 80, love_energy: 25, coin_reward: 20 },
];

export type AchievementDef = {
  id: string;
  scope: "user" | "couple";
  title: string;
  title_vi: string;
  description: string;
  icon: string;
  coin_reward: number;
  reward_item_id: string | null;
};

const achievement = (
  id: string,
  scope: "user" | "couple",
  title: string,
  title_vi: string,
  description: string,
  icon: string,
  coin_reward = 0,
  reward_item_id: string | null = null,
): AchievementDef => ({ id, scope, title, title_vi, description, icon, coin_reward, reward_item_id });

export const ACHIEVEMENTS: AchievementDef[] = [
  achievement("first_lesson", "user", "First Steps", "Những bước đầu tiên", "Complete your first lesson.", "book", 20),
  achievement("lessons_10", "user", "Bookworm", "Mọt sách", "Complete 10 lessons.", "books", 50),
  achievement("lessons_25", "user", "Scholar", "Học giả", "Complete 25 lessons.", "graduation", 100),
  achievement("words_25", "user", "Word Collector", "Nhà sưu tầm từ", "Learn 25 words.", "sparkles", 40),
  achievement("words_mastered_20", "user", "Word Master", "Bậc thầy từ vựng", "Master 20 words in review.", "crown", 80),
  achievement("first_battle_win", "user", "Word Warrior", "Chiến binh từ vựng", "Win your first Word Battle.", "sword", 20),
  achievement("puzzles_10", "user", "Puzzle Solver", "Bậc thầy ghép câu", "Solve 10 sentence puzzles.", "puzzle", 40),
  achievement("first_purchase", "user", "Home Maker", "Người trang trí", "Buy your first item.", "home", 10),
  achievement("level_5", "user", "Rising Star", "Ngôi sao đang lên", "Reach level 5.", "star", 50),
  achievement("streak_3", "user", "Warming Up", "Khởi động", "Learn 3 days in a row.", "flame", 15),
  achievement("streak_7", "user", "One Week Strong", "Một tuần bền bỉ", "Learn 7 days in a row.", "flame", 30, "golden_lamp"),
  achievement("streak_14", "user", "Two Weeks", "Hai tuần", "Learn 14 days in a row.", "flame", 50),
  achievement("streak_30", "user", "Monthly Habit", "Thói quen một tháng", "Learn 30 days in a row.", "flame", 100),
  achievement("streak_60", "user", "Unstoppable", "Không thể ngăn cản", "Learn 60 days in a row.", "flame", 150),
  achievement("streak_100", "user", "Century", "Trăm ngày", "Learn 100 days in a row.", "flame", 300),
  achievement("couple_streak_3", "couple", "In Sync", "Đồng điệu", "Both learn 3 days in a row.", "hearts", 20),
  achievement("couple_streak_7", "couple", "Week of Us", "Tuần của chúng mình", "Both learn 7 days in a row.", "hearts", 40, "heart_lantern"),
  achievement("couple_streak_14", "couple", "Fortnight Together", "Hai tuần bên nhau", "Both learn 14 days in a row.", "hearts", 60),
  achievement("couple_streak_30", "couple", "Month of Us", "Một tháng của chúng mình", "Both learn 30 days in a row.", "hearts", 120),
  achievement("couple_streak_60", "couple", "Deep Roots", "Gốc rễ sâu", "Both learn 60 days in a row.", "hearts", 180),
  achievement("couple_streak_100", "couple", "Hundred Days Together", "Trăm ngày bên nhau", "Both learn 100 days in a row.", "hearts", 350),
  achievement("first_hug", "couple", "First Hug", "Cái ôm đầu tiên", "Share your first hug in the room.", "hug", 10),
  achievement("first_couple_quest", "couple", "Team Players", "Đồng đội", "Complete your first couple quest.", "handshake", 20),
  achievement("home_level_3", "couple", "Cozier Home", "Ngôi nhà ấm hơn", "Reach home level 3.", "house", 40),
  achievement("first_boss_clear", "user", "Guardian Slayer", "Hạ gục Hộ vệ", "Defeat your first unit boss.", "sword", 30),
  achievement("adventure_lost_love_letter", "couple", "The Lost Love Letter", "Lá thư tình thất lạc", "Complete the couple adventure The Lost Love Letter.", "hearts", 50),
  achievement("home_level_5", "couple", "Dream Home", "Ngôi nhà mơ ước", "Reach home level 5.", "castle", 100),
];

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

export const HOME_LEVELS = [
  { level: 1, loveEnergy: 0, title: "Small cozy room", title_vi: "Căn phòng nhỏ ấm cúng" },
  { level: 2, loveEnergy: 40, title: "Decorative plants", title_vi: "Cây cảnh trang trí" },
  { level: 3, loveEnergy: 120, title: "New wallpaper", title_vi: "Giấy dán tường mới" },
  { level: 4, loveEnergy: 240, title: "Special lighting", title_vi: "Ánh sáng đặc biệt" },
  { level: 5, loveEnergy: 400, title: "Expanded decorations", title_vi: "Mở rộng trang trí" },
] as const;

export type CoupleAdventureDef = {
  id: string;
  title: string;
  title_vi: string;
  story: string;
  story_vi: string;
  letter: string;
  letter_vi: string;
  parts: { slot: 0 | 1; category: "vocabulary" | "grammar"; title: string; title_vi: string }[];
  couple_xp: number;
  love_energy: number;
  reward_item_id: string | null;
};

export const COUPLE_ADVENTURES: CoupleAdventureDef[] = [
  {
    id: "lost_love_letter",
    title: "The Lost Love Letter",
    title_vi: "Lá thư tình thất lạc",
    story: "A gust of wind scattered an old love letter across the kingdom. One of you gathers the lost words, the other restores the broken grammar seal. Only together can you read it.",
    story_vi: "Một cơn gió thổi tung lá thư tình cũ khắp vương quốc. Một người nhặt lại những từ bị thất lạc, người kia sửa phong ấn ngữ pháp. Chỉ khi cùng nhau, hai bạn mới đọc được lá thư.",
    letter: "To the one who learns beside me: every word I learn is a small step closer to you. Distance is only a number between two hearts that keep growing together. Wait for me — I'm coming, one lesson at a time.",
    letter_vi: "Gửi người cùng học bên mình: mỗi từ mình học là một bước nhỏ đến gần bạn hơn. Khoảng cách chỉ là con số giữa hai trái tim vẫn cùng nhau lớn lên. Đợi mình nhé — mình đang đến, từng bài học một.",
    parts: [
      { slot: 0, category: "vocabulary", title: "Gather the lost words", title_vi: "Nhặt lại những từ thất lạc" },
      { slot: 1, category: "grammar", title: "Restore the grammar seal", title_vi: "Sửa phong ấn ngữ pháp" },
    ],
    couple_xp: 120,
    love_energy: 30,
    reward_item_id: "love_letter_box",
  },
];
