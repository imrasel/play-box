import { getEngine } from '../core/audio';
import { load, save } from '../core/storage';
import { h } from '../core/dom';
import { localPoint } from '../core/rotate';
import { btn, homeTool, panels, segmented, slider as uiSlider, tool } from '../core/ui';
import { CHORD_KEYS, STRUM_MS, keyChords, stripNotes, type Chord, type ChordKey } from './chords';
import { clampFirst, fitRange } from './geometry';
import { Instrument, VOICES, loadSamples, type VoiceId } from './instrument';
import { KeyboardView, THEMES, pitchColor } from './keyboard';
import { parseMidi } from './midi-import';
import { LearnSession, type LearnMode, type LearnNote } from './learn';
import { RainGame, endlessSong } from './rain';
import { RainView } from './rain-view';
import { HIGH, LOW, WHITE_COUNT, isBlack, noteName, whiteIndex, type LabelStyle } from './notes';
import { toMidiFile, type RecEvent, type Recording } from './recording';
import { SONGS, type Song } from './songs';

type RowMode = 'single' | 'dual' | 'duet' | 'chords';

const DEFAULTS = {
  voice: 'grand' as VoiceId,
  rowMode: 'single' as RowMode,
  visible: 15,
  first: [23, 23],
  keyHeight: 100,
  theme: 'classic',
  pressColor: '#ffb400',
  labels: 'letters' as LabelStyle,
  touchVelocity: true,
  volume: 0.9,
  reverb: 0.2,
  transpose: 0,
  bpm: 90,
  beats: 4,
  chordKey: 'C' as ChordKey,
  strum: true,
  chordKeys: false,
};

const SWATCHES = ['#ffb400', '#ff4d4d', '#37d67a', '#2d9cff', '#b65cff', '#ff5fa2'];
const KEY_MAP = 'awsedftgyhujkolp;';
const RING_MS = 1400; // how long a swiped chord bar sounds

