/**
 * Unit-тесты строки состояния редактора.
 * Запуск: node tests/editor-ide.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

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


function commentHarness(text, selections) {
  const lines = text.split('\n');
  const context = { window: {}, document: { getElementById: () => null, querySelector: () => null }, localStorage: { getItem: () => null }, CodeMirror: { defineExtension: () => {} }, setTimeout, clearTimeout };
  context.window = context;
  vm.runInNewContext(source, context);
  const ranges = selections.map(([from, to]) => ({ from: () => from, to: () => to }));
  const editor = {
    state: {}, phrase: () => '', options: {},
    getOption: () => ({}), setOption(name, value) { this.options[name] = value; },
    listSelections: () => ranges, getLine: n => lines[n],
    operation: fn => fn(), on: () => {},
    replaceRange(value, from, to) { lines[from.line] = lines[from.line].slice(0, from.ch) + value + lines[from.line].slice(to.ch); }
  };
  context.EditorIDE.setup(editor);
  return { toggle: () => editor.options.extraKeys['Ctrl-/'](editor), text: () => lines.join('\n') };
}

test('комментирование не затрагивает строку после конца выделения', () => {
  const h = commentHarness('a\nb\nc', [[{ line: 0, ch: 0 }, { line: 2, ch: 0 }]]);
  h.toggle();
  assert.equal(h.text(), '# a\n# b\nc');
  h.toggle();
  assert.equal(h.text(), 'a\nb\nc');
});

test('комментирование сохраняет пустые строки и не затрагивает промежутки между выделениями', () => {
  const h = commentHarness('  a\n\n  b\nc', [
    [{ line: 0, ch: 0 }, { line: 0, ch: 3 }],
    [{ line: 2, ch: 0 }, { line: 2, ch: 3 }]
  ]);
  h.toggle();
  assert.equal(h.text(), '  # a\n\n  # b\nc');
  h.toggle();
  assert.equal(h.text(), '  a\n\n  b\nc');
});

test('пустую текущую строку можно закомментировать', () => {
  const h = commentHarness('    ', [[{ line: 0, ch: 4 }, { line: 0, ch: 4 }]]);
  h.toggle();
  assert.equal(h.text(), '    # ');
});
