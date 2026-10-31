import { AudioEngine } from '../core/audio';

type Handle = { release(): void; kill(): void };
type VoiceFn = (midi: number, vel: number, out: AudioNode) => Handle;

export const VOICES = [
  { id: 'grand', name: 'Grand Piano', emoji: '🎹' },
  { id: 'epiano', name: 'Electric Piano', emoji: '⚡' },
  { id: 'musicbox', name: 'Music Box', emoji: '🎁' },
  { id: 'organ', name: 'Organ', emoji: '⛪' },
  { id: 'harpsichord', name: 'Harpsichord', emoji: '🏰' },
  { id: 'strings', name: 'Strings', emoji: '🎻' },
  { id: 'synth', name: 'Space Synth', emoji: '🚀' },
] as const;
export type VoiceId = (typeof VOICES)[number]['id'];

const MAX_VOICES = 32; // keeps low-end phones from crackling
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// Middle of the keyboard first, so the piano is playable while the rest load.
const SAMPLE_NOTES = [
  ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['A3', 57], ['Fs3', 54], ['Ds3', 51], ['C3', 48],
  ['C5', 72], ['Ds5', 75], ['Fs5', 78], ['A5', 81], ['A2', 45], ['Fs2', 42], ['Ds2', 39], ['C2', 36],
  ['C6', 84], ['Ds6', 87], ['Fs6', 90], ['A6', 93], ['A1', 33], ['Fs1', 30], ['Ds1', 27], ['C1', 24],
  ['C7', 96], ['Ds7', 99], ['Fs7', 102], ['A7', 105], ['A0', 21], ['C8', 108],
] as const;

const buffers = new Map<number, AudioBuffer>();
let loading: Promise<void> | null = null;

