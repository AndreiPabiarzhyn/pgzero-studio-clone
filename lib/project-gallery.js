/**
 * Галерея проектов — 6 слотов, стартовый экран, автосохранение в активный слот.
 */
(function (global) {
    'use strict';

    var MAX_SLOTS = 6;
    var DB_NAME = 'pgz_project_gallery_v1';
    var STORE = 'slots';
    var ACTIVE_SLOT_KEY = 'pgz_active_slot';
    var MIGRATED_KEY = 'pgz_session_migrated';

    var dbPromise = null;
    var uiMode = 'normal'; // normal | startup | switch
    var startupResolve = null;

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

    function getActiveSlot() {
        var raw = localStorage.getItem(ACTIVE_SLOT_KEY);
        if (raw === null || raw === '') return null;
        var n = parseInt(raw, 10);
        return n >= 0 && n < MAX_SLOTS ? n : null;
    }

    function setActiveSlot(index) {
        if (index === null || index === undefined) {
            localStorage.removeItem(ACTIVE_SLOT_KEY);
        } else {
            localStorage.setItem(ACTIVE_SLOT_KEY, String(index));
        }
        updateSlotIndicator();
    }

    function updateSlotIndicator() {
        if (typeof PGZSession !== 'undefined' && typeof PGZSession.refreshFooterStatus === 'function') {
            PGZSession.refreshFooterStatus();
        }
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
        updateSlotIndicator();
        return true;
    }

    async function createNewInSlot(index) {
        if (typeof clearProjectResources === 'function') {
            await clearProjectResources();
        }
        if (typeof clearAllSelections === 'function') clearAllSelections();
        if (typeof PGZCodeHistory !== 'undefined') PGZCodeHistory.clear();

        var code = typeof PGZ_STARTER_CODE !== 'undefined'
            ? PGZ_STARTER_CODE
            : "import pgzrun\n\nTITLE = 'Pygame Zero'\nWIDTH = 800\nHEIGHT = 600\n\npgzrun.go()\n";
        var name = typeof generateProjectName === 'function' ? generateProjectName() : 'my_game';

        PythonIDE.files = { 'my_pgz.py': code };
        PythonIDE.currentFile = 'my_pgz.py';
        if (PythonIDE.editor && typeof PythonIDE.editor.setValue === 'function') {
            PythonIDE.disableChangeEvent = true;
            PythonIDE.editor.setValue(code);
            PythonIDE.disableChangeEvent = false;
        }
        if (typeof PythonIDE.updateFileTabs === 'function') {
            PythonIDE.updateFileTabs();
        }

        var nameInput = document.getElementById('projectNameInput');
        if (nameInput) nameInput.value = name;

        var payload = await captureCurrent();
        if (!payload) return false;

        await setSlot(index, payload);
        setActiveSlot(index);

        if (typeof refreshGallery === 'function') await refreshGallery();
        if (typeof PGZSession !== 'undefined') {
            PGZSession.clear();
            PGZSession.setStatus('saved');
        }
        return true;
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
            updateSlotIndicator();
            return true;
        } catch (e) {
            console.error('PGZProjectGallery: save failed', e);
            await message('Ошибка', 'Не удалось сохранить проект. Возможно, не хватает места в браузере.');
            return false;
        }
    }

    async function saveActiveSlotQuiet() {
        var idx = getActiveSlot();
        if (idx === null) return false;
        return saveToSlot(idx, { skipOverwriteConfirm: true });
    }

    async function saveActiveSlotNow() {
        if (typeof PGZSession !== 'undefined') PGZSession.flush();
        var idx = getActiveSlot();
        if (idx === null) {
            await message('Сохранение', 'Сначала выберите слот: нажмите «Сменить игру».');
            return false;
        }

        var ok = await saveActiveSlotQuiet();
        if (ok) {
            if (typeof PGZSession !== 'undefined') PGZSession.setStatus('saved');
            if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                PythonIDE.showHint('Игра сохранена в слот ' + (idx + 1));
            }
        }
        return ok;
    }

    async function flushAndSaveActive() {
        if (typeof PGZSession !== 'undefined') PGZSession.flush();
        return saveActiveSlotQuiet();
    }

    async function migrateLegacySession() {
        try {
            if (localStorage.getItem(MIGRATED_KEY)) return;
            if (typeof PGZSession === 'undefined' || !PGZSession.hasSession()) return;
            var slot0 = await getSlot(0);
            if (slot0) {
                localStorage.setItem(MIGRATED_KEY, '1');
                return;
            }
            var session = PGZSession.read();
            if (!session || !session.files) return;

            await setSlot(0, {
                version: 1,
                savedAt: session.savedAt || Date.now(),
                projectName: session.projectName || (typeof generateProjectName === 'function' ? generateProjectName() : 'Моя игра'),
                currentFile: session.currentFile || 'my_pgz.py',
                files: session.files,
                assets: { images: [], sounds: [], music: [] },
                thumb: null
            });
            PGZSession.clear();
            localStorage.setItem(MIGRATED_KEY, '1');
        } catch (e) {
            console.warn('PGZProjectGallery: migrate failed', e);
        }
    }

    function setModalUiMode(mode) {
        uiMode = mode;
        var modal = document.getElementById('projectGalleryModal');
        var title = document.getElementById('projectGalleryTitle');
        if (!modal) return;

        modal.classList.toggle('project-gallery--startup', mode === 'startup');
        modal.classList.toggle('project-gallery--switch', mode === 'switch');

        if (title) {
            title.textContent = mode === 'startup' ? 'Выбери игру' : 'Сменить игру';
        }

        modal.querySelectorAll('.project-gallery-close').forEach(function (btn) {
            btn.style.display = mode === 'startup' ? 'none' : '';
        });
    }

    function closeModal() {
        var modal = document.getElementById('projectGalleryModal');
        if (modal) modal.style.display = 'none';
        setModalUiMode('normal');
    }

    function finishStartup() {
        closeModal();
        if (startupResolve) {
            startupResolve(true);
            startupResolve = null;
        }
    }

    async function handleSlotPick(index) {
        var data = await getSlot(index);
        var active = getActiveSlot();

        if (uiMode === 'startup') {
            if (data) {
                await applyProject(data);
                setActiveSlot(index);
            } else {
                await createNewInSlot(index);
            }
            if (typeof PGZSession !== 'undefined') PGZSession.setStatus('saved');
            finishStartup();
            return;
        }

        if (index === active) {
            closeModal();
            return;
        }

        closeModal();
        await new Promise(function (r) { setTimeout(r, 0); });

        if (data) {
            var name = data.projectName || 'Без названия';
            var ok = await askConfirm(
                'Открыть игру',
                'Открыть «' + name + '»?\n\nТекущая игра сохранится в слот ' + ((active !== null ? active : index) + 1) + '.'
            );
            if (!ok) return;
            if (active !== null) await flushAndSaveActive();
            await applyProject(data);
            setActiveSlot(index);
            if (typeof PGZSession !== 'undefined') PGZSession.setStatus('saved');
            return;
        }

        var okNew = await askConfirm(
            'Новая игра',
            'Начать новую игру в слоте ' + (index + 1) + '?\n\nТекущая игра сохранится перед выходом.'
        );
        if (!okNew) return;
        if (active !== null) await flushAndSaveActive();
        await createNewInSlot(index);
        if (typeof PGZSession !== 'undefined') PGZSession.setStatus('saved');
    }

    async function removeFromSlot(index) {
        if (uiMode === 'startup') {
            var data = await getSlot(index);
            if (!data) return false;
            var ok = await askConfirm(
                'Удалить игру',
                'Удалить «' + (data.projectName || 'Без названия') + '» из слота ' + (index + 1) + '?'
            );
            if (!ok) return false;
            await deleteSlot(index);
            await renderGrid();
            return true;
        }

        closeModal();
        await new Promise(function (r) { setTimeout(r, 0); });

        var dataSw = await getSlot(index);
        if (!dataSw) return false;

        var okDel = await askConfirm(
            'Удалить игру',
            'Удалить «' + (dataSw.projectName || 'Без названия') + '» из слота ' + (index + 1) + '?'
        );
        if (!okDel) return false;

        if (getActiveSlot() === index) {
            setActiveSlot(null);
        }
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
        var active = getActiveSlot();
        grid.innerHTML = '';

        for (var i = 0; i < MAX_SLOTS; i++) {
            var data = slots[i];
            var card = document.createElement('div');
            var isActive = active === i && uiMode !== 'startup';
            card.className = 'pg-slot' + (data ? '' : ' pg-slot--empty') + (isActive ? ' pg-slot--active' : '');
            card.dataset.slot = String(i);
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            if (data) {
                var title = escapeHtml(data.projectName || 'Без названия');
                var meta = formatSavedAt(data.savedAt);
                var assets = assetSummary(data);
                if (assets) meta += ' · ' + assets;

                card.innerHTML =
                    '<div class="pg-slot-top">' +
                    '<span class="pg-slot-badge">' + (i + 1) + '</span>' +
                    (uiMode !== 'startup'
                        ? '<button type="button" class="pg-slot-icon-btn pg-slot-icon-btn--delete" data-action="delete" title="Удалить">×</button>'
                        : '') +
                    '</div>' +
                    '<div class="pg-slot-title">' + title + '</div>' +
                    (meta ? '<span class="pg-slot-meta">' + escapeHtml(meta) + '</span>' : '');
            } else {
                card.innerHTML =
                    '<div class="pg-slot-top"><span class="pg-slot-badge">' + (i + 1) + '</span></div>' +
                    '<div class="pg-slot-title pg-slot-title--empty">Новая игра</div>';
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
                }
                return;
            }

            var card = e.target.closest('.pg-slot');
            if (!card) return;
            await handleSlotPick(parseInt(card.dataset.slot, 10));
        });

        grid.addEventListener('keydown', async function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var card = e.target.closest('.pg-slot');
            if (!card || e.target.closest('[data-action]')) return;
            e.preventDefault();
            await handleSlotPick(parseInt(card.dataset.slot, 10));
        });
    }

    function showModal(mode) {
        var modal = document.getElementById('projectGalleryModal');
        if (!modal) return Promise.resolve(false);
        setModalUiMode(mode);
        bindGridEvents();
        return renderGrid().then(function () {
            modal.style.display = 'flex';
            if (typeof PZTooltip !== 'undefined') PZTooltip.scan(modal);
            return true;
        });
    }

    function promptStartup() {
        return new Promise(function (resolve) {
            startupResolve = resolve;
            showModal('startup');
        });
    }

    function openModal() {
        showModal('switch');
    }

    function openSwitchModal() {
        if (typeof PGZSession !== 'undefined') PGZSession.flush();
        saveActiveSlotQuiet().then(function () {
            showModal('switch');
        });
    }

    function isStartupOpen() {
        var modal = document.getElementById('projectGalleryModal');
        return modal && modal.style.display === 'flex' && uiMode === 'startup';
    }

    global.PGZProjectGallery = {
        MAX_SLOTS: MAX_SLOTS,
        getActiveSlot: getActiveSlot,
        setActiveSlot: setActiveSlot,
        updateSlotIndicator: updateSlotIndicator,
        migrateLegacySession: migrateLegacySession,
        promptStartup: promptStartup,
        openModal: openModal,
        openSwitchModal: openSwitchModal,
        closeModal: closeModal,
        saveToSlot: saveToSlot,
        saveActiveSlotQuiet: saveActiveSlotQuiet,
        saveActiveSlotNow: saveActiveSlotNow,
        listSlots: listSlots,
        isStartupOpen: isStartupOpen,
        _test: {
            assetSummary: assetSummary,
            escapeHtml: escapeHtml,
            slotKey: slotKey
        }
    };
})(window);
