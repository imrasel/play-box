/** Fruit is painted once per size and kind, so rich shading stays cheap in play. */
export type FruitKind = {
  name: string; light: string; rind: string; dark: string;
  pith: string; flesh: string; core: string; seed?: string;
};

export const KINDS: FruitKind[] = [
  { name: 'melon', light: '#7fd36b', rind: '#2f9140', dark: '#0f4d20', pith: '#e9f5c9', flesh: '#f7314a', core: '#ff7a84', seed: '#231410' },
  { name: 'orange', light: '#ffc35a', rind: '#ff8c10', dark: '#b84c00', pith: '#fff1d6', flesh: '#ff9d1e', core: '#ffd27a' },
  { name: 'apple', light: '#ff7a6b', rind: '#d81b26', dark: '#6d0710', pith: '#fff8e0', flesh: '#fff3c8', core: '#fffbe6', seed: '#4a2a0e' },
  { name: 'kiwi', light: '#b08a5c', rind: '#7f5a31', dark: '#3a2510', pith: '#d9eea3', flesh: '#6fbf33', core: '#f1f9d6', seed: '#17140c' },
  { name: 'lemon', light: '#fff27a', rind: '#ffd21f', dark: '#c79200', pith: '#fffbe2', flesh: '#ffe95c', core: '#fff9c2' },
];

type G = CanvasRenderingContext2D;
export const SPRITE_PAD = 1.5; // room around a fruit for stems and leaves

function sheet(r: number, paint: (g: G) => void) {
  const scale = Math.min(2, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(r * SPRITE_PAD * 2 * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.translate(r * SPRITE_PAD, r * SPRITE_PAD);
  paint(g);
  return c;
}

function outline(g: G, k: FruitKind, r: number) {
  g.beginPath();
  if (k.name === 'apple') {
    g.moveTo(0, -r * 0.72);
    g.bezierCurveTo(r * 0.5, -r * 1.12, r * 1.16, -r * 0.72, r * 1.02, r * 0.02);
    g.bezierCurveTo(r * 0.94, r * 0.66, r * 0.42, r * 1.1, r * 0.1, r * 0.92);
    g.quadraticCurveTo(0, r * 0.86, -r * 0.1, r * 0.92);
    g.bezierCurveTo(-r * 0.42, r * 1.1, -r * 0.94, r * 0.66, -r * 1.02, r * 0.02);
    g.bezierCurveTo(-r * 1.16, -r * 0.72, -r * 0.5, -r * 1.12, 0, -r * 0.72);
  } else if (k.name === 'lemon') {
    g.moveTo(-r * 1.16, 0);
    g.bezierCurveTo(-r * 1.02, -r * 0.1, -r * 0.8, -r * 0.84, 0, -r * 0.84);
    g.bezierCurveTo(r * 0.8, -r * 0.84, r * 1.02, -r * 0.1, r * 1.16, 0);
    g.bezierCurveTo(r * 1.02, r * 0.1, r * 0.8, r * 0.84, 0, r * 0.84);
    g.bezierCurveTo(-r * 0.8, r * 0.84, -r * 1.02, r * 0.1, -r * 1.16, 0);
  } else if (k.name === 'melon') {
    g.ellipse(0, 0, r * 1.12, r * 0.92, 0, 0, 7);
  } else if (k.name === 'kiwi') {
    g.ellipse(0, 0, r, r * 0.86, 0, 0, 7);
  } else {
    g.arc(0, 0, r, 0, 7);
  }
  g.closePath();
}

function skinTexture(g: G, k: FruitKind, r: number) {
  // A fixed pattern, so every fruit of a kind is consistent and the sprite is stable.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  if (k.name === 'melon') {
    g.strokeStyle = k.dark;
    for (const bend of [-1.05, -0.62, -0.2, 0.2, 0.62, 1.05]) {
      g.lineWidth = r * 0.13;
      g.beginPath();
      for (let t = -1; t <= 1.01; t += 0.1) {
        const wave = Math.sin(t * 13 + bend * 9) * r * 0.05;
        const x = bend * r * Math.sqrt(1 - t * t) + wave;
        const y = t * r;
        if (t === -1) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (k.name === 'orange' || k.name === 'lemon') {
    g.fillStyle = `${k.dark}55`;
    for (let i = 0; i < 300; i++) {
      const a = rnd() * 7;
      const d = Math.sqrt(rnd()) * r * 1.05;
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.012, 0, 7);
      g.fill();
    }
  } else if (k.name === 'apple') {
    g.lineWidth = r * 0.03;
    for (let i = 0; i < 26; i++) {
      const x = -r + rnd() * r * 2;
      g.strokeStyle = rnd() > 0.5 ? 'rgba(255,210,110,.26)' : 'rgba(120,0,10,.22)';
      g.beginPath();
      g.moveTo(x * 0.5, -r * 0.8);
      g.quadraticCurveTo(x * 1.3, 0, x * 0.6, r * 0.9);
      g.stroke();
    }
  } else {
    g.strokeStyle = 'rgba(50,30,12,.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 300; i++) {
      const a = rnd() * 7;
      const d = Math.sqrt(rnd()) * r;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d * 0.86;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 5, y + 3 + rnd() * 3);
      g.stroke();
    }
  }
}

export function wholeFruit(k: FruitKind, r: number) {
  return sheet(r, (g) => {
    g.save();
    outline(g, k, r);
    g.clip();

    const base = g.createRadialGradient(-r * 0.32, -r * 0.4, r * 0.05, 0, 0, r * 1.2);
    base.addColorStop(0, k.light);
    base.addColorStop(0.5, k.rind);
    base.addColorStop(1, k.rind);
    g.fillStyle = base;
    g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
    skinTexture(g, k, r);

    // The curve of the form: light falls away towards the far edge.
    const form = g.createRadialGradient(-r * 0.34, -r * 0.42, r * 0.3, -r * 0.1, -r * 0.1, r * 1.32);
    form.addColorStop(0, 'rgba(0,0,0,0)');
    form.addColorStop(0.62, 'rgba(0,0,0,.05)');
    form.addColorStop(1, 'rgba(0,0,0,.62)');
    g.fillStyle = form;
    g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);

    // Light bouncing back up from below stops the shadow side going dead.
    const bounce = g.createRadialGradient(r * 0.5, r * 0.72, 1, r * 0.5, r * 0.72, r * 0.7);
    bounce.addColorStop(0, `${k.light}66`);
    bounce.addColorStop(1, `${k.light}00`);
    g.fillStyle = bounce;
    g.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);

    if (k.name === 'orange') {
      g.fillStyle = 'rgba(120,50,0,.7)';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.28;
        g.beginPath();
        g.ellipse(r * 0.34 + Math.cos(a) * r * 0.05, r * 0.3 + Math.sin(a) * r * 0.05, r * 0.05, r * 0.016, a, 0, 7);
        g.fill();
      }
    }
    if (k.name === 'apple') {
      const dip = g.createRadialGradient(0, -r * 0.74, 1, 0, -r * 0.7, r * 0.42);
      dip.addColorStop(0, 'rgba(60,0,5,.8)');
      dip.addColorStop(1, 'rgba(60,0,5,0)');
      g.fillStyle = dip;
      g.fillRect(-r, -r * 1.1, r * 2, r);
    }

    g.fillStyle = 'rgba(255,255,255,.34)';
    g.beginPath();
    g.ellipse(-r * 0.4, -r * 0.42, r * 0.34, r * 0.2, -0.75, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath();
    g.ellipse(-r * 0.44, -r * 0.46, r * 0.12, r * 0.06, -0.75, 0, 7);
    g.fill();
    g.restore();

    if (k.name === 'apple') {
      g.strokeStyle = '#4a2a0e';
      g.lineCap = 'round';
      g.lineWidth = r * 0.09;
      g.beginPath();
      g.moveTo(0, -r * 0.66);
      g.quadraticCurveTo(r * 0.02, -r * 1, r * 0.14, -r * 1.2);
      g.stroke();
      const leaf = g.createLinearGradient(r * 0.1, -r * 1.2, r * 0.66, -r * 0.9);
      leaf.addColorStop(0, '#7ed957');
      leaf.addColorStop(1, '#2f8f3a');
      g.fillStyle = leaf;
      g.beginPath();
      g.moveTo(r * 0.1, -r * 0.94);
      g.quadraticCurveTo(r * 0.36, -r * 1.34, r * 0.72, -r * 1.12);
      g.quadraticCurveTo(r * 0.44, -r * 0.84, r * 0.1, -r * 0.94);
      g.fill();
    }
  });
}

