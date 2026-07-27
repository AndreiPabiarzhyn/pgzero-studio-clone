/** Страница play.html — полноэкранный запуск опубликованной игры */
(function (global) {
    'use strict';

    var projectTitle = 'Игра';
    var projectLoaded = false;

    function $(id) {
        return global.document.getElementById(id);
    }

    function showState(name) {
        var loading = $('playLoading');
        var intro = $('playIntro');
        var gameArea = $('playGameArea');
        var error = $('playError');
        if (loading) loading.hidden = name !== 'loading';
        if (intro) intro.hidden = name !== 'intro';
        if (gameArea) gameArea.hidden = name !== 'game';
        if (error) error.hidden = name !== 'error';
    }

    function setHeaderTitle(title) {
        projectTitle = title || 'Игра';
        var els = global.document.querySelectorAll('[data-play-title]');
        els.forEach(function (el) {
            el.textContent = projectTitle;
        });
    }

    function showPlayError(text) {
        var msg = $('playErrorMessage');
        if (msg) msg.textContent = text;
        showState('error');
    }

    async function clearPlayResources() {
        if (typeof initFS === 'function') await initFS();
        if (typeof clearFolder === 'function') {
            await clearFolder('/images');
            await clearFolder('/sounds');
            await clearFolder('/music');
        }
        if (typeof clearImageCache === 'function') clearImageCache();
    }

    async function loadProjectFromPortable() {
        if (typeof PGZPublishLink === 'undefined') {
            throw new Error('Модуль ссылки не загружен');
        }
        var pgzBlob = await PGZPublishLink.loadPortableFromLocation(global.location);
        if (!pgzBlob) return null;
        var zip = await JSZip.loadAsync(pgzBlob);
        await clearPlayResources();
        var imported = await PGZProjectIO.importZipToProject(zip, { skipIde: true });
        setHeaderTitle(imported.title);
        return imported.code;
    }

    async function loadProjectByStaticId(id) {
        if (typeof PGZPublishStatic === 'undefined') {
            return null;
        }
        var url = PGZPublishStatic.getStaticUrl(id);
        var response = await fetch(url);
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error('static_not_found');
        }
        var pgzBlob = await response.blob();
        var zip = await JSZip.loadAsync(pgzBlob);
        await clearPlayResources();
        var imported = await PGZProjectIO.importZipToProject(zip, { skipIde: true });
        var title = await PGZPublishStatic.fetchTitle(id);
        setHeaderTitle(title || imported.title);
        return imported.code;
    }

    async function loadProjectById(id) {
        if (typeof PGZProjectPublish === 'undefined') {
            throw new Error('Модуль публикации не загружен');
        }
        var record = await PGZProjectPublish.load(id);
        if (!record || !record.blob) {
            throw new Error('Игра не найдена');
        }
        var blob = new Blob([record.blob], { type: 'application/zip' });
        var zip = await JSZip.loadAsync(blob);
        await clearPlayResources();
        var imported = await PGZProjectIO.importZipToProject(zip, { skipIde: true });
        setHeaderTitle(record.title || imported.title);
        return imported.code;
    }

    async function loadProjectByRunUrl(rawUrl) {
        var zip = await PGZProjectIO.loadZipFromUrl(rawUrl);
        await clearPlayResources();
        var imported = await PGZProjectIO.importZipToProject(zip, { skipIde: true });
        setHeaderTitle(imported.title);
        return imported.code;
    }

    function setupPythonIDE(code) {
        PythonIDE.hash = 'playpage';
        PythonIDE.aT = PythonIDE.aT || {};
        PythonIDE.aT.playpage = { r: false, v: Date.now(), t: false, s: 0, m: 0 };
        PythonIDE.files = { 'my_pgz.py': code || "import pgzrun\n\npgzrun.go()\n" };
        PythonIDE.currentFile = 'my_pgz.py';
        PythonIDE.projectName = projectTitle;
        PythonIDE.vault = PythonIDE.vault || [];
        PythonIDE.playPageMode = true;

        Sk.inBrowser = true;
        Sk.inputfunTakesPrompt = true;
        (Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = 'gameCanvas';
        PythonIDE.configSkulpt('run');
    }

    function patchPlayPageErrors() {
        PythonIDE.handleError = function (err) {
            PythonIDE.running = false;
            console.error(err);
            var text = err && err.toString ? err.toString() : String(err);
            stopGame(false);
            showPlayError('Ошибка в игре:\n' + text);
        };
    }

    function bindKeyboard() {
        if (global.PGZPlayPage._keyboardBound) return;
        global.PGZPlayPage._keyboardBound = true;

        if (!PythonIDE.keyHandlers) PythonIDE.keyHandlers = [];

        global.addEventListener('keyup', function (e) {
            if (!PythonIDE.running) {
                PythonIDE.keyHandlers = [];
                return;
            }
            if ([37, 38, 39, 40].indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
            for (var i = 0; i < PythonIDE.keyHandlers.length; i++) {
                PythonIDE.keyHandlers[i](e);
            }
        });

        global.addEventListener('keydown', function (e) {
            if (!PythonIDE.running) {
                PythonIDE.keyHandlers = [];
                return;
            }
            if ([37, 38, 39, 40, 32, 116].indexOf(e.keyCode) > -1) {
                e.preventDefault();
            }
            for (var i = 0; i < PythonIDE.keyHandlers.length; i++) {
                PythonIDE.keyHandlers[i](e);
            }
        });
    }

    function bindGamepad() {
        var overlay = $('gameModal');
        if (!overlay) return;
        overlay.addEventListener('mousedown', function (e) {
            if (e.target.closest('#closeGameBtn')) return;
            e.preventDefault();
        });
    }

    function startGame() {
        if (!projectLoaded) return;
        showState('game');
        window.PGZ_STOP_REQUESTED = false;

        var overlay = $('gameModal');
        if (overlay) {
            overlay.classList.add('is-open');
            overlay.style.display = 'flex';
        }

        PythonIDE.runCode('normal');

        var canvas = $('gameCanvas');
        if (canvas && canvas.focus) canvas.focus();
    }

    function stopGame(showIntroAgain) {
        window.PGZ_STOP_REQUESTED = true;
        PythonIDE.running = false;

        var overlay = $('gameModal');
        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.style.display = 'none';
        }

        var gamepad = $('virtual-gamepad');
        if (gamepad) gamepad.style.display = 'none';

        if (showIntroAgain !== false) {
            showState('intro');
        }
    }

    async function initPlayPage() {
        showState('loading');

        var params = new URLSearchParams(global.location.search);
        var id = params.get('id');
        var runUrl = params.get('run') || params.get('pgz');
        var portablePayload = typeof PGZPublishLink !== 'undefined'
            ? PGZPublishLink.extractPortablePayload(global.location)
            : null;

        try {
            if (typeof initFS === 'function') await initFS();

            var code;
            if (portablePayload) {
                code = await loadProjectFromPortable();
            } else if (id) {
                code = await loadProjectByStaticId(id);
                if (!code) {
                    code = await loadProjectById(id);
                }
            } else if (runUrl) {
                code = await loadProjectByRunUrl(runUrl);
            } else {
                throw new Error('missing_game');
            }

            setupPythonIDE(code);
            patchPlayPageErrors();
            bindKeyboard();
            bindGamepad();

            var closeBtn = $('closeGameBtn');
            if (closeBtn) {
                closeBtn.onclick = function () {
                    stopGame(true);
                };
            }

            var playBtn = $('playPageStartBtn');
            if (playBtn) {
                playBtn.onclick = startGame;
            }

            projectLoaded = true;
            showState('intro');
        } catch (err) {
            console.error(err);
            var hint = portablePayload
                ? 'Не удалось открыть игру по ссылке. Возможно, ссылка обрезана при отправке — скопируй её заново целиком из Studio.'
                : (id
                    ? 'Игра не найдена. Подожди минуту после публикации или опубликуй заново.'
                    : (err.message === 'missing_game'
                        ? 'В ссылке нет данных игры. Открой Studio, нажми «Опубликовать» и скопируй ссылку.'
                        : (err.message || String(err))));
            showPlayError(hint);
        }

        global.document.getElementById('page-loader')?.remove();
    }

    global.PGZPlayPage = {
        init: initPlayPage,
        startGame: startGame,
        stopGame: stopGame
    };
})(window);
