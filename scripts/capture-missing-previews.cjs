// Capture candidates only. Review images before copying into published/previews.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = process.cwd();
const requested = new Set(process.argv.slice(2));
const games = JSON.parse(fs.readFileSync(path.join(root, 'published/catalog.json'), 'utf8')).filter(game =>
  requested.size ? requested.has(game.id) : !game.preview && game.id !== 'kr5get');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pgz-preview-candidates-'));
const results = [];
const queue = [...games];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--mute-audio'] });
  async function worker() {
    while (queue.length) {
      const game = queue.shift();
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = route.request().url();
        return url.startsWith('http://127.0.0.1:8100/') || url.startsWith('data:') || url.startsWith('blob:') ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      try {
        await page.goto('http://127.0.0.1:8100/play.html?id=' + encodeURIComponent(game.id), { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.locator('#playPageStartBtn').click({ timeout: 8000 });
        await page.locator('#gameCanvas').waitFor({ state: 'visible', timeout: 5000 });
        await page.waitForTimeout(2500);
        if (await page.locator('#playError').isVisible()) throw new Error('Game error');
        const png = await page.locator('#gameCanvas').evaluate(canvas => canvas.toDataURL('image/png'), { timeout: 5000 });
        if (!png.startsWith('data:image/png;base64,')) throw new Error('Canvas unavailable');
        fs.writeFileSync(path.join(output, game.id + '.png'), Buffer.from(png.split(',')[1], 'base64'));
        results.push({ id: game.id, title: game.title, status: 'captured' });
      } catch (error) { results.push({ id: game.id, title: game.title, status: 'failed', reason: String(error.message).split('\n')[0] }); }
      finally { await context.close(); }
      console.log('Checked ' + results.length + '/' + games.length);
    }
  }
  try { await Promise.all([worker(), worker(), worker()]); }
  finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
  console.log('Candidates: ' + output);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
