import { getEngine } from '../core/audio';
import { h } from '../core/dom';
import { load, save } from '../core/storage';
import { btn, homeTool, panels, segmented, slider, tool } from '../core/ui';
import { GROOVES, grooveLength, hitsAt } from '../drums/grooves';
import { playDrum } from '../drums/kit';
import { Neck, type NeckMode } from './neck';
import { CUSTOM, PATTERNS, PROGRESSIONS, SLOT_CYCLE, strokes, type Slot } from './rhythm';
import { GUITARS, GuitarSynth, type GuitarVoice } from './synth';
import { CHORD_NAMES, chordNotes } from './theory';

type Take = { id: string; name: string; duration: number; voice: GuitarVoice; events: { t: number; s: number; midi: number }[] };

const DEFAULTS = {
  voice: 'acoustic' as GuitarVoice, mode: 'chords' as NeckMode, chord: 'C', volume: 0.9, reverb: 0.16,
  bpm: 90, pattern: 'yours', custom: 'D-DU-UDU', progression: 'off', drums: 'off',
};

export function mountGuitar(root: HTMLElement, goHome: () => void) {
  const s = load('guitar.settings', DEFAULTS);
  let takes = load<Take[]>('guitar.takes', []);
  const engine = getEngine();
  engine.setVolume(s.volume);
  engine.setReverb(s.reverb);
  const synth = new GuitarSynth(engine);
  synth.voice = s.voice;
  const persist = () => save('guitar.settings', s);

  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  let take: { start: number; events: Take['events'] } | null = null;
  const log = (string: number, midi: number, at = 0) => {
    if (take) take.events.push({ t: performance.now() / 1000 - take.start + at, s: string, midi });
  };

  const neck = new Neck((string, midi) => {
    synth.play(string, midi);
    log(string, midi);
  });
  neck.mode = s.mode;
  neck.chord = s.chord;

  /** One tap on a chord strums it, so it sounds right before any swiping. */
  function strum(slot: Slot = 'D', when = engine.ctx.currentTime, onBeat = false) {
    const delay = when - engine.ctx.currentTime;
    for (const k of strokes(slot, chordNotes(neck.chord), onBeat)) {
      synth.play(k.string, k.midi, k.vel, when + k.gap, k.muted);
      log(k.string, k.midi, delay + k.gap);
      later(() => neck.shake(k.string), (delay + k.gap) * 1000);
    }
  }

  // ---- auto strum ------------------------------------------------------
  let timer = 0;
  let next = 0;
  let step = 0; // sixteenth notes within the pattern
  let bar = 0;
  let drumStep = 0;
  const slots = () => (s.pattern === CUSTOM ? s.custom : PATTERNS.find((p) => p.id === s.pattern)?.slots ?? PATTERNS[0].slots);
  const progression = () => PROGRESSIONS.find((p) => p.id === s.progression) ?? PROGRESSIONS[0];

  function schedule() {
    const c = engine.ctx;
    while (next < c.currentTime + 0.12) {
      const when = next;
      const line = slots();
      const chords = progression().chords;
      if (step === 0 && chords.length) {
        const chord = chords[bar % chords.length];
        neck.chord = chord; // sounded straight away; the buttons catch up on the beat
        later(() => setChord(chord), Math.max(0, (when - c.currentTime) * 1000));
      }
      if (step % 2 === 0) {
        const slot = step / 2;
        strum(line[slot] as Slot, when, slot % 4 === 0);
      }
      const groove = GROOVES.find((g) => g.id === s.drums);
      if (groove) {
        for (const id of hitsAt(groove, drumStep)) playDrum(c, engine.input, id, 'acoustic', id === 'hat' ? 0.4 : 0.62, when);
        drumStep = (drumStep + 1) % grooveLength(groove);
      }
      next += 60 / s.bpm / 4;
      step += 1;
      if (step >= line.length * 2) {
        step = 0;
        bar += 1;
      }
    }
  }

  function toggleAuto() {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    } else {
      next = engine.ctx.currentTime + 0.06;
      step = bar = drumStep = 0;
      timer = window.setInterval(schedule, 25);
    }
    playBtn.textContent = timer ? '⏹' : '▶';
    playBtn.classList.toggle('on', !!timer);
  }

  const setBpm = (bpm: number) => {
    s.bpm = Math.max(40, Math.min(200, bpm));
    bpmLabel.textContent = `${s.bpm}`;
    persist();
  };
  const patternLabel = () => (s.pattern === CUSTOM ? 'My pattern' : PATTERNS.find((p) => p.id === s.pattern)?.name ?? '');

  const padGrid = h('section', { class: 'guitar-pads' });
  const pads = new Map<string, HTMLElement>();
  for (const name of CHORD_NAMES) {
    const pad = h('button', { class: 'guitar-pad' }, name);
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setChord(name);
      if (!timer) strum();
    });
    pads.set(name, pad);
    padGrid.append(pad);
  }
  function setChord(name: string) {
    s.chord = neck.chord = name;
    pads.forEach((p, n) => p.classList.toggle('on', n === name));
    neck.redraw();
    persist();
  }

  const recBtn = tool('⏺', 'Record', toggleRec);
  const modeBtn = btn('', () => setMode(s.mode === 'chords' ? 'frets' : 'chords'));
  modeBtn.classList.add('beat-name');

  function setMode(mode: NeckMode) {
    s.mode = neck.mode = mode;
    padGrid.hidden = mode !== 'chords';
    modeBtn.textContent = mode === 'chords' ? 'Chords' : 'Fretboard';
    persist();
    requestAnimationFrame(() => neck.paintBoard());
  }

  const playBtn = tool('▶', 'Auto strum', toggleAuto);
  const rhythmBtn = btn(patternLabel(), () => openRhythm());
  rhythmBtn.classList.add('rhythm-name');
  const bpmLabel = h('span', { class: 'bpm' }, String(s.bpm));
  const header = h('header', { class: 'bar' },
    homeTool(goHome),
    modeBtn,
    playBtn, rhythmBtn,
    tool('−', 'Slower', () => setBpm(s.bpm - 5)), bpmLabel, tool('+', 'Faster', () => setBpm(s.bpm + 5)),
    h('span', { class: 'bar-gap' }),
    recBtn,
    tool('📂', 'Saved', () => openTakes()),
    tool('⚙️', 'Setup', () => openSetup()),
  );
  const page = h('div', { class: 'piano guitar' }, header, h('main', { class: 'guitar-stage' }, padGrid, neck.canvas));
  const toastEl = h('div', { class: 'toast', hidden: true });
  page.append(toastEl);
  root.append(page);
  const { open, close } = panels(page);
  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    later(() => { toastEl.hidden = true; }, 2200);
  };

  setChord(s.chord);
  setMode(s.mode);

  function toggleRec() {
    if (!take) {
      take = { start: performance.now() / 1000, events: [] };
      recBtn.classList.add('rec');
      return;
    }
    const { events, start } = take;
    take = null;
    recBtn.classList.remove('rec');
    if (!events.length) return;
    const name = `My tune ${takes.length + 1}`;
    takes = [{ id: String(Date.now()), name, voice: s.voice, duration: performance.now() / 1000 - start, events }, ...takes];
    toast(save('guitar.takes', takes) ? `Saved as “${name}”` : 'Could not save: storage is full');
  }

  function replay(t: Take) {
    const current = synth.voice;
    synth.voice = t.voice;
    for (const e of t.events) {
      later(() => { synth.play(e.s, e.midi); neck.shake(e.s); }, e.t * 1000);
    }
    later(() => { synth.voice = current; }, t.duration * 1000 + 300);
  }

  function openTakes() {
    open('My tunes', (body) => {
      if (!takes.length) body.append(h('p', {}, 'Nothing yet. Press ⏺, play something, then press ⏺ again.'));
      for (const t of takes) {
        const row = h('div', { class: 'rec-row' },
          h('span', {}, `${t.name} · ${Math.round(t.duration)}s`),
          btn('▶', () => { close(); replay(t); }),
          btn('🗑', () => {
            takes = takes.filter((x) => x !== t);
            save('guitar.takes', takes);
            row.remove();
          }),
        );
        body.append(row);
      }
    });
  }

  function openRhythm() {
    open('Rhythm', (body) => {
      const list = h('div', { class: 'song-list' });
      const pick = (id: string) => {
        s.pattern = id;
        rhythmBtn.textContent = patternLabel();
        step = 0;
        persist();
      };
      for (const p of PATTERNS) {
        const b = btn(p.name, () => { pick(p.id); close(); if (!timer) toggleAuto(); });
        b.classList.toggle('on', p.id === s.pattern);
        list.append(b);
      }
      const editor = h('div', { class: 'slots' });
      [...s.custom].forEach((slot, i) => {
        const b = btn(slot === '-' ? '·' : slot, () => {
          const value = SLOT_CYCLE[(SLOT_CYCLE.indexOf(s.custom[i] as Slot) + 1) % SLOT_CYCLE.length];
          s.custom = s.custom.slice(0, i) + value + s.custom.slice(i + 1);
          b.textContent = value === '-' ? '·' : value;
          pick(CUSTOM);
        });
        editor.append(b);
      });
      body.append(
        h('p', { class: 'label' }, 'Strum pattern'), list,
        h('p', { class: 'label' }, 'My pattern (tap a box: D down, U up, X chuck, · rest)'), editor,
        segmented('Chords', PROGRESSIONS.map((p) => [p.id, p.name]), s.progression, (v) => { s.progression = v; bar = 0; persist(); }),
        segmented('Drums play along', [['off', 'Off'], ...GROOVES.map((g) => [g.id, g.name])], s.drums, (v) => { s.drums = v; drumStep = 0; persist(); }),
      );
    });
  }

  function openSetup() {
    open('Setup', (body) => body.append(
      segmented('Guitar', GUITARS.map((g) => [g.id, g.name]), s.voice, (v) => {
        s.voice = synth.voice = v as GuitarVoice;
        persist();
        if (!timer) strum();
      }),
      slider('Volume', s.volume, 0, 1, 0.05, (v) => { s.volume = v; engine.setVolume(v); persist(); }),
      slider('Echo (reverb)', s.reverb, 0, 0.6, 0.02, (v) => { s.reverb = v; engine.setReverb(v); persist(); }),
    ));
  }

  const keydown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    if (e.key === ' ') {
      e.preventDefault();
      toggleAuto();
      return;
    }
    const name = CHORD_NAMES[Number(e.key) - 1];
    if (!name) return;
    setChord(name);
    if (!timer) strum();
  };
  window.addEventListener('keydown', keydown);

  return () => {
    if (take) toggleRec();
    if (timer) toggleAuto();
    timers.forEach(clearTimeout);
    neck.destroy();
    synth.destroy();
    window.removeEventListener('keydown', keydown);
    page.remove();
  };
}
