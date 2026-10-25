export type Rng = { state: number };

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 || 0x9e3779b9 };
}

export function next(rng: Rng) {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function between(rng: Rng, min: number, max: number) {
  return min + (max - min) * next(rng);
}

export function chance(rng: Rng, p: number) {
  return next(rng) < p;
}

export function spread(rng: Rng, amount: number) {
  return (next(rng) + next(rng) + next(rng) - 1.5) * (amount / 1.5);
}
