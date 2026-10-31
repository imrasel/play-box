// Drum checks. Needs `npm run preview -- --port 4199`. SHOW=1 opens a visible window.
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
const strike = (page, id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-id=${id}] .skin`);
  el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, bubbles: true, cancelable: true, pointerType: 'touch' }));
}, id);

{
  const browser = await chromium.launch({ headless: !show, channel: show ? 'chrome' : undefined, slowMo: show ? 200 : 0, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(meter);
  await page.goto('http://localhost:4199/');
  await page.locator('.tile', { hasText: 'Drums' }).click();
  await page.waitForSelector('.kit');
  await page.screenshot({ path: `${out}/drums.png` });

  check('extra pads hidden by default', await page.locator('.extras').isHidden());
await page.locator('.tool[aria-label=Setup]').tap();
await page.locator('.segments .btn', { hasText: 'Show' }).tap();
await page.locator('.panel-head .btn').tap();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/drums-extras.png` });
for (const id of ['kick', 'snare', 'hat', 'open', 'tom1', 'tom2', 'floor', 'crash', 'ride', 'clap', 'cowbell', 'tambourine', 'rim']) {
    await strike(page, id);
    const peak = await page.evaluate(() => window.__peak(200));
    check(`sound: ${id}`, peak > 0.02, `peak ${peak.toFixed(3)}`);
    await page.waitForTimeout(250);
  }

  // A real tap on screen must land on the piece drawn there.
  const box = await page.locator('[data-id=snare] .skin').boundingBox();
  await page.locator('.tool[aria-label=Record]').tap();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => {
    for (const [i, id] of ['kick', 'crash'].entries()) {
      document.querySelector(`[data-id=${id}] .skin`).dispatchEvent(new PointerEvent('pointerdown', { pointerId: 10 + i, bubbles: true, cancelable: true, pointerType: 'touch' }));
    }
  });
  await page.waitForTimeout(200);
  await page.locator('.tool[aria-label=Record]').tap();
  const take = await page.evaluate(() => JSON.parse(localStorage['drums.takes'])[0].events.map((e) => e.id));
  check('tap and two fingers together are recorded', take.join() === 'snare,kick,crash', take.join());
  await page.locator('.tool[aria-label=Saved]').tap();
  await page.waitForTimeout(600);
  await page.locator('.rec-row .btn').first().tap();
  const replay = await page.evaluate(() => window.__peak(400));
  check('recording replays', replay > 0.02, `peak ${replay.toFixed(3)}`);
  await page.waitForTimeout(1200);

  await page.locator('.beat-name').tap();
  await page.locator('.song-list .btn', { hasText: 'Keherwa' }).tap();
  const beat = await page.evaluate(() => window.__peak(1500));
  check('backing beat plays', beat > 0.02, `peak ${beat.toFixed(3)}`);
  await page.screenshot({ path: `${out}/drums-beat.png` });
  for (const name of ['Dadra', 'Bollywood Dance', 'Filmi Romantic', 'Bhangra', 'Bangla Folk', 'Baul', 'Qawwali', 'Hip-Hop', 'Waltz']) {
    await page.locator('.beat-name').tap();
    await page.waitForTimeout(250);
    if (name === 'Dadra') await page.screenshot({ path: `${out}/drums-beats-list.png` });
    await page.locator('.song-list .btn', { hasText: name }).tap();
    const peak = await page.evaluate(() => window.__peak(1400));
    check(`beat ${name}`, peak > 0.02 && peak <= 1, `peak ${peak.toFixed(3)}`);
  }
  // Leaving the app must silence it, and coming back must carry on.
  const setHidden = (hidden) => page.evaluate((hidden) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await setHidden(true);
  await page.waitForTimeout(500);
  const away = await page.evaluate(async () => {
    const data = new Float32Array(2048);
    const c = window.__meter.context;
    const t = c.currentTime;
    await new Promise((r) => setTimeout(r, 600));
    window.__meter.getFloatTimeDomainData(data);
    return { state: c.state, moved: c.currentTime - t };
  });
  check('hidden app stops all sound', away.state === 'suspended' && away.moved === 0, JSON.stringify(away));
  await setHidden(false);
  const back = await page.evaluate(() => window.__peak(1500));
  check('sound returns when the app does', back > 0.02, `peak ${back.toFixed(3)}`);

  await page.locator('.tool[aria-label="Play beat"]').tap();
  await page.waitForTimeout(1200);
  const quiet = await page.evaluate(() => window.__peak(150));
  check('backing beat stops', quiet < 0.05, `peak ${quiet.toFixed(3)}`);

  await page.locator('.tool[aria-label=Setup]').tap();
  await page.locator('.segments .btn', { hasText: 'Electronic' }).tap();
  await page.locator('.panel-head .btn').tap();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/drums-electronic.png` });
  await strike(page, 'kick');
  const electro = await page.evaluate(() => window.__peak(200));
  check('electronic kit sounds', electro > 0.02, `peak ${electro.toFixed(3)}`);
  await page.locator('.tool[aria-label=Home]').tap();
  await page.locator('.tile', { hasText: 'Piano' }).click();
  await page.waitForSelector('canvas.keys');
  check('piano still opens after drums', true);
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
  await page.locator('.tile', { hasText: 'Drums' }).tap();
  await page.waitForSelector('.kit');
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => [...document.querySelectorAll('.tool')].every((t) => {
    const r = t.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  check(`${label}: upright buttons on screen`, fit);
  const box = await page.locator('[data-id=snare] .skin').boundingBox();
  await page.locator('.tool[aria-label=Record]').tap();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(150);
  await page.locator('.tool[aria-label=Record]').tap();
  const first = await page.evaluate(() => JSON.parse(localStorage['drums.takes'] ?? '[]')[0]?.events[0]?.id);
  check(`${label}: upright tap lands on the snare`, first === 'snare', String(first));
  await page.screenshot({ path: `${out}/drums-${label}.png` });
  check(`${label}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}
process.exit(failed ? 1 : 0);
