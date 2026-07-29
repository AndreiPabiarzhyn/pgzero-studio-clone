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

function loadImageLibraryTest(version, lang) {
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
  if (lang) {
    sandbox.PGZI18n = { getLang: () => lang };
  }
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._imageLibraryTest;
}

test('game-sprites.json содержит Kenney-спрайты', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/image-library/game-sprites.json'), 'utf8'));
  assert.ok(json.length >= 320);
  const ids = json.map(function (e) { return e.id; });
  assert.ok(ids.includes('hero_green_stand'));
  assert.ok(ids.includes('slime_blue'));
  assert.ok(ids.includes('bg_colored_grass'));
  assert.ok(ids.includes('bg_forest'));
  assert.ok(ids.includes('ship1_blue'));
  assert.ok(ids.includes('dungeon_wizard'));
  assert.ok(ids.includes('dungeon_cyclops'));
  assert.ok(ids.includes('fire_00'));
  assert.equal(json[0].pack, 'platformer-redux');
  const groups = new Set(json.map(function (e) { return e.group; }));
  assert.ok(groups.has('characters'));
  assert.ok(groups.has('backgrounds'));
  assert.ok(groups.has('projectiles'));
});

test('resolveSpriteUrl поддерживает локальные файлы', () => {
  const { resolveSpriteUrl } = loadImageLibraryTest();
  assert.equal(resolveSpriteUrl({
    source: 'local',
    file: 'assets/image-library/kenney/characters/hero_green_stand.png'
  }), './assets/image-library/kenney/characters/hero_green_stand.png?v=0.036');
});

test('mapSpriteEntry задаёт имя для Actor', () => {
  const { mapSpriteEntry } = loadImageLibraryTest();
  const mapped = mapSpriteEntry({
    id: 'hero_green_stand',
    label: 'Герой зелёный (стоит)',
    group: 'characters',
    source: 'local',
    file: 'assets/image-library/kenney/characters/hero_green_stand.png'
  });
  assert.equal(mapped.name, 'Герой зелёный (стоит)');
  assert.equal(mapped.importName, 'hero_green_stand');
  assert.equal(mapped.ext, 'png');
  assert.match(mapped.url, /hero_green_stand\.png\?v=0\.036$/);
});

test('mapSpriteEntry uses translated labels for en', () => {
  const { mapSpriteEntry, setSpriteLabels } = loadImageLibraryTest('0.036', 'en');
  setSpriteLabels({ hero_green_stand: 'Hero green (standing)' }, 'en');
  const mapped = mapSpriteEntry({
    id: 'hero_green_stand',
    label: 'Герой зелёный (стоит)',
    group: 'characters',
    source: 'local',
    file: 'assets/image-library/kenney/characters/hero_green_stand.png'
  });
  assert.equal(mapped.name, 'Hero green (standing)');
});
