/** Изменяемые размеры панелей (splitter) + скрытие правой панели */
(function () {
    var STORAGE = {
        sidebarWidth: 'OPT_sidebarWidth',
        consoleHeight: 'OPT_consoleHeight',
        sidebarVisible: 'OPT_sidebarVisible'
    };

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

    function setSidebarVisible(visible) {
        var right = document.getElementById('rightBar');
        var splitter = document.getElementById('splitterV');
        if (!right) return;

        if (visible) {
            right.classList.remove('layout-right--hidden');
            if (splitter) splitter.style.display = '';
        } else {
            right.classList.add('layout-right--hidden');
            if (splitter) splitter.style.display = 'none';
        }

        localStorage[STORAGE.sidebarVisible] = visible ? '1' : '0';
        refreshEditor();
    }

    function toggleSidebar() {
        var right = document.getElementById('rightBar');
        if (!right) return;
        setSidebarVisible(right.classList.contains('layout-right--hidden'));
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
                applyConsoleHeight(clamp(height, 100, 520));
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

    function readConsoleHeight() {
        var layout = document.getElementById('mainLayout');
        if (!layout) return 220;
        return parseFloat(getComputedStyle(layout).getPropertyValue('--console-height')) || 220;
    }

    function init() {
        var layout = document.getElementById('mainLayout');
        if (!layout) return;

        var sidebarW = parseInt(localStorage[STORAGE.sidebarWidth] || '320', 10);
        var consoleH = parseInt(localStorage[STORAGE.consoleHeight] || '220', 10);
        var sidebarVisible = localStorage[STORAGE.sidebarVisible] !== '0';

        applySidebarWidth(clamp(sidebarW, 200, 640));
        applyConsoleHeight(clamp(consoleH, 100, 520));
        setSidebarVisible(sidebarVisible);

        // Вправо — уже правая панель; влево — шире правая / уже редактор
        bindSplitter(
            document.getElementById('splitterV'),
            readSidebarWidth,
            function (px) { applySidebarWidth(clamp(px, 200, 640)); },
            'x',
            -1
        );

        bindConsoleSplitter(document.getElementById('splitterH'));

    }

    window.LayoutSplitters = {
        init: init,
        toggleSidebar: toggleSidebar,
        setSidebarVisible: setSidebarVisible,
        _test: {
            clamp: clamp,
            consoleHeightFromPointer: function (columnBottom, clientY) {
                return columnBottom - clientY;
            }
        }
    };
})();
