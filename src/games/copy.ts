import { h } from '../core/dom';
import { CopyGame } from './logic';
import { gameScreen } from './play';

const PADS = [
  { emoji: '🐶', color: '#ff5a5f', midi: 60 },
  { emoji: '🐱', color: '#2d9cff', midi: 64 },
  { emoji: '🐸', color: '#37c978', midi: 67 },
  { emoji: '🦁', color: '#ffb400', midi: 72 },
];
const SHOW_MS = 700;

export function mountCopy(root: HTMLElement, goBack: () => void) {
  const game = gameScreen(root, goBack, 'copy');
  const { stage, later, note, cheer, celebrate } = game;
  const round = new CopyGame(PADS.length);
  let listening = false;

  const status = h('div', { class: 'copy-status' }, '👀');
  const buttons = PADS.map((pad, i) => {
    const b = h('button', { class: 'copy-pad', 'data-pad': i, style: `--color:${pad.color}` }, h('span', { class: 'copy-face' }, pad.emoji));
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (listening) press(i);
    });
    return b;
  });
  stage.append(h('div', { class: 'copy-grid' }, ...buttons), status);

  function flash(i: number) {
    note(PADS[i].midi, 0.45);
    buttons[i].classList.add('lit');
    later(() => buttons[i].classList.remove('lit'), SHOW_MS * 0.6);
  }

  function show() {
    listening = false;
    status.textContent = '👀';
    const tune = [...round.sequence];
    tune.forEach((pad, n) => later(() => flash(pad), 600 + n * SHOW_MS));
    later(() => {
      listening = true;
      status.textContent = '👆';
    }, 600 + tune.length * SHOW_MS);
  }

  function press(i: number) {
    flash(i);
    const result = round.press(i);
    if (result === 'good') return;
    listening = false;
    if (result === 'round') cheer();
    if (result === 'win') celebrate();
    later(show, result === 'win' ? 2400 : 900); // 'again' just shows the same tune once more
  }

  show();
  return () => game.close();
}
