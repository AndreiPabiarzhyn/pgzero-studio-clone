const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, 'published', 'catalog.json'), 'utf8'));
const out = path.join(root, 'published', 'previews');
fs.mkdirSync(out, { recursive: true });
const queue = [...data];
let done = 0, ok = 0;
const results = [];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--mute-audio'] });
  async function worker() {
    while (queue.length) {
      const game = queue.shift();
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith('http://127.0.0.1:8100/') || url.startsWith('data:') || url.startsWith('blob:')) route.continue();
        else route.abort();
      });
      const page = await context.newPage();
      try {
        await page.goto('http://127.0.0.1:8100/play.html?id=' + encodeURIComponent(game.id), { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.locator('#playPageStartBtn').waitFor({ state: 'visible', timeout: 7000 });
        await page.locator('#playPageStartBtn').click({ timeout: 3000 });
        await page.locator('#gameCanvas').waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(1100);
        if (await page.locator('#playError').isVisible()) throw new Error('game error');
        const png = await page.locator('#gameCanvas').evaluate(canvas => canvas.toDataURL('image/png'), { timeout: 4000 });
        if (!png.startsWith('data:image/png;base64,')) throw new Error('canvas unavailable');
        fs.writeFileSync(path.join(out, game.id + '.png'), Buffer.from(png.split(',')[1], 'base64'));
        results.push({ id: game.id, status: 'captured' }); ok++;
      } catch (err) { results.push({ id: game.id, status: 'failed', reason: String(err.message).split('\n')[0].slice(0, 120) }); }
      finally {
        await context.close().catch(() => {});
        done++;
        if (done % 10 === 0 || done === data.length) console.log(`Проверено ${done}/${data.length}, снято ${ok}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  await browser.close();
  fs.writeFileSync(path.join(out, 'capture-report.json'), JSON.stringify(results, null, 2));
  console.log(`Завершено: ${ok}/${data.length}`);
})().catch(err => { console.error(err); process.exit(1); });
