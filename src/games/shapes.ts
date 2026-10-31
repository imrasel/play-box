import { h } from '../core/dom';
import { shapeRound, type ShapeName, type ShapeRound } from './logic';
import { PENTATONIC, gameScreen } from './play';

const EVERY = 5;

const PATHS: Record<ShapeName, string> = {
  circle: '<circle cx="50" cy="50" r="44"/>',
  square: '<rect x="9" y="9" width="82" height="82" rx="12"/>',
  triangle: '<path d="M50 8 94 88a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z"/>',
  star: '<path d="M50 5l13.5 29.5 32 3.6-23.8 21.7 6.6 31.7L50 76 21.7 91.5l6.6-31.7L4.5 38.1l32-3.6z"/>',
  heart: '<path d="M50 90S6 62 6 32c0-14 11-24 23-24 9 0 17 5 21 13 4-8 12-13 21-13 12 0 23 10 23 24 0 30-44 58-44 58z"/>',
};

function shape(name: ShapeName, color: string) {
  const box = h('span', { class: 'shape' });
  box.innerHTML = `<svg viewBox="0 0 100 100" fill="${color}" stroke="rgba(0,0,0,.18)" stroke-width="2">${PATHS[name]}</svg>`;
  return box;
}

export function mountShapes(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'shapes');
  const { stage, later, note, cheer, celebrate } = game;
  let right = 0;
  let last: ShapeName | undefined;

  function next() {
    const round: ShapeRound = shapeRound(Math.random, last);
    last = round.target;
    const options = h('div', { class: 'shape-options' });
    let solved = false;
    round.options.forEach((o, i) => {
      const b = h('button', { class: 'shape-option', 'data-shape': o.shape }, shape(o.shape, o.color));
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (solved) return;
        if (o.shape !== round.target) {
          note(PENTATONIC[0], 0.18, 0, 0.22);
          b.classList.remove('wiggle');
          later(() => b.classList.add('wiggle'), 0);
          return;
        }
        solved = true;
        b.classList.add('right');
        right++;
        if (right % EVERY === 0) celebrate();
        else cheer();
        later(next, 1100);
      });
      options.append(b);
      note(PENTATONIC[i + 2], 0.12, i * 0.07, 0.14);
    });
    stage.replaceChildren(
      h('div', { class: 'shape-target', 'data-target': round.target }, shape(round.target, round.color)),
      h('span', { class: 'shape-arrow' }, '👉'),
      options,
    );
  }

  next();
  return () => game.close();
}
