import { h } from '../core/dom';
import { localPoint } from '../core/rotate';
import { load, save } from '../core/storage';
import { PENTATONIC, gameScreen } from './play';
import { RaceGame } from './race-logic';
import { bushTop, carTop, flowers, grassTile, houseTop, lamp, pond, treeTop } from './race-art';

const CAR_ROW = 0.7; // where the car rests, as a share of the height
const TOP_ROW = 0.3; // the furthest forward a finger can take it
const BOTTOM_ROW = 0.88; // the furthest back
const WORLD_SCALE = 0.36; // screen pixels per world unit: gives time to see what is coming
const ROAD_WIDTH = 0.82; // road width, as a share of the height
const ENGINE_LEVEL = 0.022; // a smooth purr, well under the music of the stars
const FAR_GAP = 300; // spacing of the big things: trees, houses, ponds
const NEAR_GAP = 150; // spacing of the small things beside the pavement
const KEY_ROW_STEP = 0.1;

const CARS = [
  { id: 'red', body: '#e8222e', dark: '#7d0a12', light: '#ff7a78' },
  { id: 'yellow', body: '#ffc21a', dark: '#b37a00', light: '#ffe98a' },
  { id: 'blue', body: '#1c7ed6', dark: '#0a3f77', light: '#79c6ff' },
  { id: 'green', body: '#2fb344', dark: '#10601f', light: '#94ee9f' },
  { id: 'purple', body: '#8a3ffc', dark: '#42128f', light: '#cda5ff' },
  { id: 'pink', body: '#ff3d9a', dark: '#94105a', light: '#ffa8d4' },
  { id: 'black', body: '#30333c', dark: '#0d0e12', light: '#858a98' },
];

