import { parseNote } from './notes';

export type ChordKey = 'C' | 'G' | 'F';
export type Chord = { name: string; notes: number[]; spelled: string[] };

export const CHORD_KEYS: ChordKey[] = ['C', 'G', 'F'];
export const STRUM_MS = 40;

// Spelled per key, so F shows Bb rather than A#.
const SCALES: Record<ChordKey, string[]> = {
  C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
  F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
};

const ROOT_LOW = 48; // C3: low enough to sit under a melody

/** The six friendly chords of a key. The seventh, diminished, is left out. */
export function keyChords(key: ChordKey): Chord[] {
  const scale = SCALES[key];
  return [0, 1, 2, 3, 4, 5].map((degree) => {
    const spelled = [0, 2, 4].map((step) => scale[(degree + step) % 7]);
    const notes: number[] = [];
    for (const name of spelled) {
      let midi = parseNote(`${name}3`);
      if (!notes.length) while (midi < ROOT_LOW) midi += 12;
      else while (midi <= notes[notes.length - 1]) midi += 12;
      notes.push(midi);
    }
    const minor = notes[1] - notes[0] === 3;
    return { name: spelled[0] + (minor ? 'm' : ''), notes, spelled };
  });
}

const STRIP_BARS = 7; // two octaves of chord tones, ending on the root

/** The notes of a swipeable column, lowest first. */
export function stripNotes(chord: Chord) {
  return Array.from({ length: STRIP_BARS }, (_, i) => ({
    midi: chord.notes[i % 3] + 12 * Math.floor(i / 3),
    name: chord.spelled[i % 3],
  }));
}
