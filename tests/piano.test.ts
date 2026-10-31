import { describe, expect, it } from 'vitest';
import { HIGH, LOW, WHITE_COUNT, isBlack, noteName, parseNote, whiteIndex } from '../src/piano/notes';
import { fitRange, keyAt, keyRect, type Layout } from '../src/piano/geometry';
import { LearnSession } from '../src/piano/learn';
import { SONGS, parseMelody, type Song } from '../src/piano/songs';
import { toMidiFile } from '../src/piano/recording';
import { parseMidi } from '../src/piano/midi-import';
import { CHORD_NAMES, chordNotes, crossed, fretAt, fretX, nearestString, stringY } from '../src/guitar/theory';
import { PATTERNS, PROGRESSIONS, strokes } from '../src/guitar/rhythm';
import { GUITARS, pluckSamples } from '../src/guitar/synth';
import { ANIMALS, CopyGame, MEMORY_LEVELS, MemoryGame, shapeRound } from '../src/games/logic';
import { AirGame, MAX_POWER, gunPattern } from '../src/games/air-logic';
import { GRAVITY, launch, touchesCircle } from '../src/games/fruit-logic';
import { RaceGame } from '../src/games/race-logic';
import { GROOVES, grooveLength, hitsAt, stepSeconds } from '../src/drums/grooves';
import { RainGame, endlessSong } from '../src/piano/rain';
import { CHORD_KEYS, keyChords, stripNotes } from '../src/piano/chords';

const layout: Layout = { width: 1000, height: 300, first: 23, visible: 10 };

describe('notes', () => {
  it('spans a full 88-key piano', () => {
    expect(HIGH - LOW + 1).toBe(88);
    expect(whiteIndex(HIGH)).toBe(WHITE_COUNT - 1);
  });
  it('parses and names notes', () => {
    expect(parseNote('A0')).toBe(21);
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('C#4')).toBe(61);
    expect(noteName(60, 'octave')).toBe('C4');
    expect(noteName(64, 'solfege')).toBe('Mi');
  });
});

describe('key hit testing', () => {
  it('finds every key at the centre of its own rectangle', () => {
    for (let m = 57; m < 74; m++) {
      const r = keyRect(m, layout);
      const x = isBlack(m) ? r.x + r.w / 2 : r.x + r.w / 2;
      const y = isBlack(m) ? r.h / 2 : layout.height * 0.9;
      if (x < 0 || x >= layout.width) continue;
      expect(keyAt(x, y, layout)).toBe(m);
    }
  });
  it('treats the top of a white key beside a black key as the black key only inside its width', () => {
    const cs = keyRect(61, layout);
    expect(keyAt(cs.x - 1, 10, layout)).toBe(60);
    expect(keyAt(cs.x + 1, 10, layout)).toBe(61);
    expect(keyAt(cs.x + cs.w + 1, 10, layout)).toBe(62);
  });
  it('returns the lowest and highest keys at the edges', () => {
    const all: Layout = { width: 520, height: 100, first: 0, visible: WHITE_COUNT };
    expect(keyAt(1, 90, all)).toBe(LOW);
    expect(keyAt(519, 90, all)).toBe(HIGH);
    expect(keyAt(519, 10, all)).toBe(HIGH);
  });
  it('fits a song range on screen', () => {
    const { first, visible } = fitRange(60, 79);
    expect(first).toBeLessThanOrEqual(whiteIndex(60));
    expect(first + visible).toBeGreaterThanOrEqual(whiteIndex(79) + 1);
  });
});

describe('songs', () => {
  it('parses durations and rests', () => {
    expect(parseMelody('C4:2 R:1 D4')).toEqual([
      { midi: 60, start: 0, dur: 2 },
      { midi: 62, start: 3, dur: 1 },
    ]);
  });
  it('all parse, with unique ids', () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
    for (const s of SONGS) expect(s.notes.length).toBeGreaterThan(10);
  });
});

