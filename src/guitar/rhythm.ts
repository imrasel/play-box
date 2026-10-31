/** D strums down, U strums up, X is a muted chuck, - lets the chord ring. Each slot is an eighth note. */
export type Slot = 'D' | 'U' | 'X' | '-';
export type Stroke = { string: number; midi: number; vel: number; muted: boolean; gap: number };

export const SLOT_CYCLE: Slot[] = ['D', 'U', 'X', '-'];
export const CUSTOM = 'custom';

export const PATTERNS = [
  { id: 'yours', name: 'DD UD UD DU', slots: 'DDUDUDDU' },
  { id: 'folk', name: 'Folk · D DU UDU', slots: 'D-DU-UDU' },
  { id: 'pop', name: 'Pop · D DUD DU', slots: 'D-DUD-DU' },
  { id: 'ballad', name: 'Ballad · D D U', slots: 'D---D-U-' },
  { id: 'rock', name: 'Rock · all down', slots: 'DDDDDDDD' },
  { id: 'funk', name: 'Funk · with chucks', slots: 'D-XUD-XU' },
  { id: 'reggae', name: 'Reggae · off-beat', slots: '--D---D-' },
  { id: 'waltz', name: 'Waltz · 3 beats', slots: 'D-DUDU' },
];

export const PROGRESSIONS = [
  { id: 'off', name: 'I choose the chords', chords: [] as string[] },
  { id: 'pop', name: 'Pop · C G Am F', chords: ['C', 'G', 'Am', 'F'] },
  { id: 'sad', name: 'Emotional · Am F C G', chords: ['Am', 'F', 'C', 'G'] },
  { id: 'folk', name: 'Folk · G D Em C', chords: ['G', 'D', 'Em', 'C'] },
  { id: 'oldies', name: 'Oldies · C Am F G', chords: ['C', 'Am', 'F', 'G'] },
  { id: 'rock', name: 'Rock · A D E A', chords: ['A', 'D', 'E', 'A'] },
];

const STRUM_GAP = 0.016; // seconds between strings: the sweep of a real hand
const UP_STRINGS = 4; // an up-strum only catches the thinner strings

/** Turn one pattern slot into the strings it plays, in the order the hand meets them. */
export function strokes(slot: Slot, notes: (number | null)[], onBeat: boolean): Stroke[] {
  if (slot === '-') return [];
  const played = notes.flatMap((midi, string) => (midi === null ? [] : [{ string, midi }]));
  const order = slot === 'U' ? played.slice(-UP_STRINGS).reverse() : played;
  const vel = slot === 'X' ? 0.55 : slot === 'U' ? 0.58 : onBeat ? 0.95 : 0.78;
  return order.map((n, i) => ({ ...n, vel, muted: slot === 'X', gap: i * STRUM_GAP }));
}

export const isSlots = (text: string): text is string => /^[DUX-]+$/.test(text);
