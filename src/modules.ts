import { mountDrums } from './drums/drums';
import { mountAir } from './games/air';
import { mountBalloons } from './games/balloons';
import { mountCopy } from './games/copy';
import { mountFruit } from './games/fruit';
import { mountGames } from './games/games';
import { mountMemory } from './games/memory';
import { mountRace } from './games/race';
import { mountShapes } from './games/shapes';
import { mountGuitar } from './guitar/guitar';
import { mountPiano } from './piano/piano';

/**
 * Everything on the home screen. To add drums or a game: write a mount function
 * that fills `root` and returns a cleanup function, then list it here.
 */
export type Mount = (root: HTMLElement, goHome: () => void) => () => void;

export type Module = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  mount?: Mount;
  /** Reached from another screen, so it gets no tile on the home screen. */
  hidden?: boolean;
};

export const MODULES: Module[] = [
  { id: 'piano', title: 'Piano', emoji: '🎹', color: '#ff5a5f', mount: mountPiano },
  { id: 'drums', title: 'Drums', emoji: '🥁', color: '#2d9cff', mount: mountDrums },
  { id: 'guitar', title: 'Guitar', emoji: '🎸', color: '#f0932b', mount: mountGuitar },
  { id: 'games', title: 'Games', emoji: '🎮', color: '#37c978', mount: mountGames },
  ...([
    ['balloons', mountBalloons], ['race', mountRace], ['fruit', mountFruit], ['air', mountAir], ['memory', mountMemory], ['shapes', mountShapes], ['copy', mountCopy],
    ['noterain', (root: HTMLElement, back: () => void) => mountPiano(root, back, true)],
  ] as [string, Mount][]).map(([id, mount]) => ({
    id, title: id, emoji: '', color: '', hidden: true,
    mount: (root: HTMLElement) => mount(root, () => { location.hash = 'games'; }),
  })),
];
