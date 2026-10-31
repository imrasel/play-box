import { registerSW } from 'virtual:pwa-register';
import { getEngine } from './core/audio';
import { h } from './core/dom';
import { goFullscreen, installButton, isInstalled } from './core/install';
import { MODULES } from './modules';
import { trackSafeSpace } from './core/safe-space';
import './style.css';

trackSafeSpace();

// Filling the whole screen slides the page under the browser's own see-through bars, which
// blur whatever is beneath them. Only the installed app, with no bars, should do that.
if (!isInstalled()) {
  const viewport = document.querySelector('meta[name=viewport]')!;
  viewport.setAttribute('content', viewport.getAttribute('content')!.replace(', viewport-fit=cover', ''));
}

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;

const goHome = () => { location.hash = ''; };

function showHub() {
  const grid = h('div', { class: 'tiles' });
  for (const m of MODULES.filter((x) => !x.hidden)) {
    const tile = h('button', { class: 'tile', style: `--tile:${m.color}`, onclick: () => {
      if (!m.mount) return;
      getEngine(); // must happen inside the tap, not after the route change
      goFullscreen();
      location.hash = m.id;
    } }, h('span', { class: 'tile-emoji' }, m.emoji), h('span', {}, m.title));
    if (!m.mount) {
      tile.classList.add('soon');
      tile.append(h('small', {}, 'Coming soon'));
    }
    grid.append(tile);
  }
  const hub = h('div', { class: 'hub' }, h('h1', {}, 'PlayBox'), grid);
  hub.append(installButton(hub));
  app.append(hub);
  return () => hub.remove();
}

function route() {
  cleanup?.();
  const mod = MODULES.find((m) => m.id === location.hash.slice(1) && m.mount);
  cleanup = mod ? mod.mount!(app, goHome) : showHub();
  app.dataset.route = mod?.id ?? 'home';
}

window.addEventListener('hashchange', route);
route();

// Stops long-press menus and double-tap zoom interrupting play.
document.addEventListener('contextmenu', (e) => e.preventDefault());

registerSW({ immediate: true });
