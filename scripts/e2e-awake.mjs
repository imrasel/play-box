// The screen must stay on while the app is used, and be let go after 3 minutes with no touch.
import { chromium } from 'playwright';

let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};
const awake = (page) => page.evaluate(() => document.documentElement.dataset.awake === 'yes');
const tap = (page) => page.mouse.click(5, 5);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.clock.install();
// Headless Chromium refuses a real wake lock, so this tests our logic against a stand-in.
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => {
    const lock = new EventTarget();
    lock.release = async () => lock.dispatchEvent(new Event('release'));
    return lock;
  } } });
});
await page.goto('http://localhost:4199/');
await tap(page);
await page.waitForFunction(() => document.documentElement.dataset.awake === 'yes');
check('the screen stays on when the app opens', await awake(page));

await page.clock.fastForward(2 * 60 * 1000);
await page.waitForTimeout(100);
check('still on after 2 minutes', await awake(page));

await tap(page);
await page.clock.fastForward(2 * 60 * 1000);
await page.waitForTimeout(100);
check('a touch renews the time', await awake(page));

await page.clock.fastForward(90 * 1000);
await page.waitForFunction(() => document.documentElement.dataset.awake !== 'yes');
check('lets go after 3 minutes with no touch', !(await awake(page)));

await tap(page);
await page.waitForFunction(() => document.documentElement.dataset.awake === 'yes');
check('the next touch keeps it on again', await awake(page));

await browser.close();
if (failed) process.exit(1);
console.log('e2e-awake ok');
