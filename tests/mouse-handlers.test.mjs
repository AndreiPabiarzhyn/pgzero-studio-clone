/**
 * Тесты обработчиков мыши pgzrun.
 * Запуск: node tests/mouse-handlers.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pgzSource = readFileSync(join(root, 'lib/skulpt/pgzrun/__init__.js'), 'utf8');

test('on_mouse_down передаёт pos/button по именам параметров', () => {
    assert.match(pgzSource, /function buildMouseButtonArgs/);
    assert.match(pgzSource, /function callMouseButtonHandler/);
    assert.doesNotMatch(
        pgzSource,
        /def on_mouse_down\(pos, button\)[\s\S]{0,80}callsimAsync\(handlers, Sk\.globals\.on_mouse_down, pos, button\)/
    );
});

test('Actor.collidepoint проверяет формат pos', () => {
    assert.match(
        pgzSource,
        /\$loc\.collidepoint = new Sk\.builtin\.func\(function\(self, pos\)[\s\S]{0,220}TypeError\("collidepoint\(\) argument must be \(x, y\) tuple"\)/
    );
});

test('Actor.__init__ поддерживает topleft при создании', () => {
    assert.match(pgzSource, /function applyInitPosition/);
    assert.match(pgzSource, /updateActorAttribute\(self, new Sk\.builtin\.str\(key\), value\)/);
    assert.match(pgzSource, /'topleft', 'topright', 'bottomleft', 'bottomright'/);
    assert.match(pgzSource, /init\.co_varnames = \['self', 'name', 'pos'\]/);
    assert.match(pgzSource, /init\.\$defaults = \[Sk\.builtin\.none\.none\$\]/);
});

test('экран очищается перед каждым draw()', () => {
    assert.match(pgzSource, /function runUserDraw\(\)/);
    assert.match(
        pgzSource,
        /function runUserDraw\(\)[\s\S]{0,400}fillRect\(0,\s*0,\s*width,\s*height\)[\s\S]{0,160}Sk\.globals\.draw/
    );
});

test('Actor сообщает об ошибке, если картинка не найдена', () => {
    assert.match(pgzSource, /function requireImage/);
    assert.match(pgzSource, /function throwImageNotFound/);
    assert.match(pgzSource, /var img = requireImage\(self\.attributes\.image\)/);
    assert.match(pgzSource, /if \(!img\) throwImageNotFound\(self\.attributes\.image\)/);
    assert.match(pgzSource, /Did you mean/);
});

test('остановка игры глушит музыку и звуки', () => {
    assert.match(pgzSource, /window\.PGZ_stopAllGameAudio = stopAllGameAudio/);
    assert.match(pgzSource, /registerGameAudio\(audio\)/);
    assert.match(readFileSync(join(root, 'lib/lib.js'), 'utf8'), /PGZ_stopAllGameAudio/);
});

test('после закрытия игры draw не падает из-за очищенного кеша', () => {
    const libSource = readFileSync(join(root, 'lib/lib.js'), 'utf8');
    assert.match(pgzSource, /if \(window\.PGZ_STOP_REQUESTED\) return;/);
    assert.match(pgzSource, /function runUserDraw\(\)[\s\S]{0,120}if \(window\.PGZ_STOP_REQUESTED\)/);
    assert.match(libSource, /Ignored runtime error after stop/);
    assert.doesNotMatch(
        libSource,
        /stop: function\(\)[\s\S]{0,700}clearImageCache\(\)/
    );
});
