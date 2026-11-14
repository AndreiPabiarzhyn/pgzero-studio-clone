import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('каталог ссылается на реальные опубликованные игры и не повторяет идентификаторы', async () => {
  const items = JSON.parse(await readFile(join(root, 'published/catalog.json'), 'utf8'));
  assert.ok(items.length > 20);
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  for (const item of items) {
    assert.match(item.id, /^[a-z0-9]+$/i);
    assert.ok(item.title.trim());
    await access(join(root, 'published', item.id + '.pgz'));
    if (item.preview) await access(join(root, 'published', 'previews', item.id + '.webp'));
    const metadata = JSON.parse(await readFile(join(root, 'published', item.id + '.json'), 'utf8'));
    assert.equal(item.title, metadata.title.trim());
  }
});


test('подборка ленты содержит разные доступные игры с кадрами', async () => {
  const html = await readFile(join(root, 'index.html'), 'utf8');
  const section = html.match(/id="featuredTrack"[\s\S]*?<\/div>/)?.[0];
  assert.ok(section);
  const ids = [...section.matchAll(/play\.html\?id=([a-z0-9]+)/gi)].map(match => match[1]);
  assert.ok(ids.length >= 12);
  assert.equal(new Set(ids).size, ids.length);
  const catalog = JSON.parse(await readFile(join(root, 'published/catalog.json'), 'utf8'));
  const report = JSON.parse(await readFile(join(root, 'published/previews/capture-report.json'), 'utf8'));
  for (const id of ids) {
    assert.ok(catalog.some(game => game.id === id));
    assert.ok(report.some(game => game.id === id && game.status === 'captured'));
  }
});