export function mountPiano(root: HTMLElement, goHome: () => void, openGames = false) {
  const s = load('piano.settings', DEFAULTS);
  let recordings = load<Recording[]>('piano.recordings', []);
  let userSongs = load<Song[]>('piano.songs', []);
  const engine = getEngine();
  const inst = new Instrument(engine);
  inst.voice = s.voice;
  engine.setVolume(s.volume);
  engine.setReverb(s.reverb);

  const persist = () => save('piano.settings', s);
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  // ---- note routing ----------------------------------------------------
  const lit = new Map<number, number>();
  const litSet = new Set<number>();
  const light = (midi: number, delta: number) => {
    const n = Math.max(0, (lit.get(midi) ?? 0) + delta);
    lit.set(midi, n);
    if (n) litSet.add(midi); else litSet.delete(midi);
    rows.forEach((r) => r.view.invalidate());
    drawMaps();
  };
  const sounding = (midi: number) => Math.max(LOW, Math.min(HIGH, midi + s.transpose));

  /** A key pressed by the player, by any input device. */
  const userDown = (midi: number, vel: number) => {
    inst.noteOn(sounding(midi), vel);
    light(midi, 1);
    if (rec) rec.events.push({ t: performance.now() / 1000 - rec.start, midi, vel, on: true });
    if (session instanceof RainGame) session.input(midi);
    else if (session && session.mode !== 'watch') session.input(midi);
  };
  const userUp = (midi: number) => {
    inst.noteOff(sounding(midi));
    light(midi, -1);
    if (rec) rec.events.push({ t: performance.now() / 1000 - rec.start, midi, vel: 0, on: false });
  };
  /** A note played by the app: a song or a saved recording. */
  const autoDown = (midi: number, vel: number) => { inst.noteOn(sounding(midi), vel); light(midi, 1); };
  const autoUp = (midi: number) => { inst.noteOff(sounding(midi)); light(midi, -1); };

  // ---- layout ----------------------------------------------------------
  const maps = h('div', { class: 'maps' });
  const status = h('span', { class: 'status' });
  const recBtn = tool('⏺', 'Record', () => toggleRec());
  const pedalBtn = tool('🦶', 'Pedal', () => setPedal(!pedal));
  pedalBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const metroBtn = tool('🥁', 'Beat', () => toggleMetronome());
  const chordBtn = tool('🎸', 'Chords', () => {
    s.rowMode = s.rowMode === 'chords' ? 'single' : 'chords';
    persist();
    buildRows();
  });

  const navTools = [
    tool('◀', 'Left', () => shift(-2)),
    tool('▶', 'Right', () => shift(2)),
    tool('−', 'Bigger', () => zoom(-2)),
    tool('+', 'More', () => zoom(2)),
  ];

  const bar = h('header', { class: 'bar' },
    homeTool(goHome),
    navTools[0],
    maps,
    ...navTools.slice(1),
    pedalBtn, metroBtn, chordBtn, recBtn,
    tool('📂', 'Saved', () => openRecordings()),
    tool('🌟', 'Learn', () => openLearn()),
    tool('🎮', 'Game', () => openGame()),
    tool('🔊', 'Sound', () => openSounds()),
    tool('⚙️', 'Setup', () => openSettings()),
    status,
  );
  const fall = h('canvas', { class: 'fall' }) as HTMLCanvasElement;
  const hud = h('div', { class: 'hud' });
  const stage = h('div', { class: 'stage', hidden: true }, fall, hud);
  const spacer = h('div', { class: 'spacer' });
  const keysWrap = h('main', { class: 'keywrap' });
  const page = h('div', { class: 'piano' }, bar, stage, spacer, keysWrap);
  root.append(page);
  const { open: openPanel, close: closePanel } = panels(page);

  // ---- keyboard rows ---------------------------------------------------
  type Row = { view: KeyboardView; map: HTMLCanvasElement };
  let rows: Row[] = [];

  function buildRows() {
    rows.forEach((r) => r.view.destroy());
    padReleases.forEach((release) => release());
    padReleases.clear();
    keysWrap.replaceChildren();
    maps.replaceChildren();
    const showPads = s.rowMode === 'chords' && !session;
    const showKeys = !showPads || s.chordKeys;
    keysWrap.classList.toggle('with-pads', showPads);
    navTools.forEach((t) => { t.hidden = !showKeys; });
    chordBtn.classList.toggle('on', s.rowMode === 'chords');
    if (showPads) keysWrap.append(buildPads());
    const count = s.rowMode === 'dual' || s.rowMode === 'duet' ? (session ? 1 : 2) : 1;
    rows = Array.from({ length: count }, (_, i) => {
      const view = new KeyboardView({ onDown: userDown, onUp: userUp });
      view.active = litSet;
      view.noteColors = !!session;
      view.flipped = s.rowMode === 'duet' && !session && i === 0;
      // Hidden rows still drive the overview strip, which shows the chord notes.
      if (showKeys) keysWrap.append(view.canvas);
      const map = h('canvas', { class: 'map' }) as HTMLCanvasElement;
      bindMap(map, i);
      maps.append(map);
      return { view, map };
    });
    applyView();
  }

  // The keyboard gets less room beside the pads, so show fewer, larger keys.
  const visibleKeys = () => (s.rowMode === 'chords' ? Math.max(5, Math.round(s.visible * 0.6)) : s.visible);

  function applyView() {
    const theme = THEMES.find((t) => t.id === s.theme) ?? THEMES[0];
    rows.forEach((r, i) => {
      const fit = session ? fitRange(...songRange(session.song)) : null;
      r.view.theme = theme;
      r.view.labels = s.labels;
      r.view.pressColor = s.pressColor;
      r.view.touchVelocity = s.touchVelocity;
      r.view.layout = {
        ...r.view.layout,
        visible: fit?.visible ?? visibleKeys(),
        first: fit?.first ?? clampFirst(s.first[i], visibleKeys()),
      };
      r.view.invalidate();
    });
    keysWrap.style.flexGrow = String(session ? 0 : s.keyHeight);
    keysWrap.style.flexBasis = session ? '42%' : '0';
    spacer.style.flexGrow = String(session ? 0 : 100 - s.keyHeight);
    page.style.setProperty('--back', theme.back);
    drawMaps();
  }

  function shift(by: number) {
    s.first = s.first.map((f) => clampFirst(f + by, visibleKeys()));
    applyView();
    persist();
  }
  function zoom(by: number) {
    s.visible = Math.max(7, Math.min(WHITE_COUNT, s.visible + by));
    applyView();
    persist();
  }

  // ---- chord pads ------------------------------------------------------
  const padReleases = new Set<() => void>();

  /** Goes through userDown, so recording and transpose work with no extra code. */
  function playChord(notes: number[]) {
    const started: number[] = [];
    const pending: number[] = [];
    notes.forEach((midi, i) => {
      const go = () => { userDown(midi, 0.8); started.push(midi); };
      if (s.strum && i) pending.push(later(go, i * STRUM_MS));
      else go();
    });
    return () => {
      pending.forEach((id) => { clearTimeout(id); timers.delete(id); });
      started.forEach(userUp);
    };
  }

  function chordPad(chord: Chord) {
    const pad = h('button', { class: 'pad', style: `--pad:${pitchColor(chord.notes[0])}` },
      h('b', {}, chord.name));
    let release: (() => void) | null = null;
    const lift = () => {
      if (release) { release(); padReleases.delete(release); }
      release = null;
      pad.classList.remove('on');
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture(e.pointerId);
      lift();
      release = playChord(chord.notes);
      padReleases.add(release);
      pad.classList.add('on');
    });
    pad.addEventListener('pointerup', lift);
    pad.addEventListener('pointercancel', lift);
    return pad;
  }

  const rings = new Map<number, number>();

  /** Sound one bar and let it ring, so a swipe overlaps like harp strings. */
  function pluck(midi: number) {
    const ringing = rings.get(midi);
    if (ringing !== undefined) {
      clearTimeout(ringing);
      timers.delete(ringing);
      userUp(midi);
    }
    userDown(midi, 0.8);
    rings.set(midi, later(() => { rings.delete(midi); userUp(midi); }, RING_MS));
  }

  function chordStrip(chord: Chord) {
    const bars = stripNotes(chord).reverse().map(({ midi, name }) => {
      const label = s.labels === 'solfege' ? noteName(midi, 'solfege') : s.labels === 'none' ? '' : name;
      return h('div', { class: 'chord-bar', 'data-midi': midi, style: `--pad:${pitchColor(chord.notes[0])}` }, label);
    });
    return h('div', { class: 'strip' }, chordPad(chord), ...bars);
  }

  // Handled on the grid so one finger can travel across bars and columns.
  function bindSwipe(grid: HTMLElement) {
    const fingers = new Map<number, Element | null>();
    const hit = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.chord-bar') ?? null;
      if (!el || fingers.get(e.pointerId) === el) return;
      fingers.set(e.pointerId, el);
      pluck(Number(el.dataset.midi));
      el.classList.add('on');
      later(() => el.classList.remove('on'), 160);
    };
    grid.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('.pad')) return;
      e.preventDefault();
      grid.setPointerCapture(e.pointerId);
      fingers.set(e.pointerId, null);
      hit(e);
    });
    grid.addEventListener('pointermove', (e) => { if (fingers.has(e.pointerId)) hit(e); });
    const lift = (e: PointerEvent) => fingers.delete(e.pointerId);
    grid.addEventListener('pointerup', lift);
    grid.addEventListener('pointercancel', lift);
  }

  function buildPads() {
    const top = h('div', { class: 'pad-top' }, h('span', {}, 'Key'));
    CHORD_KEYS.forEach((key) => {
      const b = btn(key, () => { s.chordKey = key; persist(); buildRows(); });
      b.classList.toggle('on', key === s.chordKey);
      top.append(b);
    });
    const strum = btn('Strum', () => {
      s.strum = !s.strum;
      strum.classList.toggle('on', s.strum);
      persist();
    });
    strum.classList.toggle('on', s.strum);
    const keys = btn('Keys', () => { s.chordKeys = !s.chordKeys; persist(); buildRows(); });
    keys.classList.toggle('on', s.chordKeys);
    top.append(h('span', { class: 'hint' }, 'Tap a name or swipe the bars'), keys, strum);
    const grid = h('div', { class: 'pad-grid' }, ...keyChords(s.chordKey).map(chordStrip));
    bindSwipe(grid);
    return h('section', { class: 'pads' }, top, grid);
  }

  // ---- overview strip --------------------------------------------------
  function drawMaps() {
    rows.forEach((r) => {
      const c = r.map;
      const box = { width: c.clientWidth, height: c.clientHeight };
      if (!box.width) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (c.width !== Math.round(box.width * dpr)) {
        c.width = Math.round(box.width * dpr);
        c.height = Math.round(box.height * dpr);
      }
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = box.width / WHITE_COUNT;
      g.fillStyle = '#f4f1ea';
      g.fillRect(0, 0, box.width, box.height);
      for (let m = LOW; m <= HIGH; m++) {
        const x = whiteIndex(m) * w;
        if (isBlack(m)) {
          g.fillStyle = litSet.has(m) ? s.pressColor : '#222';
          g.fillRect(x + w * 0.65, 0, w * 0.7, box.height * 0.6);
        } else {
          if (litSet.has(m)) { g.fillStyle = s.pressColor; g.fillRect(x, 0, w, box.height); }
          g.fillStyle = 'rgba(0,0,0,.2)';
          g.fillRect(x, 0, 0.5, box.height);
        }
      }
      const l = r.view.layout;
      g.fillStyle = 'rgba(0,0,0,.45)';
      g.fillRect(0, 0, l.first * w, box.height);
      g.fillRect((l.first + l.visible) * w, 0, box.width, box.height);
      g.strokeStyle = '#ff3b3b';
      g.lineWidth = 2;
      g.strokeRect(l.first * w + 1, 1, l.visible * w - 2, box.height - 2);
    });
  }

  function bindMap(map: HTMLCanvasElement, i: number) {
    const go = (e: PointerEvent) => {
      if (session) return;
      const centre = (localPoint(e, map).x / map.clientWidth) * WHITE_COUNT;
      s.first[i] = clampFirst(centre - visibleKeys() / 2, visibleKeys());
      applyView();
    };
    map.addEventListener('pointerdown', (e) => { map.setPointerCapture(e.pointerId); go(e); });
    map.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') go(e); });
    map.addEventListener('pointerup', persist);
  }

  // ---- pedal -----------------------------------------------------------
  let pedal = false;
  function setPedal(down: boolean) {
    pedal = down;
    inst.setPedal(down);
    pedalBtn.classList.toggle('on', down);
  }

  // ---- metronome -------------------------------------------------------
  let metroTimer = 0;
  let metroNext = 0;
  let metroBeat = 0;
  function click(at: number, accent: boolean) {
    const c = engine.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = accent ? 1600 : 1000;
    g.gain.setValueAtTime(0.25, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    o.connect(g).connect(engine.input);
    o.start(at);
    o.stop(at + 0.06);
  }
  function toggleMetronome() {
    if (metroTimer) {
      clearInterval(metroTimer);
      metroTimer = 0;
    } else {
      metroNext = engine.ctx.currentTime + 0.05;
      metroBeat = 0;
      metroTimer = window.setInterval(() => {
        while (metroNext < engine.ctx.currentTime + 0.12) {
          click(metroNext, metroBeat % s.beats === 0);
          metroNext += 60 / s.bpm;
          metroBeat++;
        }
      }, 30);
    }
    metroBtn.classList.toggle('on', !!metroTimer);
  }

  // ---- recording -------------------------------------------------------
  let rec: { start: number; events: RecEvent[] } | null = null;
  function toggleRec() {
    if (!rec) {
      rec = { start: performance.now() / 1000, events: [] };
      recBtn.classList.add('rec');
      return;
    }
    const { events } = rec;
    rec = null;
    recBtn.classList.remove('rec');
    if (!events.some((e) => e.on)) return;
    const n = recordings.length + 1;
    recordings = [{
      id: String(Date.now()),
      name: `My song ${n}`,
      voice: s.voice,
      createdAt: Date.now(),
      duration: events[events.length - 1].t,
      events,
    }, ...recordings];
    if (!save('piano.recordings', recordings)) toast('Could not save: storage is full');
    else toast(`Saved as “My song ${n}”`);
  }

  let stopPlayback: (() => void) | null = null;
  function playRecording(r: Recording) {
    stopPlayback?.();
    const previous = inst.voice;
    inst.voice = r.voice as VoiceId;
    const ids: number[] = [];
    const held = new Set<number>();
    for (const e of r.events) {
      ids.push(later(() => {
        if (e.on) { autoDown(e.midi, e.vel); held.add(e.midi); }
        else if (held.delete(e.midi)) autoUp(e.midi);
      }, e.t * 1000));
    }
    const finish = () => {
      ids.forEach((id) => { clearTimeout(id); timers.delete(id); });
      held.forEach((m) => autoUp(m));
      inst.voice = previous;
      stopPlayback = null;
      status.textContent = '';
    };
    ids.push(later(finish, r.duration * 1000 + 300));
    stopPlayback = finish;
    status.textContent = `▶ ${r.name}`;
  }

  function download(r: Recording) {
    const url = URL.createObjectURL(new Blob([toMidiFile(r.events) as BlobPart], { type: 'audio/midi' }));
    const a = h('a', { href: url, download: `${r.name}.mid` });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- learn mode ------------------------------------------------------
  let session: LearnSession | RainGame | null = null;
  let learnRaf = 0;
  let paused = false;
  let lastSong: { song: Song; mode: LearnMode; speed: number } | null = null;
  let rainView = new RainView();
  const songRange = (song: Song): [number, number] => {
    const all = song.notes.map((n) => n.midi);
    return [Math.min(...all), Math.max(...all)];
  };

  function startLearn(song: Song, mode: LearnMode, speed: number) {
    stopLearn();
    stopPlayback?.();
    closePanel();
    lastSong = { song, mode, speed };
    const learn = new LearnSession(song, mode, speed);
    session = learn;
    paused = false;
    stage.hidden = false;
    spacer.hidden = true;
    buildRows();
    hud.replaceChildren(
      btn('✕ Stop', () => stopLearn()),
      btn('⏸', (e) => {
        paused = !paused;
        (e.currentTarget as HTMLElement).textContent = paused ? '▶' : '⏸';
      }),
      btn('↺', () => startLearn(song, mode, speed)),
      h('b', { class: 'hud-title' }, song.title),
      h('div', { class: 'progress' }, h('i', { id: 'pg' })),
    );
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (session === learn && !paused) {
        for (const n of learn.tick(dt)) playSongNote(n, learn);
        rows[0].view.hints = new Set(learn.mode === 'watch' ? [] : learn.hints());
        rows[0].view.invalidate();
        drawFall(learn);
        if (learn.finished) return finishLearn(learn);
      }
      learnRaf = requestAnimationFrame(frame);
    };
    learnRaf = requestAnimationFrame(frame);
  }

  function startGame(song: Song, lives: number, speed: number, endless: boolean) {
    stopLearn();
    stopPlayback?.();
    closePanel();
    const game = new RainGame(song, lives, speed, endless);
    session = game;
    paused = false;
    stage.hidden = false;
    spacer.hidden = true;
    buildRows();
    const score = h('span', { class: 'game-score' }, '0');
    const mult = h('span', { class: 'game-mult' });
    const hearts = h('span', { class: 'game-hearts' });
    hud.classList.add('game');
    hud.replaceChildren(
      btn('✕', () => {
        stopLearn();
        if (openGames) goHome();
      }),
      btn('⏸', (e) => {
        paused = !paused;
        (e.currentTarget as HTMLElement).textContent = paused ? '▶' : '⏸';
      }),
      btn('🎵', () => openGame()),
      score, mult, h('div', { class: 'progress' }, h('i', { id: 'pg' })), hearts,
    );
    rainView = new RainView();
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (session === game && !paused) {
        game.tick(dt);
        const size = { width: fall.clientWidth, height: fall.clientHeight };
        const g = sizeFall(size);
        rainView.draw(g, size.width, size.height, game, rows[0].view.layout);
        score.textContent = game.score.toLocaleString();
        mult.textContent = game.multiplier > 1 ? `x${game.multiplier}` : '';
        hearts.textContent = lives ? '❤️'.repeat(Math.max(0, game.hearts)) : '';
        const bar = hud.querySelector<HTMLElement>('#pg');
        if (bar) bar.style.width = endless ? '100%' : `${game.progress * 100}%`;
        if (game.finished) return finishGame(game, () => startGame(endless ? endlessSong() : song, lives, speed, endless));
      }
      learnRaf = requestAnimationFrame(frame);
    };
    learnRaf = requestAnimationFrame(frame);
  }

  function finishGame(game: RainGame, again: () => void) {
    const best = load<Record<string, number>>('piano.rainBest', {});
    const record = game.score > (best[game.song.id] ?? 0);
    if (record) {
      best[game.song.id] = game.score;
      save('piano.rainBest', best);
    }
    stopLearn();
    openPanel(game.over ? 'Game over' : 'Song complete!', (body) => {
      body.append(h('p', { class: 'result-score' }, game.score.toLocaleString()));
      if (record && game.score) body.append(h('p', { class: 'stars' }, '🏆'));
      body.append(
        h('p', { class: 'stars' }, '⭐'.repeat(game.stars) + '☆'.repeat(3 - game.stars)),
        h('p', {}, `${game.hits} notes hit · best combo ${game.bestCombo}`),
        btn('Play again', again), btn('Pick a song', () => openGame()),
      );
    });
  }

  function sizeFall(box: { width: number; height: number }) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (fall.width !== Math.round(box.width * dpr) || fall.height !== Math.round(box.height * dpr)) {
      fall.width = Math.round(box.width * dpr);
      fall.height = Math.round(box.height * dpr);
    }
    const g = fall.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return g;
  }

  function playSongNote(n: LearnNote, sess: LearnSession) {
    autoDown(n.midi, 0.75);
    later(() => autoUp(n.midi), ((n.dur * 60) / sess.song.bpm / sess.speed) * 900);
  }

  function drawFall(sess: LearnSession) {
    const box = { width: fall.clientWidth, height: fall.clientHeight };
    rainView.draw(sizeFall(box), box.width, box.height, sess, rows[0].view.layout);
    const title = hud.querySelector<HTMLElement>('.hud-title');
    if (title) title.textContent = sess.waiting ? 'Your turn! Press the green key' : sess.song.title;
    const bar = hud.querySelector<HTMLElement>('#pg');
    if (bar) bar.style.width = `${sess.progress * 100}%`;
  }

  function finishLearn(sess: LearnSession) {
    const played = sess.mode !== 'watch';
    const { song, mode, speed } = lastSong!;
    const best = load<Record<string, number>>('piano.stars', {});
    if (played && sess.stars > (best[song.id] ?? 0)) {
      best[song.id] = sess.stars;
      save('piano.stars', best);
    }
    stopLearn();
    openPanel(played ? 'Well played!' : 'That was the song!', (body) => {
      if (played) body.append(h('p', { class: 'stars' }, '⭐'.repeat(sess.stars) + '☆'.repeat(3 - sess.stars)));
      if (played) body.append(h('p', {}, `${sess.hits} of ${sess.notes.length} notes`));
      body.append(btn('Play again', () => startLearn(song, mode === 'watch' ? 'wait' : mode, speed)), btn('Pick a song', () => openLearn()));
    });
  }

  function stopLearn() {
    cancelAnimationFrame(learnRaf);
    if (!session) return;
    session = null;
    hud.classList.remove('game');
    stage.hidden = true;
    spacer.hidden = false;
    rows.forEach((r) => { r.view.hints = new Set(); });
    buildRows();
  }

  // ---- panels ----------------------------------------------------------
  function openSounds() {
    openPanel('Sound', (body) => {
      const grid = h('div', { class: 'choice-grid' });
      VOICES.forEach((v) => {
        const b = btn(`${v.emoji} ${v.name}`, () => {
          s.voice = inst.voice = v.id;
          persist();
          grid.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
          b.classList.add('on');
          inst.noteOn(60, 0.8);
          later(() => inst.noteOff(60), 500);
        });
        b.classList.toggle('on', v.id === s.voice);
        grid.append(b);
      });
      body.append(grid,
        slider('Volume', s.volume, 0, 1, 0.05, (v) => { s.volume = v; engine.setVolume(v); }),
        slider('Echo (reverb)', s.reverb, 0, 0.6, 0.02, (v) => { s.reverb = v; engine.setReverb(v); }),
        slider('Transpose (semitones)', s.transpose, -12, 12, 1, (v) => { inst.allOff(); s.transpose = v; }),
      );
    });
  }

  function openLearn() {
    let mode: LearnMode = 'wait';
    let speed = 1;
    const best = load<Record<string, number>>('piano.stars', {});
    openPanel('Learn a song', (body) => {
      body.append(
        segmented('How to play', [['wait', 'Wait for me'], ['play', 'Play along'], ['watch', 'Just listen']], mode, (v) => { mode = v as LearnMode; }),
        slider('Speed %', 100, 40, 150, 10, (v) => { speed = v / 100; }, false),
      );
      body.append(songList((song) => `${song.title}  ${'⭐'.repeat(best[song.id] ?? 0)}`, (song) => startLearn(song, mode, speed), openLearn));
    });
  }

  /** Built-in songs plus the player's imported MIDI files, which stay on this device. */
  function songList(label: (song: Song) => string, play: (song: Song) => void, reopen: () => void) {
    const list = h('div', { class: 'song-list' });
    const file = h('input', { type: 'file', accept: '.mid,.midi,audio/midi', hidden: true }) as HTMLInputElement;
    file.addEventListener('change', async () => {
      const chosen = file.files?.[0];
      if (!chosen) return;
      try {
        const song = parseMidi(new Uint8Array(await chosen.arrayBuffer()), chosen.name);
        userSongs = [song, ...userSongs];
        if (!save('piano.songs', userSongs)) toast('Could not save: storage is full');
        reopen();
      } catch {
        toast('That file could not be read as a song');
      }
    });
    list.append(file, btn('➕ Import song (MIDI file)', () => file.click()));
    for (const song of userSongs) {
      const row = h('div', { class: 'song-row' },
        btn(`🎵 ${label(song)}`, () => play(song)),
        btn('🗑', () => {
          userSongs = userSongs.filter((x) => x !== song);
          save('piano.songs', userSongs);
          row.remove();
        }));
      list.append(row);
    }
    for (const song of SONGS) list.append(btn(label(song), () => play(song)));
    return list;
  }

  function openGame() {
    let lives = 0;
    let speed = 1;
    const best = load<Record<string, number>>('piano.rainBest', {});
    const score = (id: string) => (best[id] ? `  🏆 ${best[id].toLocaleString()}` : '');
    openPanel('Note Rain', (body) => {
      body.append(
        h('p', { class: 'small' }, 'Notes keep falling. Hit each key as its note lands!'),
        segmented('When a note is missed', [['0', 'Keep going'], ['3', '3 hearts'], ['1', 'One miss stops']], '0', (v) => { lives = Number(v); }),
        segmented('Speed', [['0.7', 'Slow'], ['1', 'Normal'], ['1.35', 'Fast']], '1', (v) => { speed = Number(v); }),
      );
      const list = h('div', { class: 'song-list' });
      list.append(btn(`🌧️ Endless Rain${score('endless')}`, () => startGame(endlessSong(), lives, speed, true)));
      body.append(list, songList((song) => `${song.title}${score(song.id)}`, (song) => startGame(song, lives, speed, false), openGame));
    });
  }

  function openRecordings() {
    openPanel('My recordings', (body) => {
      if (!recordings.length) body.append(h('p', {}, 'Nothing yet. Press ⏺, play something, then press ⏺ again.'));
      for (const r of recordings) {
        const row = h('div', { class: 'rec-row' },
          h('span', {}, `${r.name} · ${Math.round(r.duration)}s`),
          btn('▶', () => { closePanel(); playRecording(r); }),
          btn('⬇ MIDI', () => download(r)),
          btn('🗑', () => {
            recordings = recordings.filter((x) => x !== r);
            save('piano.recordings', recordings);
            row.remove();
          }),
        );
        body.append(row);
      }
    });
  }

  function openSettings() {
    openPanel('Setup', (body) => {
      const swatches = h('div', { class: 'swatches' });
      SWATCHES.forEach((c) => {
        const b = h('button', { class: 'swatch', style: `background:${c}`, 'aria-label': c });
        b.addEventListener('click', () => { s.pressColor = c; applyView(); persist(); });
        swatches.append(b);
      });
      const fullscreen = btn('⛶ Full screen', async () => {
        try {
          await document.documentElement.requestFullscreen();
          await (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape');
        } catch { /* laptops and some browsers refuse; harmless */ }
      });
      const midi = btn('🎹 Connect MIDI keyboard', () => connectMidi());
      body.append(
        segmented('Keyboard rows', [['single', 'One'], ['dual', 'Two'], ['duet', 'Two players'], ['chords', 'Chords']], s.rowMode, (v) => {
          s.rowMode = v as RowMode; persist(); buildRows();
        }),
        slider('Keys on screen', s.visible, 7, WHITE_COUNT, 1, (v) => { s.visible = v; applyView(); }),
        slider('Key height %', s.keyHeight, 50, 100, 5, (v) => { s.keyHeight = v; applyView(); }),
        segmented('Key style', THEMES.map((t) => [t.id, t.name]), s.theme, (v) => { s.theme = v; persist(); applyView(); }),
        h('p', { class: 'label' }, 'Press colour'), swatches,
        segmented('Key names', [['none', 'Off'], ['letters', 'C D E'], ['solfege', 'Do Re Mi'], ['octave', 'C4']], s.labels, (v) => {
          s.labels = v as LabelStyle; persist(); applyView();
        }),
        segmented('Touch strength', [['1', 'Lower = louder'], ['0', 'Always the same']], s.touchVelocity ? '1' : '0', (v) => {
          s.touchVelocity = v === '1'; persist(); applyView();
        }),
        slider('Beat speed (BPM)', s.bpm, 40, 200, 5, (v) => { s.bpm = v; }),
        segmented('Beats in a bar', [['3', '3'], ['4', '4'], ['6', '6']], String(s.beats), (v) => { s.beats = Number(v); persist(); }),
        fullscreen, midi,
        h('p', { class: 'small' }, `Sound delay reported by the browser: ${engine.latencyMs} ms`),
        h('p', { class: 'small' }, 'Piano sound: Salamander Grand Piano by Alexander Holm (CC BY 3.0).'),
      );
    });
  }

  function slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void, store = true) {
    return uiSlider(label, value, min, max, step, (v) => {
      set(v);
      if (store) persist();
    });
  }

  const toastEl = h('div', { class: 'toast', hidden: true });
  page.append(toastEl);
  function toast(text: string) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    later(() => { toastEl.hidden = true; }, 2200);
  }

  // ---- other inputs ----------------------------------------------------
  const physical = new Map<string, number>();
  let octave = 0;
  const keydown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    if (e.key === ' ') { e.preventDefault(); setPedal(true); return; }
    if (e.key === 'z') octave = Math.max(-3, octave - 1);
    if (e.key === 'x') octave = Math.min(3, octave + 1);
    const i = KEY_MAP.indexOf(e.key.toLowerCase());
    if (i < 0) return;
    const midi = 60 + i + octave * 12;
    physical.set(e.code, midi);
    userDown(midi, 0.8);
  };
  const keyup = (e: KeyboardEvent) => {
    if (e.key === ' ') setPedal(false);
    const midi = physical.get(e.code);
    if (midi === undefined) return;
    physical.delete(e.code);
    userUp(midi);
  };
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  async function connectMidi() {
    try {
      const access = await navigator.requestMIDIAccess();
      let inputs = 0;
      access.inputs.forEach((input) => {
        inputs++;
        input.onmidimessage = (m) => {
          const [cmd, a, b] = m.data!;
          const type = cmd & 0xf0;
          if (type === 0x90 && b > 0) userDown(a, b / 127);
          else if (type === 0x80 || type === 0x90) userUp(a);
          else if (type === 0xb0 && a === 64) setPedal(b >= 64);
        };
      });
      toast(inputs ? 'MIDI keyboard connected' : 'No MIDI keyboard found');
    } catch {
      toast('This browser cannot use MIDI keyboards');
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') engine.resume();
    else inst.allOff();
  };
  document.addEventListener('visibilitychange', onVisible);

  const onResize = () => requestAnimationFrame(drawMaps);
  window.addEventListener('resize', onResize);

  buildRows();
  requestAnimationFrame(drawMaps);
  // From the Games list it starts at once. Settings wait behind the 🎵 button.
  if (openGames) startGame(SONGS.find((song) => song.id === 'birthday')!, 0, 0.7, false);
  loadSamples(engine.ctx, (done, total) => {
    status.textContent = done < total ? `Piano ${Math.round((done / total) * 100)}%` : '';
  });

  return () => {
    if (rec) toggleRec();
    if (metroTimer) toggleMetronome();
    padReleases.forEach((release) => release());
    stopPlayback?.();
    cancelAnimationFrame(learnRaf);
    timers.forEach(clearTimeout);
    rows.forEach((r) => r.view.destroy());
    inst.allOff();
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisible);
    page.remove();
  };
}
