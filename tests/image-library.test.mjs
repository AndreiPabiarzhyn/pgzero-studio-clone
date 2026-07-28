/**
 * Unit-тесты библиотеки картинок.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadImageLibraryTest(version) {
  const source = readFileSync(join(__dirname, '../lib/image-library.js'), 'utf8');
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      readyState: 'complete'
    },
    PGZRUN_ASSET_VERSION: version || '0.036',
    console
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._imageLibraryTest;
}

test('game-sprites.json содержит Kenney-спрайты', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/image-library/game-sprites.json'), 'utf8'));
  assert.ok(json.length >= 30);
  const ids = json.map(function (e) { return e.id; });
  assert.ok(ids.includes('hero_green_idle'));
  assert.ok(ids.includes('slime_green'));
  assert.ok(ids.includes('bg_sky'));
  assert.equal(json[0].pack, 'kenney-pixel-platformer');
  const groups = new Set(json.map(function (e) { return e.group; }));
  assert.ok(groups.has('characters'));
  assert.ok(groups.has('backgrounds'));
});

test('resolveSpriteUrl поддерживает локальные файлы', () => {
  const { resolveSpriteUrl } = loadImageLibraryTest();
  assert.equal(resolveSpriteUrl({
    source: 'local',
    file: 'assets/image-library/kenney/characters/hero_green_idle.png'
  }), './assets/image-library/kenney/characters/hero_green_idle.png?v=0.036');
});

test('mapSpriteEntry задаёт имя для Actor', () => {
  const { mapSpriteEntry } = loadImageLibraryTest();
  const mapped = mapSpriteEntry({
    id: 'hero_green_idle',
    label: 'Герой (зелёный)',
    group: 'characters',
    source: 'local',
    file: 'assets/image-library/kenney/characters/hero_green_idle.png'
  });
  assert.equal(mapped.importName, 'hero_green_idle');
  assert.equal(mapped.ext, 'png');
  assert.match(mapped.url, /hero_green_idle\.png\?v=0\.036$/);
});
