/** Everything in Racing is seen from directly above, lit from the top-left. */
export type Paint = { id: string; body: string; dark: string; light: string };

function sheet(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  return c;
}

function softShadow(g: CanvasRenderingContext2D, x: number, y: number, r: number, alpha = 0.42) {
  const s = g.createRadialGradient(x, y, r * 0.55, x, y, r);
  s.addColorStop(0, `rgba(0,25,5,${alpha})`);
  s.addColorStop(1, 'rgba(0,25,5,0)');
  g.fillStyle = s;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
}

function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, light: string, mid: string, dark: string) {
  const shade = g.createRadialGradient(x - r * 0.35, y - r * 0.38, r * 0.05, x, y, r);
  shade.addColorStop(0, light);
  shade.addColorStop(0.55, mid);
  shade.addColorStop(1, dark);
  g.fillStyle = shade;
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
}

/** A tree crown from above, built from lit clumps over a dark base. */
export function treeTop(seedValue: number) {
  return sheet(300, 300, (g) => {
    softShadow(g, 172, 178, 128);
    let seed = seedValue;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    ball(g, 140, 140, 100, '#3f9a4c', '#1f7a35', '#0c451c');
    const clumps = Array.from({ length: 24 }, () => {
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * 76;
      return { x: 140 + Math.cos(a) * d, y: 140 + Math.sin(a) * d, r: 26 + rnd() * 22 };
    });
    clumps.sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const c of clumps) {
      const lit = (c.x + c.y) < 280;
      if (lit) ball(g, c.x, c.y, c.r, '#c1f28a', '#57c257', '#1f7a35');
      else ball(g, c.x, c.y, c.r, '#7bd65c', '#2f9e44', '#14622a');
    }
  });
}

export function bushTop() {
  return sheet(170, 170, (g) => {
    softShadow(g, 96, 100, 74);
    for (const [x, y, r] of [[92, 96, 34], [58, 88, 32], [100, 58, 30], [70, 62, 32]]) {
      ball(g, x, y, r, '#b6ef82', '#46b552', '#17652c');
    }
  });
}

/** A house from above: two roof slopes meeting at a ridge, so one side catches the sun. */
export function houseTop(roof: string, shade: string) {
  return sheet(280, 240, (g) => {
    g.fillStyle = 'rgba(0,25,5,.34)';
    g.fillRect(34, 34, 236, 196);
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(12, 12);
    g.lineTo(248, 12);
    g.lineTo(218, 110);
    g.lineTo(42, 110);
    g.closePath();
    g.fill();
    g.fillStyle = shade;
    g.beginPath();
    g.moveTo(12, 208);
    g.lineTo(248, 208);
    g.lineTo(218, 110);
    g.lineTo(42, 110);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.beginPath();
    g.moveTo(12, 12);
    g.lineTo(42, 110);
    g.lineTo(12, 208);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.beginPath();
    g.moveTo(248, 12);
    g.lineTo(218, 110);
    g.lineTo(248, 208);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)';
    g.fillRect(42, 108, 176, 4);
    g.fillStyle = '#7a4a2c';
    g.fillRect(180, 40, 30, 30);
    g.fillStyle = '#3a2214';
    g.fillRect(186, 46, 18, 18);
  });
}

