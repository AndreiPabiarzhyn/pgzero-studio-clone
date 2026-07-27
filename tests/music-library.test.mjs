/**
 * Unit-тесты библиотеки музыки.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadMusicLibraryTest() {
  const source = readFileSync(join(__dirname, '../lib/music-library.js'), 'utf8');
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
  return sandbox.window._musicLibraryTest;
}

test('game-music.json содержит 15 треков', () => {
  const json = JSON.parse(readFileSync(join(__dirname, '../assets/sound-library/game-music.json'), 'utf8'));
  assert.equal(json.length, 15);
  const ids = json.map(function (e) { return e.id; });
  assert.ok(ids.includes('menu'));
  assert.ok(ids.includes('gameplay'));
  assert.ok(ids.includes('victory'));
});

test('resolveTrackUrl поддерживает Scratch и Kenney', () => {
  const { resolveTrackUrl } = loadMusicLibraryTest();
  assert.match(resolveTrackUrl({
    source: 'scratch',
    md5ext: 'fc6e9cc9ba13c7e4ebb1af6cd7c90c49.wav'
  }), /scratch\.mit\.edu/);
  assert.match(resolveTrackUrl({
    source: 'kenney-mirror',
    file: 'kenney_musicjingles/Audio/Hit jingles/jingles_HIT00.ogg'
  }), /ETdoFresh\/kenney\.nl/);
});

test('mapMusicEntry задаёт имя для music.play', () => {
  const { mapMusicEntry } = loadMusicLibraryTest();
  const mapped = mapMusicEntry({
    id: 'menu',
    label: 'Меню игры',
    group: 'menu',
    source: 'scratch',
    md5ext: 'fc6e9cc9ba13c7e4ebb1af6cd7c90c49.wav',
    scratchName: 'Video Game 1'
  });
  assert.equal(mapped.importName, 'menu');
  assert.equal(mapped.ext, 'wav');
});
