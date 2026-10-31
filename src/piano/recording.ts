export type RecEvent = { t: number; midi: number; vel: number; on: boolean };
export type Recording = {
  id: string;
  name: string;
  voice: string;
  createdAt: number;
  duration: number;
  events: RecEvent[];
};

const TICKS_PER_BEAT = 480;
const MICROS_PER_BEAT = 500_000; // 120 bpm
const ticksPerSecond = (TICKS_PER_BEAT * 1_000_000) / MICROS_PER_BEAT;

function varLen(n: number): number[] {
  const bytes = [n & 0x7f];
  while ((n >>= 7) > 0) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Encode a recording as a Standard MIDI File, format 0. */
export function toMidiFile(events: RecEvent[]): Uint8Array {
  const track: number[] = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20]; // tempo
  let lastTick = 0;
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const tick = Math.round(e.t * ticksPerSecond);
    const vel = e.on ? Math.max(1, Math.round(e.vel * 127)) : 0;
    track.push(...varLen(tick - lastTick), e.on ? 0x90 : 0x80, e.midi, vel);
    lastTick = tick;
  }
  track.push(0, 0xff, 0x2f, 0); // end of track
  return new Uint8Array([
    ...ascii('MThd'), ...u32(6), 0, 0, 0, 1, TICKS_PER_BEAT >> 8, TICKS_PER_BEAT & 255,
    ...ascii('MTrk'), ...u32(track.length), ...track,
  ]);
}
