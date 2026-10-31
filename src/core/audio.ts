/** Shared audio graph. Every module (piano, drums, games) plays through this. */
export class AudioEngine {
  readonly ctx: AudioContext;
  /** Connect anything that should be heard here. */
  readonly input: GainNode;
  readonly analyser: AnalyserNode;
  private readonly master: GainNode;
  private readonly wet: GainNode;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    const { ctx } = this;
    this.input = ctx.createGain();
    this.master = ctx.createGain();
    this.wet = ctx.createGain();
    this.analyser = ctx.createAnalyser();

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 1.8);

    // The limiter stops loud chords from clipping on phone speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;

    this.input.connect(limiter);
    this.input.connect(reverb).connect(this.wet).connect(limiter);
    limiter.connect(this.master).connect(this.analyser).connect(ctx.destination);
  }

  setVolume(v: number) {
    this.master.gain.value = v;
  }

  setReverb(v: number) {
    this.wet.gain.value = v;
  }

  resume() {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  /** Output delay in ms as reported by the browser. */
  get latencyMs() {
    const c = this.ctx;
    return Math.round((c.baseLatency + (c.outputLatency || 0)) * 1000);
  }
}

function impulse(ctx: BaseAudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
  }
  return buffer;
}

let engine: AudioEngine | null = null;

// iPhones only unlock audio on these events, not on the touch going down.
for (const type of ['touchend', 'pointerup', 'click']) {
  document.addEventListener(type, () => engine?.resume(), { capture: true, passive: true });
}

// Everything is timed from the audio clock, so stopping it pauses every beat, strum and
// engine hum at once, and they carry on cleanly on return.
function pauseInBackground() {
  if (document.visibilityState === 'hidden') void engine?.ctx.suspend();
  else engine?.resume();
}
document.addEventListener('visibilitychange', pauseInBackground);
window.addEventListener('pagehide', () => void engine?.ctx.suspend());
window.addEventListener('pageshow', pauseInBackground);

/** Create lazily: browsers only allow audio after a tap. */
export function getEngine() {
  // Without this, an iPhone in silent mode plays nothing at all.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  engine ??= new AudioEngine();
  engine.resume();
  return engine;
}
