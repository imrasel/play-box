import { h } from '../core/dom';
import { gameScreen } from './play';

const COLORS = ['#ff4d6d', '#ffb400', '#37c978', '#2d9cff', '#b65cff', '#ff7a2f', '#16c5c5', '#ff5fa2'];
const MOST = 6; // never so many that it feels busy
const EVERY = 8; // pops between big celebrations
const SCRAPS = 16;
// Torn rubber is never a neat shape, so each scrap picks one of these outlines.
const TEARS = [
  'polygon(0 20%, 60% 0, 100% 45%, 70% 100%, 15% 80%)',
  'polygon(10% 0, 100% 15%, 55% 55%, 90% 100%, 0 75%)',
  'polygon(0 0, 100% 30%, 80% 100%, 35% 60%)',
  'polygon(20% 0, 100% 0, 60% 100%, 0 70%)',
];

const SHAPE = 'M50 2C79 2 98 25 98 53C98 80 72 103 54 111L50 113L46 111C28 103 2 80 2 53C2 25 21 2 50 2Z';

// Shared once: the lighting is the same on every balloon, only the rubber colour differs.
const LIGHTING = `<svg class="balloon-defs" width="0" height="0" aria-hidden="true"><defs>
  <radialGradient id="bl-form" cx=".36" cy=".3" r=".78">
    <stop offset="0" stop-color="#fff" stop-opacity=".62"/>
    <stop offset=".3" stop-color="#fff" stop-opacity=".12"/>
    <stop offset=".62" stop-color="#000" stop-opacity="0"/>
    <stop offset=".92" stop-color="#000" stop-opacity=".36"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </radialGradient>
  <radialGradient id="bl-bounce" cx=".7" cy=".82" r=".42">
    <stop offset="0" stop-color="#fff" stop-opacity=".42"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bl-window" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".98"/>
    <stop offset="1" stop-color="#fff" stop-opacity=".3"/>
  </linearGradient>
</defs></svg>`;

function balloonArt(color: string) {
  return `<svg viewBox="0 0 100 125" class="balloon-art" aria-hidden="true">
    <path d="M50 118C43 138 60 150 50 172" fill="none" stroke="rgba(40,50,70,.55)" stroke-width="1.6"/>
    <path d="M43 124L50 112L57 124Q50 128 43 124Z" fill="${color}"/>
    <path d="M43 124L50 112L57 124Q50 128 43 124Z" fill="#000" fill-opacity=".28"/>
    <path d="${SHAPE}" fill="${color}"/>
    <path d="${SHAPE}" fill="url(#bl-form)"/>
    <path d="${SHAPE}" fill="url(#bl-bounce)"/>
    <path d="M23 45C22 30 31 17 45 14C38 22 33 33 33 47C33 52 24 52 23 45Z" fill="url(#bl-window)"/>
    <ellipse cx="46" cy="60" rx="3.4" ry="5" fill="#fff" fill-opacity=".62" transform="rotate(18 46 60)"/>
  </svg>`;
}

type Balloon = { el: HTMLElement; x: number; y: number; speed: number; phase: number; sway: number };

export function mountBalloons(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'balloons');
  const { stage, later, snap, celebrate } = game;
  const score = h('div', { class: 'game-score-big' }, '⭐ 0');
  stage.append(score);
  stage.insertAdjacentHTML('beforeend', LIGHTING);

  let pops = 0;
  let balloons: Balloon[] = [];
  let raf = 0;
  let last = performance.now();
  let wait = 0;

  function spawn() {
    const width = stage.clientWidth;
    const index = Math.floor(Math.random() * COLORS.length);
    const size = 92 + Math.random() * 34;
    const el = h('button', {
      class: 'balloon', 'aria-label': 'Balloon',
      style: `width:${size}px;height:${size * 1.25}px`,
    });
    el.innerHTML = balloonArt(COLORS[index]);
    const balloon: Balloon = {
      el, x: 20 + Math.random() * Math.max(0, width - size - 40), y: stage.clientHeight + 10,
      speed: 34 + Math.random() * 26, phase: Math.random() * 6, sway: 0,
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pop(balloon, index);
    });
    stage.append(el);
    balloons.push(balloon);
  }

  function burst(b: Balloon, color: string) {
    const width = b.el.offsetWidth;
    const height = b.el.offsetHeight;
    const cx = b.x + b.sway + width / 2;
    const cy = b.y + height / 2;

    const flash = h('span', { class: 'pop-flash', style: `left:${cx}px;top:${cy}px;width:${width * 1.4}px;height:${width * 1.4}px` });
    stage.append(flash);
    later(() => flash.remove(), 180);

    for (let i = 0; i < SCRAPS; i++) {
      const angle = (i / SCRAPS) * Math.PI * 2 + Math.random() * 0.5;
      const start = 0.3 + Math.random() * 0.25; // torn from the skin, not the centre
      const reach = width * (0.9 + Math.random() * 1.1);
      const size = 8 + Math.random() * 16;
      const scrap = h('span', {
        class: 'scrap',
        style: [
          `left:${cx + Math.cos(angle) * width * start}px`, `top:${cy + Math.sin(angle) * height * start}px`,
          `width:${size}px`, `height:${size * (0.6 + Math.random())}px`, `background:${color}`,
          `clip-path:${TEARS[i % TEARS.length]}`,
          `--dx:${Math.cos(angle) * reach}px`, `--dy:${Math.sin(angle) * reach}px`,
          `--fall:${50 + Math.random() * 70}px`, `--spin:${(Math.random() - 0.5) * 900}deg`,
          `animation-duration:${620 + Math.random() * 300}ms`,
        ].join(';'),
      });
      stage.append(scrap);
      later(() => scrap.remove(), 980);
    }
  }

  function pop(b: Balloon, index: number) {
    balloons = balloons.filter((x) => x !== b);
    burst(b, COLORS[index]);
    b.el.remove(); // a real balloon is simply gone, in one frame
    snap();
    pops++;
    score.textContent = `⭐ ${pops}`;
    if (pops % EVERY === 0) celebrate();
  }

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    wait -= dt;
    if (wait <= 0 && balloons.length < MOST && stage.clientWidth) {
      spawn();
      wait = 0.8 + Math.random() * 0.6;
    }
    for (const b of balloons) {
      b.y -= b.speed * dt;
      b.sway = Math.sin(now / 900 + b.phase) * 12;
      b.el.style.transform = `translate(${b.x + b.sway}px, ${b.y}px) rotate(${b.sway * 0.45}deg)`;
    }
    balloons = balloons.filter((b) => {
      if (b.y > -170) return true;
      b.el.remove(); // an escaped balloon just floats away, with no penalty
      return false;
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    game.close();
  };
}
