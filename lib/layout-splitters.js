/** Изменяемые размеры панелей (splitter); боковая панель всегда видна */
(function () {
    var STORAGE = {
        sidebarWidth: 'OPT_sidebarWidth',
        consoleHeight: 'OPT_consoleHeight'
    };

    var MIN_SIDEBAR = 200;
    var MAX_SIDEBAR = 640;
    var MIN_CONSOLE = 100;
    var MAX_CONSOLE = 520;

    function clamp(val, min, max) {
        return Math.min(max, Math.max(min, val));
    }

    function refreshEditor() {
        if (typeof PythonIDE !== 'undefined' && PythonIDE.editor) {
            setTimeout(function () { PythonIDE.editor.refresh(); }, 0);
        }
    }

    function applySidebarWidth(px) {
        var layout = document.getElementById('mainLayout');
        if (!layout) return;
        layout.style.setProperty('--sidebar-width', px + 'px');
        localStorage[STORAGE.sidebarWidth] = String(px);
        refreshEditor();
    }

    function applyConsoleHeight(px) {
        var layout = document.getElementById('mainLayout');
        if (!layout) return;
        layout.style.setProperty('--console-height', px + 'px');
        localStorage[STORAGE.consoleHeight] = String(px);
        refreshEditor();
    }

    function bindConsoleSplitter(splitter) {
        if (!splitter) return;
        var leftColumn = document.getElementById('leftColumn');
        if (!leftColumn) return;

        splitter.addEventListener('mousedown', function (e) {
            e.preventDefault();

            function onMove(ev) {
                var rect = leftColumn.getBoundingClientRect();
                var height = rect.bottom - ev.clientY;
                applyConsoleHeight(clamp(height, MIN_CONSOLE, MAX_CONSOLE));
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.classList.remove('layout-dragging-h');
                refreshEditor();
            }

            document.body.classList.add('layout-dragging-h');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    /** drag: startSize + sign * (mouse - startMouse) */
    function bindSplitter(splitter, getInitialSize, applySize, axis, sign) {
        if (!splitter) return;
        sign = sign || 1;
        splitter.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var startPos = axis === 'x' ? e.clientX : e.clientY;
            var startSize = getInitialSize();

            function onMove(ev) {
                var pos = axis === 'x' ? ev.clientX : ev.clientY;
                var delta = pos - startPos;
                applySize(startSize + sign * delta);
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.classList.remove(axis === 'x' ? 'layout-dragging-v' : 'layout-dragging-h');
                refreshEditor();
            }

            document.body.classList.add(axis === 'x' ? 'layout-dragging-v' : 'layout-dragging-h');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function readSidebarWidth() {
        var layout = document.getElementById('mainLayout');
        if (!layout) return 320;
        return parseFloat(getComputedStyle(layout).getPropertyValue('--sidebar-width')) || 320;
    }

    function init() {
        var layout = document.getElementById('mainLayout');
        if (!layout) return;

        var sidebarW = parseInt(localStorage[STORAGE.sidebarWidth] || '320', 10);
        var consoleH = parseInt(localStorage[STORAGE.consoleHeight] || '220', 10);

        // Раньше панель можно было полностью скрыть — теперь только минимальная ширина
        if (sidebarW < MIN_SIDEBAR) sidebarW = MIN_SIDEBAR;

        applySidebarWidth(clamp(sidebarW, MIN_SIDEBAR, MAX_SIDEBAR));
        applyConsoleHeight(clamp(consoleH, MIN_CONSOLE, MAX_CONSOLE));

        bindSplitter(
            document.getElementById('splitterV'),
            readSidebarWidth,
            function (px) { applySidebarWidth(clamp(px, MIN_SIDEBAR, MAX_SIDEBAR)); },
            'x',
            -1
        );

        bindConsoleSplitter(document.getElementById('splitterH'));
    }

    window.LayoutSplitters = {
        init: init,
        _test: {
            clamp: clamp,
            MIN_SIDEBAR: MIN_SIDEBAR,
            consoleHeightFromPointer: function (columnBottom, clientY) {
                return columnBottom - clientY;
            }
        }
    };
})();
