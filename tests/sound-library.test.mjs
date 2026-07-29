/**
 * Unit-тесты библиотеки звуков.
 * Запуск: node tests/sound-library.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/sound-library.js'), 'utf8');

function loadSoundLibraryTest(lang) {
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
  if (lang) {
    sandbox.PGZI18n = { getLang: () => lang };
  }
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._soundLibraryTest;
}

test('sanitizeSoundFilename нормализует имя для pgz', () => {
  const { sanitizeSoundFilename } = loadSoundLibraryTest();
  assert.equal(sanitizeSoundFilename('Boing'), 'Boing.wav');
  assert.equal(sanitizeSoundFilename('A Bass'), 'A_Bass.wav');
  assert.equal(sanitizeSoundFilename('  Pop!  '), 'Pop.wav');
});

test('soundPrimaryTag выбирает категорию по приоритету', () => {
  const { soundPrimaryTag } = loadSoundLibraryTest();
  assert.equal(soundPrimaryTag({ tags: ['wacky', 'effects'] }), 'effects');
  assert.equal(soundPrimaryTag({ tags: [] }), 'other');
});

test('scratchSoundUrl формирует CDN-адрес Scratch', () => {
  const { scratchSoundUrl } = loadSoundLibraryTest();
  assert.match(
    scratchSoundUrl('53a3c2e27d1fb5fdb14aaf0cb41e7889.wav'),
    /^https:\/\/cdn\.assets\.scratch\.mit\.edu\/internalapi\/asset\//
  );
});

test('mapGameSoundEntry задаёт имя файла для pgzero', () => {
  const { mapGameSoundEntry } = loadSoundLibraryTest();
  const mapped = mapGameSoundEntry({
    id: 'jump',
    label: 'Прыжок',
    group: 'player',
    source: 'scratch',
    md5ext: '6fcd64d6357e4ea03704e5f96bfd35ba.wav',
    scratchName: 'Jump'
  });
  assert.equal(mapped.importName, 'jump');
  assert.equal(mapped.name, 'Прыжок');
  assert.equal(mapped.ext, 'wav');
  assert.equal(mapped.isGamePack, true);
});

test('soundDisplayName использует перевод для en/es', () => {
  const testApi = loadSoundLibraryTest('en');
  testApi.setSoundLabels({ jump: 'Jump' }, 'en');
  const mapped = testApi.mapGameSoundEntry({
    id: 'jump',
    label: 'Прыжок',
    group: 'player',
    source: 'scratch',
    md5ext: '6fcd64d6357e4ea03704e5f96bfd35ba.wav'
  });
  assert.equal(mapped.name, 'Jump');
});

test('sound-labels покрывают все id из game-sounds.json', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/sound-library/game-sounds.json'), 'utf8'));
  const en = JSON.parse(readFileSync(join(__dirname, '../locales/sound-labels.en.json'), 'utf8'));
  const es = JSON.parse(readFileSync(join(__dirname, '../locales/sound-labels.es.json'), 'utf8'));
  json.forEach(function (entry) {
    assert.ok(en[entry.id], 'missing en label for ' + entry.id);
    assert.ok(es[entry.id], 'missing es label for ' + entry.id);
  });
});

test('game-sounds.json содержит набор для игр', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/sound-library/game-sounds.json'), 'utf8'));
  assert.ok(json.length >= 20);
  const sources = new Set();
  json.forEach(function (entry) {
    assert.ok(entry.id);
    assert.ok(entry.label);
    assert.ok(entry.group);
    assert.ok(entry.source);
    sources.add(entry.source);
    if (entry.source === 'scratch') assert.match(entry.md5ext, /\.wav$/);
    else assert.match(entry.file, /\.(wav|ogg)$/);
  });
  assert.ok(sources.has('scratch'));
  assert.ok(sources.has('kenney-interface') || sources.has('kenney-impact'));
  const ids = json.map(function (e) { return e.id; });
  assert.ok(ids.includes('click'));
  assert.ok(ids.includes('shoot'));
  assert.ok(ids.includes('collision'));
  assert.ok(ids.includes('death'));
  assert.ok(ids.includes('win'));
});

test('resolveGameSoundUrl поддерживает Scratch и Kenney', () => {
  const { resolveGameSoundUrl, getEntryExt } = loadSoundLibraryTest();
  assert.match(resolveGameSoundUrl({
    source: 'scratch',
    md5ext: '83a9787d4cb6f3b7632b4ddfebf74367.wav'
  }), /scratch\.mit\.edu/);
  assert.match(resolveGameSoundUrl({
    source: 'kenney-interface',
    file: 'click_001.wav'
  }), /kenney-interface-sounds/);
  assert.equal(getEntryExt({ file: 'impact_metal_000.ogg' }), 'ogg');
});

test('importSelectedSound сохраняет имя до закрытия модалки', () => {
  const src = readFileSync(join(__dirname, '../lib/sound-library.js'), 'utf8');
  assert.match(src, /var displayName = selectedSound\.name/);
  assert.doesNotMatch(src, /closeSoundLibraryModal\(\)[\s\S]{0,120}selectedSound\.name/);
});
