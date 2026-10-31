import { h } from './dom';
import { btn } from './ui';

type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

let waiting: InstallPrompt | null = null;
let refresh: (() => void) | null = null;

// Chrome fires this once, early on, so it must be caught before any screen exists.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  waiting = e as InstallPrompt;
  refresh?.();
});
window.addEventListener('appinstalled', () => {
  waiting = null;
  refresh?.();
});

export const isInstalled = () =>
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isPhone = () => matchMedia('(pointer: coarse)').matches;

/** Hides the browser bars for the current visit. iPhones refuse; installing is the fix there. */
export function goFullscreen() {
  if (isInstalled() || !isPhone() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.()
    .then(() => (screen.orientation as unknown as { lock(o: string): Promise<void> }).lock('landscape'))
    .catch(() => { /* not allowed here: the app still works with the bars showing */ });
}

/** The home-screen button. It is empty once installed, or where installing is impossible. */
export function installButton(parent: HTMLElement) {
  const slot = h('div', { class: 'install-slot' });

  function iosGuide() {
    const sheet = h('div', { class: 'install-guide' },
      h('h2', {}, 'Add PlayBox to your iPhone'),
      h('ol', {},
        h('li', {}, 'Tap the Share button ⬆️ in the browser.'),
        h('li', {}, 'Scroll down and tap “Add to Home Screen”.'),
        h('li', {}, 'Tap “Add”, then open PlayBox from the new icon.')),
      h('p', {}, 'It then runs full screen with no browser bars, and works without internet.'),
      btn('Got it', () => sheet.remove()));
    parent.append(sheet);
  }

  async function install() {
    if (!waiting) return;
    await waiting.prompt();
    await waiting.userChoice;
    waiting = null;
    render();
  }

  function render() {
    slot.replaceChildren();
    if (isInstalled()) return;
    if (waiting) slot.append(btn('⬇️ Install', install));
    else if (isIos()) slot.append(btn('⬇️ Install', iosGuide));
  }

  refresh = render;
  render();
  return slot;
}
