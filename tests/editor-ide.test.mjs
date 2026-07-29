/**
 * Unit-тесты строки состояния редактора.
 * Запуск: node tests/editor-ide.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/editor-ide.js'), 'utf8');

test('updateStatus использует i18n для позиции и выделения', () => {
  assert.match(source, /ideText\(\s*'ide\.statusPos'/);
  assert.match(source, /ideText\(\s*'ide\.statusSel'/);
  assert.match(source, /ideText\(\s*'ide\.statusLang'/);
  assert.doesNotMatch(source, /pos\.textContent = 'Стр\./);
});

test('редактор обновляет статус при смене языка', () => {
  assert.match(source, /pgz:langchange[\s\S]{0,120}updateStatus\(cm\)/);
});
