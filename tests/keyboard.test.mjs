/**
 * Тесты поведения клавиатуры / перезагрузки.
 * Запуск: node tests/keyboard.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libSource = readFileSync(join(root, 'lib/lib.js'), 'utf8');

test('F5 не запускает игру при перезагрузке страницы', () => {
    assert.doesNotMatch(
        libSource,
        /keyCode\)\s*==\s*116[\s\S]{0,160}runCode/
    );
});

test('Ctrl+Enter по-прежнему запускает игру', () => {
    assert.match(libSource, /case\s+13:[\s\S]{0,120}runCode/);
});
