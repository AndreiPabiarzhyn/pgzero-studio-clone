/**
 * Галерея проектов — до 6 слотов в IndexedDB (код + ресурсы).
 */
(function (global) {
    'use strict';

    var MAX_SLOTS = 6;
    var DB_NAME = 'pgz_project_gallery_v1';
    var STORE = 'slots';
    var dbPromise = null;

    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = function (e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE);
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
        return dbPromise;
    }

    function idbRequest(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function slotKey(index) {
        return String(index);
    }

    async function getSlot(index) {
        var db = await openDb();
        var tx = db.transaction(STORE, 'readonly');
        return idbRequest(tx.objectStore(STORE).get(slotKey(index)));
    }

    async function setSlot(index, data) {
        var db = await openDb();
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(data, slotKey(index));
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    }

    async function deleteSlot(index) {
        var db = await openDb();
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(slotKey(index));
        return new Promise(function (resolve, reject) {
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { reject(tx.error); };
        });
    }

    async function listSlots() {
        var slots = [];
        for (var i = 0; i < MAX_SLOTS; i++) {
            slots.push(await getSlot(i));
        }
        return slots;
    }

    function formatSavedAt(ts) {
        if (typeof PGZSession !== 'undefined' && PGZSession.formatSavedAt) {
            return PGZSession.formatSavedAt(ts);
        }
        if (!ts) return '';
        return new Date(ts).toLocaleString('ru-RU');
    }

    async function readFolderAssets(folder) {
        if (typeof initFS !== 'function') return [];
        await initFS();
        if (!global.fs) return [];
        var list = [];
        var names = await fs.ls('/' + folder, 'files');
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var dataUrl = await fs.read('/' + folder + '/' + name);
            list.push({ name: name, dataUrl: dataUrl });
        }
        return list;
    }

    async function captureCurrent() {
        if (typeof PGZSession !== 'undefined') PGZSession.flush();
        if (typeof PythonIDE === 'undefined' || !PythonIDE.files) return null;

        var images = await readFolderAssets('images');
        var sounds = await readFolderAssets('sounds');
        var music = await readFolderAssets('music');
        var nameInput = document.getElementById('projectNameInput');

        return {
            version: 1,
            savedAt: Date.now(),
            projectName: nameInput ? nameInput.value.trim() : '',
            currentFile: PythonIDE.currentFile || 'my_pgz.py',
            files: JSON.parse(JSON.stringify(PythonIDE.files)),
            assets: { images: images, sounds: sounds, music: music },
            thumb: images.length ? images[0].dataUrl : null
        };
    }

    async function writeAssets(folder, items) {
        if (!items || !items.length) return;
        await initFS();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            await fs.write('/' + folder + '/' + item.name, item.dataUrl);
        }
    }

    async function applyProject(data) {
        if (!data || !data.files) return false;

        if (typeof clearProjectResources === 'function') {
            await clearProjectResources();
        }
        if (typeof clearAllSelections === 'function') clearAllSelections();

        var assets = data.assets || {};
        await writeAssets('images', assets.images || []);
        await writeAssets('sounds', assets.sounds || []);
        await writeAssets('music', assets.music || []);

        PythonIDE.files = data.files;
        PythonIDE.currentFile = data.currentFile || 'my_pgz.py';
        if (!PythonIDE.files[PythonIDE.currentFile]) {
            PythonIDE.currentFile = Object.keys(PythonIDE.files)[0] || 'my_pgz.py';
        }
        if (PythonIDE.editor && typeof PythonIDE.editor.setValue === 'function') {
            PythonIDE.disableChangeEvent = true;
            PythonIDE.editor.setValue(PythonIDE.files[PythonIDE.currentFile] || '');
            PythonIDE.disableChangeEvent = false;
        }
        if (typeof PythonIDE.updateFileTabs === 'function') {
            PythonIDE.updateFileTabs();
        }

        var nameInput = document.getElementById('projectNameInput');
        if (nameInput) {
            nameInput.value = data.projectName || '';
        }

        if (typeof refreshGallery === 'function') await refreshGallery();
        if (typeof PGZCodeHistory !== 'undefined') PGZCodeHistory.clear();
        if (typeof PGZSession !== 'undefined') PGZSession.save();
        return true;
    }

    function closeModal() {
        var modal = document.getElementById('projectGalleryModal');
        if (modal) modal.style.display = 'none';
    }

    async function saveToSlot(index, options) {
        options = options || {};
        var existing = await getSlot(index);
        if (existing && !options.skipOverwriteConfirm) {
            var name = existing.projectName || 'Без названия';
            var ok = await askConfirm(
                'Перезаписать слот ' + (index + 1),
                'Слот «' + name + '» будет заменён текущим проектом. Продолжить?'
            );
            if (!ok) return false;
        }

        var payload = await captureCurrent();
        if (!payload) {
            await message('Ошибка', 'Не удалось собрать данные проекта.');
            return false;
        }

        try {
            await setSlot(index, payload);
            return true;
        } catch (e) {
            console.error('PGZProjectGallery: save failed', e);
            await message('Ошибка', 'Не удалось сохранить проект. Возможно, не хватает места в браузере — экспортируйте .pgz и удалите лишние слоты.');
            return false;
        }
    }

    async function loadFromSlot(index) {
        var data = await getSlot(index);
        if (!data) return false;

        var ok = await askConfirm(
            'Открыть проект',
            'Загрузить «' + (data.projectName || 'Без названия') + '» из слота ' + (index + 1) + '?\n\nТекущий проект будет заменён.'
        );
        if (!ok) return false;

        await applyProject(data);
        return true;
    }

    async function selectSlot(index) {
        closeModal();
        await new Promise(function (resolve) { setTimeout(resolve, 0); });

        var data = await getSlot(index);
        if (data) {
            await loadFromSlot(index);
            return;
        }

        var ok = await askConfirm(
            'Сохранить проект',
            'Сохранить текущий проект в слот ' + (index + 1) + '?'
        );
        if (ok) {
            await saveToSlot(index, { skipOverwriteConfirm: true });
        }
    }

    async function overwriteSlot(index) {
        closeModal();
        await new Promise(function (resolve) { setTimeout(resolve, 0); });
        await saveToSlot(index);
    }

    async function removeFromSlot(index) {
        closeModal();
        await new Promise(function (resolve) { setTimeout(resolve, 0); });

        var data = await getSlot(index);
        if (!data) return false;

        var ok = await askConfirm(
            'Удалить из слота ' + (index + 1),
            'Проект «' + (data.projectName || 'Без названия') + '» будет удалён из галереи. Продолжить?'
        );
        if (!ok) return false;

        await deleteSlot(index);
        return true;
    }

    function assetSummary(data) {
        if (!data || !data.assets) return '';
        var a = data.assets;
        var parts = [];
        if (a.images && a.images.length) parts.push(a.images.length + ' карт.');
        if (a.sounds && a.sounds.length) parts.push(a.sounds.length + ' зв.');
        if (a.music && a.music.length) parts.push(a.music.length + ' муз.');
        return parts.join(' · ');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    async function renderGrid() {
        var grid = document.getElementById('projectGalleryGrid');
        if (!grid) return;

        var slots = await listSlots();
        grid.innerHTML = '';

        for (var i = 0; i < MAX_SLOTS; i++) {
            var data = slots[i];
            var card = document.createElement('div');
            card.className = 'pg-slot' + (data ? '' : ' pg-slot--empty');
            card.dataset.slot = String(i);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            if (data) {
                var thumbHtml = data.thumb
                    ? '<img class="pg-slot-thumb" src="' + data.thumb + '" alt="">'
                    : '<div class="pg-slot-thumb pg-slot-thumb--empty">' + (typeof PZIcons !== 'undefined' ? PZIcons.svg('code', 28) : '🎮') + '</div>';

                var meta = formatSavedAt(data.savedAt);
                var assets = assetSummary(data);
                if (assets) meta += ' · ' + assets;

                card.innerHTML =
                    '<div class="pg-slot-top">' +
                    '<span class="pg-slot-badge">' + (i + 1) + '</span>' +
                    '<div class="pg-slot-tools">' +
                    '<button type="button" class="pg-slot-icon-btn" data-action="overwrite" title="Перезаписать">↻</button>' +
                    '<button type="button" class="pg-slot-icon-btn pg-slot-icon-btn--delete" data-action="delete" title="Удалить">×</button>' +
                    '</div></div>' +
                    thumbHtml +
                    '<div class="pg-slot-info">' +
                    '<strong class="pg-slot-name">' + escapeHtml(data.projectName || 'Без названия') + '</strong>' +
                    (meta ? '<span class="pg-slot-meta">' + escapeHtml(meta) + '</span>' : '') +
                    '</div>';
            } else {
                card.innerHTML =
                    '<div class="pg-slot-top"><span class="pg-slot-badge">' + (i + 1) + '</span></div>' +
                    '<div class="pg-slot-empty-body">' +
                    (typeof PZIcons !== 'undefined' ? PZIcons.svg('plus', 28) : '+') +
                    '</div>';
            }

            grid.appendChild(card);
        }
    }

    function bindGridEvents() {
        var grid = document.getElementById('projectGalleryGrid');
        if (!grid || grid.dataset.bound) return;
        grid.dataset.bound = '1';

        grid.addEventListener('click', async function (e) {
            var actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.preventDefault();
                e.stopPropagation();
                var card = actionBtn.closest('.pg-slot');
                if (!card) return;
                var index = parseInt(card.dataset.slot, 10);
                if (actionBtn.dataset.action === 'delete') {
                    await removeFromSlot(index);
                } else if (actionBtn.dataset.action === 'overwrite') {
                    await overwriteSlot(index);
                }
                return;
            }

            var card = e.target.closest('.pg-slot');
            if (!card) return;
            var index = parseInt(card.dataset.slot, 10);
            await selectSlot(index);
        });

        grid.addEventListener('keydown', async function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var card = e.target.closest('.pg-slot');
            if (!card || e.target.closest('[data-action]')) return;
            e.preventDefault();
            var index = parseInt(card.dataset.slot, 10);
            await selectSlot(index);
        });
    }

    function openModal() {
        var modal = document.getElementById('projectGalleryModal');
        if (!modal) return;
        bindGridEvents();
        renderGrid().then(function () {
            modal.style.display = 'flex';
        });
    }

    global.PGZProjectGallery = {
        MAX_SLOTS: MAX_SLOTS,
        openModal: openModal,
        closeModal: closeModal,
        saveToSlot: saveToSlot,
        loadFromSlot: loadFromSlot,
        selectSlot: selectSlot,
        listSlots: listSlots,
        _test: {
            assetSummary: assetSummary,
            escapeHtml: escapeHtml,
            slotKey: slotKey
        }
    };
})(window);
