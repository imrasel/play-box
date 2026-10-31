import { h } from '../core/dom';
import { localPoint } from '../core/rotate';
import { FOES, HERO, bomber, jet } from './air-art';
import { AirGame, MAX_POWER } from './air-logic';
import { PENTATONIC, gameScreen } from './play';

type Blast = { x: number; y: number; life: number; size: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string };

const AHEAD_OF_FINGER = 70; // the plane sits right of the finger, so it stays visible

export function mountAir(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'air');
  const { stage, note, boom, cheer, celebrate } = game;
  const canvas = h('canvas', { class: 'race-road' }) as HTMLCanvasElement;
  const score = h('div', { class: 'game-score-big race-score' }, '⭐ 0');
  const guns = h('div', { class: 'air-guns' });
  const bossBar = h('div', { class: 'air-boss', hidden: true }, h('i', {}));
  stage.append(canvas, score, guns, bossBar);
  const g = canvas.getContext('2d', { alpha: false })!;

  const hero = jet(HERO, false);
  const foes = FOES.map((p) => jet(p, true));
  const boss = bomber();

  let air: AirGame | null = null;
  let w = 0;
  let sh = 0;
  let scroll = 0;
  let raf = 0;
  let last = performance.now();
  let blasts: Blast[] = [];
  let sparks: Spark[] = [];
  let shake = 0;
  let shown = -1;

  const measure = () => {
    w = canvas.clientWidth;
    sh = canvas.clientHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(sh * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (w && !air) air = new AirGame(w, sh);
    air?.resize(w, sh);
  };
  const resize = new ResizeObserver(measure);
  resize.observe(canvas);

  const steer = (e: PointerEvent) => {
    if (!air) return;
    const p = localPoint(e, canvas);
    air.target.x = Math.max(air.size, Math.min(w * 0.7, p.x + AHEAD_OF_FINGER));
    air.target.y = Math.max(air.size * 0.7, Math.min(sh - air.size * 0.7, p.y));
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    steer(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') steer(e); });

  function blast(x: number, y: number, size: number) {
    blasts.push({ x, y, life: 1, size });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.3;
      const speed = 60 + Math.random() * 240;
      sparks.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.4 + Math.random() * 0.4, color: i % 3 ? '#ffb347' : '#ffe066' });
    }
  }

  function drawBackdrop() {
    const sky = g.createLinearGradient(0, 0, 0, sh);
    sky.addColorStop(0, '#1f7fe0');
    sky.addColorStop(0.62, '#a9e2ff');
    sky.addColorStop(0.66, '#e9f8ff');
    sky.addColorStop(0.67, '#2b9fd6');
    sky.addColorStop(1, '#0d5f96');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, sh);

    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 26; i++) { // glints on the sea, faster the nearer they are
      const row = (i % 7) / 7;
      const y = sh * (0.68 + row * 0.3);
      const speed = 60 + row * 200;
      const x = (w + 60 - ((i * 137 + (scroll * speed) / 100) % (w + 60)));
      g.fillRect(x, y, 16 + row * 26, 2);
    }

    for (const [speed, size, alpha, y] of [[14, 0.7, 0.62, 0.14], [26, 1, 0.8, 0.34], [42, 1.3, 0.9, 0.5]] as const) {
      const span = w + 260;
      for (let i = 0; i < 3; i++) {
        const x = span - ((i * span) / 3 + (scroll * speed) / 100) % span - 130;
        const cy = sh * (y + (i % 2) * 0.06);
        for (const [dx, dy, r] of [[0, 0, 26], [32, -11, 34], [70, 0, 24], [-26, 6, 18]]) {
          const puff = g.createRadialGradient(x + dx * size - r * 0.3, cy + dy * size - r * 0.4, 2, x + dx * size, cy + dy * size, r * size);
          puff.addColorStop(0, `rgba(255,255,255,${alpha})`);
          puff.addColorStop(1, 'rgba(205,228,245,.7)');
          g.fillStyle = puff;
          g.beginPath();
          g.arc(x + dx * size, cy + dy * size, r * size, 0, 7);
          g.fill();
        }
      }
    }
  }

  function sprite(image: HTMLCanvasElement, x: number, y: number, wide: number) {
    const tall = (image.height / image.width) * wide;
    g.drawImage(image, x - wide / 2, y - tall / 2, wide, tall);
  }

  function drawPickup(x: number, y: number, r: number, now: number) {
    const glow = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
    glow.addColorStop(0, 'rgba(255,240,140,.8)');
    glow.addColorStop(1, 'rgba(255,240,140,0)');
    g.fillStyle = glow;
    g.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    const orb = g.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
    orb.addColorStop(0, '#fff');
    orb.addColorStop(0.5, '#ffd21f');
    orb.addColorStop(1, '#e8590c');
    g.fillStyle = orb;
    g.beginPath();
    g.arc(x, y + Math.sin(now / 160) * 2, r, 0, 7);
    g.fill();
    g.fillStyle = '#7a2a00';
    g.font = `800 ${r * 1.15}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('P', x, y + Math.sin(now / 160) * 2 + 1);
    g.textBaseline = 'alphabetic';
  }

  function draw(a: AirGame, now: number) {
    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake * 12, (Math.random() - 0.5) * shake * 12);
    drawBackdrop();

    for (const p of a.pickups) drawPickup(p.x, p.y, a.size * 0.5, now);
    if (a.boss) sprite(boss, a.boss.x, a.boss.y, a.size * 6.4);
    for (const e of a.enemies) sprite(foes[e.kind], e.x, e.y, a.size * (2 + e.kind * 0.3));

    g.lineCap = 'round';
    for (const b of a.bullets) {
      g.strokeStyle = 'rgba(255,190,70,.5)';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.strokeStyle = '#fffbe0';
      g.lineWidth = 4;
      g.stroke();
    }
    for (const s of a.shots) {
      const r = a.size * 0.26;
      const ball = g.createRadialGradient(s.x - 2, s.y - 2, 1, s.x, s.y, r);
      ball.addColorStop(0, '#fff');
      ball.addColorStop(0.5, '#ff5ab0');
      ball.addColorStop(1, '#a3006b');
      g.fillStyle = ball;
      g.beginPath();
      g.arc(s.x, s.y, r, 0, 7);
      g.fill();
    }

    const size = a.size * 2.3;
    const flame = 14 + Math.sin(now / 24) * 5;
    const fire = g.createLinearGradient(a.plane.x - size / 2 - flame * 2, 0, a.plane.x - size / 2 + 8, 0);
    fire.addColorStop(0, 'rgba(255,120,30,0)');
    fire.addColorStop(1, '#fff2a8');
    g.fillStyle = fire;
    g.beginPath();
    g.ellipse(a.plane.x - size / 2 - flame / 2, a.plane.y + a.size * 0.08, flame * 1.3, a.size * 0.13, 0, 0, 7);
    g.fill();
    if (a.shield <= 0 || Math.floor(now / 90) % 2) sprite(hero, a.plane.x, a.plane.y, size);
    if (a.shield > 0) {
      g.strokeStyle = 'rgba(120,220,255,.7)';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(a.plane.x, a.plane.y, a.size * 1.35, 0, 7);
      g.stroke();
    }

    for (const b of blasts) {
      const r = b.size * (1.25 - b.life);
      const ball = g.createRadialGradient(b.x, b.y, 1, b.x, b.y, r);
      ball.addColorStop(0, `rgba(255,255,230,${b.life})`);
      ball.addColorStop(0.4, `rgba(255,170,50,${b.life})`);
      ball.addColorStop(1, 'rgba(220,40,10,0)');
      g.fillStyle = ball;
      g.beginPath();
      g.arc(b.x, b.y, r, 0, 7);
      g.fill();
    }
    for (const s of sparks) {
      g.globalAlpha = Math.min(1, s.life * 3);
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(s.x, s.y, 3, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  let firing = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (air) {
      const a = air;
      a.tick(dt);
      scroll += dt * 100;
      shake = Math.max(0, shake - dt * 2.4);
      firing += dt;
      if (firing > 0.42) {
        firing = 0;
        note(88, 0.06, 0, 0.03); // barely there: a constant gun must not grate
      }
      for (const event of a.events.splice(0)) {
        if (event === 'kill') {
          boom(0.3);
        } else if (event === 'pickup') {
          [76, 79, 84].forEach((m, i) => note(m, 0.2, i * 0.07, 0.28));
        } else if (event === 'hit') {
          shake = 0.8;
          note(45, 0.3, 0, 0.3);
        } else if (event === 'boss') {
          [48, 48, 55].forEach((m, i) => note(m, 0.3, i * 0.3, 0.4));
        } else if (event === 'bossHit') {
          if (Math.random() < 0.2) note(PENTATONIC[0] + 12, 0.04, 0, 0.08);
        } else if (event === 'bossDown') {
          shake = 1.4;
          boom(1);
          for (let i = 0; i < 6; i++) blast(w * 0.66 + Math.random() * w * 0.2, sh * 0.3 + Math.random() * sh * 0.4, a.size * 3);
          celebrate();
          cheer();
        }
      }
      // Blasts are placed from the enemies that just vanished.
      for (const known of tracked) {
        if (!a.enemies.includes(known) && known.x > -40) blast(known.x, known.y, a.size * 2);
      }
      tracked = [...a.enemies];

      blasts = blasts.filter((b) => (b.life -= dt * 2.4) > 0);
      sparks = sparks.filter((s) => (s.life -= dt) > 0);
      for (const s of sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      draw(a, now);

      score.textContent = `⭐ ${a.score}`;
      if (a.power !== shown) {
        shown = a.power;
        stage.dataset.power = String(shown);
        guns.textContent = '🔥'.repeat(shown) + '·'.repeat(MAX_POWER - shown);
      }
      bossBar.hidden = !a.boss;
      if (a.boss) (bossBar.firstChild as HTMLElement).style.width = `${(a.boss.hp / a.boss.maxHp) * 100}%`;
    }
    raf = requestAnimationFrame(frame);
  };
  let tracked: AirGame['enemies'] = [];
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    resize.disconnect();
    game.close();
  };
}
