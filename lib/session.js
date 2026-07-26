/**
 * Автосохранение текущего проекта в localStorage (сессия браузера).
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'pgz_session';
    var VERSION = 1;
    var DEBOUNCE_MS = 2000;
    var saveTimer = null;
    var dirty = false;

    function getProjectNameInput() {
        return document.getElementById('projectNameInput');
    }

    function getStatusEl() {
        return document.getElementById('footerProjectStatus');
    }

    function refreshFooterStatus(state) {
        var el = getStatusEl();
        if (!el) return;

        if (state === undefined || state === null) {
            if (el.classList.contains('is-saving')) state = 'saving';
            else if (el.classList.contains('is-saved')) state = 'saved';
            else if (el.classList.contains('is-error')) state = 'error';
            else state = '';
        }

        el.classList.remove('is-saving', 'is-saved', 'is-error');

        var parts = [];
        if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.getActiveSlot() !== null) {
            var slotIndex = PGZProjectGallery.getActiveSlot();
            var slotLabel = typeof PGZProjectGallery.cellLabel === 'function'
                ? PGZProjectGallery.cellLabel(slotIndex)
                : ('Ячейка ' + (slotIndex + 1));
            parts.push(slotLabel);
        }

        var nameInput = getProjectNameInput();
        var name = nameInput ? nameInput.value.trim() : '';
        if (name) parts.push(name);

        if (state === 'saving') {
            parts.push('Сохранение…');
            el.classList.add('is-saving');
        } else if (state === 'saved') {
            parts.push('Сохранено ✓');
            el.classList.add('is-saved');
        } else if (state === 'error') {
            parts.push('Ошибка сохранения');
            el.classList.add('is-error');
        }

        el.textContent = parts.join(' · ');
        el.title = state === 'saved'
            ? 'Игра сохранена в браузере. Файл .pgz — для переноса на другой компьютер.'
            : '';
    }

    function setStatus(state) {
        refreshFooterStatus(state);
    }

    function read() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || typeof data !== 'object' || !data.files) return null;
            return data;
        } catch (e) {
            console.warn('PGZSession: read failed', e);
            return null;
        }
    }

    function hasSession() {
        return read() !== null;
    }

    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('PGZSession: clear failed', e);
        }
        dirty = false;
        setStatus('');
    }

    function collectPayload() {
        if (typeof PythonIDE === 'undefined' || !PythonIDE.files) return null;
        var files = PythonIDE.files;
        if (!files || !Object.keys(files).length) return null;
        var nameInput = getProjectNameInput();
        return {
            version: VERSION,
            savedAt: Date.now(),
            projectName: nameInput ? nameInput.value.trim() : '',
            currentFile: PythonIDE.currentFile || 'my_pgz.py',
            files: files
        };
    }

    function save() {
        var payload = collectPayload();
        if (!payload) return false;
        try {
            if (typeof PGZProjectGallery !== 'undefined' &&
                PGZProjectGallery.getActiveSlot() !== null &&
                typeof PGZProjectGallery.saveActiveSlotQuiet === 'function') {
                PGZProjectGallery.saveActiveSlotQuiet();
            } else if (typeof PGZStorageGuard !== 'undefined') {
                PGZStorageGuard.safeLocalStorageSet(STORAGE_KEY, JSON.stringify(payload));
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            }
            dirty = false;
            setStatus('saved');
            if (typeof PGZCodeHistory !== 'undefined') {
                PGZCodeHistory.pushFromIDE('auto');
            }
            return true;
        } catch (e) {
            console.warn('PGZSession: save failed', e);
            setStatus('error');
            if (typeof message === 'function' && e && e.message) {
                message('Сохранение', e.message);
            }
            return false;
        }
    }

    function flush() {
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        if (dirty) save();
    }

    function scheduleSave() {
        dirty = true;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            saveTimer = null;
            save();
        }, DEBOUNCE_MS);
    }

    function formatSavedAt(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        var diff = Date.now() - ts;
        if (diff < 60000) return 'только что';
        if (diff < 3600000) {
            var mins = Math.floor(diff / 60000);
            return mins + ' мин. назад';
        }
        return d.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function apply(data) {
        if (!data || !data.files || typeof PythonIDE === 'undefined') return;
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
        if (typeof PythonIDE !== 'undefined' && PythonIDE.refreshEditorView) {
            PythonIDE.refreshEditorView();
        }
        var nameInput = getProjectNameInput();
        if (nameInput && data.projectName) {
            nameInput.value = data.projectName;
        }
        setStatus('saved');
    }

    function promptResumeIfNeeded() {
        return Promise.resolve(false);
    }

    function init() {
        var nameInput = getProjectNameInput();
        if (nameInput) {
            nameInput.addEventListener('input', scheduleSave);
            nameInput.addEventListener('change', scheduleSave);
            nameInput.addEventListener('input', function () {
                if (typeof PGZProjectGallery !== 'undefined') {
                    PGZProjectGallery.updateSlotIndicator();
                } else {
                    refreshFooterStatus();
                }
            });
        }
        global.addEventListener('beforeunload', flush);
        global.addEventListener('pagehide', flush);
    }

    global.PGZSession = {
        read: read,
        hasSession: hasSession,
        save: save,
        flush: flush,
        scheduleSave: scheduleSave,
        clear: clear,
        apply: apply,
        setStatus: setStatus,
        refreshFooterStatus: refreshFooterStatus,
        promptResumeIfNeeded: promptResumeIfNeeded,
        init: init,
        formatSavedAt: formatSavedAt
    };
})(window);
