// With a simulated notch and gesture bar, Home must be on screen and clear in every module.
import { chromium, webkit } from 'playwright';

const out = process.argv[2] ?? '.';
let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};
const ROUTES = ['piano', 'drums', 'guitar', 'games', 'balloons', 'race', 'fruit', 'air', 'memory', 'shapes', 'copy', 'noterain'];
const NOTCH = 47; // an iPhone notch
const BAR = 21; // the gesture bar

// Each entry is a way of holding the phone. `insets` are the phone's own edges.
const POSES = [
  { name: 'sideways, notch left', size: [844, 390], insets: { top: 0, right: NOTCH, bottom: BAR, left: NOTCH }, keepOut: { left: NOTCH, right: NOTCH, bottom: BAR, top: 0 } },
  { name: 'upright, turned by the app', size: [390, 844], insets: { top: NOTCH, right: 0, bottom: BAR, left: 0 }, keepOut: { top: NOTCH, bottom: BAR, left: 0, right: 0 } },
];

for (const [label, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  for (const pose of POSES) {
    const upright = pose.size[1] > pose.size[0];
    const { top, right, bottom, left } = pose.insets;
    // env() cannot be set from a test, so feed the same numbers to the variables built on it.
    const vars = upright
      ? { t: right, r: bottom, b: left, l: top }
      : { t: top, r: right, b: bottom, l: left };
    const css = `:root { --safe-t:${vars.t}px !important; --safe-r:${vars.r}px !important; --safe-b:${vars.b}px !important; --safe-l:${vars.l}px !important; }`;
    const ctx = await browser.newContext({ viewport: { width: pose.size[0], height: pose.size[1] }, hasTouch: true, isMobile: label === 'chromium' });
    const page = await ctx.newPage();
    for (const route of ROUTES) {
      await page.goto(`http://localhost:4199/#${route}`);
      await page.reload();
      await page.addStyleTag({ content: css });
      await page.waitForTimeout(350);
      const r = await page.evaluate(() => {
        const home = document.querySelector('.tool[aria-label=Home], .tool[aria-label=Back]');
        const box = home?.getBoundingClientRect();
        const atCentre = box && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return box && { left: box.left, top: box.top, right: innerWidth - box.right, bottom: innerHeight - box.bottom, reachable: !!atCentre && home.contains(atCentre) };
      });
      const k = pose.keepOut;
      const clear = r && r.left >= k.left && r.top >= k.top && r.right >= k.right && r.bottom >= k.bottom;
      check(`${label}, ${pose.name}: Home clear in ${route}`, !!clear && r.reachable, r ? `l${Math.round(r.left)} t${Math.round(r.top)} r${Math.round(r.right)} b${Math.round(r.bottom)}` : 'missing');
      if (route === 'piano' || route === 'games') await page.screenshot({ path: `${out}/${label}-${upright ? 'upright' : 'side'}-${route}.png` });
    }
    await ctx.close();
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);
