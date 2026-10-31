import { keyRect, type Layout } from './geometry';
import { pitchColor } from './keyboard';
import { HIGH, LOW, isBlack, noteName } from './notes';
import type { Judgement } from './rain';
import type { SongNote } from './songs';

type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Float = { x: number; y: number; text: string; color: string; life: number };

/** What the falling view needs: Note Rain and Learn both satisfy this. */
export type Falling = {
  notes: (SongNote & { state: string })[];
  beat: number;
  events?: { midi: number; kind: Judgement }[];
  combo?: number;
};

const LABEL: Record<Judgement, [string, string]> = {
  perfect: ['PERFECT', '#ffe066'],
  great: ['GREAT', '#7dffb2'],
  good: ['GOOD', '#7fd4ff'],
  miss: ['MISS', '#ff6b6b'],
};
const MAX_SPARKS = 90; // keeps phones smooth

const hue = (midi: number) => (midi % 12) * 30;

export class RainView {
  private sparks: Spark[] = [];
  private floats: Float[] = [];
  private lanes = new Map<number, number>();
  private last = performance.now();

  draw(g: CanvasRenderingContext2D, w: number, h: number, game: Falling, l: Layout) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const beatPx = Math.max(64, h / 3);

    this.drawStage(g, w, h, game.beat, beatPx, l);
    for (const e of game.events?.splice(0) ?? []) this.react(e.midi, e.kind, l, h);

    const combo = game.combo ?? 0;
    if (combo >= 5) {
      g.textAlign = 'center';
      g.font = `800 ${Math.min(64, 30 + combo * 0.7)}px system-ui, sans-serif`;
      g.fillStyle = 'rgba(255,255,255,.1)';
      g.fillText(`${combo}`, w / 2, h * 0.6);
    }

    this.drawBeams(g, h, dt, l);
    for (const n of game.notes) {
      if (n.state === 'hit') continue;
      const bottom = h - (n.start - game.beat) * beatPx;
      if (bottom < -2) break;
      const height = Math.max(20, n.dur * beatPx - 5);
      if (bottom - height > h) continue;
      this.drawNote(g, n.midi, n.state === 'missed', bottom, height, h, l);
    }
    this.drawEffects(g, dt);
  }

  /** Near-black floor with black-key lanes and beat lines, so motion reads clearly. */
  private drawStage(g: CanvasRenderingContext2D, w: number, h: number, beat: number, beatPx: number, l: Layout) {
    const floor = g.createLinearGradient(0, 0, 0, h);
    floor.addColorStop(0, '#08080f');
    floor.addColorStop(1, '#14141f');
    g.fillStyle = floor;
    g.fillRect(0, 0, w, h);

    for (let m = LOW; m <= HIGH; m++) {
      const r = keyRect(m, l);
      if (r.x + r.w < 0 || r.x > w) continue;
      if (isBlack(m)) {
        g.fillStyle = 'rgba(0,0,0,.34)';
        g.fillRect(r.x, 0, r.w, h);
      } else if (m % 12 === 0 || m % 12 === 5) {
        g.fillStyle = m % 12 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.13)';
        g.fillRect(r.x, 0, 1, h);
      }
    }
    g.fillStyle = 'rgba(255,255,255,.05)';
    const offset = (beat % 1 + 1) % 1;
    for (let i = 0; i * beatPx < h + beatPx; i++) {
      g.fillRect(0, h - (i - offset) * beatPx, w, 1);
    }
  }

  private drawBeams(g: CanvasRenderingContext2D, h: number, dt: number, l: Layout) {
    this.lanes.forEach((life, midi) => {
      const next = life - dt * 3;
      if (next <= 0) { this.lanes.delete(midi); return; }
      const r = keyRect(midi, l);
      const beam = g.createLinearGradient(0, h, 0, h * 0.25);
      beam.addColorStop(0, `hsla(${hue(midi)} 100% 70% / ${next * 0.75})`);
      beam.addColorStop(1, `hsla(${hue(midi)} 100% 70% / 0)`);
      g.fillStyle = beam;
      g.fillRect(r.x, 0, r.w, h);
      this.lanes.set(midi, next);
    });
  }

  private drawNote(g: CanvasRenderingContext2D, midi: number, missed: boolean, bottom: number, height: number, h: number, l: Layout) {
    const r = keyRect(midi, l);
    const inset = isBlack(midi) ? 0.5 : r.w * 0.09;
    const x = r.x + inset;
    const w = r.w - inset * 2;
    const y = bottom - height;
    const radius = Math.min(7, w / 3);
    g.beginPath();
    g.roundRect(x, y, w, height, radius);

    if (missed) {
      g.fillStyle = 'rgba(120,120,140,.28)';
      g.fill();
      return;
    }
    const near = Math.max(0, 1 - (h - bottom) / 90); // brightens on approach
    for (const [width, alpha] of [[9, 0.1], [5, 0.2]]) {
      g.strokeStyle = `hsla(${hue(midi)} 100% 65% / ${alpha + near * 0.2})`;
      g.lineWidth = width;
      g.stroke();
    }
    const fill = g.createLinearGradient(0, y, 0, bottom);
    fill.addColorStop(0, `hsl(${hue(midi)} 88% 40%)`);
    fill.addColorStop(1, `hsl(${hue(midi)} 96% ${62 + near * 12}%)`);
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.72)';
    g.lineWidth = 1.2;
    g.stroke();

    if (w > 18 && height > 20) {
      g.fillStyle = 'rgba(255,255,255,.95)';
      g.font = `700 ${Math.min(13, w * 0.42)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(noteName(midi, 'letters'), x + w / 2, bottom - 7);
    }
  }

  private react(midi: number, kind: Judgement, l: Layout, h: number) {
    const r = keyRect(midi, l);
    const x = r.x + r.w / 2;
    const [text, color] = LABEL[kind];
    this.floats.push({ x, y: h - 34, text, color, life: 1 });
    if (kind === 'miss') return;
    this.lanes.set(midi, 1);
    const count = kind === 'perfect' ? 20 : 11;
    for (let i = 0; i < count && this.sparks.length < MAX_SPARKS; i++) {
      const angle = -Math.PI * Math.random();
      const speed = 80 + Math.random() * 240;
      this.sparks.push({
        x, y: h - 3, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.45, color: pitchColor(midi),
      });
    }
  }

  private drawEffects(g: CanvasRenderingContext2D, dt: number) {
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 460 * dt;
      g.globalAlpha = Math.min(1, s.life * 2.2);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    this.floats = this.floats.filter((f) => (f.life -= dt * 1.6) > 0);
    g.textAlign = 'center';
    g.font = '800 15px system-ui, sans-serif';
    for (const f of this.floats) {
      g.globalAlpha = Math.min(1, f.life * 2);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y - (1 - f.life) * 34);
    }
    g.globalAlpha = 1;
  }
}
