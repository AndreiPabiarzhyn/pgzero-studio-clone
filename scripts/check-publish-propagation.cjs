// Simulates GitHub Pages serving the old version before the new one is deployed.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    let metadataRequests = 0, earlyGameRequest = false, requestedGameUrl = '';
    const version = 1794700000000;
    await page.route('**/published/q33jsj.json*', route => {
      metadataRequests++;
      return route.fulfill({ json: { title: 'Runner', updatedAt: metadataRequests >= 3 ? version : version - 1 } });
    });
    await page.route('**/published/q33jsj.pgz*', route => {
      if (metadataRequests < 3) earlyGameRequest = true;
      requestedGameUrl = route.request().url();
      return route.continue();
    });
    await page.goto('http://127.0.0.1:8101/play.html?id=q33jsj&v=' + version);
    await page.locator('#playPageStartBtn').waitFor({ state: 'visible', timeout: 30000 });
    assert.ok(metadataRequests >= 3, 'waited until metadata updated');
    assert.equal(earlyGameRequest, false, 'never fetched the old game');
    assert.ok(requestedGameUrl.includes('v=' + version), 'fresh version included in game request');
    console.log('Propagation check passed: old metadata never opened the old game.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
