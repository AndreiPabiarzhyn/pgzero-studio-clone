/**
 * Unit-тесты UI галереи ресурсов (popover, выбор).
 * Запуск: node tests/gallery-ui.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/assets-gallery.js'), 'utf8');

function loadGalleryUiTest() {
  const sandbox = {
    window: {},
    document: {
      addEventListener: () => {},
      querySelectorAll: () => [],
      body: { appendChild: () => {} }
    },
    console
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._galleryUiTest;
}

test('isSameGallerySelection сравнивает тип и путь', () => {
  const { isSameGallerySelection } = loadGalleryUiTest();
  assert.equal(isSameGallerySelection('image', '/images/a.png', { image: '/images/a.png' }), true);
  assert.equal(isSameGallerySelection('image', '/images/b.png', { image: '/images/a.png' }), false);
  assert.equal(isSameGallerySelection('image', '/images/a.png', null), false);
});

test('GALLERY_POPOVER_ACTIONS содержит кнопки для всех типов', () => {
  const { GALLERY_POPOVER_ACTIONS } = loadGalleryUiTest();
  assert.ok(GALLERY_POPOVER_ACTIONS.image.length >= 3);
  assert.ok(GALLERY_POPOVER_ACTIONS.audio.length >= 2);
  assert.ok(GALLERY_POPOVER_ACTIONS.music.length >= 2);
  GALLERY_POPOVER_ACTIONS.image.forEach(function (action) {
    assert.ok(action.icon);
    assert.ok(action.title);
    assert.equal(typeof action.run, 'function');
  });
});

test('GALLERY_POPOVER_ACTIONS image включает просмотр и удаление', () => {
  const { GALLERY_POPOVER_ACTIONS } = loadGalleryUiTest();
  const titles = GALLERY_POPOVER_ACTIONS.image.map(function (a) { return a.title; });
  assert.ok(titles.includes('Посмотреть'));
  assert.ok(titles.includes('Удалить'));
});

test('после редактора сбрасывается кеш jsfs и обновляется галерея', () => {
  assert.match(source, /invalidateMetadataCache/);
  assert.match(source, /refreshAssetsAfterEditorChange/);
  assert.match(readFileSync(join(__dirname, '../lib/draw-editor.js'), 'utf8'), /spriteSaved/);
});
