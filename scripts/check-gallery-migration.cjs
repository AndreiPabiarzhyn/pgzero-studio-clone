// Run against a disposable browser profile: node scripts/check-gallery-migration.cjs
// The production revision is deliberately pinned so the baseline cannot change silently.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');

const revision = '04284c6759716d105bb74ce1e08cb23305171e41';
const oldSource = execFileSync('git', ['show', revision + ':lib/project-gallery.js'], { encoding: 'utf8' });
const newSource = readFileSync('lib/project-gallery.js', 'utf8');
const projects = [0, 2, 5].map(index => ({
    index,
    data: {
        version: 1, savedAt: 1700000000000 + index, projectName: 'Проект ' + index,
        currentFile: 'my_pgz.py', files: { 'my_pgz.py': 'print("проект ' + index + '")', 'extra.py': '# файл' },
        assets: {
            images: [{ name: 'sprite.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }],
            sounds: [{ name: 'sound.wav', dataUrl: 'data:audio/wav;base64,UklGRg==' }],
            music: [{ name: 'music.ogg', dataUrl: 'data:audio/ogg;base64,T2dnUw==' }]
        }, thumb: null
    }
}));

(async () => {
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        // Fulfil locally: this origin and its storage exist only in this fresh context.
        await page.route('http://migration-test.invalid/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Migration test</title>' }));
        await page.goto('http://migration-test.invalid/');
        await page.evaluate(async projects => {
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('pgz_project_gallery_v1', 1);
                request.onupgradeneeded = () => request.result.createObjectStore('slots');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            await new Promise((resolve, reject) => {
                const tx = db.transaction('slots', 'readwrite');
                projects.forEach(project => tx.objectStore('slots').put(project.data, String(project.index)));
                tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
            });
            db.close();
            localStorage.setItem('pgz_active_slot', '5');
        }, projects);
        await page.addScriptTag({ content: oldSource });
        const old = await page.evaluate(async () => ({ slots: await PGZProjectGallery.listSlots(), active: PGZProjectGallery.getActiveSlot() }));
        for (const project of projects) assert.deepEqual(old.slots[project.index], project.data);
        assert.equal(old.active, 5);
        await page.reload();
        await page.addScriptTag({ content: newSource });
        const updated = await page.evaluate(async () => ({ slots: await PGZProjectGallery.listSlots(), active: PGZProjectGallery.getActiveSlot() }));
        for (const project of projects) assert.deepEqual(updated.slots[project.index], project.data);
        assert.equal(updated.active, 5);
        console.log('Migration check passed: 3 legacy projects, files, images, sounds, music and active slot survived reload.');

        await page.addScriptTag({ content: readFileSync('lib/jsfs2.js', 'utf8') });
        const result = await page.evaluate(async () => {
            const fs = new FileSystem('migration_atomic_test');
            const original = { images: [{ name: 'old.png', dataUrl: 'old-image' }], sounds: [{ name: 'old.wav', dataUrl: 'old-sound' }], music: [] };
            const replacement = { images: [{ name: 'new.png', dataUrl: 'new-image' }], sounds: [{ name: 'new.wav', dataUrl: 'new-sound' }], music: [] };
            await fs.replaceProjectAssets(original);
            const nativePut = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (value, key) {
                if (value === 'new-sound') throw new Error('Simulated write failure');
                return nativePut.call(this, value, key);
            };
            let failed = false;
            try { await fs.replaceProjectAssets(replacement); } catch (_) { failed = true; }
            finally { IDBObjectStore.prototype.put = nativePut; }
            const oldAfterFailure = [await fs.read('/images/old.png'), await fs.read('/sounds/old.wav')];
            const namesAfterFailure = await fs.ls('/images', 'files');
            await fs.replaceProjectAssets(replacement);
            const afterSuccess = [await fs.read('/images/new.png'), await fs.read('/sounds/new.wav')];
            return { failed, oldAfterFailure, namesAfterFailure, afterSuccess };
        });
        assert.equal(result.failed, true);
        assert.deepEqual(result.oldAfterFailure, ['old-image', 'old-sound']);
        assert.deepEqual(result.namesAfterFailure, ['old.png']);
        assert.deepEqual(result.afterSuccess, ['new-image', 'new-sound']);
        console.log('Atomic resource replacement passed: failure preserves old assets; successful replacement loads new assets.');

        const creation = await page.evaluate(async () => {
            const fs = new FileSystem('migration_creation_test');
            await fs.replaceProjectAssets({ images: [{ name: 'old.png', dataUrl: 'old-image' }], sounds: [], music: [] });
            window.jsfs = fs;
            window.initFS = async () => {};
            window.askConfirm = async () => true;
            window.generateProjectName = () => 'Созданный проект';
            window.PythonIDE = {
                files: { 'my_pgz.py': 'old code' }, currentFile: 'my_pgz.py',
                editor: { getValue: () => 'old code', setValue: value => { window.editorValue = value; } }
            };
            const nativePut = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function (value, key) {
                if (value && value.projectName === 'Созданный проект') throw new Error('Simulated quota failure');
                return nativePut.call(this, value, key);
            };
            let failed = false;
            try { await PGZProjectGallery.pickSlot(1); } catch (_) { failed = true; }
            finally { IDBObjectStore.prototype.put = nativePut; }
            const afterFailure = {
                image: await fs.read('/images/old.png'), code: PythonIDE.files['my_pgz.py'],
                active: PGZProjectGallery.getActiveSlot(), newSlot: await PGZProjectGallery.getSlot(1)
            };
            await PGZProjectGallery.pickSlot(1);
            return { failed, afterFailure, active: PGZProjectGallery.getActiveSlot(), created: await PGZProjectGallery.getSlot(1), images: await fs.ls('/images', 'files') };
        });
        assert.equal(creation.failed, true);
        assert.equal(creation.afterFailure.image, 'old-image');
        assert.equal(creation.afterFailure.code, 'old code');
        assert.equal(creation.afterFailure.active, 5);
        assert.equal(creation.afterFailure.newSlot, undefined);
        assert.equal(creation.active, 1);
        assert.equal(creation.created.projectName, 'Созданный проект');
        assert.deepEqual(creation.images, []);
        console.log('New-project creation passed: failed save keeps current code and assets; retry creates an empty project.');

        await page.addScriptTag({ content: readFileSync('lib/jszip.min.js', 'utf8') });
        await page.addScriptTag({ content: readFileSync('lib/project-backup.js', 'utf8') });
        const backupResult = await page.evaluate(async () => {
            const before = await PGZProjectGallery.listSlots();
            const backup = await PGZProjectBackup.create();
            const originalAdd = IDBObjectStore.prototype.add;
            let calls = 0, failed = false;
            IDBObjectStore.prototype.add = function (value, key) {
                if (++calls === 2) throw new Error('Simulated full storage');
                return originalAdd.call(this, value, key);
            };
            try { await PGZProjectBackup.restore(backup.blob); } catch (_) { failed = true; }
            finally { IDBObjectStore.prototype.add = originalAdd; }
            const afterFailure = await PGZProjectGallery.listSlots();
            const restored = await PGZProjectBackup.restore(backup.blob);
            const after = await PGZProjectGallery.listSlots();
            return { before, count: backup.count, failed, afterFailure, restored, after };
        });
        assert.equal(backupResult.count, 4);
        assert.equal(backupResult.failed, true);
        assert.deepEqual(backupResult.afterFailure, backupResult.before);
        assert.equal(backupResult.restored, backupResult.count);
        const originals = backupResult.before.filter(Boolean), all = backupResult.after.filter(Boolean);
        assert.equal(all.length, originals.length * 2);
        for (const original of originals) assert.equal(all.filter(item => JSON.stringify(item) === JSON.stringify(original)).length, 2);
        console.log('Backup roundtrip passed: all code and media retained; failed restore is atomic and existing slots are untouched.');
    } finally {
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
