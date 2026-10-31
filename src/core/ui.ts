import { h } from './dom';

export function tool(icon: string, label: string, onClick: () => void) {
  return h('button', { class: 'tool', 'aria-label': label, title: label, onclick: onClick }, icon);
}

/** Drawn, not an emoji: emoji are bitmaps and soften on a turned screen. */
const HOUSE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#ffd166" d="M12 3 2.5 11.2 4 13l1.6-1.4V21h12.8v-9.4L20 13l1.5-1.8z"/><path fill="#d9503a" d="M12 2 1.5 11l1.7 2L12 5.5 20.8 13l1.7-2z"/><path fill="#7a4a2c" d="M10 21v-6h4v6z"/></svg>`;

export function homeTool(onClick: () => void, label = 'Home') {
  const b = tool('', label, onClick);
  b.innerHTML = HOUSE;
  return b;
}

export function btn(text: string, onClick: (e: MouseEvent) => void) {
  return h('button', { class: 'btn', onclick: onClick }, text);
}

export function slider(label: string, value: number, min: number, max: number, step: number, set: (v: number) => void) {
  const out = h('b', {}, String(value));
  const input = h('input', { type: 'range', min, max, step, value }) as HTMLInputElement;
  input.addEventListener('input', () => {
    out.textContent = input.value;
    set(Number(input.value));
  });
  return h('label', { class: 'field' }, h('span', {}, label, ' ', out), input);
}

export function segmented(label: string, options: string[][], value: string, set: (v: string) => void) {
  const group = h('div', { class: 'segments' });
  options.forEach(([id, text]) => {
    const b = btn(text, () => {
      group.querySelectorAll('.on').forEach((n) => n.classList.remove('on'));
      b.classList.add('on');
      set(id);
    });
    b.classList.toggle('on', id === value);
    group.append(b);
  });
  return h('div', { class: 'field' }, h('span', {}, label), group);
}

/** The slide-in side panel shared by every module. */
export function panels(page: HTMLElement) {
  let panel: HTMLElement | null = null;
  const close = () => {
    panel?.remove();
    panel = null;
  };
  const open = (title: string, fill: (body: HTMLElement) => void) => {
    close();
    const body = h('div', { class: 'panel-body' });
    fill(body);
    const sheet = h('aside', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h2', {}, title), btn('✕', close)),
      body,
    );
    panel = h('div', { class: 'scrim' }, sheet);
    panel.addEventListener('pointerdown', (e) => { if (e.target === panel) close(); });
    page.append(panel);
  };
  return { open, close };
}
