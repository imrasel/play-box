import type { DrumId } from './kit';

const NS = 'http://www.w3.org/2000/svg';

export function s(tag: string, attrs: Record<string, string | number> = {}, ...children: (Node | string)[]) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...children);
  return el;
}

type Spec = { id: DrumId; label: string; kind: 'drum' | 'cymbal'; x: number; y: number; r: number; hitbox?: number };

// Drawn in order, so later pieces sit in front. Coordinates are in a 1000x430 stage.
const LAYOUT: Spec[] = [
  { id: 'crash', label: 'Crash', kind: 'cymbal', x: 128, y: 88, r: 108 },
  { id: 'ride', label: 'Ride', kind: 'cymbal', x: 872, y: 92, r: 112 },
  { id: 'hat', label: 'Hi-hat', kind: 'cymbal', x: 92, y: 305, r: 88 },
  { id: 'open', label: 'Open hat', kind: 'cymbal', x: 912, y: 312, r: 82 },
  { id: 'tom1', label: 'Tom 1', kind: 'drum', x: 385, y: 92, r: 88 },
  { id: 'tom2', label: 'Tom 2', kind: 'drum', x: 615, y: 92, r: 88 },
  { id: 'snare', label: 'Snare', kind: 'drum', x: 285, y: 300, r: 104 },
  { id: 'floor', label: 'Floor tom', kind: 'drum', x: 716, y: 300, r: 112 },
];

