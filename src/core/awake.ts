const IDLE_LIMIT = 3 * 60 * 1000;

let lock: WakeLockSentinel | null = null;
let asking = false;
let lastTouch = 0;

async function hold() {
  if (lock || asking || document.visibilityState !== 'visible') return;
  asking = true;
  try {
    const held = await navigator.wakeLock.request('screen');
    lock = held;
    document.documentElement.dataset.awake = 'yes';
    held.addEventListener('release', () => {
      lock = null;
      delete document.documentElement.dataset.awake;
    });
  } catch { /* unsupported, or the phone refused: its own setting applies */ }
  asking = false;
}

function touched() {
  lastTouch = Date.now();
  void hold();
}

/** Keeps the screen on while the app is in use, until 3 minutes pass with no touch. */
export function keepAwake() {
  // Some phones only allow this from a tap, and every tap also renews the 3 minutes.
  document.addEventListener('pointerdown', touched, true);
  document.addEventListener('keydown', touched, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') touched();
  });
  setInterval(() => {
    if (lock && Date.now() - lastTouch >= IDLE_LIMIT) void lock.release();
  }, 5000);
  touched();
}
