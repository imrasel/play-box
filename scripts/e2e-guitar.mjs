// Guitar checks. Needs `npm run preview -- --port 4199`. SHOW=1 opens a visible window.
import { chromium, webkit, devices } from 'playwright';

const out = process.argv[2] ?? '.';
const show = !!process.env.SHOW;
let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};
const meter = () => {
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !window.__meter) {
      window.__meter = dest.context.createAnalyser();
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
};
// Sends screen coordinates, as a real finger would.
const finger = (page, type, x, y, id = 5) => page.evaluate(([type, x, y, id]) => {
  const c = document.querySelector('canvas.neck');
  c.setPointerCapture = () => {};
  c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
}, [type, x, y, id]);
const lastTake = (page) => page.evaluate(() => JSON.parse(localStorage['guitar.takes'] ?? '[]')[0]?.events.map((e) => e.midi));

{
  const browser = await chromium.launch({ headless: !show, channel: show ? 'chrome' : undefined, slowMo: show ? 200 : 0, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(meter);
  await page.goto('http://localhost:4199/');
  await page.screenshot({ path: `${out}/home.png` });
  await page.locator('.tile', { hasText: 'Guitar' }).click();
  await page.waitForSelector('canvas.neck');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/guitar-chords.png` });
  check('nine chord buttons', (await page.locator('.guitar-pad').count()) === 9);

  const tap = (text) => page.evaluate((text) => {
    const pad = [...document.querySelectorAll('.guitar-pad')].find((p) => p.textContent === text);
    pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, bubbles: true, cancelable: true, pointerType: 'touch' }));
  }, text);
  await tap('G');
  const chord = await page.evaluate(() => window.__peak(350));
  check('tapping a chord strums it', chord > 0.02, `peak ${chord.toFixed(3)}`);

  // Swipe down across all strings with Am held: the muted low string stays silent.
  const box = await page.locator('canvas.neck').boundingBox();
  await page.locator('.tool[aria-label=Record]').tap();
  await tap('Am');
  await page.waitForTimeout(200);
  const x = box.x + box.width * 0.5;
  await finger(page, 'pointerdown', x, box.y + 1);
  for (let y = 0; y <= box.height; y += 12) await finger(page, 'pointermove', x, box.y + y);
  await finger(page, 'pointerup', x, box.y + box.height);
  const swipe = await page.evaluate(() => window.__peak(350));
  await page.waitForTimeout(200);
  await page.locator('.tool[aria-label=Record]').tap();
  check('swipe sounds', swipe > 0.02, `peak ${swipe.toFixed(3)}`);
  const am = '45,52,57,60,64';
  const notes = (await lastTake(page)).join();
  check('tap then swipe play the Am notes in order', notes === `${am},${am}`, notes);

  await page.locator('.tool[aria-label=Saved]').tap();
  await page.waitForTimeout(500);
  await page.locator('.rec-row .btn').first().tap();
  const replay = await page.evaluate(() => window.__peak(500));
  check('recording replays', replay > 0.02, `peak ${replay.toFixed(3)}`);
  await page.waitForTimeout(1200);

  // Fretboard: fret 3 of the thickest string is G2.
  await page.locator('.beat-name').tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/guitar-frets-empty.png` });
  const neck = await page.locator('canvas.neck').boundingBox();
  check('fretboard fills the screen', neck.width > 780, `${neck.width}`);
  const fretPos = 34 + (neck.width - 44) * (1 - 2 ** (-2.5 / 12)) / (1 - 2 ** -1);
  await page.locator('.tool[aria-label=Record]').tap();
  await finger(page, 'pointerdown', neck.x + fretPos, neck.y + neck.height * 0.12);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/guitar-frets.png` });
  await finger(page, 'pointerup', neck.x + fretPos, neck.y + neck.height * 0.12);
  await page.waitForTimeout(100);
  await page.locator('.tool[aria-label=Record]').tap();
  check('fretboard tap plays the right note', (await lastTake(page)).join() === '43', (await lastTake(page)).join());

  await page.locator('.beat-name').tap();
  await page.waitForTimeout(300);

  // Auto strum: your pattern on C is D D U D U D D U, so check the first three strokes.
  await tap('C');
  await page.waitForTimeout(500);
  await page.locator('.tool[aria-label=Record]').tap();
  await page.locator('.tool[aria-label="Auto strum"]').tap();
  const auto = await page.evaluate(() => window.__peak(1800));
  await page.locator('.tool[aria-label="Auto strum"]').tap();
  await page.locator('.tool[aria-label=Record]').tap();
  check('auto strum plays', auto > 0.02, `peak ${auto.toFixed(3)}`);
  const down = '48,52,55,60,64';
  const played = (await lastTake(page)).join();
  check('pattern runs down, down, up', played.startsWith(`${down},${down},64,60,55,52,${down}`), played.slice(0, 60));
  await page.screenshot({ path: `${out}/guitar-auto.png` });

  // Progression and drums: the highlighted chord must move on by itself.
  await page.locator('.rhythm-name').tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/guitar-rhythm.png` });
  await page.locator('.slots .btn').first().tap();
  await page.locator('.segments .btn', { hasText: 'Pop · C G Am F' }).tap();
  await page.locator('.segments .btn', { hasText: 'Rock' }).last().tap();
  const custom = await page.evaluate(() => JSON.parse(localStorage['guitar.settings']));
  check('pattern editor changes my pattern', custom.custom === 'U-DU-UDU' && custom.pattern === 'custom', custom.custom);
  await page.locator('.song-list .btn', { hasText: 'Pop · D DUD DU' }).tap();
  await page.locator('.tool[aria-label=Faster]').tap();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    seen.add(await page.locator('.guitar-pad.on').textContent());
    await page.waitForTimeout(150);
  }
  check('chords change by themselves', ['C', 'G'].every((c) => seen.has(c)), [...seen].join());
  await page.locator('.tool[aria-label="Auto strum"]').tap();
  await page.waitForTimeout(300);

  for (const name of ['Classical', '12-String', 'Clean Electric', 'Rock Electric']) {
    await page.locator('.tool[aria-label=Setup]').tap();
    await page.locator('.segments .btn', { hasText: name }).tap();
    const peak = await page.evaluate(() => window.__peak(350));
    check(`voice ${name}`, peak > 0.02 && peak <= 1, `peak ${peak.toFixed(3)}`);
    await page.locator('.panel-head .btn').tap();
    await page.waitForTimeout(300);
  }
  await page.locator('.beat-name').tap();
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForSelector('canvas.neck');
  check('settings survive reload', (await page.locator('.guitar-pads').isHidden()));
  check('no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

for (const [label, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const browser = await engine.launch();
  const { defaultBrowserType, ...phone } = devices['iPhone 13'];
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:4199/');
  await page.locator('.tile', { hasText: 'Guitar' }).tap();
  await page.waitForSelector('canvas.neck');
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => [...document.querySelectorAll('.tool')].every((t) => {
    const r = t.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  check(`${label}: upright buttons on screen`, fit);
  // Rotated 90° clockwise, so a swipe across the strings runs along the screen's x axis.
  await page.locator('.tool[aria-label=Record]').tap();
  const b = await page.locator('canvas.neck').boundingBox();
  const y = b.y + b.height * 0.5;
  await finger(page, 'pointerdown', b.x + b.width - 1, y);
  for (let x = b.width; x >= 0; x -= 10) await finger(page, 'pointermove', b.x + x, y);
  await finger(page, 'pointerup', b.x, y);
  await page.waitForTimeout(150);
  await page.locator('.tool[aria-label=Record]').tap();
  const n = (await lastTake(page))?.length ?? 0;
  check(`${label}: upright swipe crosses the strings`, n === 5, `${n} notes`);
  await page.screenshot({ path: `${out}/guitar-${label}.png` });
  check(`${label}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}
process.exit(failed ? 1 : 0);
