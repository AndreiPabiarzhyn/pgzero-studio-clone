/**
 * Заготовки игр — пустой код + предзагруженные картинки.
 * Картинки: assets/templates/{id}.pgz или assets/templates/{id}/manifest.json + images/
 */
(function (global) {
    'use strict';

    var BASE = 'assets/templates';

    var TEMPLATES = [
        { id: 'runner', number: 1, title: 'RunnerGame', pgz: 'RunnerGame.pgz' },
        { id: 'meteor', number: 2, title: 'MeteorGame', pgz: 'MeteorGame.pgz' },
        { id: 'clicker', number: 3, title: 'ClickerGame', pgz: 'ClickerGame.pgz' },
        { id: 'roguelike', number: 4, title: 'Roguelike', pgz: 'Roguelike.pgz' }
    ];

    var assetCache = {};

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function blobToDataUrl(blob, filename) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        }).then(function (dataUrl) {
            if (!filename || !filename.match(/\.(png|jpe?g|gif|webp)$/i)) return dataUrl;
            var mime = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            if (dataUrl.indexOf('data:application/') === 0) {
                var b64 = dataUrl.split(',')[1];
                dataUrl = 'data:' + mime + ';base64,' + b64;
            }
            if (typeof PGZStorageGuard !== 'undefined' && PGZStorageGuard.prepareImageDataUrl) {
                return PGZStorageGuard.prepareImageDataUrl(dataUrl, filename).then(function (r) {
                    return r.dataUrl;
                });
            }
            return dataUrl;
        });
    }

    async function fetchOk(url) {
        try {
            var resp = await fetch(url, { method: 'HEAD' });
            return resp.ok;
        } catch (e) {
            return false;
        }
    }

    async function loadAssetsFromPgz(url) {
        if (typeof JSZip === 'undefined') return { images: [], sounds: [], music: [] };
        var resp = await fetch(url);
        if (!resp.ok) throw new Error('pgz not found');
        var zip = await JSZip.loadAsync(await resp.arrayBuffer());
        var images = [];
        var sounds = [];
        var music = [];
        var paths = Object.keys(zip.files).filter(function (name) { return !name.endsWith('/'); });

        for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            var folder = path.split('/')[0];
            if (folder !== 'images' && folder !== 'sounds' && folder !== 'music') continue;
            var fileName = path.split('/').pop();
            var fileData = await zip.file(path).async('base64');
            var dataUrl = 'data:application/octet-stream;base64,' + fileData;
            if (folder === 'images') {
                var mime = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                dataUrl = 'data:' + mime + ';base64,' + fileData;
                if (typeof PGZStorageGuard !== 'undefined' && PGZStorageGuard.prepareImageDataUrl) {
                    var optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrl, fileName);
                    dataUrl = optimized.dataUrl;
                }
                images.push({ name: fileName, dataUrl: dataUrl });
            } else if (folder === 'sounds') {
                sounds.push({ name: fileName, dataUrl: dataUrl });
            } else {
                music.push({ name: fileName, dataUrl: dataUrl });
            }
        }

        return { images: images, sounds: sounds, music: music };
    }

    async function loadAssetsFromManifest(templateId) {
        var manifestUrl = BASE + '/' + templateId + '/manifest.json';
        var resp = await fetch(manifestUrl);
        if (!resp.ok) return { images: [], sounds: [], music: [] };
        var manifest = await resp.json();
        var result = { images: [], sounds: [], music: [] };
        var groups = [
            { key: 'images', folder: 'images' },
            { key: 'sounds', folder: 'sounds' },
            { key: 'music', folder: 'music' }
        ];

        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var names = manifest[group.key] || [];
            for (var i = 0; i < names.length; i++) {
                var name = names[i];
                var fileUrl = BASE + '/' + templateId + '/' + group.folder + '/' + name;
                var fileResp = await fetch(fileUrl);
                if (!fileResp.ok) continue;
                var blob = await fileResp.blob();
                var dataUrl = await blobToDataUrl(blob, name);
                result[group.key].push({ name: name, dataUrl: dataUrl });
            }
        }

        return result;
    }

    async function resolveTemplatePgzUrl(templateId) {
        var template = TEMPLATES.find(function (t) { return t.id === templateId; });
        var candidates = [];
        if (template && template.pgz) {
            candidates.push(BASE + '/' + templateId + '/' + template.pgz);
        }
        candidates.push(BASE + '/' + templateId + '.pgz');
        for (var i = 0; i < candidates.length; i++) {
            if (await fetchOk(candidates[i])) return candidates[i];
        }
        return null;
    }

    async function loadTemplateAssets(templateId) {
        if (assetCache[templateId]) return assetCache[templateId];

        var pgzUrl = await resolveTemplatePgzUrl(templateId);
        var assets;
        if (pgzUrl) {
            assets = await loadAssetsFromPgz(pgzUrl);
        } else {
            assets = await loadAssetsFromManifest(templateId);
        }

        assetCache[templateId] = assets;
        return assets;
    }

    async function writeAssets(folder, items) {
        if (!items || !items.length) return;
        if (typeof initFS === 'function') await initFS();
        var fs = global.jsfs || global.fs;
        if (!fs) return;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            await fs.write('/' + folder + '/' + item.name, item.dataUrl);
        }
    }

    async function applyTemplate(template) {
        if (!template || typeof PythonIDE === 'undefined') return false;

        if (typeof PGZSession !== 'undefined' && typeof PGZSession.flush === 'function') {
            PGZSession.flush();
        }
        if (typeof PGZProjectGallery !== 'undefined' && typeof PGZProjectGallery.saveActiveSlotQuiet === 'function') {
            await PGZProjectGallery.saveActiveSlotQuiet();
        }

        if (typeof clearAllSelections === 'function') clearAllSelections();
        if (typeof clearProjectResources === 'function') await clearProjectResources();

        var assets = await loadTemplateAssets(template.id);
        await writeAssets('images', assets.images);
        await writeAssets('sounds', assets.sounds);
        await writeAssets('music', assets.music);

        var code = typeof PGZ_BASE_CODE !== 'undefined'
            ? PGZ_BASE_CODE
            : 'import pgzrun\n\npgzrun.go()\n';

        PythonIDE.files = { 'my_pgz.py': code };
        PythonIDE.currentFile = 'my_pgz.py';
        if (PythonIDE.editor && typeof PythonIDE.editor.setValue === 'function') {
            PythonIDE.disableChangeEvent = true;
            PythonIDE.editor.setValue(code);
            PythonIDE.disableChangeEvent = false;
        }
        if (typeof PythonIDE.updateFileTabs === 'function') PythonIDE.updateFileTabs();

        var nameInput = document.getElementById('projectNameInput');
        if (nameInput) nameInput.value = template.title;

        if (typeof refreshGallery === 'function') await refreshGallery();
        if (typeof PGZCodeHistory !== 'undefined') PGZCodeHistory.clear();
        if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
        if (typeof PGZSession !== 'undefined' && typeof PGZSession.save === 'function') PGZSession.save();
        if (typeof PythonIDE.refreshEditorView === 'function') PythonIDE.refreshEditorView();

        return true;
    }

    function renderGrid() {
        var grid = document.getElementById('gameTemplatesGrid');
        if (!grid) return;

        grid.innerHTML = '';
        TEMPLATES.forEach(function (template) {
            var card = document.createElement('div');
            card.className = 'pg-slot pg-template-slot';
            card.dataset.templateId = template.id;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            card.innerHTML =
                '<div class="pg-slot-top">' +
                '<span class="pg-slot-badge">' + template.number + '</span>' +
                '</div>' +
                '<div class="pg-slot-title">' + escapeHtml(template.title) + '</div>';

            grid.appendChild(card);
        });
    }

    function bindGridEvents() {
        var grid = document.getElementById('gameTemplatesGrid');
        if (!grid || grid.dataset.bound) return;
        grid.dataset.bound = '1';

        grid.addEventListener('click', async function (e) {
            var card = e.target.closest('.pg-template-slot');
            if (!card) return;
            var id = card.dataset.templateId;
            var template = TEMPLATES.find(function (t) { return t.id === id; });
            if (!template) return;
            await applyTemplate(template);
            closeModal();
        });

        grid.addEventListener('keydown', async function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var card = e.target.closest('.pg-template-slot');
            if (!card) return;
            e.preventDefault();
            var id = card.dataset.templateId;
            var template = TEMPLATES.find(function (t) { return t.id === id; });
            if (!template) return;
            await applyTemplate(template);
            closeModal();
        });
    }

    function openModal() {
        var modal = document.getElementById('gameTemplatesModal');
        if (!modal) return;
        bindGridEvents();
        renderGrid();
        modal.style.display = 'flex';
        if (typeof PZTooltip !== 'undefined') PZTooltip.scan(modal);
    }

    function closeModal() {
        var modal = document.getElementById('gameTemplatesModal');
        if (modal) modal.style.display = 'none';
    }

    global.PGZGameTemplates = {
        TEMPLATES: TEMPLATES,
        openModal: openModal,
        closeModal: closeModal,
        applyTemplate: applyTemplate,
        loadTemplateAssets: loadTemplateAssets,
        _test: {
            escapeHtml: escapeHtml,
            TEMPLATES: TEMPLATES
        }
    };
})(window);
