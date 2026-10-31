import { HIGH, LOW, WHITE_COUNT, isBlack, whiteIndex } from './notes';

export type Layout = {
  width: number;
  height: number;
  /** Index of the left-most visible white key; may be fractional. */
  first: number;
  /** How many white keys fit across the width. */
  visible: number;
};

export const BLACK_HEIGHT = 0.62;
export const BLACK_WIDTH = 0.62;

export const whiteWidth = (l: Layout) => l.width / l.visible;

export const clampFirst = (first: number, visible: number) =>
  Math.max(0, Math.min(WHITE_COUNT - visible, first));

export function keyRect(midi: number, l: Layout) {
  const w = whiteWidth(l);
  const left = (whiteIndex(midi) - l.first) * w;
  if (!isBlack(midi)) return { x: left, y: 0, w, h: l.height };
  const bw = w * BLACK_WIDTH;
  return { x: left + w - bw / 2, y: 0, w: bw, h: l.height * BLACK_HEIGHT };
}

export function keyAt(x: number, y: number, l: Layout): number | null {
  if (x < 0 || x >= l.width) return null;
  const w = whiteWidth(l);
  const wi = Math.floor(x / w + l.first);
  if (wi < 0 || wi >= WHITE_COUNT) return null;

  let white = LOW;
  for (let i = 0; i < wi; i++) white += isBlack(white + 1) ? 2 : 1;

  if (y < l.height * BLACK_HEIGHT) {
    for (const m of [white - 1, white + 1]) {
      if (m < LOW || m > HIGH || !isBlack(m)) continue;
      const r = keyRect(m, l);
      if (x >= r.x && x < r.x + r.w) return m;
    }
  }
  return white;
}

/** Touching nearer the front edge of a key plays louder. */
export function velocityFromY(y: number, keyHeight: number): number {
  const t = Math.max(0, Math.min(1, y / keyHeight));
  return 0.35 + t * 0.65;
}

/** The view that shows a span of notes as large as possible, for learn mode. */
export function fitRange(lowest: number, highest: number) {
  const lo = Math.max(0, whiteIndex(lowest) - 1);
  const hi = Math.min(WHITE_COUNT - 1, whiteIndex(highest) + 1);
  const visible = Math.max(14, hi - lo + 1);
  return { first: clampFirst(lo - (visible - (hi - lo + 1)) / 2, visible), visible };
}
