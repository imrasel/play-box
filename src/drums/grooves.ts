import type { DrumId } from './kit';

/** One line per drum; `x` is a hit, `.` is silence. Each character is a sixteenth note. */
export type Groove = { id: string; name: string; bpm: number; desi?: boolean; tracks: Partial<Record<DrumId, string>> };

// The desi beats are drum-machine versions of traditional rhythms, not recordings.
export const GROOVES: Groove[] = [
  { id: 'rock', name: 'Rock', bpm: 110, tracks: {
    hat: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', kick: 'x.......x.x.....',
  } },
  { id: 'pop', name: 'Pop', bpm: 100, tracks: {
    hat: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', kick: 'x..x..x...x.....',
  } },
  { id: 'ballad', name: 'Slow Ballad', bpm: 72, tracks: {
    hat: 'x...x...x...x...', rim: '....x.......x...', kick: 'x.......x.......',
  } },
  { id: 'hiphop', name: 'Hip-Hop', bpm: 88, tracks: {
    hat: 'x.x.x.x.x.x.x.xx', snare: '....x.......x...', kick: 'x..x.....xx.....',
  } },
  { id: 'funk', name: 'Funk', bpm: 96, tracks: {
    hat: 'xxxxxxxxxxxxxxxx', snare: '....x..x.x..x...', kick: 'x.x...x...x.....',
  } },
  { id: 'disco', name: 'Disco', bpm: 118, tracks: {
    hat: 'x...x...x...x...', open: '..x...x...x...x.', snare: '....x.......x...', kick: 'x...x...x...x...',
  } },
  { id: 'reggae', name: 'Reggae', bpm: 76, tracks: {
    hat: 'x.x.x.x.x.x.x.x.', rim: '........x.......', kick: '........x.......',
  } },
  { id: 'bossa', name: 'Bossa Nova', bpm: 120, tracks: {
    hat: 'x.x.x.x.x.x.x.x.', rim: 'x..x..x...x..x..', kick: 'x..xx..xx..xx..x',
  } },
  { id: 'waltz', name: 'Waltz', bpm: 100, tracks: {
    hat: '....x...x...', kick: 'x...........', snare: '....x...x...',
  } },
  { id: 'keherwa', name: 'Keherwa · songs & ghazals', bpm: 96, desi: true, tracks: {
    tablaGe: 'x.x.........x...', tablaNa: 'x...x.x.x...x.x.',
  } },
  { id: 'dadra', name: 'Dadra · 6-beat songs', bpm: 90, desi: true, tracks: {
    tablaGe: 'x.x...x.....', tablaNa: 'x.x.x.x.x.x.',
  } },
  { id: 'bollywood', name: 'Bollywood Dance', bpm: 118, desi: true, tracks: {
    kick: 'x...x...x...x...', clap: '....x.......x...', dholak: '..x...xx..x.x.x.', tambourine: 'x.x.x.x.x.x.x.x.',
  } },
  { id: 'filmi', name: 'Filmi Romantic', bpm: 84, desi: true, tracks: {
    tablaGe: 'x.....x...x.....', tablaNa: '..x.x...x...x.x.', hat: 'x...x...x...x...',
  } },
  { id: 'bhangra', name: 'Bhangra', bpm: 128, desi: true, tracks: {
    dhol: 'x.....x...x.....', dholak: '...x..x....x..x.', clap: '....x.......x...',
  } },
  { id: 'bangla', name: 'Bangla Folk', bpm: 108, desi: true, tracks: {
    dhol: 'x.......x.......', dholak: '..x.x.x...x.x.x.', tambourine: 'x...x...x...x...',
  } },
  { id: 'baul', name: 'Baul · 6-beat', bpm: 104, desi: true, tracks: {
    tablaGe: 'x.....x.....', dholak: '..x.x...x.x.', tambourine: 'x.x.x.x.x.x.',
  } },
  { id: 'qawwali', name: 'Qawwali Claps', bpm: 92, desi: true, tracks: {
    tablaGe: 'x.x.....x.x.....', tablaNa: '....x.x.....x.x.', clap: 'x..x..x.x..x..x.',
  } },
];

export const grooveLength = (g: Groove) => Math.max(...Object.values(g.tracks).map((t) => t.length));

export function hitsAt(g: Groove, step: number): DrumId[] {
  const at = step % grooveLength(g);
  return (Object.keys(g.tracks) as DrumId[]).filter((id) => g.tracks[id]![at] === 'x');
}

export const stepSeconds = (bpm: number) => 60 / bpm / 4;
