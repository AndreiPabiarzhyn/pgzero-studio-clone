/**
 * Unit-тесты i18n (стартовый экран).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadI18nTest() {
  const source = readFileSync(join(__dirname, '../lib/i18n.js'), 'utf8');
  const sandbox = {
    window: {},
    document: { documentElement: { lang: 'ru' } },
    navigator: { language: 'ru-RU' },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); }
    },
    console
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._pgzI18nTest;
}

test('locales содержат ключи стартового экрана и редактора', () => {
  for (const lang of ['ru', 'en', 'es']) {
    const json = JSON.parse(readFileSync(join(__dirname, '../locales/' + lang + '.json'), 'utf8'));
    assert.ok(json.startup.title);
    assert.ok(json.startup.chipCode);
    assert.ok(json.slot.label.includes('{n}'));
    assert.ok(json.toolbar.play);
    assert.ok(json.publish.title);
    assert.ok(json.gallery.switchHint);
  }
});

test('locales содержат ключи фазы 3 (settings, library, play)', () => {
  for (const lang of ['ru', 'en', 'es']) {
    const json = JSON.parse(readFileSync(join(__dirname, '../locales/' + lang + '.json'), 'utf8'));
    assert.ok(json.settings.title);
    assert.ok(json.library.imageGroups.characters);
    assert.ok(json.library.soundTags.game);
    assert.ok(json.library.musicGroups.menu);
    assert.ok(json.assets.view);
    assert.ok(json.codeHistory.empty);
    assert.ok(json.projectFiles.loading);
    assert.ok(json.recoverModal.count.includes('{n}'));
    assert.ok(json.play.pageTitle);
    assert.ok(json.templates.runner);
    assert.ok(json.ide.statusPos);
    assert.ok(json.ide.statusSel);
    assert.ok(json.starterCode.demoTitle);
    assert.ok(json.starterCode.demoHint);
  }
});

test('locales содержат ключи фазы 4 (drawEditor, ide, handbook)', () => {
  for (const lang of ['ru', 'en', 'es']) {
    const json = JSON.parse(readFileSync(join(__dirname, '../locales/' + lang + '.json'), 'utf8'));
    assert.ok(json.drawEditor.pageTitle);
    assert.ok(json.drawEditor.clearConfirmTitle);
    assert.ok(json.ide.errorModalTitle);
    assert.ok(json.ide.running);
    const handbook = JSON.parse(readFileSync(join(__dirname, '../locales/handbook.' + lang + '.json'), 'utf8'));
    assert.equal(handbook.sections.length, 14);
    assert.ok(handbook.sections[0].body);
  }
});

test('normalizeLang принимает ru/en/es', () => {
  const { normalizeLang } = loadI18nTest();
  assert.equal(normalizeLang('en-US'), 'en');
  assert.equal(normalizeLang('es'), 'es');
  assert.equal(normalizeLang('de'), 'ru');
});

test('t интерполирует параметры', () => {
  const i18n = loadI18nTest();
  i18n.setMessages({ slot: { label: 'Slot {n}' } });
  assert.equal(i18n.t('slot.label', { n: 3 }), 'Slot 3');
});

test('plural для en/other форм', () => {
  const i18n = loadI18nTest();
  i18n.setMessages({
    gallery: {
      imagesOne: '{n} image',
      imagesOther: '{n} images'
    }
  });
  assert.equal(i18n.plural('gallery.images', 1), '1 image');
  assert.equal(i18n.plural('gallery.images', 3), '3 images');
});

test('index.html содержит переключатель языка и chips', () => {
  const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /pg-lang-switch/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /pg-startup-screen__chips/);
  assert.match(html, /data-i18n="startup.title"/);
  assert.match(html, /more-menu-lang/);
  assert.match(html, /data-pz-icon="globe"/);
  assert.match(html, /data-i18n="toolbar.play"/);
});

test('draw-editor.html подключает i18n', () => {
  const html = readFileSync(join(__dirname, '../draw-editor.html'), 'utf8');
  assert.match(html, /lib\/i18n\.js/);
  assert.match(html, /PGZI18n\.init/);
  assert.match(html, /data-i18n="drawEditor\.done"/);
});

test('pgz-handbook.html подключает i18n и handbook-page', () => {
  const html = readFileSync(join(__dirname, '../pgz-handbook.html'), 'utf8');
  assert.match(html, /lib\/i18n\.js/);
  assert.match(html, /handbook-page\.js/);
  assert.match(html, /PGZHandbookPage\.init/);
  assert.doesNotMatch(html, /handbookLang/);
});

test('index.html встраивает справочник без переключателя языка', () => {
  const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /pgz-handbook\.html\?embed=1/);
});

test('play.html подключает i18n и data-i18n', () => {
  const html = readFileSync(join(__dirname, '../play.html'), 'utf8');
  assert.match(html, /lib\/i18n\.js/);
  assert.match(html, /PGZI18n\.init/);
  assert.match(html, /data-i18n="play\.loading"/);
});
