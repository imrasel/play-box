import { getEngine } from '../core/audio';
import { h } from '../core/dom';
import { homeTool } from '../core/ui';

export const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76];
const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const CONFETTI = ['⭐', '🎉', '🌟', '🎈', '✨'];

/** The frame every little game shares: a home button, a stage, sound and praise. */
export function gameScreen(root: HTMLElement, goBack: () => void, name: string) {
  const engine = getEngine();
  engine.setVolume(0.9);
  engine.setReverb(0.2);

  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  const stage = h('main', { class: 'game-stage' });
  const back = homeTool(goBack, 'Back');
  back.classList.add('game-back');
  const page = h('div', { class: `piano little-game ${name}` }, stage, back);
  root.append(page);

  const note = (midi: number, seconds = 0.5, when = 0, level = 0.4) => {
    const c = engine.ctx;
    engine.resume();
    const at = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = freq(midi);
    g.gain.setValueAtTime(level, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    o.connect(g).connect(engine.input);
    o.start(at);
    o.stop(at + seconds + 0.02);
  };

  /** The crack of a burst: an instant of bright noise over a small thump. */
  const snap = () => {
    const c = engine.ctx;
    engine.resume();
    const at = c.currentTime;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * 0.09), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 5;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const bright = c.createBiquadFilter();
    bright.type = 'highpass';
    bright.frequency.value = 1100;
    const crack = c.createGain();
    crack.gain.value = 0.85;
    src.connect(bright).connect(crack).connect(engine.input);
    src.start(at);

    const body = c.createOscillator();
    const thump = c.createGain();
    body.frequency.setValueAtTime(240, at);
    body.frequency.exponentialRampToValueAtTime(70, at + 0.05);
    thump.gain.setValueAtTime(0.45, at);
    thump.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
    body.connect(thump).connect(engine.input);
    body.start(at);
    body.stop(at + 0.08);
  };

  /** An explosion: a rumble of falling noise. `size` runs from a small plane to a boss. */
  const boom = (size: number) => {
    const c = engine.ctx;
    engine.resume();
    const at = c.currentTime;
    const seconds = 0.2 + size * 0.7;
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(1400, at);
    low.frequency.exponentialRampToValueAtTime(120, at + seconds);
    const level = c.createGain();
    level.gain.setValueAtTime(0.28 + size * 0.5, at);
    level.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    src.connect(low).connect(level).connect(engine.input);
    src.start(at);
  };

  /** A blade through fruit: a fast rising swish, then a wet squish as it parts. */
  const slash = () => {
    const c = engine.ctx;
    engine.resume();
    const at = c.currentTime;
    const noise = (seconds: number) => {
      const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buffer;
      return src;
    };

    const swish = noise(0.17);
    const sweep = c.createBiquadFilter();
    sweep.type = 'bandpass';
    sweep.Q.value = 1.6;
    sweep.frequency.setValueAtTime(1400, at);
    sweep.frequency.exponentialRampToValueAtTime(8200, at + 0.13);
    const air = c.createGain();
    air.gain.setValueAtTime(0.0001, at);
    air.gain.exponentialRampToValueAtTime(0.6, at + 0.05);
    air.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    swish.connect(sweep).connect(air).connect(engine.input);
    swish.start(at);

    const wet = noise(0.11);
    const soft = c.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.setValueAtTime(1500, at + 0.06);
    soft.frequency.exponentialRampToValueAtTime(320, at + 0.16);
    const squish = c.createGain();
    squish.gain.setValueAtTime(0.5, at + 0.06);
    squish.gain.exponentialRampToValueAtTime(0.001, at + 0.17);
    wet.connect(soft).connect(squish).connect(engine.input);
    wet.start(at + 0.06);
  };

  const cheer = () => [72, 76, 79, 84].forEach((m, i) => note(m, 0.45, i * 0.11));

  /** Big praise: rising notes and a shower of stars. */
  const celebrate = () => {
    cheer();
    const width = stage.clientWidth;
    for (let i = 0; i < 26; i++) {
      const bit = h('span', {
        class: 'confetti',
        style: `left:${Math.random() * width}px;animation-delay:${Math.random() * 0.5}s;font-size:${22 + Math.random() * 26}px`,
      }, CONFETTI[i % CONFETTI.length]);
      stage.append(bit);
      later(() => bit.remove(), 2200);
    }
  };

  const close = () => {
    timers.forEach(clearTimeout);
    page.remove();
  };
  return { page, stage, engine, later, note, snap, slash, boom, cheer, celebrate, close };
}
