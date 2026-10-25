export type GameMode = "solo" | "versus" | "coop";

export type GameDefinition = {
  id: string;
  title: string;
  title_vi: string;
  description: string;
  mode: GameMode;
  href: string | null;
  serverKind: "word_battle" | "sentence_puzzle" | null;
  accent: string;
};

export const GAMES: GameDefinition[] = [
  {
    id: "love-smash",
    title: "Love Smash!",
    title_vi: "Cầu lông tình yêu",
    description: "Anime chibi badminton: rally, smash and score against Mochi the bot. Couple 2v2 is coming next.",
    mode: "solo",
    href: "/games/love-smash",
    serverKind: null,
    accent: "from-sakura-100 to-sky-100",
  },
  {
    id: "word-battle",
    title: "Word Battle",
    title_vi: "Đại chiến từ vựng",
    description: "Defeat the sleepy Mumble Slime with the right words before time runs out.",
    mode: "solo",
    href: "/games/word-battle",
    serverKind: "word_battle",
    accent: "from-sakura-100 to-lavender-100",
  },
  {
    id: "sentence-puzzle",
    title: "Sentence Puzzle",
    title_vi: "Ghép câu",
    description: "Drag the words into the right order to build natural English sentences.",
    mode: "solo",
    href: "/games/sentence-puzzle",
    serverKind: "sentence_puzzle",
    accent: "from-mint-100 to-sky-100",
  },
  { id: "versus-battle", title: "Word Duel", title_vi: "Đấu từ vựng 1-1", description: "Invite your partner or any friend: you both answer the same 8 words and compare scores.", mode: "versus", href: "/world?tab=friends", serverKind: null, accent: "from-peach-100 to-sakura-100" },
  { id: "couple-boss", title: "Couple Boss Battle", title_vi: "Cùng đánh trùm", description: "Team up to defeat a giant boss together.", mode: "coop", href: null, serverKind: null, accent: "from-lavender-100 to-sky-100" },
  { id: "listening-challenge", title: "Listening Challenge", title_vi: "Thử thách nghe", description: "How well can you catch tricky sounds?", mode: "solo", href: null, serverKind: null, accent: "from-sky-100 to-mint-100" },
  { id: "love-quiz", title: "Love Quiz", title_vi: "Câu đố tình yêu", description: "How well do you know each other — in English?", mode: "coop", href: null, serverKind: null, accent: "from-sakura-100 to-peach-100" },
];
