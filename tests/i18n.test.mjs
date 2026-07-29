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

test('locales содержат ключи стартового экрана', () => {
  for (const lang of ['ru', 'en', 'es']) {
    const json = JSON.parse(readFileSync(join(__dirname, '../locales/' + lang + '.json'), 'utf8'));
    assert.ok(json.startup.title);
    assert.ok(json.startup.chipCode);
    assert.ok(json.slot.label.includes('{n}'));
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

test('index.html содержит переключатель языка и chips', () => {
  const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /pg-lang-switch/);
  assert.match(html, /data-lang="en"/);
  assert.match(html, /pg-startup-screen__chips/);
  assert.match(html, /data-i18n="startup.title"/);
});
