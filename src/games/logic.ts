type Random = () => number;

export function shuffle<T>(items: T[], random: Random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const ANIMALS = ['🐶', '🐱', '🐸', '🦁', '🐘', '🐵', '🐰', '🐼'];
export const MEMORY_LEVELS = [3, 4, 6]; // pairs: a 4-year-old starts small

export type Flip = 'ignored' | 'first' | 'match' | 'miss';

export class MemoryGame {
  readonly cards: { face: string; state: 'down' | 'up' | 'done' }[];
  private open: number | null = null;
  private waiting: number[] = [];

  constructor(pairs: number, random: Random = Math.random) {
    const faces = shuffle(ANIMALS, random).slice(0, pairs);
    this.cards = shuffle([...faces, ...faces], random).map((face) => ({ face, state: 'down' }));
  }

  flip(i: number): Flip {
    const card = this.cards[i];
    if (card.state !== 'down' || this.waiting.length) return 'ignored';
    card.state = 'up';
    if (this.open === null) {
      this.open = i;
      return 'first';
    }
    const other = this.cards[this.open];
    const first = this.open;
    this.open = null;
    if (other.face === card.face) {
      other.state = card.state = 'done';
      return 'match';
    }
    this.waiting = [first, i];
    return 'miss';
  }

  /** Turn a mismatched pair back over, after the child has had a look. */
  hideMissed() {
    const hidden = this.waiting;
    for (const i of hidden) this.cards[i].state = 'down';
    this.waiting = [];
    return hidden;
  }

  get done() {
    return this.cards.every((c) => c.state === 'done');
  }
}

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'] as const;
export type ShapeName = (typeof SHAPES)[number];
export const SHAPE_COLORS = ['#ff4d4d', '#2d9cff', '#37c978', '#ffb400', '#b65cff', '#ff7a2f'];

export type ShapeRound = { target: ShapeName; color: string; options: { shape: ShapeName; color: string }[] };

/** Three different shapes, of which exactly one is the target. */
export function shapeRound(random: Random = Math.random, avoid?: ShapeName): ShapeRound {
  const pool = shuffle([...SHAPES], random);
  const target = pool.find((s) => s !== avoid)!;
  const others = pool.filter((s) => s !== target).slice(0, 2);
  const colors = shuffle(SHAPE_COLORS, random);
  const options = shuffle([target, ...others], random).map((shape, i) => ({ shape, color: colors[i] }));
  return { target, color: options.find((o) => o.shape === target)!.color, options };
}

export type Press = 'good' | 'round' | 'win' | 'again';

/** Copy a growing tune. A wrong press simply plays it again: nobody loses. */
export class CopyGame {
  sequence: number[] = [];
  private at = 0;

  constructor(private pads: number, private longest = 5, private random: Random = Math.random) {
    this.grow();
  }

  private grow() {
    this.sequence.push(Math.floor(this.random() * this.pads));
    this.at = 0;
  }

  press(pad: number): Press {
    if (pad !== this.sequence[this.at]) {
      this.at = 0;
      return 'again';
    }
    this.at++;
    if (this.at < this.sequence.length) return 'good';
    if (this.sequence.length >= this.longest) {
      this.sequence = [];
      this.grow();
      return 'win';
    }
    this.grow();
    return 'round';
  }
}
