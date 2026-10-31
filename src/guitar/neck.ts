import { localPoint } from '../core/rotate';
import { chordNotes, crossed, fretAt, fretX, nearestString, SHAPES, stringY, TUNING } from './theory';

export type NeckMode = 'chords' | 'frets';

const NUT = 34;
const CHORD_FRETS = 5;
const FULL_FRETS = 12;
const NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
const WIDTHS = [3.4, 2.9, 2.4, 1.9, 1.5, 1.2];

/** The strings and frets. It decides what each touch plays; the module does the sound. */
export class Neck {
  readonly canvas = document.createElement('canvas');
  mode: NeckMode = 'chords';
  chord = 'C';
  private ctx: CanvasRenderingContext2D;
  private board = document.createElement('canvas');
  private w = 0;
  private h = 0;
  private motion = [0, 0, 0, 0, 0, 0];
  private pressed = new Map<number, { s: number; f: number; life: number }>();
  private fingers = new Map<number, { y: number; s: number }>();
  private dirty = true;
  private raf = 0;
  private last = 0;
  private resize: ResizeObserver;

  constructor(private onPluck: (string: number, midi: number) => void) {
    this.canvas.className = 'neck';
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    const c = this.canvas;
    c.addEventListener('pointerdown', this.down);
    c.addEventListener('pointermove', this.move);
    c.addEventListener('pointerup', this.up);
    c.addEventListener('pointercancel', this.up);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(c);
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
  }

  private get frets() {
    return this.mode === 'chords' ? CHORD_FRETS : FULL_FRETS;
  }

  private get length() {
    return (this.mode === 'chords' ? this.w * 0.64 : this.w - NUT - 10);
  }

  private fretHeld(x: number) {
    return this.mode === 'frets' ? fretAt(x, NUT, this.length, this.frets) : 0;
  }

  private noteOn(s: number, x: number): number | null {
    return this.mode === 'chords' ? chordNotes(this.chord)[s] : TUNING[s] + this.fretHeld(x);
  }

  /** Make a string shake, for plucks that did not come from a touch. */
  shake(s: number) {
    this.motion[s] = 1;
    this.dirty = true;
  }

  private pluck(s: number, x: number) {
    const midi = this.noteOn(s, x);
    if (midi === null) return;
    this.onPluck(s, midi);
    this.shake(s);
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const { x, y } = localPoint(e, this.canvas);
    const s = nearestString(y, this.h);
    this.fingers.set(e.pointerId, { y, s });
    this.pluck(s, x);
    if (this.mode === 'frets') this.pressed.set(e.pointerId, { s, f: this.fretHeld(x), life: 1 });
  };

  private move = (e: PointerEvent) => {
    const finger = this.fingers.get(e.pointerId);
    if (!finger) return;
    const { x, y } = localPoint(e, this.canvas);
    for (const s of crossed(finger.y, y, this.h)) {
      if (s === finger.s) continue;
      this.pluck(s, x);
      finger.s = s;
      if (this.mode === 'frets') this.pressed.set(e.pointerId, { s, f: this.fretHeld(x), life: 1 });
    }
    finger.y = y;
  };

  private up = (e: PointerEvent) => {
    this.fingers.delete(e.pointerId);
    this.pressed.delete(e.pointerId);
    this.dirty = true;
  };

  private measure() {
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [this.canvas, this.board]) {
      c.width = Math.round(this.w * dpr);
      c.height = Math.round(this.h * dpr);
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.paintBoard();
  }

