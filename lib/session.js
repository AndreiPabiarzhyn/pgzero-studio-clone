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
        return document.getElementById('sessionSaveStatus');
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            dirty = false;
            setStatus('saved');
            return true;
        } catch (e) {
            console.warn('PGZSession: save failed', e);
            setStatus('error');
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
        setStatus('saving');
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            saveTimer = null;
            save();
        }, DEBOUNCE_MS);
    }

    function setStatus(state) {
        var el = getStatusEl();
        if (!el) return;
        el.classList.remove('is-saving', 'is-saved', 'is-error');
        if (state === 'saving') {
            el.textContent = 'Сохранение…';
            el.classList.add('is-saving');
            el.title = 'Автосохранение в браузере';
        } else if (state === 'saved') {
            el.textContent = 'Сохранено ✓';
            el.classList.add('is-saved');
            el.title = 'Проект сохранён в браузере. Файл .pgz — для переноса на другой компьютер.';
        } else if (state === 'error') {
            el.textContent = 'Ошибка сохранения';
            el.classList.add('is-error');
        } else {
            el.textContent = '';
        }
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
        var nameInput = getProjectNameInput();
        if (nameInput && data.projectName) {
            nameInput.value = data.projectName;
        }
        setStatus('saved');
    }

    function promptResumeIfNeeded() {
        if (!hasSession()) {
            return Promise.resolve(false);
        }
        var data = read();
        if (!data) return Promise.resolve(false);

        var modal = document.getElementById('sessionResumeModal');
        var textEl = document.getElementById('sessionResumeText');
        var btnContinue = document.getElementById('sessionResumeContinue');
        var btnNew = document.getElementById('sessionResumeNew');
        if (!modal || !textEl || !btnContinue || !btnNew) {
            apply(data);
            return Promise.resolve(true);
        }

        var name = data.projectName || 'Без названия';
        var when = formatSavedAt(data.savedAt);
        textEl.textContent = '«' + name + '» — сохранено ' + when + '. Продолжить или начать новую игру?';

        document.getElementById('page-loader')?.remove();
        modal.style.display = 'flex';

        return new Promise(function (resolve) {
            function cleanup() {
                modal.style.display = 'none';
                btnContinue.onclick = null;
                btnNew.onclick = null;
            }

            btnContinue.onclick = function () {
                cleanup();
                apply(data);
                resolve(true);
            };

            btnNew.onclick = async function () {
                cleanup();
                clear();
                if (typeof clearProjectResources === 'function') {
                    await clearProjectResources();
                }
                resolve(false);
            };
        });
    }

    function init() {
        var nameInput = getProjectNameInput();
        if (nameInput) {
            nameInput.addEventListener('input', scheduleSave);
            nameInput.addEventListener('change', scheduleSave);
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
        promptResumeIfNeeded: promptResumeIfNeeded,
        init: init,
        formatSavedAt: formatSavedAt
    };
})(window);
