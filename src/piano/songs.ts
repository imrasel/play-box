import { parseNote } from './notes';

export type SongNote = { midi: number; start: number; dur: number };
export type Song = { id: string; title: string; level: number; bpm: number; notes: SongNote[] };

/** `E4` is one beat, `E4:2` two beats, `R:1` a rest. */
export function parseMelody(src: string): SongNote[] {
  const notes: SongNote[] = [];
  let beat = 0;
  for (const token of src.trim().split(/\s+/)) {
    const [name, dur = '1'] = token.split(':');
    const d = Number(dur);
    if (name !== 'R') notes.push({ midi: parseNote(name), start: beat, dur: d });
    beat += d;
  }
  return notes;
}

const song = (id: string, title: string, level: number, bpm: number, melody: string): Song => ({
  id, title, level, bpm, notes: parseMelody(melody),
});

// All traditional or public-domain melodies.
export const SONGS: Song[] = [
  song('mary', 'Mary Had a Little Lamb', 1, 100,
    'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4:4'),
  song('twinkle', 'Twinkle Twinkle Little Star', 1, 100,
    'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2 G4 G4 F4 F4 E4 E4 D4:2 G4 G4 F4 F4 E4 E4 D4:2 C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2'),
  song('frere', 'Frère Jacques', 1, 110,
    'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4:2 E4 F4 G4:2 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 G4:0.5 A4:0.5 G4:0.5 F4:0.5 E4 C4 C4 G3 C4:2 C4 G3 C4:2'),
  song('london', 'London Bridge', 2, 110,
    'G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2 G4:1.5 A4:0.5 G4 F4 E4 F4 G4:2 D4:2 G4:2 E4 C4:3'),
  song('macdonald', 'Old MacDonald', 2, 120,
    'G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:3 D4 G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:4'),
  song('rowrow', 'Row Row Row Your Boat', 2, 100,
    'C4:1.5 C4:1.5 C4 D4:0.5 E4:1.5 E4 D4:0.5 E4 F4:0.5 G4:3 C5:0.5 C5:0.5 C5:0.5 G4:0.5 G4:0.5 G4:0.5 E4:0.5 E4:0.5 E4:0.5 C4:0.5 C4:0.5 C4:0.5 G4 F4:0.5 E4 D4:0.5 C4:3'),
  song('ode', 'Ode to Joy', 2, 110,
    'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:0.5 D4:2 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4:1.5 C4:0.5 C4:2'),
  song('jingle', 'Jingle Bells', 3, 130,
    'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 E4 D4 D4 E4 D4:2 G4:2 E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:0.5 E4:4 F4 F4 F4:1.5 F4:0.5 F4 E4 E4 E4:0.5 E4:0.5 G4 G4 F4 D4 C4:4'),
  // Read from the Cantorion voice and piano score typeset by Johan Schoone (CC BY-SA 3.0).
  song('shonar', 'Amar Shonar Bangla (opening)', 3, 80,
    'G4:0.5 A4:0.5 F#4:0.5 G4:0.5 F#4:0.5 E4:0.5 D4:0.5 E4:0.25 D4:0.25 C4:0.5 B3:1.5 B3:0.5 C4:0.5 D4:0.5 D4:0.25 E4:0.25 F#4:0.25 G4:0.25 F#4:0.5 E4:0.5 D4:0.25 E4:0.25 C4:0.5 D4 E4:0.5 F#4:0.5 E4:0.5 D4 D4:0.5 D4:0.5 D4 E4:0.25 F#4:0.25 G4 A4:0.5 A4:0.5 G4:0.5 A4:0.5 A4:0.5 B4:0.25 C5:0.25 B4:0.5 G4 A4:0.5 A4:0.5 B4:0.25 C5:0.25 B4:0.5 A4:2.5'),
  song('auld', 'Auld Lang Syne', 2, 100,
    'G4 C5:1.5 C5:0.5 C5 E5 D5:1.5 C5:0.5 D5 E5 C5:1.5 C5:0.5 E5 G5 A5:3 A5 G5:1.5 E5:0.5 E5 C5 D5:1.5 C5:0.5 D5 E5 C5:1.5 A4:0.5 A4 G4 C5:3'),
  song('elise', 'Für Elise', 3, 80,
    'E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 E4:0.5 G#4:0.5 B4:0.5 C5:1 R:0.5 E4:0.5 E5:0.5 D#5:0.5 E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5 A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5 B4:1 R:0.5 E4:0.5 C5:0.5 B4:0.5 A4:2'),
  song('birthday', 'Happy Birthday', 3, 100,
    'G4:0.75 G4:0.25 A4 G4 C5 B4:2 G4:0.75 G4:0.25 A4 G4 D5 C5:2 G4:0.75 G4:0.25 G5 E5 C5 B4 A4 F5:0.75 F5:0.25 E5 C5 D5 C5:2'),
];
