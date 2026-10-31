// Renders the app icon to PNG. Run once: node scripts/icons.mjs
import { chromium } from 'playwright';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ff5a5f"/>
  <rect x="96" y="150" width="320" height="212" rx="20" fill="#fff"/>
  <path d="M152 150v212M208 150v212M264 150v212M320 150v212M376 150v212" stroke="#d9d6cf" stroke-width="5"/>
  <path d="M136 150h32v124h-32zM192 150h32v124h-32zM304 150h32v124h-32zM360 150h32v124h-32z" fill="#22202c"/>
</svg>`;

const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/icons/icon-${size}.png` });
}
await browser.close();
