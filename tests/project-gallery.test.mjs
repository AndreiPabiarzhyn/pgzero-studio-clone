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

test('стартовый экран содержит каталог, игры и переключение языка', () => {
    const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
    assert.match(source, /projectStartupScreen/);
    assert.match(source, /projectStartupGrid/);
    assert.match(source, /function showStartupScreen/);
    assert.match(html, /startupHomeView/);
    assert.match(html, /startupProjectsView/);
    assert.match(html, /data-i18n="startup.credit"/);
    assert.match(html, /data-i18n="startup.featuredTitle"/);
    assert.match(html, /startupProjectSearch/);
    assert.match(html, /pg-lang-switch/);
    assert.doesNotMatch(html, /То, что сделал я/);
});


test('список проектов сохраняет прежние ключи и поддерживает больше 20 проектов', async () => {
    const records = new Map([['0', {projectName:'Старый'}], ['5', {projectName:'Шестой'}], ['21', {projectName:'Новый'}]]);
    function request(value) { const req = {}; queueMicrotask(() => { req.result = value; req.onsuccess(); }); return req; }
    const db = { transaction() { return { objectStore() { return { getAllKeys() { return request([...records.keys()]); }, getAll() { return request([...records.values()]); } }; } }; } };
    const indexedDB = { open() { return request(db); } };
    const sandbox = { window: {}, indexedDB, console, localStorage: {getItem() { return '21'; }} };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    const gallery = sandbox.window.PGZProjectGallery;
    const slots = await gallery.listSlots();
    assert.equal(slots[0].projectName, 'Старый');
    assert.equal(slots[5].projectName, 'Шестой');
    assert.equal(slots[21].projectName, 'Новый');
    assert.equal(gallery.getActiveSlot(), 21);
    assert.equal((await gallery.findEmptySlots())[0], 1);
});


test('каталог фильтрует проекты и показывает не более 20 на странице', () => {
    const startupSource = readFileSync(join(__dirname, '../lib/startup-home.js'), 'utf8');
    const sandbox = {window: {}, document: {readyState:'loading', addEventListener() {}}};
    vm.createContext(sandbox); vm.runInContext(startupSource, sandbox);
    const projectPage = sandbox.window.PGZStartupHome.projectPage;
    const projects = Array.from({length: 23}, (_, i) => ({projectName:'Проект ' + i, savedAt:i}));
    const first = projectPage(projects, '', 0), second = projectPage(projects, '', 1);
    assert.equal(first.items.length, 20); assert.equal(first.pages, 2); assert.equal(second.items.length, 3);
    assert.equal(first.items[0].index, 22); assert.equal(projectPage(projects, 'ПРОЕКТ 12', 0).items[0].index, 12);
    assert.equal(projectPage(projects, 'несуществующий', 1).total, 0);
});

test('новые игры отбираются за 10 дней по первой публикации', () => {
    const startupSource = readFileSync(join(__dirname, '../lib/startup-home.js'), 'utf8');
    const sandbox = {window: {}, document: {readyState:'loading', addEventListener() {}}};
    vm.createContext(sandbox); vm.runInContext(startupSource, sandbox);
    const now = Date.UTC(2026, 10, 14), day = 86400000;
    const games = [
      {id:'new', publishedAt: now-day, preview:true}, {id:'old', publishedAt: now-11*day, updatedAt:now-day, preview:true},
      {id:'legacy', updatedAt:now-2*day, preview:true}, {id:'future', publishedAt: now+day, preview:true},
      {id:'no-cover', publishedAt:now, preview:false}, {id:'missing-cover-field', publishedAt:now}
    ];
    const result = sandbox.window.PGZStartupHome.recentGames(games, now);
    assert.deepEqual(Array.from(result, x => x.id), ['new','legacy']);
    assert.equal(sandbox.window.PGZStartupHome.recentGames([{id:'no-cover', publishedAt:now, preview:false}], now).length, 0);
    assert.equal(sandbox.window.PGZStartupHome.recentGames(games, now+30*day).length, 0);
});
