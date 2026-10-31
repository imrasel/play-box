type Random = () => number;

export const MAX_POWER = 5;
export const KILLS_TO_BOSS = 18;
const FIRE_EVERY = 0.2;
const BULLET_SPEED = 720;
const ENEMY_SHOT_SPEED = 170; // slow enough for small hands to dodge
const SHIELD_SECONDS = 1.8;
const DROP_EVERY = 5; // a pick-up is guaranteed at least this often

export type Bullet = { x: number; y: number; vx: number; vy: number };
export type Enemy = { x: number; y: number; hp: number; kind: 0 | 1 | 2; age: number; startY: number; speed: number };
export type Pickup = { x: number; y: number };
export type Boss = { x: number; y: number; hp: number; maxHp: number; age: number; reload: number };
export type AirEvent = 'kill' | 'pickup' | 'hit' | 'boss' | 'bossDown' | 'bossHit';

/** Bullet offsets (y, as a share of plane size) and angles for each level of guns. */
export function gunPattern(power: number): [number, number][] {
  switch (Math.max(1, Math.min(MAX_POWER, power))) {
    case 1: return [[0, 0]];
    case 2: return [[-0.3, 0], [0.3, 0]];
    case 3: return [[0, 0], [-0.3, -0.16], [0.3, 0.16]];
    case 4: return [[-0.14, 0], [0.14, 0], [-0.4, -0.2], [0.4, 0.2]];
    default: return [[0, 0], [-0.2, -0.13], [0.2, 0.13], [-0.45, -0.28], [0.45, 0.28]];
  }
}

/** Nothing here can end the game: a hit only costs one level of guns. */
export class AirGame {
  plane = { x: 0, y: 0 };
  target = { x: 0, y: 0 };
  power = 1;
  shield = 0;
  score = 0;
  wave = 1;
  kills = 0;
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  shots: Bullet[] = [];
  pickups: Pickup[] = [];
  boss: Boss | null = null;
  readonly events: AirEvent[] = [];
  private cooldown = 0;
  private spawn = 0.6;
  private sinceDrop = 0;
  private killsThisWave = 0;

  constructor(public w: number, public h: number, private random: Random = Math.random) {
    this.plane = { x: w * 0.18, y: h / 2 };
    this.target = { ...this.plane };
  }