/** The cut face, seen flat on. It is drawn foreshortened on a half. */
export function cutFace(k: FruitKind, r: number) {
  return sheet(r, (g) => {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    g.fillStyle = k.rind;
    g.beginPath();
    g.arc(0, 0, r, 0, 7);
    g.fill();
    g.fillStyle = k.pith;
    g.beginPath();
    g.arc(0, 0, r * 0.93, 0, 7);
    g.fill();
    const flesh = g.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.86);
    flesh.addColorStop(0, k.core);
    flesh.addColorStop(0.55, k.flesh);
    flesh.addColorStop(1, k.flesh);
    g.fillStyle = flesh;
    g.beginPath();
    g.arc(0, 0, r * 0.86, 0, 7);
    g.fill();

    if (k.name === 'orange' || k.name === 'lemon') {
      g.strokeStyle = k.pith;
      g.lineWidth = r * 0.045;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.283;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.08, Math.sin(a) * r * 0.08);
        g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.34)';
      g.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const a = rnd() * 6.283;
        const d = r * (0.2 + rnd() * 0.6);
        g.beginPath();
        g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
        g.lineTo(Math.cos(a) * (d + r * 0.1), Math.sin(a) * (d + r * 0.1));
        g.stroke();
      }
    }
    if (k.name === 'melon') {
      g.fillStyle = 'rgba(255,255,255,.1)';
      for (let i = 0; i < 70; i++) {
        const a = rnd() * 6.283;
        const d = Math.sqrt(rnd()) * r * 0.82;
        g.beginPath();
        g.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.03, 0, 7);
        g.fill();
      }
    }
    if (k.seed) {
      const ring = k.name === 'kiwi' ? 18 : k.name === 'apple' ? 5 : 9;
      const at = k.name === 'kiwi' ? 0.36 : k.name === 'apple' ? 0.17 : 0.52;
      const size = k.name === 'kiwi' ? 0.045 : 0.085;
      g.fillStyle = k.seed;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * 6.283;
        g.save();
        g.translate(Math.cos(a) * r * at, Math.sin(a) * r * at);
        g.rotate(a);
        g.beginPath();
        g.ellipse(0, 0, r * size, r * size * 0.55, 0, 0, 7);
        g.fill();
        g.restore();
      }
    }
    const wet = g.createRadialGradient(-r * 0.3, -r * 0.3, 1, -r * 0.3, -r * 0.3, r * 0.7);
    wet.addColorStop(0, 'rgba(255,255,255,.38)');
    wet.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wet;
    g.beginPath();
    g.arc(0, 0, r * 0.86, 0, 7);
    g.fill();
  });
}
