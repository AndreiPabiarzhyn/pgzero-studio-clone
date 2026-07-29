/**
 * История версий кода — до 5 последних снимков (автосохранение и запуск).
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'pgz_code_history';
    var MAX_ENTRIES = 5;

    function L(key, params, fallback) {
        if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
            return PGZI18n.uiText(key, params, fallback);
        }
        return fallback != null ? fallback : key;
    }

    function readRaw() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn('PGZCodeHistory: read failed', e);
            return [];
        }
    }

    function writeRaw(list) {
        try {
            var json = JSON.stringify(list);
            if (typeof PGZStorageGuard !== 'undefined') {
                PGZStorageGuard.safeLocalStorageSet(STORAGE_KEY, json);
            } else {
                localStorage.setItem(STORAGE_KEY, json);
            }
        } catch (e) {
            console.warn('PGZCodeHistory: write failed', e);
        }
    }

    function fingerprint(files) {
        try {
            return JSON.stringify(files);
        } catch (e) {
            return '';
        }
    }

    function getProjectName() {
        var inp = document.getElementById('projectNameInput');
        return inp ? inp.value.trim() : '';
    }

    function formatDate(ts) {
        if (!ts) return '';
        var diff = Date.now() - ts;
        if (diff < 60000) return L('session.justNow', null, 'только что');
        if (diff < 3600000) {
            var mins = Math.floor(diff / 60000);
            return L('session.minsAgo', { n: mins }, mins + ' мин. назад');
        }
        var locale = (typeof PGZI18n !== 'undefined' && PGZI18n.getLocaleTag)
            ? PGZI18n.getLocaleTag()
            : 'ru-RU';
        return new Date(ts).toLocaleString(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function sourceLabel(source) {
        if (source === 'run') return L('codeHistory.sourceRun', null, 'запуск игры');
        if (source === 'auto') return L('codeHistory.sourceAuto', null, 'автосохранение');
        return L('codeHistory.sourceSave', null, 'сохранение');
    }

    function migrateFromVault() {
        if (readRaw().length > 0) return;
        try {
            if (!localStorage.vault) return;
            var vault = JSON.parse(localStorage.vault);
            if (!Array.isArray(vault) || !vault.length) return;
            var migrated = vault.slice(-MAX_ENTRIES).map(function (snap) {
                return {
                    savedAt: snap.date || Date.now(),
                    projectName: '',
                    currentFile: 'my_pgz.py',
                    files: JSON.parse(snap.files),
                    source: 'run',
                    fp: snap.files
                };
            });
            writeRaw(migrated);
        } catch (e) {
            console.warn('PGZCodeHistory: vault migrate failed', e);
        }
    }

    function push(files, projectName, currentFile, source) {
        if (!files || !Object.keys(files).length) return;
        var fp = fingerprint(files);
        if (!fp) return;

        var list = readRaw();
        if (list.length > 0 && list[0].fp === fp) {
            list[0].savedAt = Date.now();
            list[0].source = source || list[0].source;
            if (projectName) list[0].projectName = projectName;
            writeRaw(list);
            return;
        }

        list.unshift({
            savedAt: Date.now(),
            projectName: projectName || '',
            currentFile: currentFile || 'my_pgz.py',
            files: files,
            source: source || 'auto',
            fp: fp
        });

        if (list.length > MAX_ENTRIES) {
            list = list.slice(0, MAX_ENTRIES);
        }
        writeRaw(list);
    }

    function pushFromIDE(source) {
        if (typeof PythonIDE === 'undefined' || !PythonIDE.files) return;
        push(
            PythonIDE.files,
            getProjectName(),
            PythonIDE.currentFile || 'my_pgz.py',
            source || 'auto'
        );
    }

    function list() {
        return readRaw();
    }

    function clear() {
        writeRaw([]);
    }

    function applyEntry(entry) {
        if (!entry || !entry.files || typeof PythonIDE === 'undefined') return false;
        PythonIDE.files = entry.files;
        PythonIDE.currentFile = entry.currentFile || 'my_pgz.py';
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
        if (nameInput && entry.projectName) {
            nameInput.value = entry.projectName;
        }
        if (typeof PGZSession !== 'undefined') {
            PGZSession.save();
        }
        return true;
    }

    function restore(index) {
        var entries = readRaw();
        if (index < 0 || index >= entries.length) return false;
        return applyEntry(entries[index]);
    }

    function renderList() {
        var container = document.getElementById('codeHistoryList');
        if (!container) return;
        var entries = readRaw();
        container.innerHTML = '';

        if (!entries.length) {
            container.innerHTML = '<p class="code-history-empty">' + L('codeHistory.empty', null, 'История пуста. Версии появятся после правок кода или запуска игры.') + '</p>';
            return;
        }

        entries.forEach(function (entry, index) {
            var item = document.createElement('div');
            item.className = 'code-history-item';

            var meta = document.createElement('div');
            meta.className = 'code-history-meta';

            var title = document.createElement('strong');
            title.textContent = entry.projectName || L('common.untitled', null, 'Без названия');

            var sub = document.createElement('span');
            sub.textContent = formatDate(entry.savedAt) + ' · ' + sourceLabel(entry.source);

            meta.appendChild(title);
            meta.appendChild(sub);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'code-history-restore';
            btn.textContent = L('codeHistory.restore', null, 'Восстановить');
            btn.addEventListener('click', function () {
                if (restore(index)) {
                    closeModal();
                    if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                        PythonIDE.showHint(L('codeHistory.restored', null, 'Код восстановлен из истории'));
                    }
                }
            });

            item.appendChild(meta);
            item.appendChild(btn);
            container.appendChild(item);
        });
    }

    function openModal() {
        migrateFromVault();
        renderList();
        var modal = document.getElementById('codeHistoryModal');
        if (modal) modal.style.display = 'flex';
        if (typeof closeMoreMenu === 'function') closeMoreMenu();
    }

    function closeModal() {
        var modal = document.getElementById('codeHistoryModal');
        if (modal) modal.style.display = 'none';
    }

    function init() {
        migrateFromVault();
        var btnClear = document.getElementById('codeHistoryClear');
        if (btnClear) {
            btnClear.addEventListener('click', function () {
                if (confirm(L('codeHistory.clearConfirm', null, 'Удалить всю историю версий кода?'))) {
                    clear();
                    renderList();
                }
            });
        }
        if (typeof global.addEventListener === 'function') {
            global.addEventListener('pgz:langchange', function () {
                var modal = document.getElementById('codeHistoryModal');
                if (modal && modal.style.display === 'flex') renderList();
            });
        }
    }

    global.PGZCodeHistory = {
        list: list,
        push: push,
        pushFromIDE: pushFromIDE,
        restore: restore,
        clear: clear,
        openModal: openModal,
        closeModal: closeModal,
        init: init,
        formatDate: formatDate
    };
})(window);
