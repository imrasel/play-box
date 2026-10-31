import { localPoint } from '../core/rotate';
import { BLACK_HEIGHT, keyAt, keyRect, velocityFromY, type Layout } from './geometry';
import { HIGH, LOW, isBlack, noteName, type LabelStyle } from './notes';

export type Theme = {
  id: string;
  name: string;
  white: [string, string];
  black: [string, string];
  felt: string;
  back: string;
  /** Colour white keys by pitch, for small children finding notes. */
  rainbow?: boolean;
};

export const THEMES: Theme[] = [
  { id: 'classic', name: 'Concert', white: ['#fffef9', '#e9e4d8'], black: ['#3a3a3e', '#0c0c0e'], felt: '#a3172a', back: '#17110e' },
  { id: 'wood', name: 'Walnut', white: ['#fff9ec', '#ecdcc0'], black: ['#5a3620', '#2a160b'], felt: '#7d4a22', back: '#2b1a10' },
  { id: 'midnight', name: 'Midnight', white: ['#e8ecf8', '#b9c3de'], black: ['#27304d', '#0b0f20'], felt: '#3657d6', back: '#0b0e1c' },
  { id: 'candy', name: 'Candy', white: ['#fff3f8', '#ffd3e4'], black: ['#a93a78', '#6a1b4c'], felt: '#ff5fa2', back: '#3b1230' },
  { id: 'rainbow', name: 'Rainbow', white: ['#ffffff', '#eeeeee'], black: ['#333338', '#101014'], felt: '#ffb400', back: '#1b1b2b', rainbow: true },
];

const RAIL = 15;
const FELT = 4;

export const pitchColor = (midi: number) => `hsl(${(midi % 12) * 30} 85% 62%)`;

export type KeyboardOptions = {
  onDown(midi: number, vel: number): void;
  onUp(midi: number): void;
};

export class KeyboardView {
  readonly canvas = document.createElement('canvas');
  layout: Layout = { width: 0, height: 0, first: 23, visible: 15 };
  theme = THEMES[0];
  labels: LabelStyle = 'letters';
  pressColor = '#ffb400';
  touchVelocity = true;
  /** Light keys in their note colour, matching what is falling. */
  noteColors = false;
  /** Upside-down row, for the player sitting opposite. */
  flipped = false;
  active: ReadonlySet<number> = new Set();
  hints: ReadonlySet<number> = new Set();

  private ctx: CanvasRenderingContext2D;
  private sprites = new Map<string, HTMLCanvasElement>();
  private pointers = new Map<number, number>();
  private dirty = true;
  private raf = 0;
  private resize: ResizeObserver;

  constructor(private opts: KeyboardOptions) {
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.canvas.className = 'keys';
    const c = this.canvas;
    c.addEventListener('pointerdown', this.down);
    c.addEventListener('pointermove', this.move);
    c.addEventListener('pointerup', this.up);
    c.addEventListener('pointercancel', this.up);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(c);
    const frame = () => {
      if (this.dirty) this.draw();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.pointers.forEach((m) => this.opts.onUp(m));
    this.pointers.clear();
  }

  invalidate() {
    this.dirty = true;
  }

  private measure() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.layout = { ...this.layout, width, height };
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.invalidate();
  }

  private point(e: PointerEvent) {
    const { x, y } = localPoint(e, this.canvas);
    const { width, height } = this.layout;
    return this.flipped ? { x: width - x, y: height - y } : { x, y };
  }

  private press(id: number, x: number, y: number) {
    const midi = keyAt(x, y, this.layout);
    if (midi === null) return;
    this.pointers.set(id, midi);
    const h = this.layout.height * (isBlack(midi) ? BLACK_HEIGHT : 1);
    this.opts.onDown(midi, this.touchVelocity ? velocityFromY(y, h) : 0.8);
  }

  private down = (e: PointerEvent) => {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const { x, y } = this.point(e);
    this.press(e.pointerId, x, y);
  };

