/** Planes painted once in high resolution, then scaled to fit the screen. */
type Paint = { top: string; body: string; under: string; stripe: string; glass: string };

export const HERO: Paint = { top: '#d7e6f5', body: '#6d9ec9', under: '#2c4c6d', stripe: '#ff8a1f', glass: '#7fd8ff' };
export const FOES: Paint[] = [
  { top: '#ffb3a6', body: '#d8362f', under: '#6b0f0f', stripe: '#ffe066', glass: '#ffd9a0' },
  { top: '#d9f0a8', body: '#6a8f2c', under: '#2d4310', stripe: '#ffffff', glass: '#ffd9a0' },
  { top: '#d8c6ff', body: '#6a3fc4', under: '#2a1466', stripe: '#ffd21f', glass: '#ff9ec2' },
];

function canvas(w: number, h: number, flip: boolean, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (flip) {
    g.translate(w, 0);
    g.scale(-1, 1);
  }
  paint(g);
  return c;
}

/** A jet side-on, nose to the right, in a 320 x 170 box. */
export function jet(p: Paint, flip: boolean) {
  return canvas(320, 170, flip, (g) => {
    const skin = (y0: number, y1: number) => {
      const s = g.createLinearGradient(0, y0, 0, y1);
      s.addColorStop(0, p.top);
      s.addColorStop(0.45, p.body);
      s.addColorStop(1, p.under);
      return s;
    };
    // Far wing, tucked behind the body and in shade.
    g.fillStyle = p.under;
    g.beginPath();
    g.moveTo(170, 76);
    g.lineTo(96, 18);
    g.lineTo(70, 18);
    g.lineTo(110, 78);
    g.fill();

    // Tail fin.
    g.fillStyle = skin(14, 80);
    g.beginPath();
    g.moveTo(34, 78);
    g.lineTo(6, 16);
    g.lineTo(38, 16);
    g.lineTo(92, 76);
    g.fill();
    g.fillStyle = p.stripe;
    g.beginPath();
    g.moveTo(22, 50);
    g.lineTo(13, 30);
    g.lineTo(46, 30);
    g.lineTo(62, 50);
    g.fill();

    // Fuselage.
    g.fillStyle = skin(64, 116);
    g.beginPath();
    g.moveTo(16, 80);
    g.lineTo(190, 64);
    g.quadraticCurveTo(270, 68, 316, 90);
    g.quadraticCurveTo(262, 112, 180, 116);
    g.lineTo(26, 106);
    g.closePath();
    g.fill();

    // Nose cone and engine intake.
    g.fillStyle = '#20252e';
    g.beginPath();
    g.moveTo(272, 76);
    g.quadraticCurveTo(300, 82, 316, 90);
    g.quadraticCurveTo(298, 98, 272, 104);
    g.quadraticCurveTo(280, 90, 272, 76);
    g.fill();
    g.fillStyle = '#20252e';
    g.beginPath();
    g.roundRect(150, 96, 52, 15, 6);
    g.fill();

    g.fillStyle = p.stripe;
    g.fillRect(70, 86, 86, 7);

    // Canopy, with a highlight running along the glass.
    const glass = g.createLinearGradient(0, 50, 0, 80);
    glass.addColorStop(0, '#ffffff');
    glass.addColorStop(0.4, p.glass);
    glass.addColorStop(1, '#17324d');
    g.fillStyle = glass;
    g.beginPath();
    g.moveTo(176, 68);
    g.quadraticCurveTo(206, 42, 250, 72);
    g.closePath();
    g.fill();

    // Near wing, the closest thing to us, so it is drawn last and lit strongly.
    g.fillStyle = skin(92, 162);
    g.beginPath();
    g.moveTo(176, 96);
    g.lineTo(82, 162);
    g.lineTo(116, 162);
    g.lineTo(222, 104);
    g.closePath();
    g.fill();
    g.fillStyle = p.stripe;
    g.beginPath();
    g.moveTo(98, 150);
    g.lineTo(84, 160);
    g.lineTo(114, 160);
    g.lineTo(130, 150);
    g.fill();
    g.fillStyle = '#c9ced6';
    g.beginPath();
    g.roundRect(120, 120, 62, 9, 4);
    g.fill();
  });
}

/** The boss, a huge armoured bomber, nose to the left, in a 640 x 340 box. */
export function bomber() {
  return canvas(640, 340, true, (g) => {
    const skin = (y0: number, y1: number) => {
      const s = g.createLinearGradient(0, y0, 0, y1);
      s.addColorStop(0, '#c8ccd6');
      s.addColorStop(0.4, '#6d7382');
      s.addColorStop(1, '#23262f');
      return s;
    };
    g.fillStyle = '#23262f';
    g.beginPath();
    g.moveTo(350, 150);
    g.lineTo(220, 18);
    g.lineTo(170, 18);
    g.lineTo(230, 150);
    g.fill();

    g.fillStyle = skin(28, 160);
    g.beginPath();
    g.moveTo(60, 160);
    g.lineTo(16, 28);
    g.lineTo(82, 28);
    g.lineTo(190, 150);
    g.fill();
    g.fillStyle = '#e8222e';
    g.beginPath();
    g.moveTo(48, 100);
    g.lineTo(32, 56);
    g.lineTo(98, 56);
    g.lineTo(134, 100);
    g.fill();

    g.fillStyle = skin(124, 232);
    g.beginPath();
    g.moveTo(30, 170);
    g.lineTo(380, 122);
    g.quadraticCurveTo(560, 128, 634, 178);
    g.quadraticCurveTo(540, 234, 370, 236);
    g.lineTo(50, 216);
    g.closePath();
    g.fill();

    g.fillStyle = '#e8222e';
    g.fillRect(90, 172, 370, 12);
    g.fillStyle = '#ffd21f';
    for (let x = 110; x < 440; x += 44) {
      g.beginPath();
      g.arc(x, 204, 9, 0, 7);
      g.fill();
    }

    const glass = g.createLinearGradient(0, 110, 0, 160);
    glass.addColorStop(0, '#fff');
    glass.addColorStop(0.4, '#ff8a6b');
    glass.addColorStop(1, '#5a0d0d');
    g.fillStyle = glass;
    g.beginPath();
    g.moveTo(420, 134);
    g.quadraticCurveTo(486, 92, 556, 148);
    g.closePath();
    g.fill();

    g.fillStyle = '#2b2e38';
    g.beginPath();
    g.moveTo(574, 150);
    g.quadraticCurveTo(610, 162, 634, 178);
    g.quadraticCurveTo(606, 196, 574, 208);
    g.quadraticCurveTo(590, 178, 574, 150);
    g.fill();

    g.fillStyle = skin(196, 330);
    g.beginPath();
    g.moveTo(350, 200);
    g.lineTo(170, 330);
    g.lineTo(240, 330);
    g.lineTo(440, 212);
    g.closePath();
    g.fill();
    for (const [x, y] of [[250, 264], [318, 226]]) {
      const engine = g.createLinearGradient(0, y - 18, 0, y + 18);
      engine.addColorStop(0, '#d3d7df');
      engine.addColorStop(0.5, '#5c6170');
      engine.addColorStop(1, '#1b1d24');
      g.fillStyle = engine;
      g.beginPath();
      g.roundRect(x - 60, y - 18, 110, 36, 16);
      g.fill();
      g.fillStyle = '#ffb347';
      g.beginPath();
      g.arc(x + 48, y, 11, 0, 7);
      g.fill();
    }
  });
}
