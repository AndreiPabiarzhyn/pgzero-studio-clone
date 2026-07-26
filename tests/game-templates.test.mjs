/**
 * Unit-тесты заготовок игр.
 * Запуск: node tests/game-templates.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../lib/game-templates.js'), 'utf8');

function loadTemplates() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.PGZGameTemplates;
}

test('escapeHtml экранирует спецсимволы', () => {
    const { escapeHtml } = loadTemplates()._test;
    assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
});

test('список заготовок — 4 игры', () => {
    const list = loadTemplates()._test.TEMPLATES;
    assert.equal(list.length, 4);
    assert.equal(list[0].title, 'RunnerGame');
    assert.equal(list[0].pgz, 'RunnerGame.pgz');
    assert.equal(list[1].title, 'MeteorGame');
    assert.equal(list[2].title, 'ClickerGame');
    assert.equal(list[3].title, 'Roguelike');
});
