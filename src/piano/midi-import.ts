import { HIGH, LOW } from './notes';
import type { Song, SongNote } from './songs';

type Raw = { start: number; end: number; midi: number };

const DRUM_CHANNEL = 9;

/** Read a Standard MIDI File into a playable single-line melody. */
export function parseMidi(bytes: Uint8Array, title: string): Song {
  const text = (at: number, length: number) => String.fromCharCode(...bytes.slice(at, at + length));
  const u32 = (at: number) => (bytes[at] << 24 | bytes[at + 1] << 16 | bytes[at + 2] << 8 | bytes[at + 3]) >>> 0;
  const u16 = (at: number) => bytes[at] << 8 | bytes[at + 1];

  if (text(0, 4) !== 'MThd') throw new Error('Not a MIDI file');
  const division = u16(12);
  if (division & 0x8000) throw new Error('Unsupported MIDI timing');

  let pos = 8 + u32(4);
  let micros = 500_000;
  let tempoSet = false;
  const raw: Raw[] = [];

  while (pos + 8 <= bytes.length) {
    const end = pos + 8 + u32(pos + 4);
    const isTrack = text(pos, 4) === 'MTrk';
    let p = pos + 8;
    pos = end;
    if (!isTrack) continue;

    const readVar = () => {
      let value = 0;
      for (;;) {
        const b = bytes[p++];
        value = value * 128 + (b & 0x7f);
        if (!(b & 0x80) || p >= end) return value;
      }
    };
    const open = new Map<number, number>();
    let tick = 0;
    let status = 0;
    while (p < end) {
      tick += readVar();
      if (bytes[p] & 0x80) status = bytes[p++];
      if (status === 0xff) {
        const type = bytes[p++];
        const length = readVar();
        if (type === 0x51 && !tempoSet) {
          micros = bytes[p] << 16 | bytes[p + 1] << 8 | bytes[p + 2];
          tempoSet = true;
        }
        p += length;
      } else if (status === 0xf0 || status === 0xf7) {
        p += readVar();
      } else {
        const kind = status & 0xf0;
        const channel = status & 0x0f;
        const a = bytes[p++];
        const b = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[p++];
        if (channel === DRUM_CHANNEL || (kind !== 0x90 && kind !== 0x80)) continue;
        const id = channel * 128 + a;
        if (kind === 0x90 && b > 0) {
          open.set(id, tick);
        } else if (open.has(id)) {
          if (a >= LOW && a <= HIGH) raw.push({ start: open.get(id)!, end: tick, midi: a });
          open.delete(id);
        }
      }
    }
  }
  if (!raw.length) throw new Error('No notes found');

  // Keep the top note at each moment: on most files that is the tune.
  const onset = division / 16;
  raw.sort((a, b) => a.start - b.start || b.midi - a.midi);
  const melody: Raw[] = [];
  for (const n of raw) {
    const prev = melody[melody.length - 1];
    if (!prev || n.start - prev.start > onset) melody.push(n);
    else if (n.midi > prev.midi) melody[melody.length - 1] = n;
  }

  const first = melody[0].start;
  const notes: SongNote[] = melody.map((n, i) => {
    const next = melody[i + 1]?.start ?? n.end;
    return {
      midi: n.midi,
      start: (n.start - first) / division,
      dur: Math.max(0.1, (Math.min(n.end, next) - n.start) / division),
    };
  });
  return {
    id: `user-${Date.now()}`,
    title: title.replace(/\.(mid|midi)$/i, ''),
    level: 0,
    bpm: Math.round(60_000_000 / micros),
    notes,
  };
}
