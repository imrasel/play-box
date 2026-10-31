import { h } from '../core/dom';
import { ANIMALS, MEMORY_LEVELS, MemoryGame } from './logic';
import { PENTATONIC, gameScreen } from './play';

const LOOK_MS = 1000; // long enough for a small child to see both cards
const CARD_TINTS = ['#ffe3e3', '#fff3bf', '#d3f9d8', '#d0ebff', '#eebefa', '#ffd8a8', '#c3fae8', '#e9ecef'];

export function mountMemory(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'memory');
  const { stage, later, note, cheer, celebrate } = game;
  let level = 0;

  function deal() {
    const round = new MemoryGame(MEMORY_LEVELS[level]);
    const columns = round.cards.length <= 6 ? 3 : 4;
    const grid = h('div', { class: 'memory-grid', style: `--columns:${columns}` });
    stage.replaceChildren(grid);

    const rows = Math.ceil(round.cards.length / columns);
    const size = Math.min(stage.clientHeight / rows, stage.clientWidth / columns) * 0.56;
    const buttons = round.cards.map((card, i) => {
      const tint = CARD_TINTS[ANIMALS.indexOf(card.face) % CARD_TINTS.length];
      const b = h('button', { class: 'card', 'aria-label': 'Card', 'data-face': card.face },
        h('span', { class: 'card-inner' },
          h('span', { class: 'card-back', style: `font-size:${size * 0.62}px` }, '⭐'),
          h('span', { class: 'card-front', style: `font-size:${size}px;--tint:${tint}` }, card.face)));
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        turn(i);
      });
      grid.append(b);
      return b;
    });

    function turn(i: number) {
      const result = round.flip(i);
      if (result === 'ignored') return;
      buttons[i].classList.add('up');
      note(PENTATONIC[2], 0.2);
      if (result === 'miss') {
        later(() => round.hideMissed().forEach((n) => buttons[n].classList.remove('up')), LOOK_MS);
      } else if (result === 'match') {
        round.cards.forEach((c, n) => { if (c.state === 'done') buttons[n].classList.add('done'); });
        cheer();
        if (round.done) {
          celebrate();
          level = Math.min(level + 1, MEMORY_LEVELS.length - 1);
          later(deal, 2300);
        }
      }
    }
  }

  // Sizes depend on the stage, which only has them after the first layout.
  requestAnimationFrame(deal);
  return () => game.close();
}
