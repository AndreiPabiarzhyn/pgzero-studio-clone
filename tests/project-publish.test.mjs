/**
 * Unit-тесты публикации проектов.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publishSource = readFileSync(join(__dirname, '../lib/project-publish.js'), 'utf8');
const indexHtml = readFileSync(join(__dirname, '../index.html'), 'utf8');
const playHtml = readFileSync(join(__dirname, '../play.html'), 'utf8');

function loadPublish(location) {
    const sandbox = {
        window: {},
        location: location || { origin: 'https://example.com', pathname: '/pgzero-studio-clone/index.html' },
        localStorage: { getItem: () => null, setItem: () => {} },
        indexedDB: {},
        console
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(publishSource, sandbox);
    return sandbox.window.PGZProjectPublish;
}

test('generatePublishId создаёт короткий id', () => {
    const { generatePublishId } = loadPublish()._test;
    const id = generatePublishId();
    assert.match(id, /^[a-z0-9]{6}$/);
});

test('buildPlayUrl формирует play.html?id=', () => {
    const pub = loadPublish();
    const url = pub._test.buildPlayUrl('abc123');
    assert.equal(url, 'https://example.com/pgzero-studio-clone/play.html?id=abc123');
});

test('getAppBasePath учитывает index.html и play.html', () => {
    const fromIndex = loadPublish({ origin: 'https://x.com', pathname: '/app/index.html' })._test.getAppBasePath();
    assert.equal(fromIndex, '/app');
    const fromPlay = loadPublish({ origin: 'https://x.com', pathname: '/app/play.html' })._test.getAppBasePath();
    assert.equal(fromPlay, '/app');
});

test('кнопка Опубликовать и экран успеха в index.html', () => {
    assert.match(indexHtml, /btn_pgz_publish/);
    assert.match(indexHtml, /projectPublishScreen/);
    assert.match(indexHtml, /publishCopyLinkBtn/);
    assert.match(indexHtml, /project-publish\.js/);
});

test('play.html — отдельная страница без модалки IDE', () => {
    assert.match(playHtml, /pg-play-page/);
    assert.match(playHtml, /playPageStartBtn/);
    assert.match(playHtml, /play-page\.js/);
    assert.doesNotMatch(playHtml, /game-modal-overlay/);
});

test('play-page подключает обработчики клавиатуры', () => {
    const playSource = readFileSync(join(__dirname, '../lib/play-page.js'), 'utf8');
    assert.match(playSource, /function bindKeyboard/);
    assert.match(playSource, /addEventListener\('keydown'/);
    assert.match(playSource, /PythonIDE\.keyHandlers/);
});

test('toolbar-compact скрывает подписи при нехватке места', () => {
    const css = readFileSync(join(__dirname, '../theme.css'), 'utf8');
    const js = readFileSync(join(__dirname, '../lib/toolbar-compact.js'), 'utf8');
    assert.match(css, /topPanel--compact/);
    assert.match(js, /measureNeedsCompact/);
});
