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

test('галерея сериализует сохранение и загрузку слотов', () => {
    assert.match(source, /function runGalleryOp/);
    assert.match(source, /function syncEditorToFiles/);
    assert.match(source, /saveToSlotImpl\(active, \{ skipOverwriteConfirm: true \}/);
    assert.match(source, /await applyProjectImpl\(data\)/);
});

test('openSwitchModal ждёт сохранение перед показом модалки', () => {
    assert.match(source, /function openSwitchModal/);
    assert.match(source, /await saveToSlotImpl\(idx, \{ skipOverwriteConfirm: true \}/);
    assert.match(source, /await showSwitchModal\(\)/);
});

test('applyProject сбрасывает pgz-globals при смене слота', () => {
    assert.match(source, /PythonIDE\.resetPgzRunGlobals/);
    assert.match(readFileSync(join(__dirname, '../lib/lib.js'), 'utf8'), /resetPgzRunGlobals: function/);
    assert.match(readFileSync(join(__dirname, '../lib/game-modal.js'), 'utf8'), /resetChrome: resetChrome/);
});

test('галерея зеркалирует слоты в localStorage и умеет восстанавливать', () => {
    assert.match(source, /pgz_slots_mirror_v1/);
    assert.match(source, /recoverIfNeeded/);
    assert.match(source, /syncMirrorFromSlots/);
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
        '2 картинки · 1 звук'
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

test('cellLabel возвращает понятное имя ячейки', () => {
    const { cellLabel } = loadGallery()._test;
    assert.equal(cellLabel(0), 'Ячейка 1');
    assert.equal(cellLabel(5), 'Ячейка 6');
});

test('заполненные ячейки показывают кнопку очистки', () => {
    assert.match(source, /function clearSlotButtonHtml/);
    assert.match(source, /function bindClearButton/);
    assert.match(source, /data-action="clear"/);
    assert.match(source, /async function clearSlot/);
    assert.match(source, /gallery\.clearBody/);
});

test('стартовый экран — hero, chips, i18n и автор', () => {
    const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
    assert.match(source, /projectStartupScreen/);
    assert.match(source, /projectStartupGrid/);
    assert.match(source, /function showStartupScreen/);
    assert.match(html, /pg-startup-screen__title/);
    assert.match(html, /data-i18n="startup.credit"/);
    assert.match(html, /data-i18n="startup.hint"/);
    assert.match(html, /pg-startup-screen__chips/);
    assert.match(html, /pg-startup-screen__scene/);
    assert.match(html, /pg-lang-switch/);
    assert.doesNotMatch(html, /То, что сделал я/);
});
