import { ROOM_DEPTH, ROOM_WIDTH, footprintTiles, reservedTiles, tileKey } from "./room";

export type Placement = {
  inventoryId: string;
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flipped: boolean;
};

const RESERVED = new Set(reservedTiles().map(tileKey));

export function placementProblem(candidate: Placement, others: Placement[]): "out_of_bounds" | "tile_occupied" | null {
  if (candidate.x < 0 || candidate.y < 0 || candidate.x + candidate.w > ROOM_WIDTH || candidate.y + candidate.h > ROOM_DEPTH) {
    return "out_of_bounds";
  }
  const taken = new Set(RESERVED);
  for (const other of others) {
    if (other.inventoryId === candidate.inventoryId) continue;
    for (const t of footprintTiles(other)) taken.add(tileKey(t));
  }
  return footprintTiles(candidate).some((t) => taken.has(tileKey(t))) ? "tile_occupied" : null;
}

export function placedBlockingTiles(placements: Placement[]) {
  return placements.flatMap(footprintTiles);
}
