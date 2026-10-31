import type { Song, SongNote } from './songs';

export type LearnMode = 'watch' | 'wait' | 'play';
export type LearnNote = SongNote & { state: 'pending' | 'hit' | 'missed' };

const LEAD_IN = 4; // beats before the first note
const HIT_WINDOW = 0.5; // beats either side of the note
const EARLY_WINDOW = 0.75; // how early wait mode accepts a note

export class LearnSession {
  readonly notes: LearnNote[];
  readonly end: number;
  beat = -LEAD_IN;
  wrong = 0;
  waiting = false;

  constructor(readonly song: Song, readonly mode: LearnMode, readonly speed = 1) {
    this.notes = song.notes.map((n) => ({ ...n, state: 'pending' }));
    this.end = Math.max(...this.notes.map((n) => n.start + n.dur));
  }

  /** Advance time. Returns the notes that fell due for the app to auto-play. */
  tick(seconds: number): LearnNote[] {
    const next = this.notes.find((n) => n.state === 'pending');
    let beat = this.beat + seconds * (this.song.bpm / 60) * this.speed;

    this.waiting = false;
    if (this.mode === 'wait' && next && beat >= next.start) {
      beat = next.start;
      this.waiting = true;
    }
    this.beat = beat;

    const due: LearnNote[] = [];
    for (const n of this.notes) {
      if (n.state !== 'pending') continue;
      if (this.mode === 'watch' && beat >= n.start) {
        n.state = 'hit';
        due.push(n);
      } else if (this.mode === 'play' && beat > n.start + HIT_WINDOW) {
        n.state = 'missed';
      }
    }
    return due;
  }

  /** Register a key the child pressed. Returns whether it was the right note. */
  input(midi: number): boolean {
    if (this.mode === 'watch') return false;
    const reach = this.mode === 'wait' ? EARLY_WINDOW : HIT_WINDOW;
    const note = this.notes.find(
      (n) => n.state === 'pending' && n.midi === midi && Math.abs(n.start - this.beat) <= reach,
    );
    if (note) note.state = 'hit';
    else this.wrong++;
    return !!note;
  }

  /** Keys to light up now: whatever is next to be played. */
  hints(): number[] {
    const next = this.notes.find((n) => n.state === 'pending');
    return next && next.start - this.beat <= 1 ? [next.midi] : [];
  }

  get finished() {
    return this.beat >= this.end && this.notes.every((n) => n.state !== 'pending');
  }

  get progress() {
    return Math.max(0, Math.min(1, this.beat / this.end));
  }

  get hits() {
    return this.notes.filter((n) => n.state === 'hit').length;
  }

  /** 1-3 stars. Wrong keys count softly: young players should still earn a star. */
  get stars() {
    const accuracy = (this.hits - this.wrong * 0.25) / this.notes.length;
    return accuracy >= 0.9 ? 3 : accuracy >= 0.6 ? 2 : 1;
  }
}