export function mountRace(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'race');
  const { stage, note, cheer, celebrate } = game;
  const canvas = h('canvas', { class: 'race-road' }) as HTMLCanvasElement;
  const score = h('div', { class: 'game-score-big race-score' }, '⭐ 0');
  const picker = h('div', { class: 'car-picker' });
  stage.append(canvas, score, picker);
  const g = canvas.getContext('2d', { alpha: false })!;

  const saved = load('race.settings', { car: 'red' });
  const sprites = new Map<string, HTMLCanvasElement>();
  const carFor = (id: string) => {
    if (!sprites.has(id)) sprites.set(id, carTop(CARS.find((c) => c.id === id) ?? CARS[0]));
    return sprites.get(id)!;
  };
  const far = [
    { art: treeTop(5), size: 0.24 }, { art: treeTop(23), size: 0.27 }, { art: treeTop(61), size: 0.22 },
    { art: treeTop(97), size: 0.26 }, { art: treeTop(131), size: 0.24 },
    { art: houseTop('#d9534a', '#a83a33'), size: 0.27 }, { art: houseTop('#4a86c7', '#2f5f96'), size: 0.27 },
    { art: houseTop('#e0a23c', '#b57a22'), size: 0.27 }, { art: pond(), size: 0.3 },
  ];
  const near = [
    { art: bushTop(), size: 0.09 }, { art: flowers(['#ff5fa2', '#ffffff', '#ffd21f']), size: 0.1 },
    { art: flowers(['#ff4d4d', '#b65cff', '#ffffff']), size: 0.1 }, { art: bushTop(), size: 0.075 },
  ];
  const street = lamp();
  const lawn = g.createPattern(grassTile(), 'repeat')!;
  const swatches = CARS.map((paint) => {
    const b = h('button', { class: 'car-swatch', 'aria-label': paint.id, 'data-car': paint.id, style: `--paint:${paint.body};--shine:${paint.light}` });
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      saved.car = paint.id;
      save('race.settings', saved);
      swatches.forEach((s) => s.classList.toggle('on', s === b));
      note(PENTATONIC[5], 0.14, 0, 0.2);
    });
    b.classList.toggle('on', paint.id === saved.car);
    picker.append(b);
    return b;
  });

  const race = new RaceGame();

  // Two soft tones a fifth apart: a smooth purr with no heavy bass in it.
  const audio = game.engine.ctx;
  const motor = audio.createOscillator();
  const rumble = audio.createOscillator();
  const muffle = audio.createBiquadFilter();
  const hum = audio.createGain();
  motor.type = 'triangle';
  rumble.type = 'sine';
  muffle.type = 'lowpass';
  muffle.frequency.value = 900;
  hum.gain.value = 0;
  motor.connect(muffle);
  rumble.connect(muffle);
  muffle.connect(hum).connect(game.engine.input);
  motor.start();
  rumble.start();
  hum.gain.setTargetAtTime(ENGINE_LEVEL, audio.currentTime, 0.4);

  const onVisible = () => {
    hum.gain.setTargetAtTime(document.hidden ? 0 : ENGINE_LEVEL, audio.currentTime, 0.05);
  };
  document.addEventListener('visibilitychange', onVisible);

  let w = 0;
  let sh = 0;
  let shownLane = 1;
  let shownRow = 0;
  let wobble = 0;
  let raf = 0;
  let last = performance.now();
  let sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  const measure = () => {
    w = canvas.clientWidth;
    sh = canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(sh * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const resize = new ResizeObserver(measure);
  resize.observe(canvas);

  const roadWidth = () => Math.min(w * 0.62, sh * ROAD_WIDTH);
  const roadLeft = () => (w - roadWidth()) / 2;
  const laneWidth = () => roadWidth() / 3;
  const laneX = (lane: number) => roadLeft() + laneWidth() * (lane + 0.5);
  const restRow = () => sh * CAR_ROW;
  const screenY = (worldX: number) => restRow() - (worldX - race.distance) * WORLD_SCALE;
  /** Scrolling patterns repeat, so only their position within one repeat matters. */
  const scrollOffset = (repeat: number) => (race.distance * WORLD_SCALE) % repeat;

  /** Where the car is heading. It glides there, so a tap or a drag both feel smooth. */
  const aim = { lane: 1, row: 0 };

  const setAim = (lane: number, row: number) => {
    aim.lane = Math.max(0, Math.min(2, lane));
    aim.row = Math.max(sh * TOP_ROW, Math.min(sh * BOTTOM_ROW, row));
    stage.dataset.lane = String(Math.round(aim.lane));
    stage.dataset.row = String(Math.round((aim.row / sh) * 100));
  };

  function steer(e: { clientX: number; clientY: number }) {
    const p = localPoint(e, canvas);
    setAim((p.x - roadLeft()) / laneWidth() - 0.5, p.y);
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    steer(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') steer(e); });

  // Some phones drop pointer events during fast taps. Touches are read directly as well,
  // from the whole stage, so no tap can land somewhere that does nothing.
  const touched = (e: TouchEvent) => {
    if ((e.target as Element).closest('button')) return;
    e.preventDefault();
    const touch = e.touches[e.touches.length - 1];
    if (touch) steer(touch);
  };
  stage.addEventListener('touchstart', touched, { passive: false });
  stage.addEventListener('touchmove', touched, { passive: false });

  const keydown = (e: KeyboardEvent) => {
    const [lanes, rows] = ({
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    } as Record<string, number[]>)[e.key] ?? [0, 0];
    if (!lanes && !rows) return;
    e.preventDefault();
    setAim(aim.lane + lanes, aim.row + rows * sh * KEY_ROW_STEP);
  };
  window.addEventListener('keydown', keydown);

  function drawGround() {
    g.save();
    g.translate(0, scrollOffset(512));
    g.fillStyle = lawn;
    g.fillRect(0, -512, w, sh + 1024);
    g.restore();

    const left = roadLeft();
    const width = roadWidth();
    const kerb = Math.max(6, width * 0.03);
    const pavement = Math.max(16, width * 0.09);

    // A pavement runs along both sides, with joints that pass by to show the speed.
    const joint = 34;
    const jointOffset = scrollOffset(joint);
    for (const x of [left - kerb - pavement, left + width + kerb]) {
      g.fillStyle = '#d7dadf';
      g.fillRect(x, 0, pavement, sh);
      g.fillStyle = 'rgba(70,75,85,.32)';
      for (let y = jointOffset - joint; y < sh; y += joint) g.fillRect(x, y, pavement, 1.5);
    }
    for (const x of [left - kerb - pavement, left + width + kerb + pavement]) {
      g.fillStyle = 'rgba(0,30,5,.3)';
      g.fillRect(x - 2, 0, 3, sh);
    }

    const block = 16;
    const kerbOffset = scrollOffset(block * 2);
    for (const x of [left - kerb, left + width]) {
      g.fillStyle = '#f4f6f8';
      g.fillRect(x, 0, kerb, sh);
      g.fillStyle = '#e8222e';
      for (let y = kerbOffset - block * 2; y < sh; y += block * 2) g.fillRect(x, y, kerb, block);
      g.fillStyle = 'rgba(0,0,0,.14)';
      g.fillRect(x + kerb * 0.62, 0, kerb * 0.38, sh);
    }

    const tarmac = g.createLinearGradient(left, 0, left + width, 0);
    tarmac.addColorStop(0, '#32353c');
    tarmac.addColorStop(0.14, '#4a4d56');
    tarmac.addColorStop(0.5, '#565a64');
    tarmac.addColorStop(0.86, '#4a4d56');
    tarmac.addColorStop(1, '#32353c');
    g.fillStyle = tarmac;
    g.fillRect(left, 0, width, sh);

    // Grain and old tyre lines keep the surface from reading as flat paint.
    g.fillStyle = 'rgba(255,255,255,.035)';
    const grain = 24;
    const grainOffset = scrollOffset(grain);
    for (let y = grainOffset - grain; y < sh; y += grain) g.fillRect(left, y, width, 2);
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let lane = 0; lane < 3; lane++) {
      for (const side of [-0.17, 0.17]) g.fillRect(laneX(lane) + laneWidth() * side - 3, 0, 6, sh);
    }

    g.fillStyle = 'rgba(255,255,255,.92)';
    g.fillRect(left + 4, 0, 3, sh);
    g.fillRect(left + width - 7, 0, 3, sh);
    const dash = 62;
    const dashOffset = scrollOffset(dash);
    for (const lane of [1, 2]) {
      const x = left + laneWidth() * lane - 2.5;
      for (let y = dashOffset - dash; y < sh; y += dash) {
        g.beginPath();
        g.roundRect(x, y, 5, 34, 2);
        g.fill();
      }
    }
  }

  /** A row of roadside things, chosen from a hash of distance so the world stays put. */
  function drawRow(set: typeof far, gap: number, inner: number, outer: number) {
    const first = Math.floor(race.distance / gap) * gap - gap * 4;
    const reach = race.distance + (sh + 200) / WORLD_SCALE;
    for (let at = first; at < reach; at += gap) {
      const n = Math.round(at / gap);
      for (const side of [-1, 1]) {
        const hash = Math.abs((n * 2654435761 + side * 40503) % 104729);
        const { art, size } = set[hash % set.length];
        const wide = sh * size;
        const tall = (art.height / art.width) * wide;
        const x = w / 2 + side * (inner + (hash % 97) / 97 * Math.max(0, outer - inner) + wide / 2);
        g.drawImage(art, x - wide / 2, screenY(at + (hash % 53)) - tall / 2, wide, tall);
      }
    }
  }

  function drawProps() {
    const edge = roadWidth() / 2 + Math.max(6, roadWidth() * 0.03) + Math.max(16, roadWidth() * 0.09);
    const nearEnd = edge + sh * 0.1;
    drawRow(near, NEAR_GAP, edge + 8, nearEnd);
    if (w / 2 - nearEnd > sh * 0.1) drawRow(far, FAR_GAP, nearEnd + sh * 0.1, w / 2 - sh * 0.16);

    const lampSize = sh * 0.06;
    const spacing = 420;
    const first = Math.floor(race.distance / spacing) * spacing - spacing * 2;
    for (let at = first; at < race.distance + (sh + 200) / WORLD_SCALE; at += spacing) {
      for (const side of [-1, 1]) {
        g.drawImage(street, w / 2 + side * (edge - roadWidth() * 0.045) - lampSize / 2, screenY(at) - lampSize / 2, lampSize, lampSize);
      }
    }
  }

  function drawStar(x: number, y: number, r: number, turn: number) {
    g.save();
    g.translate(x + 3, y + 4);
    g.rotate(turn);
    g.fillStyle = 'rgba(0,0,0,.3)';
    star(r);
    g.fill();
    g.restore();
    g.save();
    g.translate(x, y);
    g.rotate(turn);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const b = ((i + 1) * Math.PI) / 5 - Math.PI / 2;
      const [da, db] = i % 2 ? [r * 0.5, r] : [r, r * 0.5];
      const lit = (Math.sin((i + 0.5) * 0.628 + 2.2 - turn) + 1) / 2;
      g.fillStyle = `hsl(${42 + lit * 12} 100% ${44 + lit * 32}%)`;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * da, Math.sin(a) * da);
      g.lineTo(Math.cos(b) * db, Math.sin(b) * db);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  function star(r: number) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const d = i % 2 ? r * 0.5 : r;
      g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    g.closePath();
  }

  /** A traffic cone from above: a square foot and rings closing in on the tip. */
  function drawCone(x: number, y: number, r: number) {
    g.fillStyle = 'rgba(0,0,0,.34)';
    g.beginPath();
    g.roundRect(x - r + 3, y - r + 5, r * 2, r * 2, r * 0.24);
    g.fill();
    g.fillStyle = '#c2410c';
    g.beginPath();
    g.roundRect(x - r, y - r, r * 2, r * 2, r * 0.24);
    g.fill();
    g.fillStyle = '#ff8a2f';
    g.beginPath();
    g.roundRect(x - r * 0.92, y - r * 0.92, r * 1.74, r * 1.74, r * 0.2);
    g.fill();
    for (const [size, colour] of [[0.72, '#e8590c'], [0.5, '#ffffff'], [0.32, '#ff7a1a'], [0.14, '#ffc48a']] as const) {
      const ring = g.createRadialGradient(x - r * size * 0.3, y - r * size * 0.3, 1, x, y, r * size);
      ring.addColorStop(0, colour);
      ring.addColorStop(1, colour === '#ffffff' ? '#cfd4db' : '#b4380a');
      g.fillStyle = ring;
      g.beginPath();
      g.arc(x, y, r * size, 0, 7);
      g.fill();
    }
  }

  function drawFinish() {
    if (race.finishX === Infinity) return;
    const y = screenY(race.finishX);
    if (y < -40 || y > sh + 40) return;
    const cell = roadWidth() / 14;
    for (let i = 0; i < 14; i++) {
      for (let row = 0; row < 3; row++) {
        g.fillStyle = (i + row) % 2 ? '#111' : '#fff';
        g.fillRect(roadLeft() + i * cell, y + row * cell * 0.7, cell + 1, cell * 0.7);
      }
    }
  }

  function drawCar() {
    const tall = sh * 0.2;
    const wide = tall * (150 / 280);
    const lean = (aim.lane - shownLane) * 0.34;
    g.save();
    g.translate(roadLeft() + laneWidth() * (shownLane + 0.5) + Math.sin(wobble * 30) * wobble * 8, shownRow);
    g.rotate(lean + Math.sin(wobble * 26) * wobble * 0.14);
    g.drawImage(carFor(saved.car), -wide / 2, -tall / 2, wide, tall);
    g.restore();
  }

  function burst(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.3;
      const speed = 90 + Math.random() * 220;
      sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.3 + Math.random() * 0.4 });
    }
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (w) {
      race.tick(dt);
      for (const event of race.events.splice(0)) {
        if (event === 'star') {
          note(PENTATONIC[race.stars % PENTATONIC.length], 0.3);
          score.textContent = `⭐ ${race.total}`;
          burst(laneX(shownLane), shownRow - sh * 0.06);
        } else if (event === 'cone') {
          wobble = 1;
          note(55, 0.14, 0, 0.2);
        } else {
          celebrate();
          cheer();
        }
      }
      const pitch = 92 + race.speed * 0.14;
      motor.frequency.setTargetAtTime(pitch, audio.currentTime, 0.25);
      rumble.frequency.setTargetAtTime(pitch * 1.5, audio.currentTime, 0.25);

      wobble = Math.max(0, wobble - dt * 1.7);
      if (!aim.row) setAim(1, restRow());
      if (!shownRow) shownRow = restRow();
      const glide = Math.min(1, dt * 17);
      shownLane += (aim.lane - shownLane) * glide;
      shownRow += (aim.row - shownRow) * glide;
      race.lane = shownLane;
      race.forward = (restRow() - shownRow) / WORLD_SCALE;

      drawGround();
      drawFinish();
      drawProps();
      for (const item of race.items) {
        if (item.gone) continue;
        const y = screenY(item.x);
        if (y < -60 || y > sh + 60) continue;
        if (item.kind === 'star') drawStar(laneX(item.lane), y, sh * 0.05, now / 500);
        else drawCone(laneX(item.lane), y, sh * 0.04);
      }
      drawCar();

      sparks = sparks.filter((s) => (s.life -= dt) > 0);
      g.fillStyle = '#ffe066';
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        g.globalAlpha = Math.min(1, s.life * 3);
        g.beginPath();
        g.arc(s.x, s.y, 3, 0, 7);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('keydown', keydown);
    motor.stop();
    rumble.stop();
    hum.disconnect();
    game.close();
  };
}
