export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export const COURT = {
  halfLength: 6.7,
  singlesHalfWidth: 2.59,
  doublesHalfWidth: 3.05,
  shortService: 1.98,
  doublesLongService: 6.7 - 0.76,
  netHeight: 1.55,
  postHalfWidth: 3.05 + 0.1,
};

export type Side = 0 | 1;

export const sideSign = (side: Side) => (side === 0 ? -1 : 1);

export const sideOf = (y: number): Side => (y < 0 ? 0 : 1);

export function inSingles(x: number, y: number) {
  return Math.abs(x) <= COURT.singlesHalfWidth && Math.abs(y) <= COURT.halfLength;
}

export function serviceCourt(server: Side, serverScore: number) {
  const right = serverScore % 2 === 0;
  const receiver: Side = server === 0 ? 1 : 0;
  const serverX = (right ? 1 : -1) * (server === 0 ? 1 : -1);
  return { receiver, serverX: serverX * 1.2, receiverX: -serverX * 1.2, targetX: -serverX };
}

export function inServiceCourt(server: Side, serverScore: number, x: number, y: number) {
  const { receiver, targetX } = serviceCourt(server, serverScore);
  if (sideOf(y) !== receiver) return false;
  const depth = Math.abs(y);
  if (depth < COURT.shortService || depth > COURT.halfLength) return false;
  if (Math.abs(x) > COURT.singlesHalfWidth) return false;
  return targetX > 0 ? x >= 0 : x <= 0;
}

export function inDoubles(x: number, y: number) {
  return Math.abs(x) <= COURT.doublesHalfWidth && Math.abs(y) <= COURT.halfLength;
}

export function inDoublesServiceCourt(server: Side, serverScore: number, x: number, y: number) {
  const { receiver, targetX } = serviceCourt(server, serverScore);
  if (sideOf(y) !== receiver) return false;
  const depth = Math.abs(y);
  if (depth < COURT.shortService || depth > COURT.doublesLongService) return false;
  if (Math.abs(x) > COURT.doublesHalfWidth) return false;
  return targetX > 0 ? x >= 0 : x <= 0;
}
