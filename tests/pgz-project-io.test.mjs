/**
 * Unit-тесты PGZProjectIO (медиа в .pgz / публикации).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadProjectIO() {
  const source = readFileSync(join(__dirname, '../lib/pgz-project-io.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.PGZProjectIO;
}

test('mimeFromMediaPath определяет audio для публикации', () => {
  const { mimeFromMediaPath } = loadProjectIO();
  assert.equal(mimeFromMediaPath('sounds/jump.wav'), 'audio/wav');
  assert.equal(mimeFromMediaPath('music/victory.ogg'), 'audio/ogg');
  assert.equal(mimeFromMediaPath('music/theme.mp3'), 'audio/mpeg');
});

test('buildProjectZipBlob включает sounds и music', () => {
  const source = readFileSync(join(__dirname, '../lib/pgz-project-io.js'), 'utf8');
  assert.match(source, /zip\.file\('sounds\//);
  assert.match(source, /zip\.file\('music\//);
  assert.match(source, /buildProjectZipFromActiveSlot/);
  assert.match(source, /syncEditorToFiles/);
});

test('dataURLToBlob отклоняет пустые данные', () => {
  const { dataURLToBlob } = loadProjectIO();
  assert.throws(() => dataURLToBlob(undefined), /Повреждённый файл ресурса/);
  assert.throws(() => dataURLToBlob('not-a-data-url'), /Повреждённый файл ресурса/);
});
