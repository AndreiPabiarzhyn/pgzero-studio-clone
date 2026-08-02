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
    assert.match(indexHtml, /projectPublishLoading/);
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

test('короткая ссылка через GitHub Pages published/', () => {
    const staticSource = readFileSync(join(__dirname, '../lib/publish-static.js'), 'utf8');
    const publishSource = readFileSync(join(__dirname, '../lib/project-publish.js'), 'utf8');
    assert.match(staticSource, /published/);
    assert.match(publishSource, /PGZPublishStatic\.uploadGame/);
    assert.match(publishSource, /PGZPublishLink\.encodePortableUrl/);
    assert.match(readFileSync(join(__dirname, '../lib/play-page.js'), 'utf8'), /loadProjectByStaticId/);
});

test('publish-static определяет repo на github.io', () => {
    const staticSource = readFileSync(join(__dirname, '../lib/publish-static.js'), 'utf8');
    const sandbox = {
        PGZPublishConfig: { github: { token: '', path: 'published' } },
        location: {
            hostname: 'andreipabiarzhyn.github.io',
            pathname: '/pgzero-studio-clone/index.html'
        },
        fetch: async () => ({ ok: true }),
        console
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(staticSource, sandbox);
    const detected = sandbox.window.PGZPublishStatic.detectFromLocation(sandbox.location);
    assert.ok(detected);
    assert.equal(detected.owner, 'andreipabiarzhyn');
    assert.equal(detected.repo, 'pgzero-studio-clone');
    const url = sandbox.window.PGZPublishStatic._test.getStaticUrl('abc123');
    assert.equal(url, '/pgzero-studio-clone/published/abc123.pgz');
});

test('play.html подключает статическую публикацию', () => {
    assert.match(playHtml, /publish-config\.js/);
    assert.match(playHtml, /publish-static\.js/);
    assert.doesNotMatch(playHtml, /publish-cloud\.js/);
});

test('publish привязывает id к активному слоту через getActiveSlot', () => {
    assert.match(publishSource, /PGZProjectGallery\.getActiveSlot/);
    assert.doesNotMatch(publishSource, /PGZProjectGallery\.getActiveSlotIndex/);
});

test('play-page не подставляет пустой проект по ссылке', () => {
    const playSource = readFileSync(join(__dirname, '../lib/play-page.js'), 'utf8');
    assert.match(playSource, /loadProjectByStaticId/);
    assert.doesNotMatch(playSource, /code = await loadProjectById\(id\)/);
    assert.match(playSource, /empty_project/);
    assert.match(playSource, /isZipBlob/);
});
