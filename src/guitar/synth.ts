import type { AudioEngine } from '../core/audio';

export const GUITARS = [
  { id: 'acoustic', name: 'Acoustic', seconds: 2.6, damping: 0.996 },
  { id: 'classical', name: 'Classical', seconds: 2.2, damping: 0.993 },
  { id: 'twelve', name: '12-String', seconds: 3, damping: 0.997 },
  { id: 'electric', name: 'Clean Electric', seconds: 3.6, damping: 0.9985 },
  { id: 'rock', name: 'Rock Electric', seconds: 3.6, damping: 0.999 },
] as const;
export type GuitarVoice = (typeof GUITARS)[number]['id'];

const TWELVE_OCTAVE_STRINGS = 4; // only the four thick courses are doubled an octave up

/** Each pass averages with the following sample, so the loop is half a sample short of `period`. */
export const loopPeriod = (period: number) => period - 0.5;

/**
 * Karplus-Strong: a burst of noise circulating in a short delay line, softened on
 * each pass, behaves remarkably like a plucked string.
 */
export function pluckSamples(freq: number, sampleRate: number, seconds: number, damping: number, random = Math.random) {
  const period = Math.max(2, Math.floor(sampleRate / freq));
  const out = new Float32Array(Math.floor(sampleRate * seconds));
  const line = new Float32Array(period);
  let smooth = 0;
  for (let i = 0; i < period; i++) {
    smooth = smooth * 0.5 + (random() * 2 - 1) * 0.5; // a soft pick, not a wire
    line[i] = smooth;
  }
  let at = 0;
  for (let i = 0; i < out.length; i++) {
    const next = (at + 1) % period;
    out[i] = line[at];
    line[at] = damping * 0.5 * (line[at] + line[next]);
    at = next;
  }
  return { samples: out, rate: (freq * loopPeriod(period)) / sampleRate };
}

export class GuitarSynth {
  voice: GuitarVoice = 'acoustic';
  private cache = new Map<string, { buffer: AudioBuffer; rate: number }>();
  private strings: (GainNode | null)[] = Array(6).fill(null);
  private bus: GainNode;
  private chains = new Map<GuitarVoice, AudioNode>();

  constructor(private engine: AudioEngine) {
    this.bus = engine.ctx.createGain();
    this.bus.gain.value = 0.42; // six strings ringing together must not clip
    this.bus.connect(engine.input);
  }

  destroy() {
    this.bus.disconnect();
  }

  /** The tone stage for a guitar: a wooden body, or an amplifier. */
  private chain(voice: GuitarVoice) {
    const found = this.chains.get(voice);
    if (found) return found;
    const c = this.engine.ctx;
    const filter = (type: BiquadFilterType, freq: number, q = 1, gain = 0) => {
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      f.gain.value = gain;
      return f;
    };
    let input: AudioNode;
    if (voice === 'rock') {
      const drive = c.createGain();
      drive.gain.value = 9;
      const shaper = c.createWaveShaper();
      shaper.curve = distortionCurve();
      shaper.oversample = '2x';
      const cabinet = filter('lowpass', 3400, 0.8);
      const level = c.createGain();
      level.gain.value = 0.3;
      input = drive;
      drive.connect(shaper).connect(cabinet).connect(level).connect(this.bus);
    } else if (voice === 'electric') {
      input = filter('lowpass', 3200, 1.4);
      input.connect(this.bus);
    } else if (voice === 'classical') {
      const warm = filter('lowpass', 2300, 0.7);
      input = warm;
      warm.connect(filter('peaking', 200, 0.9, 6)).connect(this.bus);
    } else {
      input = filter('peaking', 220, 0.9, 7);
      input.connect(this.bus);
    }
    this.chains.set(voice, input);
    return input;
  }

  private note(midi: number) {
    const key = `${this.voice}:${midi}`;
    let found = this.cache.get(key);
    if (!found) {
      const c = this.engine.ctx;
      const spec = GUITARS.find((g) => g.id === this.voice)!;
      const { samples, rate } = pluckSamples(440 * 2 ** ((midi - 69) / 12), c.sampleRate, spec.seconds, spec.damping);
      const buffer = c.createBuffer(1, samples.length, c.sampleRate);
      buffer.copyToChannel(samples, 0);
      found = { buffer, rate };
      this.cache.set(key, found);
    }
    return found;
  }

  /** A string can only sound one note, so a new pluck stops its last one. */
  play(string: number, midi: number, vel = 0.85, when = this.engine.ctx.currentTime, muted = false) {
    const c = this.engine.ctx;
    this.engine.resume();
    this.strings[string]?.gain.setTargetAtTime(0, when, 0.012);

    const gain = c.createGain();
    gain.gain.setValueAtTime(vel * 1.1, when);
    if (muted) gain.gain.setTargetAtTime(0, when + 0.012, 0.014); // a chuck: the hand kills it at once
    gain.connect(this.chain(this.voice));

    const start = (note: number, level: number) => {
      const { buffer, rate } = this.note(note);
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const mix = c.createGain();
      mix.gain.value = level;
      src.connect(mix).connect(gain);
      src.start(when);
    };
    start(midi, 1);
    if (this.voice === 'twelve') start(string < TWELVE_OCTAVE_STRINGS ? midi + 12 : midi, 0.45);
    this.strings[string] = gain;
  }
}

function distortionCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 3);
  return curve;
}
