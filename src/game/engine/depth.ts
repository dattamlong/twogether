export type DepthBox = { id: string; x: number; y: number; w: number; h: number; layer?: number };

const behind = (a: DepthBox, b: DepthBox) => a.x + a.w <= b.x + 1e-6 || a.y + a.h <= b.y + 1e-6;

export function sortByDepth(boxes: DepthBox[]): string[] {
  const floor = boxes.filter((b) => (b.layer ?? 0) < 0);
  const solid = boxes.filter((b) => (b.layer ?? 0) >= 0);
  const order: string[] = floor.sort((a, b) => a.x + a.y - (b.x + b.y)).map((b) => b.id);

  const incoming = new Map<string, number>(solid.map((b) => [b.id, 0]));
  const edges = new Map<string, string[]>(solid.map((b) => [b.id, []]));
  for (const a of solid) {
    for (const b of solid) {
      if (a === b) continue;
      if (behind(a, b) && !behind(b, a)) {
        edges.get(a.id)!.push(b.id);
        incoming.set(b.id, incoming.get(b.id)! + 1);
      }
    }
  }

  const byKey = (id: string) => {
    const box = solid.find((b) => b.id === id)!;
    return box.x + box.w / 2 + box.y + box.h / 2;
  };
  const ready = solid.filter((b) => incoming.get(b.id) === 0).map((b) => b.id);
  while (ready.length) {
    ready.sort((p, q) => byKey(p) - byKey(q));
    const id = ready.shift()!;
    order.push(id);
    for (const next of edges.get(id)!) {
      incoming.set(next, incoming.get(next)! - 1);
      if (incoming.get(next) === 0) ready.push(next);
    }
  }
  if (order.length < boxes.length) {
    const seen = new Set(order);
    order.push(...solid.filter((b) => !seen.has(b.id)).sort((a, b) => byKey(a.id) - byKey(b.id)).map((b) => b.id));
  }
  return order;
}