/** A low sports car from above, nose up, in a 150 x 280 box. */
export function carTop(paint: Paint) {
  return sheet(150, 280, (g) => {
    const shape = (grow = 0) => {
      g.beginPath();
      g.moveTo(75, 10 - grow);
      g.bezierCurveTo(100, 10, 116, 22, 122 + grow, 56);
      g.bezierCurveTo(126 + grow, 82, 118 + grow, 106, 118 + grow, 128);
      g.bezierCurveTo(118 + grow, 158, 132 + grow, 178, 130 + grow, 222);
      g.bezierCurveTo(129 + grow, 256, 106, 268 + grow, 75, 268 + grow);
      g.bezierCurveTo(44, 268 + grow, 21, 256, 20 - grow, 222);
      g.bezierCurveTo(18 - grow, 178, 32 - grow, 158, 32 - grow, 128);
      g.bezierCurveTo(32 - grow, 106, 24 - grow, 82, 28 - grow, 56);
      g.bezierCurveTo(34, 22, 50, 10, 75, 10 - grow);
      g.closePath();
    };

    g.save();
    g.translate(9, 9);
    g.fillStyle = 'rgba(0,0,0,.4)';
    shape(2);
    g.fill();
    g.restore();

    // Wide tyres just showing past the arches.
    g.fillStyle = '#0d0d11';
    for (const [x, y, height] of [[17, 58, 50], [119, 58, 50], [12, 184, 58], [124, 184, 58]]) {
      g.beginPath();
      g.roundRect(x, y, 15, height, 5);
      g.fill();
    }

    const across = g.createLinearGradient(18, 0, 132, 0);
    across.addColorStop(0, paint.dark);
    across.addColorStop(0.14, paint.body);
    across.addColorStop(0.34, paint.light);
    across.addColorStop(0.5, paint.body);
    across.addColorStop(0.84, paint.body);
    across.addColorStop(1, paint.dark);
    g.fillStyle = across;
    shape();
    g.fill();

    // Bonnet creases, sweeping towards the windscreen.
    g.strokeStyle = 'rgba(0,0,0,.2)';
    g.lineWidth = 2;
    for (const [from, to] of [[48, 56], [102, 94]]) {
      g.beginPath();
      g.moveTo(from, 22);
      g.quadraticCurveTo(from + (to - from) * 0.2, 60, to, 98);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.55)';
    for (const x of [58, 80]) {
      g.beginPath();
      g.roundRect(x, 62, 12, 22, 3);
      g.fill();
    }

    const screen = g.createLinearGradient(0, 96, 0, 136);
    screen.addColorStop(0, '#d4f0ff');
    screen.addColorStop(0.5, '#4f88ad');
    screen.addColorStop(1, '#16283a');
    g.fillStyle = screen;
    g.beginPath();
    g.moveTo(45, 136);
    g.quadraticCurveTo(38, 112, 44, 102);
    g.quadraticCurveTo(75, 88, 106, 102);
    g.quadraticCurveTo(112, 112, 105, 136);
    g.quadraticCurveTo(75, 128, 45, 136);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.42)';
    g.beginPath();
    g.moveTo(54, 128);
    g.lineTo(64, 99);
    g.lineTo(76, 97);
    g.lineTo(66, 125);
    g.fill();

    const roof = g.createLinearGradient(44, 0, 106, 0);
    roof.addColorStop(0, paint.dark);
    roof.addColorStop(0.32, paint.light);
    roof.addColorStop(0.7, paint.body);
    roof.addColorStop(1, paint.dark);
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(47, 138);
    g.quadraticCurveTo(75, 130, 103, 138);
    g.quadraticCurveTo(108, 165, 104, 184);
    g.quadraticCurveTo(75, 192, 46, 184);
    g.quadraticCurveTo(42, 165, 47, 138);
    g.fill();

    g.fillStyle = '#1a2f42';
    for (const [a, b] of [[41, 46], [109, 104]]) {
      g.beginPath();
      g.moveTo(a, 140);
      g.lineTo(b, 142);
      g.lineTo(b, 180);
      g.lineTo(a, 182);
      g.closePath();
      g.fill();
    }
    const rear = g.createLinearGradient(0, 186, 0, 216);
    rear.addColorStop(0, '#16283a');
    rear.addColorStop(1, '#6fa8c8');
    g.fillStyle = rear;
    g.beginPath();
    g.moveTo(50, 188);
    g.quadraticCurveTo(75, 194, 100, 188);
    g.lineTo(106, 214);
    g.quadraticCurveTo(75, 222, 44, 214);
    g.closePath();
    g.fill();

    // Headlights, mirrors, tail lights and a rear wing.
    g.fillStyle = '#fff7cf';
    for (const flip of [1, -1]) {
      g.save();
      g.translate(75, 0);
      g.scale(flip, 1);
      g.beginPath();
      g.moveTo(14, 15);
      g.quadraticCurveTo(34, 18, 42, 38);
      g.quadraticCurveTo(26, 30, 12, 24);
      g.closePath();
      g.fill();
      g.fillStyle = paint.dark;
      g.beginPath();
      g.ellipse(50, 112, 11, 5, 0.3, 0, 7);
      g.fill();
      g.fillStyle = '#fff7cf';
      g.restore();
    }
    g.fillStyle = paint.dark;
    g.beginPath();
    g.roundRect(26, 238, 98, 13, 5);
    g.fill();
    g.fillStyle = paint.light;
    g.fillRect(30, 239, 90, 3);
    g.fillStyle = '#ff2d2d';
    for (const x of [30, 92]) {
      g.beginPath();
      g.roundRect(x, 257, 28, 7, 3);
      g.fill();
    }
  });
}

