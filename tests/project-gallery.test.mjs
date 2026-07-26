/**
 * Unit-тесты галереи проектов (чистые функции).
 * Запуск: node tests/project-gallery.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/project-gallery.js'), 'utf8');

function loadGallery() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.PGZProjectGallery;
}

test('escapeHtml экранирует спецсимволы', () => {
    const { escapeHtml } = loadGallery()._test;
    assert.equal(escapeHtml('a & b'), 'a &amp; b');
    assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
    assert.equal(escapeHtml('"quote"'), '&quot;quote&quot;');
});

test('assetSummary считает ресурсы', () => {
    const { assetSummary } = loadGallery()._test;
    assert.equal(assetSummary(null), '');
    assert.equal(assetSummary({ assets: {} }), '');
    assert.equal(
        assetSummary({
            assets: {
                images: [{ name: 'a.png' }, { name: 'b.png' }],
                sounds: [{ name: 'x.wav' }],
                music: []
            }
        }),
        '2 карт. · 1 зв.'
    );
});

test('slotKey возвращает строковый индекс', () => {
    const { slotKey } = loadGallery()._test;
    assert.equal(slotKey(0), '0');
    assert.equal(slotKey(5), '5');
});

test('hasStoredAssets определяет наличие ресурсов в слоте', () => {
    const { hasStoredAssets } = loadGallery()._test;
    assert.equal(hasStoredAssets(null), false);
    assert.equal(hasStoredAssets({}), false);
    assert.equal(hasStoredAssets({ images: [] }), false);
    assert.equal(hasStoredAssets({ images: [{ name: 'a.png', dataUrl: 'x' }] }), true);
    assert.equal(hasStoredAssets({ sounds: [{ name: 'a.wav', dataUrl: 'x' }] }), true);
});
