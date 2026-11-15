// Browser check with mocked GitHub, no real publication or user profile.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const base = process.env.PGZ_CHECK_BASE || 'http://127.0.0.1:8101/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const auto of [false, true]) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const writes = [];
      await context.addInitScript(() => localStorage.setItem('pgz_publish_github_token', 'test-only'));
      await context.route('https://api.github.com/**', async route => {
        const req = route.request();
        if (req.method() === 'GET') return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        writes.push({ url: req.url(), data: req.postDataJSON() });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      const page = await context.newPage();
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#projectStartupScreen', { state: 'visible', timeout: 30000 });
        await page.locator('#projectStartupGrid [data-slot="0"]').first().click();
        await page.waitForFunction(() => document.getElementById('projectStartupScreen').hidden, null, { timeout: 30000 });
        await page.evaluate(() => PythonIDE.editor.setValue('import pgzrun\nWIDTH = 400\nHEIGHT = 300\ndef draw():\n    screen.fill((30, 41, 59))\n    screen.draw.text("Preview test", (40, 100), color="white")\npgzrun.go()\n'));
        const keep = 'data:image/png;base64,' + fs.readFileSync(path.join(root(), 'assets/featured-games/runner.png')).toString('base64');
        await page.evaluate(async data => { await initFS(); await jsfs.write('/images/keep.png', data); }, keep);
        await page.locator('#btn_pgz_publish').click();
        assert.equal(await page.locator('#publishGameName').inputValue(), '', 'generated project names are not prefilled');
        await page.locator('#publishGameName').fill('');
        await page.locator('#publishDetailsForm [type=submit]').click();
        assert.equal(await page.locator('#publishDetailsDialog').isVisible(), true);
        assert.equal(writes.length, 0);
        await page.locator('#publishGameName').fill('myHiddenUndertakingGame');
        await page.locator('#publishDetailsForm [type=submit]').click();
        assert.equal(await page.locator('#publishDetailsDialog').isVisible(), true);
        assert.equal(writes.length, 0);
        await page.locator('#publishGameName').fill(auto ? 'Auto cover' : 'Uploaded cover');
        if (!auto) {
          await page.locator('#publishCoverFile').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(root(), 'assets/featured-games/runner.png')) });
          await page.locator('#publishCoverPreview').waitFor({ state: 'visible' });
          await page.screenshot({ path: path.join(os.tmpdir(), 'pgz-publish-dialog.png') });
        }
        await page.locator('#publishDetailsForm [type=submit]').click();
        await page.waitForSelector('#projectPublishScreen', { state: 'visible', timeout: 45000 });
        const preview = writes.find(item => /\/previews\/.+\.webp$/.test(item.url));
        assert.ok(preview, 'preview uploaded');
        const bytes = Buffer.from(preview.data.content, 'base64');
        assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
        const meta = writes.find(item => /\.json$/.test(item.url));
        assert.equal(JSON.parse(Buffer.from(meta.data.content, 'base64')).title, auto ? 'Auto cover' : 'Uploaded cover');
        assert.equal(await page.locator('#projectNameInput').inputValue(), auto ? 'Auto cover' : 'Uploaded cover');
        assert.equal((await page.evaluate(() => PGZProjectGallery.getSlot(0))).projectName, auto ? 'Auto cover' : 'Uploaded cover');
        assert.equal(await page.evaluate(() => jsfs.read('/images/keep.png')), keep);
        await page.evaluate(() => PGZProjectPublish.hideSuccess());
        await page.locator('#btn_pgz_publish').click();
        assert.equal(await page.locator('#publishGameName').inputValue(), auto ? 'Auto cover' : 'Uploaded cover', 'custom names are retained');
        console.log((auto ? 'Automatic' : 'Uploaded') + ' cover: validation, WebP upload and title passed');
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
function root() { return process.cwd(); }
