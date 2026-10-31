export const LOW = 21; // A0
export const HIGH = 108; // C8
export const WHITE_COUNT = 52;

export type LabelStyle = 'none' | 'letters' | 'solfege' | 'octave';

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

/** Index of the white key at or just below `midi`, counted from A0. */
export function whiteIndex(midi: number): number {
  const m = isBlack(midi) ? midi - 1 : midi;
  let i = 0;
  for (let n = LOW; n < m; n++) if (!isBlack(n)) i++;
  return i;
}

export function noteName(midi: number, style: LabelStyle): string {
  const pc = midi % 12;
  if (style === 'none') return '';
  if (style === 'solfege') return SOLFEGE[pc];
  if (style === 'octave') return LETTERS[pc] + (Math.floor(midi / 12) - 1);
  return LETTERS[pc];
}

export function parseNote(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const pc = LETTERS.indexOf(m[1]) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return pc + (Number(m[3]) + 1) * 12;
}
