/**
 * Unit-тесты конвертации ADPCM WAV.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadWavAdpcmTest() {
  const source = readFileSync(join(__dirname, '../lib/wav-adpcm.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._wavAdpcmTest;
}

function fetchBuffer(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve(Buffer.concat(chunks)); });
    }).on('error', reject);
  });
}

test('isImaAdpcm определяет формат Scratch', () => {
  const { isImaAdpcm } = loadWavAdpcmTest();
  assert.equal(isImaAdpcm({ audioFormat: 0x11 }), true);
  assert.equal(isImaAdpcm({ audioFormat: 1 }), false);
});

test('ensurePlayableWav конвертирует Scratch ADPCM Boing', async () => {
  const { ensurePlayableWav } = (function () {
    const source = readFileSync(join(__dirname, '../lib/wav-adpcm.js'), 'utf8');
    const sandbox = { window: {}, console };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.WavAdpcm;
  })();

  const raw = await fetchBuffer(
    'https://cdn.assets.scratch.mit.edu/internalapi/asset/53a3c2e27d1fb5fdb14aaf0cb41e7889.wav/get/'
  );
  const result = ensurePlayableWav(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  assert.equal(result.converted, true);
  assert.ok(result.buffer.byteLength > raw.length);

  const view = new DataView(result.buffer);
  const fmt = view.getUint16(20, true);
  assert.equal(fmt, 1, 'должен стать PCM');
});
