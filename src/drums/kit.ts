export const EXTRAS = [
  { id: 'clap', label: 'Clap' }, { id: 'cowbell', label: 'Cowbell' },
  { id: 'tambourine', label: 'Tambourine' }, { id: 'rim', label: 'Rim click' },
] as const;
export const DRUMS = ['kick', 'snare', 'hat', 'open', 'tom1', 'tom2', 'floor', 'crash', 'ride', ...EXTRAS.map((e) => e.id)] as const;
/** Heard in the desi beats only, so they have no piece on the kit. */
export type HandDrum = 'tablaNa' | 'tablaGe' | 'dholak' | 'dhol';
export type DrumId = (typeof DRUMS)[number] | HandDrum;
export type KitId = 'acoustic' | 'electronic';

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(c: BaseAudioContext) {
  let buffer = noises.get(c);
  if (!buffer) {
    buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noises.set(c, buffer);
  }
  return buffer;
}

function decay(c: BaseAudioContext, out: AudioNode, when: number, peak: number, seconds: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + seconds);
  g.connect(out);
  return g;
}

function noise(c: BaseAudioContext, out: AudioNode, when: number, peak: number, seconds: number, type: BiquadFilterType, freq: number) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = decay(c, out, when, peak, seconds);
  src.connect(filter).connect(g);
  src.start(when, Math.random());
  src.stop(when + seconds + 0.02);
  return g;
}

function tone(c: BaseAudioContext, out: AudioNode, when: number, peak: number, seconds: number, from: number, to: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, when);
  o.frequency.exponentialRampToValueAtTime(to, when + Math.min(seconds, 0.14));
  o.connect(decay(c, out, when, peak, seconds));
  o.start(when);
  o.stop(when + seconds + 0.02);
}

// Inharmonic square waves are the classic recipe for a metallic cymbal.
function metal(c: BaseAudioContext, out: AudioNode, when: number, peak: number, seconds: number, freq: number) {
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = freq;
  const g = decay(c, out, when, peak, seconds);
  filter.connect(g);
  for (const ratio of [1, 1.483, 1.932, 2.546, 2.63, 3.897]) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 205 * ratio;
    o.connect(filter);
    o.start(when);
    o.stop(when + seconds + 0.02);
  }
  return g;
}

let ringingHat: GainNode | null = null;

export function playDrum(c: BaseAudioContext, out: AudioNode, id: DrumId, kit: KitId, vel = 0.9, when = c.currentTime) {
  const v = vel;
  const electro = kit === 'electronic';
  switch (id) {
    case 'kick':
      tone(c, out, when, 1.1 * v, electro ? 0.6 : 0.32, electro ? 120 : 160, electro ? 38 : 48);
      if (!electro) noise(c, out, when, 0.25 * v, 0.02, 'lowpass', 3000);
      break;
    case 'snare':
      if (electro) {
        for (const delay of [0, 0.012, 0.024]) noise(c, out, when + delay, 0.45 * v, 0.15, 'bandpass', 1300);
      } else {
        noise(c, out, when, 0.65 * v, 0.2, 'highpass', 1600);
        tone(c, out, when, 0.45 * v, 0.12, 260, 180, 'triangle');
      }
      break;
    case 'hat':
      ringingHat?.gain.cancelScheduledValues(when);
      ringingHat?.gain.setTargetAtTime(0.0001, when, 0.008);
      ringingHat = null;
      metal(c, out, when, 0.16 * v, electro ? 0.04 : 0.07, 7000);
      break;
    case 'open':
      ringingHat = metal(c, out, when, 0.14 * v, 0.45, 6500);
      break;
    case 'tom1':
      tone(c, out, when, 0.8 * v, 0.34, electro ? 300 : 260, electro ? 130 : 180);
      break;
    case 'tom2':
      tone(c, out, when, 0.8 * v, 0.38, electro ? 220 : 190, electro ? 95 : 130);
      break;
    case 'floor':
      tone(c, out, when, 0.85 * v, 0.48, electro ? 160 : 130, electro ? 60 : 85);
      break;
    case 'crash':
      noise(c, out, when, 0.42 * v, 1.5, 'highpass', 4500);
      metal(c, out, when, 0.1 * v, 1.1, 3500);
      break;
    case 'clap':
      for (const delay of [0, 0.011, 0.023]) noise(c, out, when + delay, 0.4 * v, 0.03, 'bandpass', 1400);
      noise(c, out, when + 0.03, 0.55 * v, 0.16, 'bandpass', 1500);
      break;
    case 'cowbell':
      for (const freq of [587, 845]) tone(c, out, when, 0.26 * v, 0.28, freq, freq, 'square');
      break;
    case 'tambourine':
      noise(c, out, when, 0.3 * v, 0.14, 'highpass', 6500);
      noise(c, out, when + 0.05, 0.16 * v, 0.1, 'highpass', 8000);
      break;
    case 'rim':
      tone(c, out, when, 0.5 * v, 0.03, 1700, 1500, 'triangle');
      noise(c, out, when, 0.25 * v, 0.02, 'bandpass', 2600);
      break;
    case 'tablaNa':
      tone(c, out, when, 0.5 * v, 0.24, 450, 435, 'triangle');
      tone(c, out, when, 0.14 * v, 0.16, 905, 880);
      noise(c, out, when, 0.14 * v, 0.018, 'bandpass', 2600);
      break;
    case 'tablaGe':
      tone(c, out, when, 0.6 * v, 0.42, 92, 142); // the palm sliding on the bayan bends it up
      break;
    case 'dholak':
      tone(c, out, when, 0.4 * v, 0.1, 560, 430, 'triangle');
      noise(c, out, when, 0.3 * v, 0.05, 'bandpass', 1900);
      break;
    case 'dhol':
      tone(c, out, when, 0.7 * v, 0.34, 140, 66);
      noise(c, out, when, 0.3 * v, 0.03, 'lowpass', 2400);
      break;
    case 'ride':
      metal(c, out, when, 0.1 * v, 0.9, 5000);
      tone(c, out, when, 0.07 * v, 0.5, 2700, 2650);
      break;
  }
}