function defs() {
  const radial = (id: string, stops: [number, string][], extra = {}) =>
    s('radialGradient', { id, ...extra }, ...stops.map(([o, c]) => s('stop', { offset: o, 'stop-color': c })));
  const linear = (id: string, stops: [number, string][]) =>
    s('linearGradient', { id, x1: 0, x2: 1, y1: 0, y2: 0 }, ...stops.map(([o, c]) => s('stop', { offset: o, 'stop-color': c })));
  return s('defs', {},
    radial('head', [[0, '#fbf8f0'], [0.7, '#ece6d8'], [1, '#c6bda9']], { cx: 0.42, cy: 0.36, r: 0.72 }),
    radial('brass', [[0, '#ffe9a6'], [0.16, '#d59f36'], [0.2, '#f6d27a'], [0.55, '#c88f2c'], [0.8, '#efc564'], [1, '#8d621a']], { cx: 0.46, cy: 0.42, r: 0.62 }),
    radial('headedge', [[0, 'rgba(70,55,35,0)'], [0.82, 'rgba(70,55,35,0)'], [1, 'rgba(70,55,35,.34)']]),
    radial('headshine', [[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]),
    radial('bell', [[0, '#fff0c0'], [0.55, '#e0ad4a'], [1, '#9a6c1d']], { cx: 0.42, cy: 0.34, r: 0.7 }),
    radial('sheen', [[0, 'rgba(255,250,220,.6)'], [0.6, 'rgba(255,250,220,.26)'], [1, 'rgba(255,250,220,0)']]),
    radial('kickhead', [[0, '#3a3a44'], [0.75, '#1a1a22'], [1, '#08080c']]),
    linear('chrome', [[0, '#62656d'], [0.22, '#f5f7fb'], [0.5, '#9ca1ab'], [0.72, '#eef1f6'], [1, '#4a4c54']]),
    s('linearGradient', { id: 'chromeV', x1: 0, x2: 0, y1: 0, y2: 1 },
      ...([[0, '#ffffff'], [0.4, '#aab0ba'], [0.62, '#f0f3f8'], [1, '#54575f']] as [number, string][]).map(([o, c]) => s('stop', { offset: o, 'stop-color': c }))),
    linear('shellshine', [[0, 'rgba(0,0,0,.62)'], [0.14, 'rgba(0,0,0,.1)'], [0.3, 'rgba(255,255,255,.42)'], [0.42, 'rgba(255,255,255,.05)'], [0.8, 'rgba(0,0,0,.28)'], [1, 'rgba(0,0,0,.72)']]),
    s('filter', { id: 'soft', x: '-30%', y: '-30%', width: '160%', height: '180%' }, s('feGaussianBlur', { stdDeviation: 9 })),
  );
}

/** Lettering pressed into the surface: a light edge below makes it read as stamped. */
function stamped(x: number, y: number, text: string, cls: string) {
  return s('g', { class: 'stamp' },
    s('text', { x, y: y + 1.2, class: `${cls} stamp-edge` }, text),
    s('text', { x, y, class: cls }, text),
  );
}

function drum({ id, label, x, y, r }: Spec) {
  const ry = r * 0.68;
  const depth = r * 0.5;
  const shell = `M${x - r} ${y}v${depth}a${r} ${ry} 0 0 0 ${r * 2} 0v${-depth}z`;
  const lugs = [-0.82, -0.42, 0, 0.42, 0.82].map((t) => {
    const top = y + ry * Math.sqrt(1 - t * t);
    return s('g', {},
      s('rect', { x: x + t * r - 3, y: top + 1, width: 6, height: depth - 2, rx: 2, fill: 'url(#chrome)' }),
      s('rect', { x: x + t * r - 7, y: top + depth * 0.32, width: 14, height: depth * 0.3, rx: 5, fill: 'url(#chrome)', stroke: 'rgba(0,0,0,.35)' }),
    );
  });
  const claws = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2 + 0.31;
    return s('circle', { cx: x + Math.cos(angle) * r * 0.965, cy: y + Math.sin(angle) * ry * 0.965, r: 3.2, fill: '#f4f6fa', stroke: 'rgba(0,0,0,.45)' });
  });
  return s('g', { class: 'piece drum', 'data-id': id },
    s('ellipse', { cx: x, cy: y + depth + ry * 0.6, rx: r * 1.06, ry: ry * 0.8, fill: 'rgba(0,0,0,.55)', filter: 'url(#soft)' }),
    s('path', { d: shell, class: 'shell' }),
    s('path', { d: shell, fill: 'url(#shellshine)' }),
    ...lugs,
    s('path', { d: `M${x - r} ${y + depth}a${r} ${ry} 0 0 0 ${r * 2} 0`, fill: 'none', stroke: 'url(#chrome)', 'stroke-width': 7 }),
    s('g', { class: 'skin' },
      s('ellipse', { cx: x, cy: y + 2, rx: r + 1, ry: ry + 1, fill: '#3a3c44' }),
      s('ellipse', { cx: x, cy: y, rx: r, ry, fill: 'url(#chromeV)' }),
      s('ellipse', { cx: x, cy: y + 1, rx: r * 0.93, ry: ry * 0.92, fill: 'url(#head)' }),
      s('ellipse', { cx: x, cy: y + 1, rx: r * 0.93, ry: ry * 0.92, fill: 'url(#headedge)' }),
      s('ellipse', { cx: x - r * 0.3, cy: y - ry * 0.42, rx: r * 0.36, ry: ry * 0.2, fill: 'url(#headshine)' }),
      ...claws,
      stamped(x, y + 7, label.toUpperCase(), 'drum-label'),
    ),
  );
}

