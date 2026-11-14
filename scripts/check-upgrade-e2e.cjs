// Run with: NODE_PATH=<path-to-playwright> node scripts/check-upgrade-e2e.cjs <old-worktree>
// Both versions share a temporary local origin and an isolated browser context.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const oldRoot = path.resolve(process.argv[2] || '');
const newRoot = path.resolve('.');
if (!fs.existsSync(path.join(oldRoot, 'index.html'))) throw new Error('Provide the old-version worktree path');
let root = oldRoot;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#projectStartupScreen', { state: 'visible', timeout: 30000 });
    const original = {
      version: 1, savedAt: Date.now(), projectName: 'Учебная игра', currentFile: 'my_pgz.py',
      files: { 'my_pgz.py': 'import pgzrun\nWIDTH = 321\nHEIGHT = 123\ndef draw():\n    screen.clear()\npgzrun.go()\n', 'helper.py': '# дополнительный файл' },
      assets: { images: [{ name: 'hero.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aJ8AAAAASUVORK5CYII=' }], sounds: [{ name: 'jump.wav', dataUrl: 'data:audio/wav;base64,UklGRg==' }], music: [{ name: 'theme.ogg', dataUrl: 'data:audio/ogg;base64,T2dnUw==' }] }, thumb: null
    };
    await page.evaluate(async project => {
      const request = indexedDB.open('pgz_project_gallery_v1', 1);
      const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise((resolve, reject) => { const tx = db.transaction('slots', 'readwrite'); tx.objectStore('slots').put(project, '0'); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
      db.close(); localStorage.setItem('pgz_active_slot', '0');
    }, original);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#projectStartupScreen', { state: 'visible', timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => PGZProjectGallery.getSlot(0)), original);
    root = newRoot;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#projectStartupScreen', { state: 'visible', timeout: 30000 });
    await page.locator('#projectStartupGrid [data-slot="0"]').first().click();
    await page.waitForFunction(() => document.getElementById('projectStartupScreen').hidden, null, { timeout: 30000 });
    const loaded = await page.evaluate(async () => ({
      files: PythonIDE.files, active: PGZProjectGallery.getActiveSlot(),
      image: await jsfs.read('/images/hero.png'), sound: await jsfs.read('/sounds/jump.wav'), music: await jsfs.read('/music/theme.ogg')
    }));
    assert.deepEqual(loaded.files, original.files);
    assert.equal(loaded.active, 0);
    assert.equal(loaded.image, original.assets.images[0].dataUrl);
    assert.equal(loaded.sound, original.assets.sounds[0].dataUrl);
    assert.equal(loaded.music, original.assets.music[0].dataUrl);
    assert.deepEqual(await page.evaluate(() => PGZProjectGallery.getSlot(0)), original);
    console.log('Full upgrade passed: old UI → new UI → open game; all code and media are intact.');
  } finally { await context.close(); await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