describe('learn session', () => {
  const song: Song = { id: 't', title: 't', level: 1, bpm: 60, notes: parseMelody('C4 D4 E4 F4') };

  it('watch mode plays every note by itself', () => {
    const s = new LearnSession(song, 'watch');
    const played = [];
    for (let i = 0; i < 100; i++) played.push(...s.tick(0.1));
    expect(played.map((n) => n.midi)).toEqual([60, 62, 64, 65]);
    expect(s.finished).toBe(true);
  });
  it('wait mode stops on a note until the right key is pressed', () => {
    const s = new LearnSession(song, 'wait');
    s.tick(10);
    expect(s.beat).toBe(0);
    expect(s.waiting).toBe(true);
    expect(s.input(61)).toBe(false);
    s.tick(10);
    expect(s.beat).toBe(0);
    expect(s.input(60)).toBe(true);
    s.tick(0.5);
    expect(s.beat).toBeCloseTo(0.5);
    s.tick(10);
    expect(s.beat).toBe(1);
  });
  it('play mode marks skipped notes as missed and still finishes', () => {
    const s = new LearnSession(song, 'play');
    s.tick(4);
    expect(s.input(60)).toBe(true);
    for (let i = 0; i < 100; i++) s.tick(0.1);
    expect(s.finished).toBe(true);
    expect(s.hits).toBe(1);
    expect(s.stars).toBe(1);
  });
  it('awards three stars for a clean run', () => {
    const s = new LearnSession(song, 'wait');
    for (const n of song.notes) {
      s.tick(10);
      s.input(n.midi);
    }
    s.tick(10);
    expect(s.finished).toBe(true);
    expect(s.stars).toBe(3);
  });
  it('speed scales how fast the song advances', () => {
    const s = new LearnSession(song, 'watch', 0.5);
    s.tick(2);
    expect(s.beat).toBeCloseTo(-3);
  });
});

describe('MIDI export', () => {
  it('writes a valid header and timed note events', () => {
    const bytes = toMidiFile([
      { t: 0, midi: 60, vel: 1, on: true },
      { t: 0.5, midi: 60, vel: 0, on: false },
    ]);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk');
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toContain('00903c7f'); // note on at tick 0
    expect(hex).toContain('83608' + '03c00'); // note off 480 ticks later
    expect(hex.endsWith('00ff2f00')).toBe(true);
  });
});

