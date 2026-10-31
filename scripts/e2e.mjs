// End-to-end check in an emulated landscape phone. Needs `npm run preview -- --port 4199`.
import { chromium } from 'playwright';

const URL = 'http://localhost:4199/';
const out = process.argv[2] ?? '.';
// SHOW=1 opens a real window, slowed down so a person can follow along.
const show = !!process.env.SHOW;
const browser = await chromium.launch({
  headless: !show,
  channel: show ? 'chrome' : undefined,
  slowMo: show ? 350 : 0,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 800, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Tap the graph just before the speakers, so we can measure real output.
await page.addInitScript(() => {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !window.__meter) {
      window.__meter = dest.context.createAnalyser();
      window.__ctx = dest.context;
      connect.call(this, window.__meter);
    }
    return connect.call(this, dest, ...rest);
  };
  window.__peak = async (ms) => {
    const buf = new Float32Array(2048);
    let peak = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      window.__meter.getFloatTimeDomainData(buf);
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
      await new Promise((r) => setTimeout(r, 15));
    }
    return peak;
  };
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};
const pointer = (type, id, x, y) => page.evaluate(([type, id, x, y]) => {
  const c = document.querySelector('canvas.keys');
  c.setPointerCapture = () => {};
  c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: id === 1 }));
}, [type, id, x, y]);
const tool = (label) => page.locator(`.tool[aria-label="${label}"]`).click();

await page.goto(URL);
await page.screenshot({ path: `${out}/1-home.png` });
await page.locator('.tile', { hasText: 'Piano' }).click();
await page.waitForSelector('canvas.keys');
await page.waitForFunction(() => !document.querySelector('.status')?.textContent, null, { timeout: 60000 });
check('all samples loaded', true);
check('audio running', (await page.evaluate(() => window.__ctx.state)) === 'running');

const quiet = await page.evaluate(() => window.__peak(200));
await pointer('pointerdown', 1, 300, 300);
const clock = await page.evaluate(() => window.__ctx.currentTime);
const loud = await page.evaluate(() => window.__peak(400));
const clockAfter = await page.evaluate(() => window.__ctx.currentTime);
await pointer('pointerup', 1, 300, 300);
check('a key press makes sound', loud > 0.02 && loud > quiet * 3, `peak ${loud.toFixed(3)}, audio clock moved ${(clockAfter - clock).toFixed(3)}s`);
await page.waitForTimeout(600);

// Three fingers at once, then slide one across keys.
await pointer('pointerdown', 1, 200, 300);
await pointer('pointerdown', 2, 320, 300);
await pointer('pointerdown', 3, 440, 300);
await page.screenshot({ path: `${out}/2-chord.png` });
for (let x = 200; x < 420; x += 20) await pointer('pointermove', 1, x, 300);
for (const [id, x] of [[1, 400], [2, 320], [3, 440]]) await pointer('pointerup', id, x, 300);

for (const voice of ['Electric Piano', 'Music Box', 'Organ', 'Harpsichord', 'Strings', 'Space Synth', 'Grand Piano']) {
  await tool('Sound');
  await page.locator('.choice-grid .btn', { hasText: voice }).click();
  const peak = await page.evaluate(() => window.__peak(300));
  await page.locator('.panel-head .btn').click();
  check(`voice ${voice}`, peak > 0.01, `peak ${peak.toFixed(3)}`);
  await page.waitForTimeout(500);
}

await tool('Sound');
await page.screenshot({ path: `${out}/3-sound.png` });
await page.locator('.panel-head .btn').click();

// Record, then save and replay.
await tool('Record');
await pointer('pointerdown', 1, 300, 300);
await page.waitForTimeout(200);
await pointer('pointerup', 1, 300, 300);
await tool('Record');
await tool('Saved');
check('recording saved', (await page.locator('.rec-row').count()) === 1);
await page.locator('.rec-row .btn').first().click();
const replay = await page.evaluate(() => window.__peak(300));
check('recording replays', replay > 0.01, `peak ${replay.toFixed(3)}`);
await page.waitForTimeout(500);

