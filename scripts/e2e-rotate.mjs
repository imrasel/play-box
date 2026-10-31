// Upright-phone check in both engines. Needs `npm run preview -- --port 4199`.
import { chromium, webkit, devices } from 'playwright';

const out = process.argv[2] ?? '.';
let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};

for (const [label, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  const browser = await engine.launch();
  const { defaultBrowserType, ...phone } = devices['iPhone 13'];
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:4199/');
  const home = await page.evaluate(() => { const c = document.querySelector('.hub'); return [c.clientWidth, c.clientHeight]; });
  check(`${label}: home screen is landscape`, home[0] > home[1], home.join('x'));
  const tilesFit = await page.evaluate(() => [...document.querySelectorAll('.tile')].every((t) => {
    const r = t.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  check(`${label}: all home tiles on screen`, tilesFit);
  await page.screenshot({ path: `${out}/${label}-home.png` });
  await page.locator('.tile', { hasText: 'Games' }).tap();
  await page.locator('.game-tile', { hasText: 'Note Rain' }).tap();
  await page.waitForSelector('.game-score');
  check(`${label}: Note Rain starts at once`, (await page.locator('.panel').count()) === 0);
  await page.goBack();
  await page.waitForSelector('.game-tile');
  await page.screenshot({ path: `${out}/${label}-games.png` });
  await page.goBack();
  await page.locator('.tile', { hasText: 'Piano' }).tap();
  await page.waitForSelector('canvas.keys');
  await page.waitForTimeout(500);

  const v = page.viewportSize();
  const fit = await page.evaluate(() => [...document.querySelectorAll('.tool')].every((t) => {
    const r = t.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  check(`${label}: every header button on screen`, fit);
  const size = await page.evaluate(() => { const c = document.querySelector('canvas.keys'); return [c.clientWidth, c.clientHeight]; });
  check(`${label}: keyboard is landscape`, size[0] > size[1], size.join('x'));

  // Tap real screen coordinates and confirm the expected key was hit.
  await page.locator('.tool[aria-label=Record]').tap();
  await page.touchscreen.tap(40, Math.round(v.height / 2));
  await page.waitForTimeout(200);
  await page.locator('.tool[aria-label=Record]').tap();
  const rec = await page.evaluate(() => JSON.parse(localStorage['piano.recordings'] ?? '[]')[0]?.events[0]?.midi);
  // Measured from the keyboard's own edge, since phones may reserve space before it.
  const expected = await page.evaluate((y) => {
    const whites = [];
    for (let m = 21; m <= 108; m++) if (![1, 3, 6, 8, 10].includes(m % 12)) whites.push(m);
    const keys = document.querySelector('canvas.keys');
    return whites[Math.floor(((y - keys.getBoundingClientRect().top) / keys.clientWidth) * 15 + 23)];
  }, Math.round(v.height / 2));
  check(`${label}: tap lands on the right key`, rec === expected, `got ${rec}, want ${expected}`);

  await page.locator('.tool[aria-label=Chords]').tap();
  await page.screenshot({ path: `${out}/${label}-chords.png` });
  check(`${label}: chord columns`, (await page.locator('.strip').count()) === 6);
  await page.locator('.tool[aria-label=Chords]').tap();
  await page.locator('.tool[aria-label=Learn]').tap();
  await page.screenshot({ path: `${out}/${label}-panel.png` });
  const scrolled = await page.evaluate(() => {
    const b = document.querySelector('.panel-body');
    b.scrollTop = 40;
    return b.scrollTop;
  });
  check(`${label}: panel scrolls`, scrolled > 0, `scrollTop ${scrolled}`);
  check(`${label}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}
process.exit(failed ? 1 : 0);