/** A seamless patch of lawn: thousands of tiny blades, far richer than flat green. */
export function grassTile() {
  return sheet(512, 512, (g) => {
    g.fillStyle = '#58c45c';
    g.fillRect(0, 0, 512, 512);
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 30 + rnd() * 60;
      g.fillStyle = rnd() > 0.5 ? 'rgba(120,220,100,.14)' : 'rgba(30,130,60,.13)';
      for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
        g.beginPath();
        g.arc(x + ox, y + oy, r, 0, 7);
        g.fill();
      }
    }
    for (let i = 0; i < 4200; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      g.fillStyle = ['#6fd86c', '#4bb552', '#83e27a', '#3fa84a'][Math.floor(rnd() * 4)];
      g.fillRect(x, y, 1.6, 3 + rnd() * 3);
    }
  });
}

export function flowers(colors: string[]) {
  return sheet(150, 150, (g) => {
    softShadow(g, 78, 80, 66, 0.2);
    let seed = 41;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 20; i++) ball(g, 30 + rnd() * 90, 30 + rnd() * 90, 13, '#8fe07a', '#3fa84a', '#1f7a35');
    for (let i = 0; i < 26; i++) {
      const x = 28 + rnd() * 94;
      const y = 28 + rnd() * 94;
      g.fillStyle = colors[i % colors.length];
      for (let p = 0; p < 5; p++) {
        const a = p * 1.257;
        g.beginPath();
        g.arc(x + Math.cos(a) * 4.4, y + Math.sin(a) * 4.4, 3.6, 0, 7);
        g.fill();
      }
      g.fillStyle = '#ffe066';
      g.beginPath();
      g.arc(x, y, 2.4, 0, 7);
      g.fill();
    }
  });
}

export function pond() {
  return sheet(300, 220, (g) => {
    const shape = (grow: number) => {
      g.beginPath();
      g.ellipse(150, 110, 130 + grow, 88 + grow, 0.12, 0, 7);
    };
    g.fillStyle = '#d9c79a';
    shape(9);
    g.fill();
    const water = g.createRadialGradient(120, 84, 10, 150, 110, 138);
    water.addColorStop(0, '#a8ecff');
    water.addColorStop(0.55, '#3fb0e0');
    water.addColorStop(1, '#14709f');
    g.fillStyle = water;
    shape(0);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 3;
    for (const [x, y, r] of [[110, 90, 26], [190, 130, 18]]) {
      g.beginPath();
      g.ellipse(x, y, r, r * 0.42, 0, 0.3, 3.4);
      g.stroke();
    }
    for (const [x, y] of [[80, 128], [204, 76], [168, 160]]) {
      g.fillStyle = '#3fae4b';
      g.beginPath();
      g.arc(x, y, 12, 0.5, 6.2);
      g.lineTo(x, y);
      g.fill();
    }
  });
}

export function lamp() {
  return sheet(90, 90, (g) => {
    softShadow(g, 50, 52, 30, 0.34);
    ball(g, 42, 42, 20, '#ffffff', '#ffe9a0', '#c99a2e');
    ball(g, 42, 42, 8, '#ffffff', '#fff7cf', '#ffd35c');
  });
}
