/** Open strings from the thickest, drawn at the top as the player looks down at them. */
export const TUNING = [40, 45, 50, 55, 59, 64];

const MUTE = -1;

// Fret per string, low E first. The easiest common open shapes for small hands.
export const SHAPES: Record<string, number[]> = {
  C: [MUTE, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  D: [MUTE, MUTE, 0, 2, 3, 2],
  Am: [MUTE, 0, 2, 2, 1, 0],
  Em: [0, 2, 2, 0, 0, 0],
  F: [MUTE, MUTE, 3, 2, 1, 1],
  Dm: [MUTE, MUTE, 0, 2, 3, 1],
  A: [MUTE, 0, 2, 2, 2, 0],
  E: [0, 2, 2, 1, 0, 0],
};
export const CHORD_NAMES = Object.keys(SHAPES);

/** The note each string plays for a chord; null where a string stays silent. */
export function chordNotes(name: string): (number | null)[] {
  return SHAPES[name].map((fret, s) => (fret === MUTE ? null : TUNING[s] + fret));
}

const TOP = 0.12;
const SPAN = 0.76;

export const stringY = (s: number, h: number) => h * (TOP + (SPAN * s) / 5);

export function nearestString(y: number, h: number) {
  return Math.max(0, Math.min(5, Math.round(((y / h - TOP) / SPAN) * 5)));
}

/** Strings a finger passed over between two heights, in the order it met them. */
export function crossed(from: number, to: number, h: number) {
  const hit: number[] = [];
  for (let s = 0; s < 6; s++) {
    const y = stringY(s, h);
    if ((from < y && y <= to) || (to <= y && y < from)) hit.push(s);
  }
  return to >= from ? hit : hit.reverse();
}

// Frets close up towards the body, following the real equal-tempered spacing.
export function fretX(fret: number, left: number, length: number, frets: number) {
  return left + (length * (1 - 2 ** (-fret / 12))) / (1 - 2 ** (-frets / 12));
}

/** Which fret a finger is holding: left of the nut is the open string. */
export function fretAt(x: number, left: number, length: number, frets: number) {
  if (x < left) return 0;
  for (let f = 1; f <= frets; f++) if (x < fretX(f, left, length, frets)) return f;
  return frets;
}
