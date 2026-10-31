// Renders the link-preview picture to public/og.png. Run once: node scripts/og.mjs
import { chromium } from 'playwright';

const balloon = (x, y, size, color, tilt) => `
  <svg class="b" style="left:${x}px;top:${y}px;width:${size}px;rotate:${tilt}deg" viewBox="0 0 100 180">
    <path d="M50 118C43 138 60 150 50 172" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.6"/>
    <path d="M43 124L50 112L57 124Q50 128 43 124Z" fill="${color}"/>
    <path d="M50 2C79 2 98 25 98 53C98 80 72 103 54 111L50 113L46 111C28 103 2 80 2 53C2 25 21 2 50 2Z" fill="${color}"/>
    <path d="M50 2C79 2 98 25 98 53C98 80 72 103 54 111L50 113L46 111C28 103 2 80 2 53C2 25 21 2 50 2Z" fill="url(#form)"/>
    <path d="M23 45C22 30 31 17 45 14C38 22 33 33 33 47C33 52 24 52 23 45Z" fill="#fff" opacity=".85"/>
  </svg>`;

const whites = Array.from({ length: 22 }, (_, i) => `<i class="w ${[8, 10, 13].includes(i) ? 'on' : ''}"></i>`).join('');
const blacks = Array.from({ length: 22 }, (_, i) => ([2, 6, 0].includes(i % 7) ? '' : `<i class="k" style="left:${(i + 1) * 54.5 - 15}px"></i>`)).join('');

const html = `<!doctype html><style>
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;position:relative;font-family:-apple-system,system-ui,sans-serif;
  background:radial-gradient(circle at 26% 12%,#7c4dff,#3b22b8 46%,#160d52)}
.star{position:absolute;border-radius:50%;background:#fff}
h1{position:absolute;left:84px;top:96px;font-size:150px;font-weight:900;letter-spacing:-.04em;color:#fff;text-shadow:0 8px 0 rgba(0,0,0,.2)}
h1 b{color:#ffcf33}
p{position:absolute;left:92px;top:272px;width:640px;font-size:46px;line-height:1.16;font-weight:700;color:#e7e0ff}
.tags{position:absolute;left:92px;top:398px;display:flex;gap:12px}
.tags span{padding:9px 20px;border-radius:30px;font-size:27px;font-weight:800;color:#23165f;background:#fff}
.tags span:nth-child(2){background:#ffcf33}.tags span:nth-child(3){background:#7dffb2}.tags span:nth-child(4){background:#ff9ac1}
.b{position:absolute;filter:drop-shadow(0 18px 18px rgba(0,0,0,.28))}
.keys{position:absolute;left:0;right:0;bottom:0;height:136px;display:flex;background:#0b0820;border-top:9px solid #e8222e}
.w{flex:1;margin:0 1px;border-radius:0 0 8px 8px;background:linear-gradient(#fff 72%,#d8d4c8)}
.w.on{background:linear-gradient(#ffd96a,#ffb000)}
.k{position:absolute;top:0;width:32px;height:82px;border-radius:0 0 6px 6px;background:linear-gradient(90deg,#000,#3a3a44 50%,#000)}
</style><body>
<svg width="0" height="0"><defs><radialGradient id="form" cx=".36" cy=".3" r=".78">
<stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".3" stop-color="#fff" stop-opacity=".1"/>
<stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".46"/>
</radialGradient></defs></svg>
${Array.from({ length: 40 }, (_, i) => `<i class="star" style="left:${(i * 197) % 1200}px;top:${(i * 83) % 470}px;width:${2 + (i % 4)}px;height:${2 + (i % 4)}px;opacity:${0.25 + (i % 5) * 0.14}"></i>`).join('')}
${balloon(930, 34, 190, '#ff3b7f', 8)}${balloon(790, 150, 150, '#ffb000', -9)}${balloon(1058, 214, 132, '#18c5c5', 12)}
<h1>Play<b>Box</b></h1>
<p>Piano, drums, guitar and fun games for kids</p>
<div class="tags"><span>Free</span><span>No ads</span><span>Works offline</span><span>Ages 3+</span></div>
<div class="keys">${whites}${blacks}</div>
</body>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