  /** The unit everything is sized from, so the game suits any screen. */
  get size() {
    return this.h * 0.11;
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private spawnEnemy() {
    const kind = (this.random() < 0.6 ? 0 : this.random() < 0.7 ? 1 : 2) as Enemy['kind'];
    const y = this.size * 1.4 + this.random() * (this.h - this.size * 2.8);
    this.enemies.push({ x: this.w + this.size * 2, y, startY: y, hp: kind + 1, kind, age: this.random() * 6, speed: 130 + this.random() * 60 + this.wave * 12 });
  }

  private killed(e: Enemy) {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.kills++;
    this.killsThisWave++;
    this.sinceDrop++;
    this.score += 10 * (e.kind + 1);
    this.events.push('kill');
    if (this.sinceDrop >= DROP_EVERY || this.random() < 0.14) {
      this.sinceDrop = 0;
      this.pickups.push({ x: e.x, y: e.y });
    }
  }

  private hurtPlane() {
    if (this.shield > 0) return;
    this.shield = SHIELD_SECONDS;
    this.power = Math.max(1, this.power - 1);
    this.events.push('hit');
  }

  tick(dt: number) {
    const { plane, target, size } = this;
    const ease = Math.min(1, dt * 12);
    plane.x += (target.x - plane.x) * ease;
    plane.y += (target.y - plane.y) * ease;
    this.shield = Math.max(0, this.shield - dt);

    this.cooldown -= dt;
    if (this.cooldown <= 0) {
      this.cooldown = FIRE_EVERY;
      for (const [offset, angle] of gunPattern(this.power)) {
        this.bullets.push({
          x: plane.x + size, y: plane.y + offset * size,
          vx: Math.cos(angle) * BULLET_SPEED, vy: Math.sin(angle) * BULLET_SPEED,
        });
      }
    }

    if (!this.boss) {
      this.spawn -= dt;
      if (this.spawn <= 0) {
        this.spawnEnemy();
        this.spawn = Math.max(0.5, 1 - this.wave * 0.06) + this.random() * 0.4;
      }
      if (this.killsThisWave >= KILLS_TO_BOSS) {
        const maxHp = 50 + this.wave * 22;
        this.boss = { x: this.w + size * 4, y: this.h / 2, hp: maxHp, maxHp, age: 0, reload: 2 };
        this.killsThisWave = 0;
        this.events.push('boss');
      }
    }

    for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
    for (const s of this.shots) { s.x += s.vx * dt; s.y += s.vy * dt; }
    for (const p of this.pickups) { p.x -= 95 * dt; p.y += Math.sin(p.x / 34) * 26 * dt; }
    for (const e of this.enemies) {
      e.age += dt;
      e.x -= e.speed * dt;
      e.y = e.startY + Math.sin(e.age * 1.8) * size * (e.kind === 2 ? 1.1 : 0.5);
      if (e.kind === 2 && this.random() < dt * 0.3 && e.x < this.w) this.shootAt(e.x, e.y);
    }

    const boss = this.boss;
    if (boss) {
      boss.age += dt;
      boss.x += (this.w * 0.76 - boss.x) * Math.min(1, dt * 1.1);
      boss.y = this.h / 2 + Math.sin(boss.age * 0.7) * this.h * 0.2;
      boss.reload -= dt;
      if (boss.reload <= 0 && boss.x < this.w * 0.85) {
        boss.reload = 2.1;
        for (const spread of [-0.34, 0, 0.34]) this.shootAt(boss.x - size * 2, boss.y, spread);
      }
    }

    this.bullets = this.bullets.filter((b) => {
      const hit = this.enemies.find((e) => (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < (size * 0.95) ** 2);
      if (hit) {
        if (--hit.hp <= 0) this.killed(hit);
        return false;
      }
      if (boss && Math.abs(b.x - boss.x) < size * 2.8 && Math.abs(b.y - boss.y) < size * 1.5) {
        boss.hp--;
        this.score += 2;
        this.events.push('bossHit');
        return false;
      }
      return b.x < this.w + 40 && b.y > -40 && b.y < this.h + 40;
    });

    if (boss && boss.hp <= 0) {
      this.boss = null;
      this.score += 200;
      this.wave++;
      this.shots = [];
      this.pickups.push({ x: boss.x, y: boss.y - size }, { x: boss.x, y: boss.y + size });
      this.events.push('bossDown');
    }

    const touching = (x: number, y: number, reach: number) => (x - plane.x) ** 2 + (y - plane.y) ** 2 < reach ** 2;
    this.pickups = this.pickups.filter((p) => {
      if (touching(p.x, p.y, size * 1.5)) { // generous, so small fingers still catch them
        this.power = Math.min(MAX_POWER, this.power + 1);
        this.score += 25;
        this.events.push('pickup');
        return false;
      }
      return p.x > -40;
    });
    this.shots = this.shots.filter((s) => {
      if (touching(s.x, s.y, size * 0.5)) {
        this.hurtPlane();
        return false;
      }
      return s.x > -30 && s.x < this.w + 30 && s.y > -30 && s.y < this.h + 30;
    });
    this.enemies = this.enemies.filter((e) => {
      if (touching(e.x, e.y, size * 0.9)) {
        this.hurtPlane();
        this.events.push('kill');
        return false;
      }
      return e.x > -size * 3;
    });
  }

  private shootAt(x: number, y: number, spread = 0) {
    const angle = Math.atan2(this.plane.y - y, this.plane.x - x) + spread;
    this.shots.push({ x, y, vx: Math.cos(angle) * ENEMY_SHOT_SPEED, vy: Math.sin(angle) * ENEMY_SHOT_SPEED });
  }
}
