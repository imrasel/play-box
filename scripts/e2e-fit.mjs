// Every screen, on real phone sizes both ways round: all controls must be on screen.
import { chromium, webkit } from 'playwright';

const out = process.argv[2] ?? '.';
let failed = false;
let passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; return; }
  failed = true;
  console.log(`FAIL  ${name} ${detail}`);
};
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const PHONES = [
  ['iPhone 17', 402, 874, IPHONE, 'webkit'], ['iPhone 17 Pro Max', 440, 956, IPHONE, 'webkit'],
  ['iPhone SE', 375, 667, IPHONE, 'webkit'], ['iPhone 12 mini', 360, 780, IPHONE, 'webkit'],
  ['Galaxy S23', 360, 780, ANDROID, 'chromium'], ['Galaxy S23 Ultra', 384, 824, ANDROID, 'chromium'],
  ['small Android', 320, 568, ANDROID, 'chromium'],
];
const ROUTES = ['', 'piano', 'drums', 'guitar', 'games', 'balloons', 'race', 'fruit', 'air', 'memory', 'shapes', 'copy', 'noterain'];

for (const [name, w, h, ua, kind] of PHONES) {
  const browser = await (kind === 'webkit' ? webkit : chromium).launch();
  for (const [pose, width, height] of [['upright', w, h], ['sideways', h, w]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, userAgent: ua, hasTouch: true, isMobile: kind === 'chromium' });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      await page.goto(`http://localhost:4199/#${route}`);
      await page.reload();
      await page.waitForTimeout(220);
      const r = await page.evaluate(() => {
        const off = [...document.querySelectorAll('.tool, .btn:not(.panel .btn), .tile')]
          .filter((el) => !el.hidden && el.offsetParent !== null)
          .filter((el) => {
            const b = el.getBoundingClientRect();
            return b.width && (b.left < -1 || b.right > innerWidth + 1 || b.top < -1);
          }).map((el) => el.getAttribute('aria-label') ?? el.textContent);
        const home = document.querySelector('.tool[aria-label=Home], .tool[aria-label=Back]')?.getBoundingClientRect();
        return { off, top: home?.top, right: home ? innerWidth - home.right : 0, wide: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(`${name} ${pose} ${route || 'home'}: controls on screen`, r.off.length === 0, r.off.join(' '));
      check(`${name} ${pose} ${route || 'home'}: no sideways scroll`, !r.wide);
      if (ua === IPHONE && pose === 'upright' && r.top !== undefined) {
        check(`${name} ${route}: Home clear of the status area`, r.top >= 58, `top ${Math.round(r.top)}`);
      }
      if (name === 'iPhone 17' && pose === 'upright' && ['piano', 'race', ''].includes(route)) await page.screenshot({ path: `${out}/iphone17-${route || 'home'}.png` });
      if (name === 'Galaxy S23' && pose === 'upright' && ['piano', 'guitar'].includes(route)) await page.screenshot({ path: `${out}/s23-${route}.png` });
    }
    await ctx.close();
  }
  await browser.close();
}
console.log(`${passes} passed`);
process.exit(failed ? 1 : 0);
