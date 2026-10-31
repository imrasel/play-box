// Little games, on an upright phone in both engines. Needs `npm run preview -- --port 4199`.
import { chromium, webkit, devices } from 'playwright';

const out = process.argv[2] ?? '.';
const show = !!process.env.SHOW;
let failed = false;
const check = (name, ok, detail = '') => {
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`);
};

for (const [label, engine, opts] of [
  ['chromium', chromium, { headless: !show, channel: show ? 'chrome' : undefined, slowMo: show ? 120 : 0 }],
  ['webkit', webkit, {}],
]) {
  const browser = await engine.launch(opts);
  const { defaultBrowserType, ...phone } = devices['iPhone 13'];
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const open = async (name) => {
    await page.goto('http://localhost:4199/#games');
    await page.waitForSelector('.game-tile');
    await page.locator('.game-tile', { hasText: name }).tap();
  };

  await page.goto('http://localhost:4199/#games');
  await page.waitForSelector('.game-tile');
  check(`${label}: eight games listed`, (await page.locator('.game-tile').count()) === 8);
  const fit = await page.evaluate(() => [...document.querySelectorAll('.game-tile')].every((t) => {
    const r = t.getBoundingClientRect();
    return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  check(`${label}: all tiles on screen`, fit);
  await page.screenshot({ path: `${out}/${label}-list.png` });

  // Balloons: pop three, and each must be big enough for a small finger.
  await open('Balloons');
  await page.waitForTimeout(2500);
  const smallest = await page.evaluate(() => Math.min(...[...document.querySelectorAll('.balloon')].map((b) => Math.min(b.clientWidth, b.clientHeight))));
  check(`${label}: balloons are finger-sized`, smallest >= 88, `${Math.round(smallest)}px`);
  // A balloon can drift out from under a tap, so keep going until three have popped.
  let popped = 0;
  let firstPop = true;
  const popEnd = Date.now() + 25000;
  while (popped < 3 && Date.now() < popEnd) {
    await page.waitForFunction(() => [...document.querySelectorAll('.balloon')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.left > 0 && r.top > 0 && r.right < innerWidth && r.bottom < innerHeight;
    }), null, { timeout: 10000 });
    const spot = await page.evaluate(() => {
      const r = [...document.querySelectorAll('.balloon')].map((el) => el.getBoundingClientRect())
        .find((b) => b.left > 0 && b.top > 0 && b.right < innerWidth && b.bottom < innerHeight);
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    await page.touchscreen.tap(spot[0], spot[1]);
    const now = Number((await page.locator('.game-score-big').textContent()).replace(/\D/g, ''));
    if (now > popped && firstPop) {
      firstPop = false;
      const scraps = await page.locator('.scrap').count();
      check(`${label}: burst throws rubber scraps`, scraps >= 12, `${scraps}`);
      await page.screenshot({ path: `${out}/${label}-burst.png` });
    }
    popped = now;
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1100);
  check(`${label}: scraps clean themselves up`, (await page.locator('.scrap').count()) === 0);
  await page.screenshot({ path: `${out}/${label}-balloons.png` });
  check(`${label}: popping scores`, (await page.locator('.game-score-big').textContent()).includes('3'));

  // Racing: real taps must steer, and stars must add up. Rotated, lanes run along screen x.
  await open('Racing');
  await page.waitForSelector('canvas.race-road');
  await page.waitForTimeout(500);
  const box = await page.locator('canvas.race-road').boundingBox();
  // Upright, the left of the rotated screen runs along the top of the phone.
  const roadWide = Math.min(box.height * 0.62, box.width * 0.82);
  const laneTap = (lane) => page.touchscreen.tap(box.x + box.width * 0.4, box.y + (box.height - roadWide) / 2 + (roadWide * (lane + 0.5)) / 3);
  for (const lane of [0, 2, 1]) {
    await laneTap(lane);
    await page.waitForTimeout(250);
    const steered = await page.locator('.game-stage').getAttribute('data-lane');
    check(`${label}: tapping lane ${lane} steers there`, steered === String(lane), String(steered));
  }
  await page.locator('.car-swatch[data-car=blue]').tap();
  await page.waitForTimeout(250);
  check(`${label}: choosing a car colour sticks`, (await page.evaluate(() => JSON.parse(localStorage['race.settings']).car)) === 'blue');
  check(`${label}: colour buttons are finger-sized`, (await page.locator('.car-swatch').first().evaluate((e) => e.clientWidth)) >= 36);
  // Upright, the top of the rotated screen is the right of the phone: forward is rightward.
  await page.touchscreen.tap(box.x + box.width * 0.62, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const forwardRow = Number(await page.locator('.game-stage').getAttribute('data-row'));
  await page.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  const backRow = Number(await page.locator('.game-stage').getAttribute('data-row'));
  check(`${label}: the car moves forward and backward`, forwardRow < backRow, `${forwardRow} then ${backRow}`);
  const covers = () => page.evaluate(() => {
    const r = document.querySelector('.little-game').getBoundingClientRect();
    return Math.abs(r.width - innerWidth) < 2 && Math.abs(r.height - innerHeight) < 2 && r.left === 0 && r.top === 0;
  });
  check(`${label}: racing fills the screen`, await covers());
  await page.screenshot({ path: `${out}/${label}-race.png` });
  const end = Date.now() + 16000;
  let got = 0;
  for (let lane = 0; Date.now() < end && got < 1; lane = (lane + 1) % 3) {
    await laneTap(lane);
    await page.waitForTimeout(700);
    got = Number((await page.locator('.race-score').textContent()).replace(/\D/g, ''));
  }
  check(`${label}: stars are collected`, got > 0, `${got}`);

  // Fruit Slice: sweep the blade across the board until something is cut.
  await open('Fruit Slice');
  await page.waitForSelector('canvas.fruit-board');
  await page.waitForTimeout(600);
  check(`${label}: fruit fills the screen`, await covers());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${label}-fruit.png` });
  const swipe = (type, x, y) => page.evaluate(([type, x, y]) => {
    const c = document.querySelector('canvas.fruit-board');
    c.setPointerCapture = () => {};
    c.dispatchEvent(new PointerEvent(type, { pointerId: 4, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch' }));
  }, [type, x, y]);
  const area = await page.locator('canvas.fruit-board').boundingBox();
  let cut = 0;
  const stop = Date.now() + 15000;
  for (let row = 0; Date.now() < stop && cut < 2; row = (row + 1) % 4) {
    const x = area.x + area.width * (0.3 + row * 0.15);
    await swipe('pointerdown', x, area.y + 5);
    for (let y = 0; y <= area.height; y += 60) await swipe('pointermove', x, area.y + y);
    await swipe('pointerup', x, area.y + area.height - 5);
    await page.waitForTimeout(120);
    cut = Number((await page.locator('.race-score').textContent()).replace(/\D/g, ''));
  }
  await page.screenshot({ path: `${out}/${label}-fruit-cut.png` });
  check(`${label}: swiping slices fruit`, cut > 0, `${cut}`);

  // Air Fighter: fly at the enemies by real touch until something is shot down.
  await open('Air Fighter');
  await page.waitForSelector('canvas.race-road');
  await page.waitForTimeout(600);
  check(`${label}: air fighter fills the screen`, await covers());
  const sky = await page.locator('canvas.race-road').boundingBox();
  let points = 0;
  const flying = Date.now() + 20000;
  for (let row = 0; Date.now() < flying && points < 10; row = (row + 1) % 5) {
    // Rotated: a row across the sky is a position along the screen's x axis.
    await page.touchscreen.tap(sky.x + sky.width * (0.15 + row * 0.17), sky.y + sky.height * 0.2);
    await page.waitForTimeout(800);
    points = Number((await page.locator('.race-score').textContent()).replace(/\D/g, ''));
  }
  await page.screenshot({ path: `${out}/${label}-air.png` });
  check(`${label}: the plane shoots enemies down`, points > 0, `${points}`);

  // Memory: solve the first board, then a bigger one must appear.
  await open('Memory');
  await page.waitForSelector('.card');
  check(`${label}: starts with 3 pairs`, (await page.locator('.card').count()) === 6);
  await page.locator('.card').first().tap();
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${label}-memory.png` });
  const first = await page.locator('.card').first().getAttribute('data-face');
  const faces = await page.locator('.card').evaluateAll((els) => els.map((e) => e.dataset.face));
  const order = [];
  faces.forEach((f, i) => { if (i && f === first) order.push(i); });
  for (const f of new Set(faces)) {
    if (f === first) continue;
    faces.forEach((x, i) => { if (x === f) order.push(i); });
  }
  for (const i of order) {
    await page.locator('.card').nth(i).tap();
    await page.waitForTimeout(380);
  }
  check(`${label}: all pairs found`, (await page.locator('.card.done').count()) === 6);
  await page.waitForSelector('.confetti', { timeout: 1000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 8, null, { timeout: 5000 });
  check(`${label}: next board is bigger`, true);

  // Shapes: a wrong tap changes nothing, the right tap moves on.
  await open('Shapes');
  await page.waitForSelector('.shape-option');
  await page.screenshot({ path: `${out}/${label}-shapes.png` });
  const target = await page.locator('.shape-target').getAttribute('data-target');
  await page.locator(`.shape-option:not([data-shape=${target}])`).first().tap();
  await page.waitForTimeout(350);
  check(`${label}: wrong shape is gentle`, (await page.locator('.shape-target').getAttribute('data-target')) === target);
  await page.locator(`.shape-option[data-shape=${target}]`).tap();
  await page.waitForTimeout(1400);
  const next = await page.locator('.shape-target').getAttribute('data-target');
  check(`${label}: right shape moves on`, next !== target, `${target} then ${next}`);

  // Copy Me: follow the lit pad, then a longer tune must play.
  await open('Copy Me');
  await page.waitForSelector('.copy-pad');
  const lit = await page.waitForFunction(() => document.querySelector('.copy-pad.lit')?.dataset.pad, null, { timeout: 3000 });
  const pad = await lit.jsonValue();
  await page.screenshot({ path: `${out}/${label}-copy.png` });
  await page.waitForFunction(() => document.querySelector('.copy-status').textContent === '👆');
  await page.locator(`.copy-pad[data-pad="${pad}"]`).tap();
  await page.waitForFunction(() => document.querySelector('.copy-status').textContent === '👀', null, { timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('.copy-status').textContent === '👆', null, { timeout: 5000 });
  check(`${label}: copy advances`, true);

  await page.locator('.game-back').tap();
  await page.waitForSelector('.game-tile');
  check(`${label}: home button returns to the list`, true);

  // Note Rain: straight into Happy Birthday with no menu, and the song can still be changed.
  await page.locator('.game-tile', { hasText: 'Note Rain' }).tap();
  await page.waitForSelector('.game-score');
  check(`${label}: Note Rain opens straight into play`, (await page.locator('.panel').count()) === 0);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${out}/${label}-rain.png` });
  const moved = await page.locator('#pg').evaluate((el) => parseFloat(el.style.width));
  check(`${label}: the song is running`, moved > 0, `${moved}%`);
  await page.locator('.hud .btn', { hasText: '🎵' }).tap();
  check(`${label}: song menu opens on request`, (await page.locator('.panel h2').textContent()) === 'Note Rain');
  await page.locator('.panel-head .btn').tap();
  await page.locator('.hud .btn', { hasText: '✕' }).tap();
  await page.waitForSelector('.game-tile');
  check(`${label}: ✕ returns to the list`, true);
  check(`${label}: no errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}
// A laptop: a wide screen and a mouse, where the road is narrower than the window.
{
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 800 } });
  await page.goto('http://localhost:4199/#race');
  await page.waitForSelector('canvas.race-road');
  await page.waitForTimeout(500);
  const road = Math.min(1440 * 0.62, 800 * 0.82);
  for (const lane of [0, 2]) {
    await page.mouse.click(720 - road / 2 + (road * (lane + 0.5)) / 3, 500);
    await page.waitForTimeout(250);
    check(`laptop: clicking lane ${lane} moves the car`, (await page.locator('.game-stage').getAttribute('data-lane')) === String(lane));
  }
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  check('laptop: arrow keys steer', (await page.locator('.game-stage').getAttribute('data-lane')) === '1');
  const row = await page.locator('.game-stage').getAttribute('data-row');
  await page.keyboard.press('ArrowUp');
  check('laptop: up arrow moves forward', Number(await page.locator('.game-stage').getAttribute('data-row')) < Number(row));
  await page.screenshot({ path: `${out}/laptop-race.png` });
  await browser.close();
}

// The list must never lose a tile, even on a very short phone screen.
for (const [label, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage({ viewport: { width: 667, height: 300 } });
  await page.goto('http://localhost:4199/#games');
  await page.waitForSelector('.game-tile');
  await page.waitForTimeout(250);
  const reach = await page.evaluate(() => {
    const list = document.querySelector('.tiles');
    list.scrollTop = list.scrollHeight;
    const r = [...document.querySelectorAll('.game-tile')].pop().getBoundingClientRect();
    const home = document.querySelector('.hub > .tool').getBoundingClientRect();
    return { bottom: r.bottom, height: innerHeight, scrolls: list.scrollHeight >= list.clientHeight && home.top >= 0 };
  });
  check(`${label}: short screen can scroll to the last game`, reach.scrolls && reach.bottom <= reach.height + 1, `${Math.round(reach.bottom)} of ${reach.height}`);
  await page.screenshot({ path: `${out}/${label}-short-list.png` });
  await browser.close();
}
process.exit(failed ? 1 : 0);
