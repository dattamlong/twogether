export const ROOM_WIDTH = 10;
export const ROOM_DEPTH = 10;

export type Tile = { x: number; y: number };

export type RoomAction = "study" | "games" | "sofa" | "mailbox" | "gifts" | "sleep" | "memories";

export type FixtureKind =
  | "bed"
  | "bookshelf"
  | "desk"
  | "chair"
  | "gift_cabinet"
  | "plant_tall"
  | "plant_small"
  | "console"
  | "sofa"
  | "mailbox"
  | "rug";

export type Facing = "ne" | "nw" | "se" | "sw";

export type Fixture = {
  id: string;
  kind: FixtureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  blocking: boolean;
  minHomeLevel?: number;
  action?: RoomAction;
  label?: string;
  approach?: Tile[];
  seats?: { tile: Tile; facing: Facing }[];
};

export const FIXTURES: Fixture[] = [
  {
    id: "bed",
    kind: "bed",
    x: 0,
    y: 0,
    w: 2,
    h: 3,
    blocking: true,
    action: "sleep",
    label: "Bed",
    approach: [{ x: 2, y: 1 }, { x: 2, y: 2 }],
  },
  {
    id: "bookshelf",
    kind: "bookshelf",
    x: 3,
    y: 0,
    w: 2,
    h: 1,
    blocking: true,
    action: "memories",
    label: "Memory Shelf",
    approach: [{ x: 3, y: 1 }, { x: 4, y: 1 }],
  },
  {
    id: "desk",
    kind: "desk",
    x: 6,
    y: 0,
    w: 2,
    h: 1,
    blocking: true,
    action: "study",
    label: "Study Desk",
    approach: [{ x: 6, y: 2 }, { x: 7, y: 2 }],
    seats: [
      { tile: { x: 6, y: 1 }, facing: "ne" },
      { tile: { x: 7, y: 1 }, facing: "ne" },
    ],
  },
  { id: "chair-a", kind: "chair", x: 6, y: 1, w: 1, h: 1, blocking: true },
  { id: "chair-b", kind: "chair", x: 7, y: 1, w: 1, h: 1, blocking: true },
  {
    id: "gift-cabinet",
    kind: "gift_cabinet",
    x: 9,
    y: 0,
    w: 1,
    h: 2,
    blocking: true,
    action: "gifts",
    label: "Gift Cabinet",
    approach: [{ x: 8, y: 1 }, { x: 9, y: 2 }],
  },
  { id: "plant-corner", kind: "plant_tall", x: 5, y: 0, w: 1, h: 1, blocking: true },
  {
    id: "console",
    kind: "console",
    x: 0,
    y: 5,
    w: 1,
    h: 2,
    blocking: true,
    action: "games",
    label: "Game Console",
    approach: [{ x: 1, y: 4 }, { x: 1, y: 7 }],
  },
  { id: "rug", kind: "rug", x: 1, y: 4, w: 2, h: 4, blocking: false },
  {
    id: "sofa",
    kind: "sofa",
    x: 3,
    y: 5,
    w: 1,
    h: 2,
    blocking: true,
    action: "sofa",
    label: "Sofa",
    approach: [{ x: 4, y: 5 }, { x: 4, y: 6 }],
    seats: [
      { tile: { x: 3, y: 5 }, facing: "nw" },
      { tile: { x: 3, y: 6 }, facing: "nw" },
    ],
  },
  {
    id: "mailbox",
    kind: "mailbox",
    x: 0,
    y: 9,
    w: 1,
    h: 1,
    blocking: true,
    action: "mailbox",
    label: "Mailbox",
    approach: [{ x: 1, y: 9 }, { x: 0, y: 8 }],
  },
  { id: "plant-window", kind: "plant_small", x: 0, y: 3, w: 1, h: 1, blocking: true, minHomeLevel: 2 },
  { id: "plant-front", kind: "plant_tall", x: 9, y: 9, w: 1, h: 1, blocking: true, minHomeLevel: 2 },
];

export const SPAWN_TILES: [Tile, Tile] = [
  { x: 5, y: 3 },
  { x: 5, y: 6 },
];

export function activeFixtures(homeLevel: number) {
  return FIXTURES.filter((f) => (f.minHomeLevel ?? 1) <= homeLevel);
}

export function footprintTiles(rect: { x: number; y: number; w: number; h: number }): Tile[] {
  const tiles: Tile[] = [];
  for (let dx = 0; dx < rect.w; dx++) for (let dy = 0; dy < rect.h; dy++) tiles.push({ x: rect.x + dx, y: rect.y + dy });
  return tiles;
}

export const tileKey = (t: Tile) => `${t.x},${t.y}`;

export function reservedTiles(): Tile[] {
  const keys = new Map<string, Tile>();
  for (const fixture of FIXTURES) {
    if (fixture.kind === "rug") continue;
    for (const t of footprintTiles(fixture)) keys.set(tileKey(t), t);
    for (const t of fixture.approach ?? []) keys.set(tileKey(t), t);
  }
  for (const t of SPAWN_TILES) keys.set(tileKey(t), t);
  return [...keys.values()];
}

export function inBounds(t: Tile) {
  return t.x >= 0 && t.y >= 0 && t.x < ROOM_WIDTH && t.y < ROOM_DEPTH;
}
