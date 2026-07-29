/**
 * Unit-тесты стартового кода проекта.
 * Запуск: node tests/starter-code.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/starter-code.js'), 'utf8');

function loadStarterCodeTest(lang, messages) {
  const sandbox = {
    window: {},
    localStorage: {
      _data: {},
      getItem(key) { return this._data[key] || null; },
      setItem(key, value) { this._data[key] = String(value); }
    },
    console
  };
  sandbox.window = sandbox;
  if (messages) {
    sandbox.PGZI18n = {
      getLang: () => lang || 'ru',
      uiText(key, params, fallback) {
        const parts = key.split('.');
        let value = messages;
        parts.forEach(function (part) { value = value && value[part]; });
        return value != null ? value : fallback;
      }
    };
  } else if (lang) {
    sandbox.PGZI18n = { getLang: () => lang };
  }
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window._starterCodeTest;
}

test('buildDemoCode на русском по умолчанию', () => {
  const { buildDemoCode } = loadStarterCodeTest('ru');
  const code = buildDemoCode();
  assert.match(code, /TITLE = "Мой раннер"/);
  assert.match(code, /Пробел — прыжок/);
  assert.match(code, /Мини-раннер/);
});

test('buildDemoCode использует en из локали', () => {
  const { buildDemoCode } = loadStarterCodeTest('en', {
    starterCode: {
      demoComment: 'Mini-runner: a circle runs and jumps with space',
      demoTitle: 'My runner',
      demoHint: 'Space — jump'
    }
  });
  const code = buildDemoCode();
  assert.match(code, /TITLE = "My runner"/);
  assert.match(code, /Space — jump/);
  assert.doesNotMatch(code, /Мой раннер/);
});

test('getProjectTemplate локализует placeholder', () => {
  const { getProjectTemplate } = loadStarterCodeTest('en', {
    starterCode: {
      baseComment: 'Pygame Zero',
      placeholderComment: 'Your code goes here'
    }
  });
  const code = getProjectTemplate({ width: 640, height: 480, title: 'Game' });
  assert.match(code, /WIDTH = 640/);
  assert.match(code, /TITLE = "Game"/);
  assert.match(code, /# Your code goes here/);
});
