// Publishes a real, clearly labelled test game. Run only when intentionally testing production.
// Production configuration is loaded directly by the isolated browser and never printed or saved.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = 'https://andreipabiarzhyn.github.io/pgzero-studio-clone/';
const root = path.resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm' };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route(base + '**', async route => {
      const url = new URL(route.request().url());
      const relative = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length)) || 'index.html';
      if (relative === 'lib/publish-config.js') return route.continue();
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.continue();
      await route.fulfill({ path: file, contentType: types[path.extname(file)] || 'application/octet-stream' });
    });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#projectStartupScreen', { state: 'visible', timeout: 30000 });
    await page.locator('#projectStartupGrid [data-slot="0"]').first().click();
    await page.waitForFunction(() => document.getElementById('projectStartupScreen').hidden, null, { timeout: 30000 });
    await page.evaluate(() => {
      document.getElementById('projectNameInput').value = 'Тест публикации PGZero Studio';
      PythonIDE.editor.setValue('import pgzrun\nWIDTH = 400\nHEIGHT = 300\ndef draw():\n    screen.fill((30, 41, 59))\n    screen.draw.text("Publication test", (90, 130), color="white")\npgzrun.go()\n');
    });
    await page.locator('#btn_pgz_publish').click();
    await page.waitForSelector('#projectPublishScreen', { state: 'visible', timeout: 90000 });
    const url = await page.locator('#publishSuccessUrl').inputValue();
    const parsed = new URL(url);
    const id = parsed.searchParams.get('id');
    if (!id || parsed.hash) throw new Error('Publication did not produce a hosted short link');
    console.log('Published test game: ' + url);
    console.log('Publication ID: ' + id);
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
