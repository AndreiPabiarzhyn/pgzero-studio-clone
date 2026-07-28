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

function loadImageLibraryTest() {
  const source = readFileSync(join(__dirname, '../lib/image-library.js'), 'utf8');
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      getElementById: () => null,
      querySelectorAll: () => [],
      readyState: 'complete'
    },
    console
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._imageLibraryTest;
}

test('game-sprites.json содержит персонажей и фоны', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/image-library/game-sprites.json'), 'utf8'));
  assert.ok(json.length >= 30);
  const ids = json.map(function (e) { return e.id; });
  assert.ok(ids.includes('coddy'));
  assert.ok(ids.includes('rogue'));
  assert.ok(ids.includes('fon_main'));
  assert.ok(ids.includes('space'));
  const groups = new Set(json.map(function (e) { return e.group; }));
  assert.ok(groups.has('characters'));
  assert.ok(groups.has('backgrounds'));
});

test('resolveSpriteUrl поддерживает локальные файлы', () => {
  const { resolveSpriteUrl } = loadImageLibraryTest();
  assert.equal(resolveSpriteUrl({
    source: 'local',
    file: 'assets/image-library/pixel/characters/coddy.png'
  }), './assets/image-library/pixel/characters/coddy.png');
});

test('mapSpriteEntry задаёт имя для Actor', () => {
  const { mapSpriteEntry } = loadImageLibraryTest();
  const mapped = mapSpriteEntry({
    id: 'coddy',
    label: 'Кодди (бег)',
    group: 'characters',
    source: 'local',
    file: 'assets/image-library/pixel/characters/coddy.png'
  });
  assert.equal(mapped.importName, 'coddy');
  assert.equal(mapped.ext, 'png');
  assert.match(mapped.url, /coddy\.png$/);
});