export function loadSamples(ctx: AudioContext, onProgress: (done: number, total: number) => void) {
  loading ??= (async () => {
    let done = 0;
    for (const [name, midi] of SAMPLE_NOTES) {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}.mp3`);
        buffers.set(midi, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // A missing sample only means its neighbour gets pitched further.
      }
      onProgress(++done, SAMPLE_NOTES.length);
    }
  })();
  return loading;
}

export function nearestSample(midi: number, available: Iterable<number>) {
  let best: number | null = null;
  for (const m of available) {
    if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  }
  return best;
}

export class Instrument {
  voice: VoiceId = 'grand';
  private held = new Map<number, Handle>();
  private ringing = new Map<number, Handle>(); // released keys held by the pedal
  private order: Handle[] = [];
  private pedal = false;
  private voices: Record<VoiceId, VoiceFn>;

  constructor(private engine: AudioEngine) {
    const c = engine.ctx;
    this.voices = {
      grand: (m, v, o) => grand(c, m, v, o),
      epiano: (m, v, o) => epiano(c, m, v, o),
      musicbox: (m, v, o) => musicbox(c, m, v, o),
      organ: (m, v, o) => organ(c, m, v, o),
      harpsichord: (m, v, o) => harpsichord(c, m, v, o),
      strings: (m, v, o) => strings(c, m, v, o),
      synth: (m, v, o) => synth(c, m, v, o),
    };
  }

  noteOn(midi: number, vel: number) {
    this.engine.resume();
    this.held.get(midi)?.release();
    this.ringing.get(midi)?.release();
    this.ringing.delete(midi);

    const handle = this.voices[this.voice](midi, vel, this.engine.input);
    this.held.set(midi, handle);
    this.order.push(handle);
    if (this.order.length > MAX_VOICES) this.order.shift()?.kill();
  }

  noteOff(midi: number) {
    const h = this.held.get(midi);
    if (!h) return;
    this.held.delete(midi);
    if (this.pedal) this.ringing.set(midi, h);
    else h.release();
  }

  setPedal(down: boolean) {
    this.pedal = down;
    if (down) return;
    this.ringing.forEach((h) => h.release());
    this.ringing.clear();
  }

  allOff() {
    this.setPedal(false);
    this.held.forEach((h) => h.release());
    this.held.clear();
  }
}

/** A gain stage that fades out when the key is let go. */
function envelope(c: AudioContext, out: AudioNode, level: number, attack: number, releaseTime: number, stoppables: AudioScheduledSourceNode[]) {
  const gain = c.createGain();
  const now = c.currentTime;
  gain.gain.setValueAtTime(attack ? 0 : level, now);
  if (attack) gain.gain.linearRampToValueAtTime(level, now + attack);
  gain.connect(out);

  let released = false;
  const fade = (time: number) => {
    if (released) return;
    released = true;
    const t = c.currentTime;
    gain.gain.cancelAndHoldAtTime?.(t);
    gain.gain.setTargetAtTime(0, t, time / 3);
    stoppables.forEach((s) => s.stop(t + time + 0.1));
  };
  return { gain, handle: { release: () => fade(releaseTime), kill: () => fade(0.03) } };
}

function osc(c: AudioContext, type: OscillatorType, f: number, out: AudioNode, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.detune.value = detune;
  o.connect(out);
  o.start();
  return o;
}

function grand(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const root = nearestSample(midi, buffers.keys());
  if (root === null) return epiano(c, midi, vel, out); // samples not decoded yet

  const src = c.createBufferSource();
  src.buffer = buffers.get(root)!;
  src.playbackRate.value = 2 ** ((midi - root) / 12);

  // Softer touches sound darker on a real piano, not only quieter.
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 900 + vel * vel * 14000;

  const { gain, handle } = envelope(c, out, 0.3 + vel * 0.7, 0, 0.3, [src]);
  src.connect(tone).connect(gain);
  src.start();
  return handle;
}

function epiano(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.3 * (0.4 + vel * 0.6), 0, 0.4, stops);
  const carrier = osc(c, 'sine', f, gain);
  const depth = c.createGain();
  depth.gain.setValueAtTime(f * (0.5 + vel * 2), c.currentTime);
  depth.gain.setTargetAtTime(f * 0.1, c.currentTime, 0.25);
  depth.connect(carrier.frequency);
  stops.push(carrier, osc(c, 'sine', f * 2, depth));
  gain.gain.setTargetAtTime(0.02, c.currentTime + 0.02, 1.5);
  return handle;
}

function musicbox(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi + 12);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.28 * (0.5 + vel * 0.5), 0, 1.2, stops);
  stops.push(osc(c, 'sine', f, gain));
  const shimmer = c.createGain();
  shimmer.gain.setValueAtTime(0.35, c.currentTime);
  shimmer.gain.setTargetAtTime(0, c.currentTime, 0.12);
  shimmer.connect(gain);
  stops.push(osc(c, 'sine', f * 4.02, shimmer));
  gain.gain.setTargetAtTime(0, c.currentTime + 0.01, 0.7);
  return handle;
}

function organ(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.13 * (0.7 + vel * 0.3), 0.012, 0.06, stops);
  for (const [ratio, level] of [[0.5, 0.6], [1, 1], [2, 0.6], [3, 0.3], [4, 0.2]]) {
    const g = c.createGain();
    g.gain.value = level;
    g.connect(gain);
    stops.push(osc(c, 'sine', f * ratio, g));
  }
  return handle;
}

function harpsichord(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.16 * (0.8 + vel * 0.2), 0, 0.12, stops);
  const tone = c.createBiquadFilter();
  tone.type = 'highpass';
  tone.frequency.value = f * 1.5;
  tone.connect(gain);
  stops.push(osc(c, 'sawtooth', f, tone), osc(c, 'square', f * 2, tone, 4));
  gain.gain.setTargetAtTime(0, c.currentTime + 0.01, 0.8);
  return handle;
}

function strings(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.1 * (0.6 + vel * 0.4), 0.18, 0.5, stops);
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(9000, f * 6);
  tone.connect(gain);
  stops.push(osc(c, 'sawtooth', f, tone, -7), osc(c, 'sawtooth', f, tone, 7));
  return handle;
}

function synth(c: AudioContext, midi: number, vel: number, out: AudioNode): Handle {
  const f = freq(midi);
  const stops: OscillatorNode[] = [];
  const { gain, handle } = envelope(c, out, 0.12 * (0.6 + vel * 0.4), 0.005, 0.25, stops);
  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 8;
  tone.frequency.setValueAtTime(f * 10, c.currentTime);
  tone.frequency.exponentialRampToValueAtTime(f * 2, c.currentTime + 0.4);
  tone.connect(gain);
  stops.push(osc(c, 'square', f, tone, -5), osc(c, 'sawtooth', f, tone, 5));
  return handle;
}
