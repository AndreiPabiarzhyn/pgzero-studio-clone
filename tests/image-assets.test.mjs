/**
 * Unit-тесты замены картинок (PGZImageAssets).
 * Запуск: node tests/image-assets.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadImageAssets() {
    const source = readFileSync(join(__dirname, '../lib/image-assets.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox.window.PGZImageAssets;
}

function createMockFs(initialFiles) {
    const files = new Map(Object.entries(initialFiles || {}));

    return {
        files: files,
        async ls(folder, mode) {
            const prefix = folder.replace(/\/+$/, '') + '/';
            const names = [];
            for (const key of files.keys()) {
                if (key.startsWith(prefix) && key.slice(prefix.length).indexOf('/') === -1) {
                    names.push(key.slice(prefix.length));
                }
            }
            return names;
        },
        async type(path) {
            return files.has(path) ? 'file' : null;
        },
        async read(path) {
            return files.get(path);
        },
        async write(path, content) {
            files.set(path, content);
        },
        async rm(path) {
            files.delete(path);
        }
    };
}

test('normalizeImageFileName сохраняет png и переводит в jpg при jpeg dataUrl', () => {
    const IA = loadImageAssets();
    assert.equal(IA.normalizeImageFileName('hero.png', 'data:image/png;base64,abc'), 'hero.png');
    assert.equal(IA.normalizeImageFileName('hero.png', 'data:image/jpeg;base64,abc'), 'hero.jpg');
    assert.equal(IA.normalizeImageFileName('sprite', 'data:image/png;base64,abc'), 'sprite.png');
});

test('writeImageReplacing перезаписывает файл с тем же именем', async () => {
    const IA = loadImageAssets();
    const fs = createMockFs({
        '/images/hero.png': 'data:image/png;base64,old'
    });

    await IA.writeImageReplacing(fs, 'hero.png', 'data:image/png;base64,new');

    assert.equal(fs.files.get('/images/hero.png'), 'data:image/png;base64,new');
    assert.equal(fs.files.size, 1);
});

test('writeImageReplacing удаляет другие расширения с тем же базовым именем', async () => {
    const IA = loadImageAssets();
    const fs = createMockFs({
        '/images/hero.png': 'data:image/png;base64,old-png',
        '/images/hero.jpg': 'data:image/jpeg;base64,old-jpg',
        '/images/alien.png': 'data:image/png;base64,keep'
    });

    await IA.writeImageReplacing(fs, 'hero.jpg', 'data:image/jpeg;base64,fresh');

    assert.equal(fs.files.has('/images/hero.png'), false);
    assert.equal(fs.files.get('/images/hero.jpg'), 'data:image/jpeg;base64,fresh');
    assert.equal(fs.files.get('/images/alien.png'), 'data:image/png;base64,keep');
});

test('resolveUploadImageName заменяет существующий спрайт, а не создаёт hero (1)', async () => {
    const IA = loadImageAssets();
    const fs = createMockFs({
        '/images/hero.png': 'data:image/png;base64,old'
    });
    const used = new Set();

    const name = await IA.resolveUploadImageName(fs, 'hero.png', 'data:image/png;base64,new', used);

    assert.equal(name, 'hero.png');
    assert.deepEqual(Array.from(used), ['hero']);
});

test('resolveUploadImageName различает дубликаты в одной пачке загрузки', async () => {
    const IA = loadImageAssets();
    const fs = createMockFs({});
    const used = new Set();

    const first = await IA.resolveUploadImageName(fs, 'hero.png', 'data:image/png;base64,a', used);
    const second = await IA.resolveUploadImageName(fs, 'hero.png', 'data:image/png;base64,b', used);

    assert.equal(first, 'hero.png');
    assert.equal(second, 'hero (1).png');
});

test('inspectImageUpload отклоняет svg и принимает jfif с конвертацией', () => {
    const IA = loadImageAssets();
    const jfif = IA.inspectImageUpload({ name: 'enemy.jfif', type: 'image/jpeg' });
    assert.equal(jfif.ok, true);
    assert.equal(jfif.converted, true);
    assert.equal(jfif.uploadName, 'enemy.jpg');

    const svg = IA.inspectImageUpload({ name: 'icon.svg', type: 'image/svg+xml' });
    assert.equal(svg.ok, false);
    assert.equal(svg.blocked, true);

    const png = IA.inspectImageUpload({ name: 'hero.png', type: 'image/png' });
    assert.equal(png.ok, true);
    assert.equal(png.converted, undefined);
});

test('inspectStoredImageName находит jfif и предлагает repairTo jpg', () => {
    const IA = loadImageAssets();
    const info = IA.inspectStoredImageName('enemy.jfif');
    assert.equal(info.ok, false);
    assert.equal(info.repairTo, 'enemy.jpg');
    assert.equal(IA.inspectStoredImageName('fon.jpg').ok, true);
});

test('repairConvertibleImages пересохраняет jfif как jpg', async () => {
    const IA = loadImageAssets();
    const fs = createMockFs({
        '/images/enemy.jfif': 'data:image/jpeg;base64,abc',
        '/images/fon.jpg': 'data:image/jpeg;base64,zzz'
    });
    const repaired = await IA.repairConvertibleImages(fs);
    assert.equal(repaired.length, 1);
    assert.equal(repaired[0].from, 'enemy.jfif');
    assert.equal(repaired[0].to, 'enemy.jpg');
    assert.equal(fs.files.has('/images/enemy.jfif'), false);
    assert.equal(fs.files.get('/images/enemy.jpg'), 'data:image/jpeg;base64,abc');
});

test('clearRuntimeImageCache сохраняет объект кеша для pgzrun', () => {
    const source = readFileSync(join(__dirname, '../lib/image-assets.js'), 'utf8');
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);

    sandbox.window.PGZ_IMAGE_CACHE = { fon: {}, dog: {} };
    const cacheRef = sandbox.window.PGZ_IMAGE_CACHE;
    sandbox.window.PGZImageAssets.clearRuntimeImageCache();
    cacheRef.hero = { width: 10, height: 10 };

    assert.equal(sandbox.window.PGZ_IMAGE_CACHE, cacheRef);
    assert.equal(Object.keys(sandbox.window.PGZ_IMAGE_CACHE).length, 1);
    assert.ok(sandbox.window.PGZ_IMAGE_CACHE.hero);
    assert.equal(sandbox.window.PGZ_PRELOAD_COMPLETE, false);
});

test('runCode использует clearRuntimeImageCache вместо нового объекта', () => {
    const libSource = readFileSync(join(__dirname, '../lib/lib.js'), 'utf8');
    const pgzSource = readFileSync(join(__dirname, '../lib/skulpt/pgzrun/__init__.js'), 'utf8');
    assert.match(libSource, /clearRuntimeImageCache/);
    assert.match(libSource, /delete window\.PGZ_IMAGE_CACHE\[key\]/);
    assert.match(pgzSource, /function imageCache\(\)/);
    assert.doesNotMatch(pgzSource, /var loadedAssets = window\.PGZ_IMAGE_CACHE/);
});

test('assets-gallery и image-library подключены к PGZImageAssets', () => {
    const gallerySource = readFileSync(join(__dirname, '../lib/assets-gallery.js'), 'utf8');
    const librarySource = readFileSync(join(__dirname, '../lib/image-library.js'), 'utf8');
    const indexHtml = readFileSync(join(__dirname, '../index.html'), 'utf8');

    assert.match(gallerySource, /PGZImageAssets\.writeImageReplacing/);
    assert.match(gallerySource, /PGZImageAssets\.resolveUploadImageName/);
    assert.match(gallerySource, /async function afterImageAssetsChanged/);
    assert.match(gallerySource, /PythonIDE\.stop\(\)/);
    assert.match(gallerySource, /let dragDropEnabled = false/);
    assert.match(librarySource, /PGZImageAssets\.writeImageReplacing/);
    assert.match(indexHtml, /lib\/image-assets\.js/);
});