describe('chords', () => {
  it('stacks chord tones into a two-octave swipe column', () => {
    const strip = stripNotes(keyChords('C')[0]);
    expect(strip.map((b) => b.midi)).toEqual([48, 52, 55, 60, 64, 67, 72]);
    expect(strip.map((b) => b.name).join('')).toBe('CEGCEGC');
  });
  it('builds the six chords of C', () => {
    const chords = keyChords('C');
    expect(chords.map((c) => c.name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am']);
    expect(chords[0].notes).toEqual([48, 52, 55]);
    expect(chords[5].notes).toEqual([57, 60, 64]);
  });
  it('spells sharps and flats for the key', () => {
    expect(keyChords('G').map((c) => c.name)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em']);
    expect(keyChords('G')[4].spelled).toEqual(['D', 'F#', 'A']);
    expect(keyChords('F').map((c) => c.name)).toEqual(['F', 'Gm', 'Am', 'Bb', 'C', 'Dm']);
  });
  it('makes every chord a real major or minor triad in root position', () => {
    for (const key of CHORD_KEYS) {
      for (const { notes } of keyChords(key)) {
        expect(notes[0]).toBeGreaterThanOrEqual(48);
        expect(notes[0]).toBeLessThan(60);
        expect([3, 4]).toContain(notes[1] - notes[0]);
        expect(notes[2] - notes[0]).toBe(7);
      }
    }
  });
});

describe('note rain game', () => {
  const song: Song = { id: 't', title: 't', level: 1, bpm: 60, notes: parseMelody('C4 D4 E4 F4') };
  const toFirst = (g: RainGame) => g.tick(4); // lead-in at 60 bpm

  it('never waits: an unplayed note passes and the game carries on', () => {
    const g = new RainGame(song, 0);
    for (let i = 0; i < 200; i++) g.tick(0.05);
    expect(g.beat).toBeGreaterThan(4);
    expect(g.misses).toBe(4);
    expect(g.over).toBe(false);
    expect(g.finished).toBe(true);
  });
  it('one-miss mode ends on the first miss', () => {
    const g = new RainGame(song, 1);
    toFirst(g);
    g.tick(0.5);
    expect(g.over).toBe(true);
    expect(g.finished).toBe(true);
  });
  it('three hearts survive two misses', () => {
    const g = new RainGame(song, 3);
    toFirst(g);
    g.tick(1.5);
    expect(g.hearts).toBe(1);
    expect(g.over).toBe(false);
  });
  it('judges timing and scores combos', () => {
    const g = new RainGame(song, 0);
    toFirst(g);
    expect(g.input(60)).toBe(true);
    expect(g.events[0].kind).toBe('perfect');
    expect(g.score).toBe(100);
    g.tick(1.13);
    expect(g.input(62)).toBe(true);
    expect(g.events[1].kind).toBe('great');
    expect(g.combo).toBe(2);
  });
  it('ignores wrong keys and keys pressed far too early', () => {
    const g = new RainGame(song, 0);
    expect(g.input(60)).toBe(false);
    toFirst(g);
    expect(g.input(61)).toBe(false);
    expect(g.score).toBe(0);
  });
  it('endless mode speeds up and stays in a playable range', () => {
    const s = endlessSong(() => 0.6);
    expect(s.notes.length).toBeGreaterThan(1000);
    for (const n of s.notes) {
      expect(n.midi).toBeGreaterThanOrEqual(60);
      expect(n.midi).toBeLessThanOrEqual(79);
    }
    const g = new RainGame(s, 0, 1, true);
    g.tick(40);
    const a = g.beat;
    g.tick(1);
    expect(g.beat - a).toBeGreaterThan(1.5);
  });
});

describe('MIDI import', () => {
  it('reads back a file this app exported', () => {
    const song = parseMidi(toMidiFile([
      { t: 0, midi: 60, vel: 1, on: true },
      { t: 0.5, midi: 60, vel: 0, on: false },
      { t: 0.5, midi: 62, vel: 1, on: true },
      { t: 1, midi: 62, vel: 0, on: false },
    ]), 'Tune.mid');
    expect(song.title).toBe('Tune');
    expect(song.bpm).toBe(120);
    expect(song.notes).toEqual([{ midi: 60, start: 0, dur: 1 }, { midi: 62, start: 1, dur: 1 }]);
  });
  it('keeps only the top note of a chord', () => {
    const song = parseMidi(toMidiFile([
      { t: 0, midi: 48, vel: 1, on: true },
      { t: 0, midi: 72, vel: 1, on: true },
      { t: 0, midi: 60, vel: 1, on: true },
      { t: 0.5, midi: 48, vel: 0, on: false },
      { t: 0.5, midi: 60, vel: 0, on: false },
      { t: 0.5, midi: 72, vel: 0, on: false },
    ]), 'x');
    expect(song.notes.map((n) => n.midi)).toEqual([72]);
  });
  it('refuses a file that is not MIDI', () => {
    expect(() => parseMidi(new TextEncoder().encode('hello there world'), 'x')).toThrow();
  });
});

describe('drum grooves', () => {
  it('have equal-length tracks using only x and dot', () => {
    for (const g of GROOVES) {
      for (const track of Object.values(g.tracks)) {
        expect(track.length).toBe(grooveLength(g));
        expect(track).toMatch(/^[x.]+$/);
      }
    }
  });
  it('use the beats and hand drums they promise', () => {
    const desi = GROOVES.filter((g) => g.desi);
    expect(desi.length).toBeGreaterThanOrEqual(8);
    expect(new Set(GROOVES.map((g) => g.id)).size).toBe(GROOVES.length);
    for (const g of desi) {
      expect(Object.keys(g.tracks).some((id) => ['tablaNa', 'tablaGe', 'dholak', 'dhol'].includes(id))).toBe(true);
    }
  });
  it('finds the hits on a step and wraps around', () => {
    const rock = GROOVES[0];
    expect(hitsAt(rock, 0).sort()).toEqual(['hat', 'kick']);
    expect(hitsAt(rock, 4).sort()).toEqual(['hat', 'snare']);
    expect(hitsAt(rock, 16)).toEqual(hitsAt(rock, 0));
  });
  it('times sixteenth notes from the tempo', () => {
    expect(stepSeconds(60)).toBeCloseTo(0.25);
  });
});

describe('strum patterns', () => {
  const am = chordNotes('Am');

  it('strums down from the thickest played string', () => {
    expect(strokes('D', am, true).map((k) => k.string)).toEqual([1, 2, 3, 4, 5]);
  });
  it('strums up from the thinnest, more softly, and only the top strings', () => {
    const up = strokes('U', am, false);
    expect(up.map((k) => k.string)).toEqual([5, 4, 3, 2]);
    expect(up[0].vel).toBeLessThan(strokes('D', am, false)[0].vel);
  });
  it('rests make no sound and chucks are muted', () => {
    expect(strokes('-', am, false)).toEqual([]);
    expect(strokes('X', am, false).every((k) => k.muted)).toBe(true);
  });
  it('spreads a strum over time, like a hand sweeping', () => {
    const gaps = strokes('D', am, true).map((k) => k.gap);
    expect(gaps[0]).toBe(0);
    expect(gaps[4]).toBeGreaterThan(gaps[1]);
  });
  it('has the requested pattern, and every preset and progression is playable', () => {
    expect(PATTERNS[0].slots).toBe('DDUDUDDU');
    for (const p of PATTERNS) expect(p.slots).toMatch(/^[DUX-]+$/);
    for (const p of PROGRESSIONS) for (const c of p.chords) expect(CHORD_NAMES).toContain(c);
    expect(GUITARS).toHaveLength(5);
  });
});

describe('guitar', () => {
  const pitchClasses = (name: string) => [...new Set(chordNotes(name).filter((n) => n !== null).map((n) => n! % 12))].sort((a, b) => a - b);

  it('every chord shape contains exactly the right notes', () => {
    const want: Record<string, number[]> = {
      C: [0, 4, 7], G: [2, 7, 11], D: [2, 6, 9], Am: [0, 4, 9], Em: [4, 7, 11],
      F: [0, 5, 9], Dm: [2, 5, 9], A: [1, 4, 9], E: [4, 8, 11],
    };
    expect(CHORD_NAMES.sort()).toEqual(Object.keys(want).sort());
    for (const [name, notes] of Object.entries(want)) expect(pitchClasses(name)).toEqual(notes);
  });
  it('finds strings crossed by a swipe in the order they are met', () => {
    expect(crossed(0, 400, 400)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(crossed(400, 0, 400)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(crossed(stringY(2, 400) + 1, stringY(3, 400) + 1, 400)).toEqual([3]);
    expect(crossed(10, 11, 400)).toEqual([]);
  });
  it('maps a touch to the nearest string and a fret', () => {
    expect(nearestString(0, 400)).toBe(0);
    expect(nearestString(400, 400)).toBe(5);
    expect(fretAt(10, 34, 700, 12)).toBe(0);
    expect(fretAt(fretX(3, 34, 700, 12) - 1, 34, 700, 12)).toBe(3);
    expect(fretX(12, 34, 700, 12)).toBeCloseTo(734);
  });
  it('plucks a string that decays, in tune', () => {
    const sr = 44100;
    for (const freq of [82.41, 196, 659.25]) {
      const { samples, rate } = pluckSamples(freq, sr, 2, 0.996);
      const rms = (a: Float32Array) => Math.sqrt(a.reduce((t, v) => t + v * v, 0) / a.length);
      expect(rms(samples.slice(sr, sr + 4000))).toBeLessThan(rms(samples.slice(0, 4000)));
      // Measure across eight periods: one alone is too coarse to resolve the half sample.
      const span = Math.floor(sr / freq) * 8;
      let best = 0;
      let bestLag = 0;
      for (let lag = span - 10; lag <= span + 10; lag++) {
        let sum = 0;
        for (let i = 2000; i < 12000; i++) sum += samples[i] * samples[i + lag];
        if (sum > best) { best = sum; bestLag = lag; }
      }
      expect(Math.abs((sr * 8 / bestLag) * rate / freq - 1)).toBeLessThan(0.004);
    }
  });
});

describe('little games', () => {
  it('memory deals pairs and can be finished', () => {
    for (const pairs of MEMORY_LEVELS) {
      const game = new MemoryGame(pairs);
      expect(game.cards).toHaveLength(pairs * 2);
      for (const face of new Set(game.cards.map((c) => c.face))) {
        expect(ANIMALS).toContain(face);
        const [a, b] = game.cards.flatMap((c, i) => (c.face === face ? [i] : []));
        expect(game.flip(a)).toBe('first');
        expect(game.flip(b)).toBe('match');
      }
      expect(game.done).toBe(true);
    }
  });
  it('memory turns a wrong pair back and blocks taps until then', () => {
    const game = new MemoryGame(3);
    const a = 0;
    const b = game.cards.findIndex((c, i) => i !== a && c.face !== game.cards[a].face);
    const c = game.cards.findIndex((_, i) => i !== a && i !== b);
    game.flip(a);
    expect(game.flip(a)).toBe('ignored');
    expect(game.flip(b)).toBe('miss');
    expect(game.flip(c)).toBe('ignored');
    expect(game.hideMissed().sort()).toEqual([a, b].sort());
    expect(game.flip(a)).toBe('first');
  });
  it('shape rounds always have exactly one right answer, and never repeat', () => {
    let last;
    for (let i = 0; i < 300; i++) {
      const round = shapeRound(Math.random, last);
      expect(round.target).not.toBe(last);
      expect(new Set(round.options.map((o) => o.shape)).size).toBe(3);
      expect(round.options.filter((o) => o.shape === round.target)).toHaveLength(1);
      last = round.target;
    }
  });
  it('copy me grows, forgives a mistake, and restarts after a win', () => {
    const game = new CopyGame(4, 3, () => 0.1);
    expect(game.sequence).toEqual([0]);
    expect(game.press(0)).toBe('round');
    expect(game.sequence).toHaveLength(2);
    expect(game.press(3)).toBe('again');
    expect(game.sequence).toHaveLength(2);
    expect(game.press(0)).toBe('good');
    expect(game.press(0)).toBe('round');
    expect(game.press(0)).toBe('good');
    expect(game.press(0)).toBe('good');
    expect(game.press(0)).toBe('win');
    expect(game.sequence).toHaveLength(1);
  });
});

describe('racing game', () => {
  const run = (game: RaceGame, seconds: number, steer = false) => {
    for (let t = 0; t < seconds; t += 0.02) {
      if (steer) {
        const next = game.items.find((i) => !i.gone && i.kind === 'star' && i.x > game.distance - 40);
        if (next) game.lane = next.lane;
      }
      game.tick(0.02);
    }
  };

  it('always keeps driving, even with no steering at all', () => {
    const game = new RaceGame();
    run(game, 60);
    expect(game.distance).toBeGreaterThan(5000);
  });
  it('collects a star in the same lane and ignores other lanes', () => {
    const game = new RaceGame(() => 0);
    const star = game.items[0];
    expect(star.kind).toBe('star');
    game.lane = star.lane === 0 ? 1 : 0;
    run(game, 3);
    expect(game.total).toBe(0);
    const other = new RaceGame(() => 0);
    other.lane = other.items[0].lane;
    run(other, 3);
    expect(other.total).toBeGreaterThan(0);
  });
  it('a cone slows the car briefly and never stops it', () => {
    const game = new RaceGame(() => 0.9);
    const cone = game.items[0];
    expect(cone.kind).toBe('cone');
    game.lane = cone.lane;
    while (!game.events.includes('cone')) game.tick(0.02);
    game.tick(0.02);
    expect(game.speed).toBeLessThan(250);
    expect(game.speed).toBeGreaterThan(0);
    game.events.length = 0;
    game.lane = (cone.lane + 1) % 3;
    run(game, 1);
    expect(game.speed).toBe(250);
  });
  it('reaches the finish line and carries on', () => {
    const game = new RaceGame();
    run(game, 40, true);
    expect(game.total).toBeGreaterThanOrEqual(12);
    const seen = game.total;
    run(game, 40, true);
    expect(game.total).toBeGreaterThan(seen);
  });
  it('never places two things level with each other', () => {
    const game = new RaceGame();
    const xs = game.items.map((i) => i.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(240);
  });
});

describe('fruit slice', () => {
  it('detects a swipe through a fruit and a miss beside it', () => {
    expect(touchesCircle(0, 0, 100, 0, 50, 10, 20)).toBe(true);
    expect(touchesCircle(0, 0, 100, 0, 50, 40, 20)).toBe(false);
    expect(touchesCircle(0, 0, 10, 0, 50, 0, 20)).toBe(false);
  });
  it('counts a plain tap on a fruit', () => {
    expect(touchesCircle(50, 50, 50, 50, 60, 55, 20)).toBe(true);
  });
  it('throws every fruit so it peaks in view and stays inside the sides', () => {
    const [w, h, r] = [800, 360, 60];
    for (let i = 0; i < 500; i++) {
      const f = launch(w, h, r);
      const flight = (2 * -f.vy) / GRAVITY;
      const peak = f.y - (f.vy * f.vy) / (2 * GRAVITY);
      expect(peak).toBeGreaterThan(0);
      expect(peak).toBeLessThan(h * 0.5);
      const landing = f.x + f.vx * flight;
      expect(Math.min(f.x, landing)).toBeGreaterThanOrEqual(r);
      expect(Math.max(f.x, landing)).toBeLessThanOrEqual(w - r);
    }
  });
});

describe('air fighter', () => {
  const play = (game: AirGame, seconds: number, each?: (g: AirGame) => void) => {
    for (let t = 0; t < seconds; t += 0.02) {
      each?.(game);
      game.tick(0.02);
    }
  };
  // Chases the nearest enemy, and grabs anything it dropped.
  const pilot = (g: AirGame) => {
    const goal = g.pickups[0] ?? g.enemies[0];
    if (goal) g.target = { x: g.w * 0.2, y: goal.y };
    if (g.boss) g.target.y = g.boss.y;
  };

  it('fires by itself, with more guns at each level', () => {
    expect([1, 2, 3, 4, 5].map((p) => gunPattern(p).length)).toEqual([1, 2, 3, 4, 5]);
    const game = new AirGame(800, 360);
    game.tick(0.02);
    expect(game.bullets).toHaveLength(1);
    game.power = 5;
    play(game, 0.22);
    expect(game.bullets.length).toBeGreaterThanOrEqual(5);
  });
  it('shooting enemies scores, and pick-ups raise the guns to the limit', () => {
    const game = new AirGame(800, 360);
    let best = 1;
    play(game, 60, (g) => { pilot(g); best = Math.max(best, g.power); });
    expect(game.score).toBeGreaterThan(0);
    expect(best).toBeGreaterThan(1);
    expect(best).toBeLessThanOrEqual(MAX_POWER);
  });
  it('a boss arrives after enough kills, and defeating it starts the next wave', () => {
    const game = new AirGame(800, 360);
    let seen = false;
    for (let t = 0; t < 400 && game.wave === 1; t += 0.02) {
      pilot(game);
      game.tick(0.02);
      seen ||= !!game.boss;
    }
    expect(seen).toBe(true);
    expect(game.wave).toBe(2);
    expect(game.boss).toBeNull();
  });
  it('holds back ordinary enemies during a boss fight', () => {
    const game = new AirGame(800, 360);
    game.boss = { x: 600, y: 180, hp: 9999, maxHp: 9999, age: 0, reload: 99 };
    play(game, 10);
    expect(game.enemies).toHaveLength(0);
  });
  it('a hit costs one level of guns, shields briefly, and never ends the game', () => {
    const game = new AirGame(800, 360);
    game.power = 3;
    const shot = () => game.shots.push({ x: game.plane.x, y: game.plane.y, vx: 0, vy: 0 });
    shot();
    game.tick(0.02);
    expect(game.power).toBe(2);
    expect(game.shield).toBeGreaterThan(0);
    shot();
    game.tick(0.02);
    expect(game.power).toBe(2);
    game.power = 1;
    game.shield = 0;
    shot();
    game.tick(0.02);
    expect(game.power).toBe(1);
    expect('over' in game).toBe(false);
  });
});