  /** Wood and frets never change while playing, so they are painted once. */
  paintBoard() {
    const { w, h } = this;
    if (!w) return;
    const g = this.board.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const end = NUT + this.length;

    if (this.mode === 'chords') {
      const top = g.createLinearGradient(0, 0, w, h);
      top.addColorStop(0, '#d9a55a');
      top.addColorStop(0.5, '#c88c3f');
      top.addColorStop(1, '#a96c28');
      g.fillStyle = top;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(90,50,10,.13)';
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        g.moveTo(end, (h * i) / 26);
        g.bezierCurveTo(w * 0.8, (h * i) / 26 + 9, w * 0.9, (h * i) / 26 - 9, w, (h * i) / 26);
        g.stroke();
      }
      const cx = end + (w - end) * 0.52;
      const radius = Math.min(h * 0.42, (w - end) * 0.42);
      g.fillStyle = '#23130a';
      g.beginPath();
      g.arc(cx, h / 2, radius + 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8c789';
      g.beginPath();
      g.arc(cx, h / 2, radius + 7, 0, Math.PI * 2);
      g.fill();
      const hole = g.createRadialGradient(cx - radius * 0.2, h / 2 - radius * 0.2, radius * 0.2, cx, h / 2, radius);
      hole.addColorStop(0, '#2a180d');
      hole.addColorStop(1, '#060302');
      g.fillStyle = hole;
      g.beginPath();
      g.arc(cx, h / 2, radius, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = '#1b100a';
      g.fillRect(0, 0, w, h);
    }

    const wood = g.createLinearGradient(0, 0, 0, h);
    wood.addColorStop(0, '#2c180e');
    wood.addColorStop(0.5, '#4a2a18');
    wood.addColorStop(1, '#23130b');
    g.fillStyle = wood;
    g.fillRect(NUT, 0, end - NUT, h);
    g.strokeStyle = 'rgba(0,0,0,.2)';
    for (let i = 0; i < 40; i++) {
      const y = (h * i) / 40 + (i % 3);
      g.beginPath();
      g.moveTo(NUT, y);
      g.lineTo(end, y + (i % 5) - 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.fillRect(NUT, 0, end - NUT, 8);
    g.fillRect(NUT, h - 8, end - NUT, 8);

    for (const f of [3, 5, 7, 9, 12]) {
      if (f > this.frets) continue;
      const a = fretX(f - 1, NUT, this.length, this.frets);
      const b = fretX(f, NUT, this.length, this.frets);
      for (const y of f === 12 ? [h * 0.31, h * 0.69] : [h / 2]) {
        const pearl = g.createRadialGradient((a + b) / 2 - 2, y - 2, 1, (a + b) / 2, y, 8);
        pearl.addColorStop(0, '#fffdf4');
        pearl.addColorStop(1, '#bcae98');
        g.fillStyle = pearl;
        g.beginPath();
        g.arc((a + b) / 2, y, 7, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let f = 1; f <= this.frets; f++) {
      const x = fretX(f, NUT, this.length, this.frets);
      const metal = g.createLinearGradient(x - 2, 0, x + 2, 0);
      metal.addColorStop(0, '#6f7178');
      metal.addColorStop(0.45, '#f3f4f7');
      metal.addColorStop(1, '#55565c');
      g.fillStyle = metal;
      g.fillRect(x - 2, 0, 4, h);
    }

    const nut = g.createLinearGradient(NUT - 9, 0, NUT, 0);
    nut.addColorStop(0, '#d9d2bf');
    nut.addColorStop(1, '#fbf7ea');
    g.fillStyle = '#17100c';
    g.fillRect(0, 0, NUT - 9, h);
    g.fillStyle = nut;
    g.fillRect(NUT - 9, 0, 9, h);
    this.dirty = true;
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.dirty || this.motion.some((m) => m > 0.01)) this.draw(now, dt);
  };

  private draw(now: number, dt: number) {
    this.dirty = false;
    const { ctx: g, w, h } = this;
    if (!w) return;
    g.drawImage(this.board, 0, 0, w, h);
    const end = this.mode === 'chords' ? w : NUT + this.length;

    g.font = '700 12px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    TUNING.forEach((_, s) => {
      const muted = this.mode === 'chords' && SHAPES[this.chord][s] < 0;
      g.fillStyle = muted ? '#ff7a7a' : 'rgba(255,255,255,.8)';
      g.fillText(muted ? '✕' : NAMES[s], 11, stringY(s, h));
    });

    for (let s = 0; s < 6; s++) this.drawString(s, NUT - 9, end, now);
    if (this.mode === 'chords') {
      SHAPES[this.chord].forEach((f, s) => { if (f > 0) this.dot(s, f); });
    } else {
      this.pressed.forEach(({ s, f }) => { if (f > 0) this.dot(s, f); });
    }
    g.textBaseline = 'alphabetic';

    this.motion = this.motion.map((m) => m * Math.exp(-dt * 3.2));
  }

  private drawString(s: number, from: number, to: number, now: number) {
    const { ctx: g, h } = this;
    const y = stringY(s, h);
    const a = this.motion[s] * (4.2 - s * 0.35);
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const wave = a > 0.05 ? Math.sin(Math.PI * t) * Math.sin(now / (9 + s)) * a : 0;
        const x = from + (to - from) * t;
        if (i) g.lineTo(x, y + wave);
        else g.moveTo(x, y + wave);
      }
    };
    const width = WIDTHS[s];
    g.strokeStyle = 'rgba(0,0,0,.45)';
    g.lineWidth = width + 1;
    g.save();
    g.translate(0, 2.5);
    path();
    g.stroke();
    g.restore();
    path();
    g.strokeStyle = s < 3 ? '#b98a4e' : '#c9ccd2';
    g.lineWidth = width;
    g.stroke();
    path();
    g.strokeStyle = 'rgba(255,255,255,.72)';
    g.lineWidth = Math.max(0.6, width * 0.32);
    g.stroke();
  }

  private dot(s: number, f: number) {
    const { ctx: g, h } = this;
    const x = (fretX(f - 1, NUT, this.length, this.frets) + fretX(f, NUT, this.length, this.frets)) / 2;
    const y = stringY(s, h);
    const r = Math.min(13, h * 0.052);
    const ball = g.createRadialGradient(x - r / 3, y - r / 3, 1, x, y, r);
    ball.addColorStop(0, '#ffe58a');
    ball.addColorStop(1, '#f28a1e');
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath();
    g.arc(x + 1, y + 3, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ball;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  redraw() {
    this.dirty = true;
  }
}