  // Sliding a finger across the keys plays each one, like a glissando.
  private move = (e: PointerEvent) => {
    const held = this.pointers.get(e.pointerId);
    if (held === undefined) return;
    const { x, y } = this.point(e);
    const midi = keyAt(x, y, this.layout);
    if (midi === null || midi === held) return;
    this.opts.onUp(held);
    this.press(e.pointerId, x, y);
  };

  private up = (e: PointerEvent) => {
    const held = this.pointers.get(e.pointerId);
    if (held === undefined) return;
    this.pointers.delete(e.pointerId);
    this.opts.onUp(held);
  };

  private draw() {
    this.dirty = false;
    const { ctx, theme, layout: l } = this;
    if (!l.width) return;
    ctx.save();
    if (this.flipped) {
      ctx.translate(l.width, l.height);
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = theme.back;
    ctx.fillRect(0, 0, l.width, l.height);

    const whites: number[] = [];
    const blacks: number[] = [];
    for (let m = LOW; m <= HIGH; m++) {
      const r = keyRect(m, l);
      if (r.x + r.w < 0 || r.x > l.width) continue;
      (isBlack(m) ? blacks : whites).push(m);
    }
    whites.forEach((m) => this.drawWhite(m));
    blacks.forEach((m) => this.drawBlack(m));

    // Polished fallboard above the keys, then the felt strip they sit under.
    const board = ctx.createLinearGradient(0, 0, 0, RAIL);
    board.addColorStop(0, '#000');
    board.addColorStop(0.45, '#1d1b1f');
    board.addColorStop(0.7, '#050506');
    board.addColorStop(1, '#000');
    ctx.fillStyle = board;
    ctx.fillRect(0, 0, l.width, RAIL);
    if (!this.flipped) {
      // The keys mirrored in the lacquer: the detail that sells real depth.
      const c = this.canvas;
      const scale = c.width / l.width;
      ctx.globalAlpha = 0.13;
      ctx.drawImage(c, 0, (RAIL + FELT) * scale, c.width, 34 * scale, 0, RAIL, l.width, -RAIL);
      ctx.globalAlpha = 1;
      const fade = ctx.createLinearGradient(0, 0, 0, RAIL);
      fade.addColorStop(0, '#000');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, l.width, RAIL);
    }
    ctx.fillStyle = theme.felt;
    ctx.fillRect(0, RAIL, l.width, FELT);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.fillRect(0, RAIL + FELT - 1, l.width, 1);
    const shadow = ctx.createLinearGradient(0, RAIL + FELT, 0, RAIL + FELT + 30);
    shadow.addColorStop(0, 'rgba(0,0,0,.62)');
    shadow.addColorStop(0.35, 'rgba(0,0,0,.22)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, RAIL + FELT, l.width, 30);
    ctx.restore();
  }

  /** Keys are painted once and reused, so rich shading stays cheap on phones. */
  private sprite(id: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const key = `${id}|${this.theme.id}|${Math.ceil(w)}x${Math.ceil(h)}`;
    let c = this.sprites.get(key);
    if (!c) {
      if (this.sprites.size > 120) this.sprites.clear();
      c = document.createElement('canvas');
      c.width = Math.ceil(w) * dpr;
      c.height = Math.ceil(h) * dpr;
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      paint(g);
      this.sprites.set(key, c);
    }
    return c;
  }

  private drawWhite(m: number) {
    const { ctx, theme, layout: l } = this;
    const r = keyRect(m, l);
    const down = this.active.has(m);
    const tint = theme.rainbow ? pitchColor(m) : theme.white[1];
    const id = `w${down ? 1 : 0}${theme.rainbow ? m % 12 : ''}`;
    const cw = Math.ceil(r.w);
    const ch = Math.ceil(r.h);
    ctx.drawImage(this.sprite(id, r.w, r.h, (g) => paintWhite(g, cw, ch, theme.white[0], tint, down)), r.x, 0, r.w, r.h);
    const surface = whiteSurface(r.h, down);
    this.overlay(m, r.x + 1, r.w - 2, surface, down);

    const text = noteName(m, this.labels);
    if (text && r.w > 16) {
      ctx.fillStyle = 'rgba(30,30,40,.66)';
      ctx.font = `600 ${Math.min(15, r.w * 0.34)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(text, r.x + r.w / 2, surface - 11);
    }
  }

  private drawBlack(m: number) {
    const { ctx, theme, layout: l } = this;
    const r = keyRect(m, l);
    const down = this.active.has(m);
    const pad = Math.ceil(r.w * 0.8);
    const sw = r.w + pad * 2;
    const sh = r.h + pad * 2;
    const sprite = this.sprite(`b${down ? 1 : 0}`, sw, sh, (g) =>
      paintBlack(g, Math.ceil(r.w), Math.ceil(r.h), pad, theme.black, down));
    ctx.drawImage(sprite, r.x - pad, -pad, sw, sh);
    if (this.active.has(m) || this.hints.has(m)) {
      this.overlay(m, r.x + r.w * 0.1, r.w * 0.8, r.h * (down ? 0.93 : 0.88), down);
    }
  }

  private overlay(m: number, x: number, w: number, h: number, down: boolean) {
    const { ctx } = this;
    const hint = this.hints.has(m);
    if (!down && !hint) return;
    ctx.globalAlpha = down ? 0.62 : 0.5;
    ctx.fillStyle = hint && !down ? '#37d67a' : this.theme.rainbow || this.noteColors ? pitchColor(m) : this.pressColor;
    ctx.beginPath();
    ctx.roundRect(x, 0, w, h, [0, 0, 3, 3]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const whiteLip = (h: number) => Math.max(8, Math.min(16, h * 0.05));
const whiteSurface = (h: number, down: boolean) => h - (down ? 1 : 3) - whiteLip(h) * (down ? 0.3 : 1);

function paintWhite(g: CanvasRenderingContext2D, w: number, h: number, light: string, tint: string, down: boolean) {
  const x = 1;
  const kw = w - 2;
  const bottom = h - (down ? 1 : 3);
  const surface = whiteSurface(h, down);

  // Dark gap between keys, so each one reads as a separate block.
  g.fillStyle = '#0a0806';
  g.fillRect(0, 0, w, h);

  // Rounded front edge: bright where it catches the light, falling into shade.
  g.fillStyle = tint;
  g.beginPath();
  g.roundRect(x, surface - 8, kw, bottom - surface + 8, [0, 0, 7, 7]);
  g.fill();
  const front = g.createLinearGradient(0, surface, 0, bottom);
  front.addColorStop(0, 'rgba(255,255,255,.55)');
  front.addColorStop(0.18, 'rgba(0,0,0,.06)');
  front.addColorStop(0.75, 'rgba(0,0,0,.3)');
  front.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = front;
  g.fill();

  const top = g.createLinearGradient(0, 0, 0, surface);
  top.addColorStop(0, tint);
  top.addColorStop(0.12, light);
  top.addColorStop(0.72, light);
  top.addColorStop(1, tint);
  g.fillStyle = top;
  g.beginPath();
  g.roundRect(x, 0, kw, surface, [0, 0, 4, 4]);
  g.fill();

  // Across the key: a slight crown, lit from the left, so it isn't a flat panel.
  const crown = g.createLinearGradient(x, 0, x + kw, 0);
  crown.addColorStop(0, 'rgba(255,255,255,.75)');
  crown.addColorStop(0.1, 'rgba(255,255,255,.12)');
  crown.addColorStop(0.55, 'rgba(0,0,0,0)');
  crown.addColorStop(0.92, 'rgba(0,0,0,.05)');
  crown.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = crown;
  g.fill();

  // A long soft sheen, like light on polished acrylic.
  const sheen = g.createLinearGradient(0, surface * 0.6, 0, surface);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.92, 'rgba(255,255,255,.5)');
  sheen.addColorStop(1, 'rgba(255,255,255,.9)');
  g.fillStyle = sheen;
  g.fillRect(x + 2, surface * 0.6, kw - 4, surface * 0.4 - 1);

  if (down) {
    const tilt = g.createLinearGradient(0, 0, 0, surface * 0.7);
    tilt.addColorStop(0, 'rgba(0,0,0,.42)');
    tilt.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = tilt;
    g.fillRect(x, 0, kw, surface);
    for (const [from, to] of [[x, x + 5], [x + kw, x + kw - 5]]) {
      const wall = g.createLinearGradient(from, 0, to, 0);
      wall.addColorStop(0, 'rgba(0,0,0,.34)');
      wall.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = wall;
      g.fillRect(Math.min(from, to), 0, 5, surface);
    }
  }
}

function paintBlack(g: CanvasRenderingContext2D, w: number, fullH: number, pad: number, [mid, dark]: [string, string], down: boolean) {
  const h = fullH - (down ? 5 : 0);
  const slope = fullH * (down ? 0.05 : 0.11);
  const plateX = pad + w * 0.11;
  const plateW = w * 0.78;
  const plate = h - slope;

  // A real blurred shadow, drawn off-canvas so only the shadow lands here.
  const away = 4000;
  const dpr = g.getTransform().a;
  g.save();
  g.shadowColor = 'rgba(0,0,0,.62)';
  g.shadowBlur = (down ? 5 : 12) * dpr;
  g.shadowOffsetX = (away + (down ? 2 : w * 0.17)) * dpr;
  g.shadowOffsetY = (down ? 2 : w * 0.14) * dpr;
  g.fillStyle = '#000';
  g.fillRect(pad - away, pad, w, h);
  g.restore();

  g.translate(0, pad);
  // Black keys are wider at the base, so the sides show as bevels.
  g.fillStyle = dark;
  g.beginPath();
  g.roundRect(pad, 0, w, h, [0, 0, 5, 5]);
  g.fill();
  const sides = g.createLinearGradient(pad, 0, pad + w, 0);
  sides.addColorStop(0, 'rgba(255,255,255,.26)');
  sides.addColorStop(0.11, 'rgba(255,255,255,.04)');
  sides.addColorStop(0.89, 'rgba(0,0,0,.2)');
  sides.addColorStop(1, 'rgba(0,0,0,.6)');
  g.fillStyle = sides;
  g.fill();

  const face = g.createLinearGradient(0, plate, 0, h);
  face.addColorStop(0, 'rgba(255,255,255,.5)');
  face.addColorStop(0.2, 'rgba(255,255,255,.2)');
  face.addColorStop(1, 'rgba(255,255,255,.02)');
  g.fillStyle = face;
  g.beginPath();
  g.moveTo(plateX, plate);
  g.lineTo(plateX + plateW, plate);
  g.lineTo(pad + w * 0.97, h - 2);
  g.lineTo(pad + w * 0.03, h - 2);
  g.closePath();
  g.fill();

  const top = g.createLinearGradient(0, 0, 0, plate);
  top.addColorStop(0, dark);
  top.addColorStop(0.5, mid);
  top.addColorStop(1, mid);
  g.fillStyle = top;
  g.beginPath();
  g.roundRect(plateX, 0, plateW, plate, [0, 0, 3, 3]);
  g.fill();

  // Gloss: the window-light streak that makes lacquer look wet.
  const gloss = g.createLinearGradient(plateX, 0, plateX + plateW, 0);
  gloss.addColorStop(0, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.16, 'rgba(255,255,255,.36)');
  gloss.addColorStop(0.3, 'rgba(255,255,255,.05)');
  gloss.addColorStop(0.72, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.88, 'rgba(255,255,255,.1)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.fillRect(plateX, plate * 0.08, plateW, plate * 0.88);
  g.fillStyle = 'rgba(255,255,255,.3)';
  g.fillRect(plateX + 1, plate - 1, plateW - 2, 1);
  if (down) {
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(pad, 0, w, h);
  }
}
