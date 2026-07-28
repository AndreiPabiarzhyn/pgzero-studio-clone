/**
 * Unit-тесты вкладок боковой панели.
 * Запуск: node tests/sidebar-tabs.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tabsSource = readFileSync(join(__dirname, '../lib/sidebar-tabs.js'), 'utf8');
const splittersSource = readFileSync(join(__dirname, '../lib/layout-splitters.js'), 'utf8');
const indexHtml = readFileSync(join(__dirname, '../index.html'), 'utf8');

function loadSidebarTabs() {
  var galleryCalled = false;

  var sandbox = {
    window: {},
    document: {
      querySelectorAll: function () {
        return [];
      },
      getElementById: function () {
        return null;
      }
    },
    localStorage: {},
    initializeAssetsGallery: function () {
      galleryCalled = true;
      return Promise.resolve();
    },
    console: console
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(tabsSource, sandbox);
  return { sandbox, getGalleryCalled: function () { return galleryCalled; } };
}

test('sidebar-tabs.js экспортирует PGZSidebarTabs и showGallery', () => {
  assert.match(tabsSource, /PGZSidebarTabs/);
  assert.match(tabsSource, /global\.showGallery/);
  assert.match(tabsSource, /global\.showHandbook/);
});

test('switchTab на assets вызывает initializeAssetsGallery', async () => {
  const { sandbox, getGalleryCalled } = loadSidebarTabs();
  await sandbox.PGZSidebarTabs.switchTab('assets');
  assert.equal(getGalleryCalled(), true);
});

test('layout-splitters не скрывает боковую панель', () => {
  assert.doesNotMatch(splittersSource, /layout-right--hidden/);
  assert.doesNotMatch(splittersSource, /toggleSidebar/);
  assert.match(splittersSource, /MIN_SIDEBAR/);
});

test('index.html содержит вкладки sidebar и без дубля Run в редакторе', () => {
  assert.match(indexHtml, /data-sidebar-tab="assets"/);
  assert.match(indexHtml, /data-sidebar-tab="handbook"/);
  assert.match(indexHtml, /sidebar-tabs\.js/);
  assert.doesNotMatch(indexHtml, /id="ideBtnRun"/);
  assert.doesNotMatch(indexHtml, /toggleShowGallery\(\)/);
  assert.doesNotMatch(indexHtml, /data-pz-icon="gallery" title="Картинки и звуки"/);
});