// Chord pads: one tap plays a whole chord, and is captured by recording.
const pad = (index, type) => page.evaluate(([index, type]) => {
  const el = document.querySelectorAll('.pad')[index];
  el.setPointerCapture = () => {};
  el.dispatchEvent(new PointerEvent(type, { pointerId: 9, bubbles: true, cancelable: true, pointerType: 'touch' }));
}, [index, type]);
await tool('Chords');
check('six chord pads', (await page.locator('.pad').count()) === 6);
await tool('Record');
await pad(0, 'pointerdown');
const chord = await page.evaluate(() => window.__peak(400));
await page.screenshot({ path: `${out}/8-chords.png` });
await pad(0, 'pointerup');
await tool('Record');
check('a tap plays a chord', chord > 0.02, `peak ${chord.toFixed(3)}`);
const on = await page.evaluate(() => JSON.parse(localStorage['piano.recordings'])[0].events.filter((e) => e.on).map((e) => e.midi));
check('chord is recorded note by note', on.join() === '48,52,55', on.join());
const stuck = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 1800)); return window.__peak(100); });
check('chord stops when released', stuck < 0.02, `peak ${stuck.toFixed(3)}`);
await page.locator('.pad-top .btn', { hasText: 'F' }).click();
check('key change', (await page.locator('.pad b').allTextContents()).join() === 'F,Gm,Am,Bb,C,Dm');
await page.locator('.pad-top .btn', { hasText: 'C' }).click();
// A vertical swipe plays each bar of a column in turn.
await tool('Record');
const bars = await page.locator('.strip').first().locator('.chord-bar').evaluateAll((els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2];
}));
const swipe = (type, x, y) => page.evaluate(([type, x, y]) => {
  const grid = document.querySelector('.pad-grid');
  grid.setPointerCapture = () => {};
  document.elementFromPoint(x, y).dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
}, [type, x, y]);
const path = [...bars].reverse();
await swipe('pointerdown', ...path[0]);
for (const point of path.slice(1)) {
  await page.waitForTimeout(60);
  await swipe('pointermove', ...point);
}
await swipe('pointerup', ...path[path.length - 1]);
const ringing = await page.evaluate(() => window.__peak(250));
await page.screenshot({ path: `${out}/9-bars.png` });
await page.waitForTimeout(1700);
await tool('Record');
check('swipe sounds', ringing > 0.02, `peak ${ringing.toFixed(3)}`);
const swiped = await page.evaluate(() => JSON.parse(localStorage['piano.recordings'])[0].events.filter((e) => e.on).map((e) => e.midi));
check('swipe plays every bar in order', swiped.join() === '48,52,55,60,64,67,72', swiped.join());
check('no keyboard by default', (await page.locator('canvas.keys').count()) === 0);
await page.locator('.pad-top .btn', { hasText: 'Keys' }).click();
check('Keys button adds the keyboard', (await page.locator('canvas.keys').count()) === 1);
await page.screenshot({ path: `${out}/10-bars-keys.png` });
await page.locator('.pad-top .btn', { hasText: 'Keys' }).click();

await tool('Chords');
check('chords view closes', (await page.locator('.pad').count()) === 0);

// Learn: wait-for-me mode, driven through the on-screen keys.
await tool('Learn');
await page.screenshot({ path: `${out}/4-learn-menu.png` });
await page.locator('.song-list .btn', { hasText: 'Mary' }).click();
await page.waitForTimeout(3200);
await page.screenshot({ path: `${out}/5-learn.png` });
check('learn waits for the child', (await page.evaluate(() => document.querySelector('#pg').style.width)) === '0%');
await page.locator('.hud .btn', { hasText: 'Stop' }).click();

// Note Rain: playing scores points; one-miss mode ends by itself.
await tool('Game');
await page.locator('.song-list .btn', { hasText: 'Mary' }).click();
const end = Date.now() + 9000;
while (Date.now() < end) {
  for (const key of ['a', 's', 'd']) await page.keyboard.press(key, { delay: 20 });
}
await page.screenshot({ path: `${out}/11-game.png` });
const points = await page.locator('.game-score').textContent();
check('game scores points', Number(points.replace(/,/g, '')) > 0, points);
await page.locator('.hud .btn', { hasText: '✕' }).click();
await tool('Game');
await page.locator('.segments .btn', { hasText: 'One miss stops' }).click();
await page.locator('.song-list .btn', { hasText: 'Endless' }).click();
await page.waitForSelector('.panel h2:has-text("Game over")', { timeout: 15000 });
await page.screenshot({ path: `${out}/12-game-over.png` });
check('one miss ends the game', true);
await page.locator('.panel-head .btn').click();

// Import a tiny MIDI file (C4 then E4), then play it through the game.
const midi = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 1, 0xe0,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 20,
  0, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 0, 0, 0x90, 64, 100, 0x83, 0x60, 0x80, 64, 0,
  0, 0xff, 0x2f, 0,
]);
await tool('Learn');
await page.locator('.song-list input[type=file]').setInputFiles({ name: 'My Tune.mid', mimeType: 'audio/midi', buffer: midi });
await page.waitForSelector('.song-row');
check('imported song is listed', (await page.locator('.song-row').first().textContent()).includes('My Tune'));
await page.locator('.song-row .btn').first().click();
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/13-learn-rain.png` });
check('imported song plays', (await page.locator('.hud-title').textContent()).length > 0);
await page.locator('.hud .btn', { hasText: 'Stop' }).click();
const bad = Buffer.from('this is not midi');
await tool('Learn');
await page.locator('.song-list input[type=file]').setInputFiles({ name: 'bad.mid', mimeType: 'audio/midi', buffer: bad });
await page.waitForFunction(() => document.querySelector('.toast') && !document.querySelector('.toast').hidden);
check('bad file shows a message', true);
await page.locator('.song-row .btn').nth(1).click();
check('imported song deletes', (await page.locator('.song-row').count()) === 0);
await page.locator('.panel-head .btn').click();

// Two-player layout and a customised theme.
await tool('Setup');
await page.locator('.segments .btn', { hasText: 'Two players' }).click();
await page.locator('.segments .btn', { hasText: 'Rainbow' }).click();
await page.screenshot({ path: `${out}/6-setup.png` });
await page.locator('.panel-head .btn').click();
await page.screenshot({ path: `${out}/7-duet.png` });
check('two rows', (await page.locator('canvas.keys').count()) === 2);

await page.reload();
await page.waitForSelector('canvas.keys');
check('settings survive reload', (await page.locator('canvas.keys').count()) === 2);

// Offline: service worker must serve the app and samples.
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForTimeout(500);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('canvas.keys', { timeout: 10000 });
const sample = await page.evaluate(() => fetch('samples/C4.mp3').then((r) => r.ok && r.arrayBuffer()).then((b) => b && b.byteLength));
check('works offline', sample > 1000, `C4.mp3 ${sample} bytes`);
await ctx.setOffline(false);

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
