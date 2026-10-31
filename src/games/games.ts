import { getEngine } from '../core/audio';
import { h } from '../core/dom';
import { homeTool } from '../core/ui';

/** Each game adds an entry to GAMES below, and a hidden route in modules.ts. */
const NOTE_RAIN_ART = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="nr-a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1f7bff"/><stop offset="1" stop-color="#7fd4ff"/></linearGradient>
    <linearGradient id="nr-b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#d42bd9"/><stop offset="1" stop-color="#ff8ad8"/></linearGradient>
    <linearGradient id="nr-c" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0fae62"/><stop offset="1" stop-color="#7dffb2"/></linearGradient>
  </defs>
  <rect x="14" y="6" width="22" height="42" rx="6" fill="url(#nr-a)" stroke="#fff" stroke-opacity=".7"/>
  <rect x="49" y="26" width="22" height="48" rx="6" fill="url(#nr-b)" stroke="#fff" stroke-opacity=".7"/>
  <rect x="84" y="12" width="22" height="30" rx="6" fill="url(#nr-c)" stroke="#fff" stroke-opacity=".7"/>
  <rect x="6" y="84" width="108" height="32" rx="5" fill="#f6f3ea"/>
  <path d="M42 84v32M78 84v32" stroke="#2a2733" stroke-width="2"/>
  <rect x="32" y="84" width="20" height="18" rx="2" fill="#17151f"/>
  <rect x="68" y="84" width="20" height="18" rx="2" fill="#17151f"/>
  <path d="M60 76l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffe066"/>
</svg>`;

const GAMES = [
  { id: 'balloons', title: 'Balloons', art: '🎈', light: '#ff9ac1', color: '#ff2e7e' },
  { id: 'race', title: 'Racing', art: '🏎️', light: '#ffc14d', color: '#ff6a00' },
  { id: 'fruit', title: 'Fruit Slice', art: '🍉', light: '#b6f36a', color: '#27c24c' },
  { id: 'air', title: 'Air Fighter', art: '✈️', light: '#9ee8ff', color: '#0a6cff' },
  { id: 'memory', title: 'Memory', art: '🐼', light: '#7fdcff', color: '#1a8cff' },
  { id: 'shapes', title: 'Shapes', art: '⭐', light: '#d2a8ff', color: '#8a3ffc' },
  { id: 'copy', title: 'Copy Me', art: '🦁', light: '#ffe45c', color: '#ffb300' },
  { id: 'noterain', title: 'Note Rain', art: NOTE_RAIN_ART, light: '#8fa8ff', color: '#3d3af0' },
];

export function mountGames(root: HTMLElement, goHome: () => void) {
  const grid = h('div', { class: 'tiles' });
  for (const game of GAMES) {
    const art = h('span', { class: 'tile-art' });
    art.innerHTML = game.art;
    grid.append(h('button', { class: 'tile game-tile', style: `--tile:${game.color};--tile-light:${game.light}`, onclick: () => {
      getEngine();
      location.hash = game.id;
    } }, art, h('span', {}, game.title)));
  }
  const hub = h('div', { class: 'hub game-hub' }, homeTool(goHome), grid);
  root.append(hub);
  return () => hub.remove();
}
