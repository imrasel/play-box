type Random = () => number;

export type RaceItem = { x: number; lane: number; kind: 'star' | 'cone'; gone: boolean };
export type RaceEvent = 'star' | 'cone' | 'finish';

const LANES = 3;
const CRUISE = 250; // pixels a second: unhurried for a 4-year-old
const CONE_SLOW = 0.5;
const SLOW_SECONDS = 0.7;
const REACH = 58; // how close the car must be, front to back, to touch an item
const LANE_REACH = 0.8; // generous, so a nearly-there car still catches the star
const STARS_TO_FINISH = 12;

/** The car always drives on. Cones only slow it for a moment, so nobody can lose. */
export class RaceGame {
  /** May sit between lanes: the car follows a finger freely. */
  lane = 1;
  /** How far the car has moved up the screen from its resting spot. */
  forward = 0;
  distance = 0;
  speed = CRUISE;
  stars = 0;
  total = 0;
  finishX = Infinity;
  items: RaceItem[] = [];
  readonly events: RaceEvent[] = [];
  private nextX = 620;
  private slow = 0;

  constructor(private random: Random = Math.random) {
    this.fill();
  }

  /** At most one thing per stretch of road, so there is always a clear lane. */
  private fill() {
    while (this.nextX < this.distance + 1500) {
      const kind = this.random() < 0.72 ? 'star' : 'cone';
      this.items.push({ x: this.nextX, lane: Math.floor(this.random() * LANES), kind, gone: false });
      this.nextX += 240 + this.random() * 160;
    }
  }

  tick(seconds: number) {
    this.slow = Math.max(0, this.slow - seconds);
    this.speed = this.slow > 0 ? CRUISE * CONE_SLOW : CRUISE;
    this.distance += this.speed * seconds;

    for (const item of this.items) {
      if (item.gone || Math.abs(item.lane - this.lane) > LANE_REACH || Math.abs(item.x - this.distance - this.forward) > REACH) continue;
      item.gone = true;
      if (item.kind === 'star') {
        this.stars++;
        this.total++;
        this.events.push('star');
        if (this.stars >= STARS_TO_FINISH && this.finishX === Infinity) this.finishX = this.distance + 700;
      } else {
        this.slow = SLOW_SECONDS;
        this.events.push('cone');
      }
    }
    if (this.distance >= this.finishX) {
      this.finishX = Infinity;
      this.stars = 0;
      this.events.push('finish');
    }
    this.items = this.items.filter((i) => i.x > this.distance - 400);
    this.fill();
  }
}
