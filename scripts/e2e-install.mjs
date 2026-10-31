// Install prompts, and every screen working offline. Needs `npm run preview -- --port 4199`.
import { chromium, webkit, devices } from 'playwright';

const URL = process.env.SITE ?? 'http://localhost:4199/';
let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};

{
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 800, height: 360 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForSelector('.hub');
  check('no install button until the browser offers one', (await page.locator('.install-slot .btn').count()) === 0);
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = async () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.locator('.install-slot .btn').click();
  await page.waitForTimeout(100);
  check('Android and laptop: Install opens the browser prompt', await page.evaluate(() => window.__prompted === true));
  check('the button leaves after answering', (await page.locator('.install-slot .btn').count()) === 0);

  // First visit caches everything; afterwards every screen must open with no network.
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(400);
  await ctx.setOffline(true);
  for (const [route, selector] of [
    ['', '.hub'], ['piano', 'canvas.keys'], ['drums', '.kit'], ['guitar', 'canvas.neck'], ['games', '.game-tile'],
    ['balloons', '.game-stage'], ['race', 'canvas.race-road'], ['fruit', 'canvas.fruit-board'], ['air', 'canvas.race-road'],
    ['memory', '.game-stage'], ['shapes', '.game-stage'], ['copy', '.game-stage'], ['noterain', 'canvas.keys'],
  ]) {
    await page.goto(`${URL}#${route}`);
    await page.reload();
    const ok = await page.waitForSelector(selector, { timeout: 5000 }).then(() => true, () => false);
    check(`offline: ${route || 'home'}`, ok);
  }
  const samples = await page.evaluate(async () => {
    const names = ['A0', 'C4', 'C8'];
    return (await Promise.all(names.map((n) => fetch(`samples/${n}.mp3`).then((r) => r.ok)))).every(Boolean);
  });
  check('offline: piano sounds are stored', samples);
  await browser.close();
}

{
  const browser = await webkit.launch();
  const { defaultBrowserType, ...phone } = devices['iPhone 13'];
  const page = await (await browser.newContext(phone)).newPage();
  await page.goto(URL);
  await page.waitForSelector('.hub');
  await page.locator('.install-slot .btn').tap();
  check('iPhone: Install shows the Add to Home Screen steps', (await page.locator('.install-guide li').count()) === 3);
  await page.screenshot({ path: `${process.argv[2] ?? '.'}/iphone-guide.png` });
  await page.locator('.install-guide .btn').tap();
  check('iPhone: the steps close', (await page.locator('.install-guide').count()) === 0);
  await page.evaluate(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  await page.goto(`${URL}#games`);
  await page.locator('.tool[aria-label=Home]').tap();
  await page.waitForSelector('.hub');
  check('once installed, the button is gone', (await page.locator('.install-slot .btn').count()) === 0);
  await browser.close();
}
process.exit(failed ? 1 : 0);
