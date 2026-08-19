/**
 * Интеграционный QA: pgz roundtrip, публикация, прод.
 * node tests/qa-integration.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PROD_BASE = 'https://andreipabiarzhyn.github.io/pgzero-studio-clone';

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSZip = require(join(root, 'lib/jszip.min.js'));

async function loadZipBytes(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    return JSZip.loadAsync(bytes);
}

async function readZipText(entry) {
    return entry.async('text');
}

function loadModule(relPath, sandboxExtra) {
    const source = readFileSync(join(root, relPath), 'utf8');
    const inject = Object.assign({
        document: { getElementById: () => ({ value: 'QA Game' }) },
        localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        JSZip: JSZip
    }, sandboxExtra || {});

    for (const key of Object.keys(inject)) {
        globalThis[key] = inject[key];
    }
    if (!globalThis.window) globalThis.window = globalThis;

    vm.runInThisContext(source, { filename: relPath });
    return globalThis.PGZProjectIO;
}

async function isZipBlob(blob) {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return head[0] === 0x50 && head[1] === 0x4B;
}

test('pgz roundtrip: код и ресурсы сохраняются в zip и читаются обратно', async () => {
    const fsStore = { files: {}, meta: { images: {}, sounds: {}, music: {} } };
    const mockFs = {
        invalidateMetadataCache: () => {},
        ls: async (folder, type) => {
            const key = folder.replace(/^\//, '');
            if (type === 'files') return Object.keys(fsStore.meta[key] || {});
            return [];
        },
        read: async (path) => fsStore.files[path],
        write: async (path, data) => { fsStore.files[path] = data; }
    };

    const IO = loadModule('lib/pgz-project-io.js', {
        jsfs: mockFs,
        initFS: async () => {},
        PythonIDE: {
            files: { 'my_pgz.py': "import pgzrun\n\nTITLE = 'QA'\n\ndef draw():\n    screen.fill('black')\n\npgzrun.go()\n" },
            currentFile: 'my_pgz.py',
            editor: null
        },
        PGZProjectGallery: {
            getActiveSlot: () => 0,
            getSlot: async () => ({
                projectName: 'QA Game',
                currentFile: 'my_pgz.py',
                files: { 'my_pgz.py': "import pgzrun\n\nTITLE = 'QA'\n\ndef draw():\n    screen.fill('black')\n\npgzrun.go()\n" },
                assets: {
                    images: [{ name: 'hero.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }],
                    sounds: [],
                    music: []
                }
            })
        }
    });

    const built = await IO.buildProjectZipBlob();
    assert.ok(built.blob, 'zip blob created');
    assert.ok(built.blob.size > 50, 'zip not empty');
    assert.equal(built.error, undefined);

    const zip = await loadZipBytes(await built.blob.arrayBuffer());
    assert.ok(zip.file('my_pgz.py'), 'my_pgz.py in zip');
    const code = await readZipText(zip.file('my_pgz.py'));
    assert.match(code, /TITLE = 'QA'/);
    assert.ok(zip.file('images/hero.png'), 'image in zip');

    fsStore.files = {};
    fsStore.meta = { images: {}, sounds: {}, music: {} };
    const imported = await IO.importZipToProject(zip, { skipIde: true });
    assert.match(imported.code, /pgzrun\.go/);
    assert.ok(fsStore.files['/images/hero.png'], 'image restored to fs');
});

test('битый dataUrl не ломает сборку zip', async () => {
    const mockFs = {
        ls: async (folder, type) => (folder === '/images' && type === 'files' ? ['broken.png'] : []),
        read: async () => undefined
    };
    const IO = loadModule('lib/pgz-project-io.js', {
        jsfs: mockFs,
        initFS: async () => {},
        PythonIDE: {
            files: { 'my_pgz.py': 'import pgzrun\npgzrun.go()\n' },
            currentFile: 'my_pgz.py'
        },
        PGZProjectGallery: { getActiveSlot: () => null }
    });
    const built = await IO.buildProjectZipBlob();
    assert.ok(built.blob);
    const zip = await loadZipBytes(await built.blob.arrayBuffer());
    assert.ok(zip.file('my_pgz.py'));
    assert.equal(zip.file('images/broken.png'), null);
});

test('publish-static URL и локальные published/*.pgz валидны', async () => {
    const staticSource = readFileSync(join(root, 'lib/publish-static.js'), 'utf8');
    const sandbox = {
        PGZPublishConfig: { github: { path: 'published' } },
        location: { hostname: 'andreipabiarzhyn.github.io', pathname: '/pgzero-studio-clone/index.html' },
        fetch: global.fetch,
        console
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(staticSource, sandbox);
    const url = sandbox.PGZPublishStatic.getStaticUrl('k0w7ec');
    assert.equal(url, '/pgzero-studio-clone/published/k0w7ec.pgz');

    const publishedDir = join(root, 'published');
    const pgzFiles = readdirSync(publishedDir).filter((n) => n.endsWith('.pgz')).slice(0, 5);
    assert.ok(pgzFiles.length >= 1, 'need sample pgz in repo');

    for (const name of pgzFiles) {
        const buf = readFileSync(join(publishedDir, name));
        assert.ok(buf[0] === 0x50 && buf[1] === 0x4B, name + ' is zip');
        const zip = await loadZipBytes(buf);
        const entry = zip.file('my_pgz.py');
        assert.ok(entry, name + ' has my_pgz.py');
        const code = await entry.async('text');
        assert.ok(code.trim().length > 10, name + ' has code');
        assert.match(code, /pgzrun/, name + ' looks like pgz game');
    }
});

test('prod: версия и ключевые ассеты доступны', async () => {
    const versionRes = await fetch(PROD_BASE + '/version.json');
    assert.equal(versionRes.status, 200);
    const version = await versionRes.json();
    assert.match(version.version, /^0\.\d{3}$/);

    const localVersion = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;
    assert.equal(version.version, localVersion, 'prod version matches repo');

    const checks = [
        '/index.html',
        '/play.html',
        '/lib/project-publish.js?v=' + localVersion,
        '/lib/pgz-project-io.js?v=' + localVersion,
        '/lib/play-page.js?v=' + localVersion,
        '/published/k0w7ec.pgz'
    ];
    for (const path of checks) {
        const res = await fetch(PROD_BASE + path, { redirect: 'follow' });
        assert.equal(res.status, 200, 'missing on prod: ' + path);
    }
});

test('prod: опубликованный pgz содержит код (не пустой проект)', async () => {
    const res = await fetch(PROD_BASE + '/published/k0w7ec.pgz');
    assert.equal(res.status, 200);
    const blob = await res.blob();
    assert.ok(await isZipBlob(blob));
    const zip = await loadZipBytes(await blob.arrayBuffer());
    const code = await zip.file('my_pgz.py').async('text');
    assert.ok(code.trim().length > 20);
    assert.match(code, /pgzrun/);
});
