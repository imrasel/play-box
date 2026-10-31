import { getEngine } from '../core/audio';
import { h } from '../core/dom';
import { load, save } from '../core/storage';
import { btn, homeTool, panels, segmented, slider, tool } from '../core/ui';
import { buildKit } from './art';
import { GROOVES, grooveLength, hitsAt, stepSeconds } from './grooves';
import { DRUMS, EXTRAS, playDrum, type DrumId, type KitId } from './kit';

type Take = { id: string; name: string; duration: number; kit: KitId; events: { t: number; id: DrumId }[] };

const DEFAULTS = { kit: 'acoustic' as KitId, groove: 'rock', bpm: 110, volume: 0.9, extras: false };
const KEYS: Record<string, DrumId> = {
  ' ': 'kick', a: 'hat', s: 'snare', d: 'tom1', f: 'tom2', g: 'floor', h: 'open', j: 'crash', k: 'ride',
  z: 'clap', x: 'cowbell', c: 'tambourine', v: 'rim',
};

export function mountDrums(root: HTMLElement, goHome: () => void) {
  const s = load('drums.settings', DEFAULTS);
  let takes = load<Take[]>('drums.takes', []);
  const engine = getEngine();
  engine.setVolume(s.volume);
  engine.setReverb(0.08);

  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  const kit = buildKit();
  const extras = h('div', { class: 'extras', hidden: !s.extras },
    ...EXTRAS.map((e) => h('button', { class: 'extra', 'data-id': e.id }, h('span', { class: 'skin' }, e.label))));
  const pieces = new Map<DrumId, Element>();
  for (const id of DRUMS) pieces.set(id, (kit.querySelector(`[data-id=${id}]`) ?? extras.querySelector(`[data-id=${id}]`))!);

  // Restarting the CSS animation needs a reflow, so swap between two identical classes.
  const strike = (id: DrumId) => {
    const piece = pieces.get(id);
    if (!piece) return; // hand drums only exist in the beats
    const odd = piece.classList.contains('hit-a');
    piece.classList.toggle('hit-a', !odd);
    piece.classList.toggle('hit-b', odd);
  };

  function hit(id: DrumId) {
    engine.resume();
    playDrum(engine.ctx, engine.input, id, s.kit);
    strike(id);
    if (take) take.events.push({ t: performance.now() / 1000 - take.start, id });
  }

  for (const [id, piece] of pieces) {
    piece.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hit(id);
    });
  }

  // ---- backing beat ----------------------------------------------------
  let beatTimer = 0;
  let next = 0;
  let step = 0;
  const groove = () => GROOVES.find((g) => g.id === s.groove) ?? GROOVES[0];

  function toggleBeat() {
    if (beatTimer) {
      clearInterval(beatTimer);
      beatTimer = 0;
    } else {
      next = engine.ctx.currentTime + 0.06;
      step = 0;
      beatTimer = window.setInterval(() => {
        const g = groove();
        while (next < engine.ctx.currentTime + 0.12) {
          const when = next;
          for (const id of hitsAt(g, step)) {
            playDrum(engine.ctx, engine.input, id, s.kit, id === 'hat' ? 0.5 : 0.66, when);
            later(() => strike(id), Math.max(0, (when - engine.ctx.currentTime) * 1000));
          }
          next += stepSeconds(s.bpm);
          step = (step + 1) % grooveLength(g);
        }
      }, 25);
    }
    playBtn.textContent = beatTimer ? '⏹' : '▶';
    playBtn.classList.toggle('on', !!beatTimer);
  }

  const setBpm = (bpm: number) => {
    s.bpm = Math.max(50, Math.min(200, bpm));
    bpmLabel.textContent = `${s.bpm}`;
    save('drums.settings', s);
  };

  // ---- recording -------------------------------------------------------
  let take: { start: number; events: Take['events'] } | null = null;
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
    const name = `My beat ${takes.length + 1}`;
    takes = [{ id: String(Date.now()), name, kit: s.kit, duration: performance.now() / 1000 - start, events }, ...takes];
    toast(save('drums.takes', takes) ? `Saved as “${name}”` : 'Could not save: storage is full');
  }

  let stopReplay: (() => void) | null = null;
  function replay(t: Take) {
    stopReplay?.();
    const ids = t.events.map((e) => later(() => {
      playDrum(engine.ctx, engine.input, e.id, t.kit);
      strike(e.id);
    }, e.t * 1000));
    stopReplay = () => {
      ids.forEach((id) => { clearTimeout(id); timers.delete(id); });
      stopReplay = null;
    };
  }

  // ---- layout ----------------------------------------------------------
  const playBtn = tool('▶', 'Play beat', toggleBeat);
  const recBtn = tool('⏺', 'Record', toggleRec);
  const bpmLabel = h('span', { class: 'bpm' }, String(s.bpm));
  const beatName = btn(groove().name.split(' · ')[0], () => openBeats());
  beatName.classList.add('beat-name');
  const bar = h('header', { class: 'bar' },
    homeTool(goHome),
    playBtn, beatName,
    tool('−', 'Slower', () => setBpm(s.bpm - 5)), bpmLabel, tool('+', 'Faster', () => setBpm(s.bpm + 5)),
    h('span', { class: 'bar-gap' }),
    recBtn,
    tool('📂', 'Saved', () => openTakes()),
    tool('⚙️', 'Setup', () => openSetup()),
  );
  const page = h('div', { class: 'piano drums', 'data-kit': s.kit }, bar, extras, kit);
  const toastEl = h('div', { class: 'toast', hidden: true });
  page.append(toastEl);
  root.append(page);
  const toast = (text: string) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    later(() => { toastEl.hidden = true; }, 2200);
  };

  const { open, close } = panels(page);

  function openBeats() {
    open('Backing beat', (body) => {
      const list = h('div', { class: 'song-list' });
      const section = (title: string, desi: boolean) => list.append(
        h('p', { class: 'label' }, title),
        ...GROOVES.filter((g) => !!g.desi === desi).map(row),
      );
      const row = (g: (typeof GROOVES)[number]) => {
        const b = btn(`${g.name} · ${g.bpm}`, () => {
          s.groove = g.id;
          beatName.textContent = g.name.split(' · ')[0];
          setBpm(g.bpm);
          step = 0;
          close();
          if (!beatTimer) toggleBeat();
        });
        b.classList.toggle('on', g.id === s.groove);
        return b;
      };
      section('Bollywood & Bangla', true);
      section('Popular', false);
      body.append(h('p', { class: 'small' }, 'To sing along, use − and + to match the speed of the song.'), list);
    });
  }

  function openTakes() {
    open('My beats', (body) => {
      if (!takes.length) body.append(h('p', {}, 'Nothing yet. Press ⏺, play something, then press ⏺ again.'));
      for (const t of takes) {
        const row = h('div', { class: 'rec-row' },
          h('span', {}, `${t.name} · ${Math.round(t.duration)}s`),
          btn('▶', () => { close(); replay(t); }),
          btn('🗑', () => {
            takes = takes.filter((x) => x !== t);
            save('drums.takes', takes);
            row.remove();
          }),
        );
        body.append(row);
      }
    });
  }

  function openSetup() {
    open('Setup', (body) => body.append(
      segmented('Drum kit', [['acoustic', 'Acoustic'], ['electronic', 'Electronic']], s.kit, (v) => {
        s.kit = v as KitId;
        page.dataset.kit = v;
        save('drums.settings', s);
      }),
      segmented('Extra pads (clap, cowbell, tambourine, rim)', [['0', 'Hide'], ['1', 'Show']], s.extras ? '1' : '0', (v) => {
        s.extras = v === '1';
        extras.hidden = !s.extras;
        save('drums.settings', s);
      }),
      slider('Volume', s.volume, 0, 1, 0.05, (v) => {
        s.volume = v;
        engine.setVolume(v);
        save('drums.settings', s);
      }),
    ));
  }

  const keydown = (e: KeyboardEvent) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    const id = KEYS[e.key.toLowerCase()];
    if (!id) return;
    e.preventDefault();
    hit(id);
  };
  window.addEventListener('keydown', keydown);

  return () => {
    if (take) toggleRec();
    if (beatTimer) toggleBeat();
    stopReplay?.();
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', keydown);
    page.remove();
  };
}
