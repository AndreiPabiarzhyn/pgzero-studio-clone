/** Профессиональные улучшения редактора CodeMirror */
(function () {
    var PGZ_KEYWORDS = [
        'import', 'from', 'def', 'return', 'if', 'elif', 'else', 'for', 'while',
        'True', 'False', 'None', 'and', 'or', 'not', 'in', 'global', 'pass',
        'pgzrun', 'Actor', 'Rect', 'screen', 'keyboard', 'mouse', 'keys',
        'sounds', 'music', 'images', 'animate', 'clock', 'random',
        'draw', 'update', 'on_mouse_down', 'on_mouse_up', 'on_mouse_move',
        'on_key_down', 'on_key_up', 'WIDTH', 'HEIGHT', 'TITLE'
    ];

    function toggleComment(cm) {
        cm.operation(function () {
            var ranges = cm.listSelections();
            var minLine = ranges[0].from().line;
            var maxLine = ranges[ranges.length - 1].to().line;
            var allCommented = true;
            for (var i = minLine; i <= maxLine; i++) {
                var t = cm.getLine(i).trim();
                if (t && t.charAt(0) !== '#') { allCommented = false; break; }
            }
            for (var j = minLine; j <= maxLine; j++) {
                var line = cm.getLine(j);
                if (allCommented) {
                    var m = line.match(/^(\s*)#\s?/);
                    if (m) cm.replaceRange('', { line: j, ch: m[1].length }, { line: j, ch: m[0].length });
                } else {
                    var indent = line.match(/^\s*/)[0];
                    cm.replaceRange('# ', { line: j, ch: indent.length }, { line: j, ch: indent.length });
                }
            }
        });
    }

    function duplicateLine(cm) {
        var cur = cm.getCursor();
        var line = cm.getLine(cur.line);
        cm.replaceRange('\n' + line, { line: cur.line, ch: line.length });
        cm.setCursor(cur.line + 1, cur.ch);
    }

    function moveLine(cm, dir) {
        var cur = cm.getCursor();
        var line = cur.line;
        var target = line + dir;
        if (target < 0 || target >= cm.lineCount()) return;
        var text = cm.getLine(line);
        cm.operation(function () {
            cm.replaceRange('', { line: line, ch: 0 }, { line: line + 1, ch: 0 });
            cm.replaceRange(text + '\n', { line: target, ch: 0 });
            cm.setCursor({ line: target, ch: cur.ch });
        });
    }

    function ideText(key, params, fallback) {
        if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
            return PGZI18n.uiText(key, params, fallback);
        }
        return fallback != null ? fallback : key;
    }

    function updateStatus(cm) {
        var pos = document.getElementById('ideStatusPos');
        var sel = document.getElementById('ideStatusSel');
        var lang = document.getElementById('ideStatusLang');
        if (!pos) return;
        var c = cm.getCursor();
        pos.textContent = ideText(
            'ide.statusPos',
            { line: c.line + 1, col: c.ch + 1 },
            'Стр. ' + (c.line + 1) + ', кол. ' + (c.ch + 1)
        );
        if (sel) {
            var something = cm.somethingSelected();
            sel.textContent = something
                ? ideText(
                    'ide.statusSel',
                    { count: cm.getSelection().length },
                    'Выделено: ' + cm.getSelection().length + ' симв.'
                )
                : '';
        }
        if (lang) {
            var mode = cm.getMode().name || 'text';
            lang.textContent = mode === 'python'
                ? ideText('ide.statusLang', null, 'Python · Pygame Zero')
                : mode;
        }
    }

    var FONT_MIN = 10;
    var FONT_MAX = 24;
    var FONT_DEFAULT = 15;

    function getFontSize() {
        if (typeof PythonIDE !== 'undefined') {
            return parseInt(PythonIDE.getOption('codeSize', FONT_DEFAULT), 10);
        }
        var wrap = document.getElementById('editorContainer');
        if (wrap) {
            var v = parseFloat(getComputedStyle(wrap).getPropertyValue('--code-font-size'));
            if (v) return Math.round(v);
        }
        return FONT_DEFAULT;
    }

    function setFontSize(px) {
        px = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(px)));
        var wrap = document.getElementById('editorContainer');
        if (wrap) wrap.style.setProperty('--code-font-size', px + 'px');
        var cmEl = document.querySelector('.CodeMirror');
        if (cmEl) cmEl.style.fontSize = px + 'px';
        if (typeof PythonIDE !== 'undefined') PythonIDE.setOption('codeSize', px);
        var slider = document.getElementById('slider_code_size');
        var txt = document.getElementById('txt_code_size');
        if (slider) slider.value = px;
        if (txt) txt.value = px + 'pt';
        var zoomLabel = document.getElementById('ideZoomLabel');
        if (zoomLabel) zoomLabel.textContent = String(px);
        if (typeof PythonIDE !== 'undefined' && PythonIDE.editor) {
            PythonIDE.editor.refresh();
        }
    }

    function zoomIn() { setFontSize(getFontSize() + 1); }
    function zoomOut() { setFontSize(getFontSize() - 1); }

    function updateTabName(name) {
        var el = document.getElementById('ideActiveTabName');
        if (el) el.textContent = name || 'my_pgz.py';
    }

    function bindToolbar(cm) {
        var findBtn = document.getElementById('ideBtnFind');
        var zoomInBtn = document.getElementById('ideBtnZoomIn');
        var zoomOutBtn = document.getElementById('ideBtnZoomOut');
        if (findBtn) findBtn.addEventListener('click', function () {
            cm.focus();
            CodeMirror.lookupKey('Ctrl-F', cm.getOption('keyMap'), function () {}, cm);
        });
        if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
        setFontSize(getFontSize());
    }

    function indentLikePython(cm) {
        if (cm.state.completionActive && cm.state.completionActive.widget) {
            cm.state.completionActive.widget.pick();
            return;
        }
        if (cm.somethingSelected()) {
            cm.indentSelection('add');
            return;
        }
        cm.execCommand('insertSoftTab');
    }

    function outdentLikePython(cm) {
        if (cm.somethingSelected()) {
            cm.indentSelection('subtract');
            return;
        }
        cm.execCommand('indentLess');
    }

    function setup(cm) {
        cm.setOption('extraKeys', Object.assign({}, cm.getOption('extraKeys'), {
            'Tab': indentLikePython,
            'Shift-Tab': outdentLikePython,
            'Ctrl-/': toggleComment,
            'Ctrl-D': duplicateLine,
            'Alt-Up': function (c) { moveLine(c, -1); },
            'Alt-Down': function (c) { moveLine(c, 1); },
            'Ctrl-S': function () {
                if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.saveActiveSlotNow) {
                    PGZProjectGallery.saveActiveSlotNow();
                }
            },
            'Ctrl-Shift-S': function () {
                if (typeof exportGallery === 'function') exportGallery();
            },
            'Ctrl-=': zoomIn,
            'Ctrl-+': zoomIn,
            'Ctrl--': zoomOut,
            'Ctrl-Enter': function (c) {
                c.replaceSelection('\n', 'end');
            },
            'Shift-Alt-F': function (c) {
                var total = c.lineCount();
                var lines = [];
                for (var i = 0; i < total; i++) lines.push(c.getLine(i));
                c.setValue(lines.join('\n'));
            }
        }));

        cm.on('cursorActivity', function () { updateStatus(cm); });
        cm.on('change', function () { updateStatus(cm); });
        updateStatus(cm);
        bindToolbar(cm);

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('pgz:langchange', function () {
                updateStatus(cm);
            });
        }
    }

    window.EditorIDE = {
        PGZ_KEYWORDS: PGZ_KEYWORDS,
        setup: setup,
        updateTabName: updateTabName,
        updateStatus: updateStatus,
        setFontSize: setFontSize,
        zoomIn: zoomIn,
        zoomOut: zoomOut
    };
})();