function cymbal({ id, label, x, y, r }: Spec) {
  const ry = r * 0.46;
  const rings = [0.86, 0.74, 0.62, 0.5, 0.38, 0.27].map((t, i) =>
    s('ellipse', { cx: x, cy: y, rx: r * t, ry: ry * t, fill: 'none', stroke: i % 2 ? 'rgba(255,240,190,.3)' : 'rgba(90,55,5,.32)', 'stroke-width': 1.4 }));
  // Spun metal catches light in two opposite wedges through the centre.
  const wedge = (from: number, to: number) => {
    const point = (a: number) => `${x + Math.cos(a) * r * 0.97} ${y + Math.sin(a) * ry * 0.97}`;
    return s('path', { d: `M${x} ${y}L${point(from)}A${r * 0.97} ${ry * 0.97} 0 0 1 ${point(to)}z`, fill: 'url(#sheen)' });
  };
  return s('g', { class: 'piece cymbal', 'data-id': id },
    s('rect', { x: x - 4, y, width: 8, height: 430 - y, fill: 'url(#chrome)', class: 'stand' }),
    s('ellipse', { cx: x + 10, cy: y + 30, rx: r * 1.02, ry: ry * 0.9, fill: 'rgba(0,0,0,.48)', filter: 'url(#soft)' }),
    s('g', { class: 'skin' },
      s('ellipse', { cx: x, cy: y + 6, rx: r, ry, fill: '#5e3f0e' }),
      s('ellipse', { cx: x, cy: y + 3, rx: r, ry, fill: '#a87a26' }),
      s('ellipse', { cx: x, cy: y, rx: r, ry, fill: 'url(#brass)', stroke: '#7a5413', 'stroke-width': 1 }),
      ...rings,
      wedge(-2.65, -1.75), wedge(0.49, 1.39),
      s('ellipse', { cx: x, cy: y + 3, rx: r * 0.19, ry: ry * 0.24, fill: '#7a5413' }),
      s('ellipse', { cx: x, cy: y - 2, rx: r * 0.17, ry: ry * 0.22, fill: 'url(#bell)' }),
      s('ellipse', { cx: x, cy: y - 7, rx: 8, ry: 5, fill: '#2a2a30' }),
      s('rect', { x: x - 3, y: y - 20, width: 6, height: 15, rx: 2, fill: 'url(#chrome)' }),
      s('ellipse', { cx: x, cy: y - 20, rx: 6, ry: 3, fill: '#f4f6fa' }),
      stamped(x, y + ry * 0.7, label.toUpperCase(), 'cymbal-label'),
    ),
  );
}

function kick() {
  const x = 500;
  const y = 278;
  const r = 138;
  const claws = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2 + 0.26;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return s('rect', {
      x: x + cos * r * 0.97 - 5, y: y + sin * r * 0.97 - 9, width: 10, height: 18, rx: 3,
      fill: 'url(#chrome)', stroke: 'rgba(0,0,0,.4)',
      transform: `rotate(${(angle * 180) / Math.PI + 90} ${x + cos * r * 0.97} ${y + sin * r * 0.97})`,
    });
  });
  return s('g', { class: 'piece kick', 'data-id': 'kick' },
    s('ellipse', { cx: x, cy: y + r - 2, rx: r * 1.14, ry: 26, fill: 'rgba(0,0,0,.65)', filter: 'url(#soft)' }),
    s('circle', { cx: x, cy: y + 7, r, class: 'shell' }),
    s('circle', { cx: x, cy: y + 7, r, fill: 'url(#shellshine)' }),
    s('g', { class: 'skin' },
      s('circle', { cx: x, cy: y, r: r * 0.97, fill: 'url(#chromeV)' }),
      s('circle', { cx: x, cy: y, r: r * 0.89, fill: '#050507' }),
      s('circle', { cx: x, cy: y + 2, r: r * 0.87, fill: 'url(#kickhead)' }),
      s('ellipse', { cx: x - r * 0.25, cy: y - r * 0.48, rx: r * 0.4, ry: r * 0.18, fill: 'url(#headshine)', opacity: 0.2 }),
      s('circle', { cx: x, cy: y + 2, r: r * 0.8, fill: 'none', class: 'kick-ring', 'stroke-width': 4 }),
      ...claws,
      s('text', { x, y: y - 8, class: 'kick-logo' }, 'PlayBox'),
      s('rect', { x: x - 34, y: y + 12, width: 68, height: 2, class: 'kick-rule' }),
      s('text', { x, y: y + 37, class: 'kick-label' }, 'KICK'),
    ),
  );
}

export function buildKit() {
  const front = LAYOUT.filter((p) => p.id === 'snare' || p.id === 'floor');
  const back = LAYOUT.filter((p) => !front.includes(p));
  return s('svg', { class: 'kit', viewBox: '0 0 1000 430', preserveAspectRatio: 'xMidYMid meet' },
    defs(),
    ...back.filter((p) => p.kind === 'cymbal').map(cymbal),
    kick(),
    ...back.filter((p) => p.kind === 'drum').map(drum),
    ...front.map(drum),
  ) as SVGSVGElement;
}
