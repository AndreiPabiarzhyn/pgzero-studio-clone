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
