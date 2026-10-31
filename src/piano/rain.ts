import { parseNote } from './notes';
import type { Song, SongNote } from './songs';

export type Judgement = 'perfect' | 'great' | 'good' | 'miss';
export type RainNote = SongNote & { state: 'pending' | 'hit' | 'missed' };

const LEAD_IN = 4; // beats of falling before the first note lands
const WINDOWS: [number, Judgement, number][] = [
  [0.09, 'perfect', 100],
  [0.17, 'great', 70],
  [0.3, 'good', 40],
];
const LATE_LIMIT = 0.3; // seconds after landing before a note counts as missed
const MAX_RAMP = 2;

/** Notes fall without ever waiting. `lives` of 0 means a miss never ends the game. */
export class RainGame {
  readonly mode = 'game' as const;
  readonly notes: RainNote[];
  readonly end: number;
  readonly events: { midi: number; kind: Judgement }[] = [];
  beat = -LEAD_IN;
  score = 0;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  misses = 0;
  hearts: number;
  over = false;
  private ramp = 1;

  constructor(readonly song: Song, readonly lives: number, readonly speed = 1, readonly endless = false) {
    this.notes = song.notes.map((n) => ({ ...n, state: 'pending' }));
    this.end = Math.max(...this.notes.map((n) => n.start + n.dur));
    this.hearts = lives;
  }

  private get secondsPerBeat() {
    return 60 / this.song.bpm / this.speed / this.ramp;
  }

  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.combo / 10));
  }

  tick(seconds: number) {
    if (this.over) return;
    this.beat += seconds / this.secondsPerBeat;
    if (this.endless) this.ramp = Math.min(MAX_RAMP, 1 + Math.max(0, this.beat) * 0.003);
    for (const n of this.notes) {
      if (n.state !== 'pending') continue;
      if (n.start > this.beat) break;
      if ((this.beat - n.start) * this.secondsPerBeat <= LATE_LIMIT) continue;
      n.state = 'missed';
      this.misses++;
      this.combo = 0;
      this.events.push({ midi: n.midi, kind: 'miss' });
      if (this.lives && --this.hearts <= 0) {
        this.over = true;
        return;
      }
    }
  }

  /** Wrong keys cost nothing: they just make a sound, which suits small hands. */
  input(midi: number): boolean {
    if (this.over) return false;
    const spb = this.secondsPerBeat;
    const note = this.notes.find(
      (n) => n.state === 'pending' && n.midi === midi && Math.abs(n.start - this.beat) * spb <= WINDOWS[2][0],
    );
    if (!note) return false;
    const off = Math.abs(note.start - this.beat) * spb;
    const [, kind, points] = WINDOWS.find(([limit]) => off <= limit)!;
    note.state = 'hit';
    this.hits++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += points * this.multiplier;
    this.events.push({ midi, kind });
    return true;
  }

  get finished() {
    return this.over || (this.beat >= this.end && this.notes.every((n) => n.state !== 'pending'));
  }

  get progress() {
    return Math.max(0, Math.min(1, this.beat / this.end));
  }

  get stars() {
    if (this.over) return Math.min(1, this.hits);
    const accuracy = this.hits / this.notes.length;
    return accuracy >= 0.9 ? 3 : accuracy >= 0.6 ? 2 : 1;
  }
}

const PENTATONIC = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5'].map(parseNote);

/** A never-ending stream that wanders by small steps, so it always sounds like a tune. */
export function endlessSong(random: () => number = Math.random): Song {
  const notes: SongNote[] = [];
  let index = 2;
  let beat = 0;
  for (let i = 0; i < 1500; i++) {
    const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(random() * 7)];
    index = Math.max(0, Math.min(PENTATONIC.length - 1, index + step));
    const dur = [1, 1, 1, 2, 0.5][Math.floor(random() * 5)];
    notes.push({ midi: PENTATONIC[index], start: beat, dur });
    beat += dur;
  }
  return { id: 'endless', title: 'Endless Rain', level: 0, bpm: 90, notes };
}
