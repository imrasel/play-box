import { h } from '../core/dom';
import { localPoint } from '../core/rotate';
import { GRAVITY, launch, touchesCircle } from './fruit-logic';
import { KINDS, SPRITE_PAD, cutFace, wholeFruit, type FruitKind } from './fruit-art';
import { gameScreen } from './play';

type Fruit = { kind: FruitKind; x: number; y: number; vx: number; vy: number; spin: number; turn: number };
type Half = Fruit & { side: 1 | -1; cut: number };
type Drop = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
type Stain = { x: number; y: number; r: number; color: string; life: number };

const MOST = 5;
const EVERY = 10;
const TRAIL_MS = 170;

export function mountFruit(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'fruit');
  const { stage, slash, celebrate } = game;
  const canvas = h('canvas', { class: 'fruit-board' }) as HTMLCanvasElement;
  const score = h('div', { class: 'game-score-big race-score' }, '⭐ 0');
  stage.append(canvas, score);
  const g = canvas.getContext('2d', { alpha: false })!;

  let w = 0;
  let height = 0;
  let radius = 60;
  let sliced = 0;
  let fruits: Fruit[] = [];
  let halves: Half[] = [];
  let drops: Drop[] = [];
  let stains: Stain[] = [];
  let wait = 0.4;
  let raf = 0;
  let last = performance.now();
  const trails = new Map<number, { x: number; y: number; at: number }[]>();
  const sprites = new Map<string, { whole: HTMLCanvasElement; face: HTMLCanvasElement }>();
  const art = (k: FruitKind) => {
    let found = sprites.get(k.name);
    if (!found) {
      found = { whole: wholeFruit(k, radius), face: cutFace(k, radius) };
      sprites.set(k.name, found);
    }
    return found;
  };

  const measure = () => {
    w = canvas.clientWidth;
    height = canvas.clientHeight;
    radius = Math.max(52, height * 0.16);
    sprites.clear();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const resize = new ResizeObserver(measure);
  resize.observe(canvas);

  function slice(f: Fruit, cut: number) {
    fruits = fruits.filter((x) => x !== f);
    for (const side of [1, -1] as const) {
      halves.push({
        ...f, side, cut,
        vx: f.vx * 0.5 + Math.cos(cut + Math.PI / 2) * side * 150,
        vy: Math.min(f.vy, 0) * 0.3 + Math.sin(cut + Math.PI / 2) * side * 150 - 60,
        spin: side * 1.8,
      });
    }
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 300;
      drops.push({
        x: f.x, y: f.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 80,
        life: 0.45 + Math.random() * 0.4, color: f.kind.flesh, size: 3 + Math.random() * 6,
      });
    }
    stains.push({ x: f.x, y: f.y, r: radius * 1.05, color: f.kind.flesh, life: 1 });
    slash();
    sliced++;
    score.textContent = `⭐ ${sliced}`;
    if (sliced % EVERY === 0) celebrate();
  }

  function cutAlong(ax: number, ay: number, bx: number, by: number) {
    for (const f of [...fruits]) {
      if (touchesCircle(ax, ay, bx, by, f.x, f.y, radius * 1.08)) slice(f, Math.atan2(by - ay, bx - ax) || Math.PI / 4);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = localPoint(e, canvas);
    trails.set(e.pointerId, [{ ...p, at: performance.now() }]);
    cutAlong(p.x, p.y, p.x, p.y); // a plain tap counts: small hands rarely swipe straight
  });
  canvas.addEventListener('pointermove', (e) => {
    const trail = trails.get(e.pointerId);
    if (!trail) return;
    const p = localPoint(e, canvas);
    const prev = trail[trail.length - 1];
    cutAlong(prev.x, prev.y, p.x, p.y);
    trail.push({ ...p, at: performance.now() });
  });
  const lift = (e: PointerEvent) => {
    const trail = trails.get(e.pointerId);
    trails.delete(e.pointerId);
    if (trail) trails.set(-1 - e.pointerId, trail); // lets the last streak fade out
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  function drawBoard() {
    const plank = height / 5;
    for (let i = 0; i < 5; i++) {
      const wood = g.createLinearGradient(0, i * plank, 0, (i + 1) * plank);
      wood.addColorStop(0, i % 2 ? '#c98a4b' : '#d69a5c');
      wood.addColorStop(1, i % 2 ? '#b97a3e' : '#c58a4d');
      g.fillStyle = wood;
      g.fillRect(0, i * plank, w, plank);
      g.fillStyle = 'rgba(70,35,10,.5)';
      g.fillRect(0, (i + 1) * plank - 2, w, 2);
    }
    for (const s of stains) {
      g.globalAlpha = s.life * 0.32;
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function drawWhole(f: Fruit) {
    const size = radius * SPRITE_PAD * 2;
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.turn);
    g.drawImage(art(f.kind).whole, -size / 2, -size / 2, size, size);
    g.restore();
  }

  /** A half is the skin as a dome, with the cut face tipped towards the viewer. */
  function drawHalf(f: Half) {
    const size = radius * SPRITE_PAD * 2;
    const { whole, face } = art(f.kind);
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.cut + f.turn);
    g.save();
    g.beginPath();
    g.rect(-size, f.side === 1 ? 0 : -size, size * 2, size);
    g.clip();
    g.drawImage(whole, -size / 2, -size / 2, size, size);
    g.restore();
    g.scale(1, 0.4);
    g.drawImage(face, -size / 2, -size / 2, size, size);
    g.restore();
  }

  function drawTrails(now: number) {
    trails.forEach((trail, id) => {
      while (trail.length && now - trail[0].at > TRAIL_MS) trail.shift();
      if (!trail.length) {
        if (id < 0) trails.delete(id);
        return;
      }
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const [width, color] of [[16, 'rgba(255,255,255,.28)'], [6, 'rgba(255,255,255,.95)']] as const) {
        g.strokeStyle = color;
        g.lineWidth = width;
        g.beginPath();
        trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
      }
    });
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (w) {
      wait -= dt;
      if (wait <= 0 && fruits.length < MOST) {
        const count = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
          fruits.push({
            kind: KINDS[Math.floor(Math.random() * KINDS.length)], ...launch(w, height, radius),
            spin: (Math.random() - 0.5) * 1.1, turn: (Math.random() - 0.5) * 0.6,
          });
        }
        wait = 1.15 + Math.random() * 0.5;
      }
      for (const f of [...fruits, ...halves]) {
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.turn += f.spin * dt;
      }
      for (const d of drops) {
        d.life -= dt;
        d.vy += GRAVITY * 1.4 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      for (const s of stains) s.life -= dt * 0.5;
      // A fruit that falls untouched just drops away: there is nothing to lose.
      fruits = fruits.filter((f) => f.y < height + radius * 2);
      halves = halves.filter((f) => f.y < height + radius * 2);
      drops = drops.filter((d) => d.life > 0);
      stains = stains.filter((s) => s.life > 0);

      drawBoard();
      halves.forEach(drawHalf);
      fruits.forEach(drawWhole);
      for (const d of drops) {
        g.globalAlpha = Math.min(1, d.life * 3);
        g.fillStyle = d.color;
        g.beginPath();
        g.arc(d.x, d.y, d.size, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
      drawTrails(now);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    game.close();
  };
}
