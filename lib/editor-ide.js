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
            var lines = {};
            ranges.forEach(function (range) {
                var from = range.from(), to = range.to();
                var end = to.line;
                // A selection ending at column zero excludes that next line.
                if (end > from.line && to.ch === 0) end--;
                for (var i = from.line; i <= end; i++) lines[i] = true;
            });
            var lineNumbers = Object.keys(lines).map(Number).sort(function (a, b) { return a - b; });
            var nonBlank = lineNumbers.filter(function (line) { return /\S/.test(cm.getLine(line)); });
            var allCommented = nonBlank.length > 0 && nonBlank.every(function (line) {
                return /^\s*#/.test(cm.getLine(line));
            });
            lineNumbers.forEach(function (lineNumber) {
                var line = cm.getLine(lineNumber);
                // Leave blank lines in a multi-line selection untouched.
                if (!/\S/.test(line) && lineNumbers.length > 1) return;
                if (allCommented) {
                    var match = line.match(/^(\s*)# ?/);
                    if (match) cm.replaceRange('', { line: lineNumber, ch: match[1].length }, { line: lineNumber, ch: match[0].length }, '+comment');
                } else {
                    var indent = line.match(/^\s*/)[0];
                    cm.replaceRange('# ', { line: lineNumber, ch: indent.length }, { line: lineNumber, ch: indent.length }, '+comment');
                }
            });
        });
    }

    function duplicateLine(cm) {
        var cur = cm.getCursor();
        var line = cm.getLine(cur.line);
        cm.replaceRange('\n' + line, { line: cur.line, ch: line.length });
        cm.setCursor(cur.line + 1, cur.ch);
    }

    function moveLine(cm, dir) {
        var selections = cm.listSelections();
        if (selections.length !== 1) return;
        var selection = selections[0], from = selection.from(), to = selection.to();
        var first = from.line, last = to.line;
        if (to.ch === 0 && last > first) last--;
        if ((dir < 0 && first === 0) || (dir > 0 && last >= cm.lineCount() - 1)) return;
        var start = dir < 0 ? first - 1 : first;
        var end = dir < 0 ? last : last + 1;
        var lines = [];
        for (var i = start; i <= end; i++) lines.push(cm.getLine(i));
        if (dir < 0) lines.push(lines.shift());
        else lines.unshift(lines.pop());
        cm.operation(function () {
            cm.replaceRange(lines.join('\n'), { line: start, ch: 0 }, { line: end, ch: cm.getLine(end).length }, '+moveLine');
            cm.setSelection(
                { line: selection.anchor.line + dir, ch: selection.anchor.ch },
                { line: selection.head.line + dir, ch: selection.head.ch }
            );
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
            cm.execCommand('find');
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

    function backspaceIndent(cm) {
        var selections = cm.listSelections();
        if (selections.length !== 1 || !selections[0].empty()) return CodeMirror.Pass;
        var cursor = selections[0].head;
        if (cursor.ch === 0) return CodeMirror.Pass;
        var before = cm.getLine(cursor.line).slice(0, cursor.ch);
        // Only spaces at the beginning of the line are safe to remove in one step.
        if (!/^ +$/.test(before)) return CodeMirror.Pass;
        var width = cm.getOption('indentUnit') || 4;
        var count = cursor.ch % width || width;
        cm.replaceRange('', { line: cursor.line, ch: cursor.ch - count }, cursor, '+delete');
    }

    function setup(cm) {
        // The bundled search add-on is newer than CodeMirror 5.22.
        if (typeof cm.phrase !== 'function') {
            var searchPhrases = {
                ru: { 'Search:': 'Поиск:', '(Use /re/ syntax for regexp search)': '(Для регулярных выражений используйте /re/)', 'With:': 'Заменить на:', 'Replace?': 'Заменить?', 'Yes': 'Да', 'No': 'Нет', 'All': 'Все', 'Stop': 'Стоп', 'Replace all:': 'Заменить все:', 'Replace:': 'Заменить:', 'Replace with:': 'Заменить на:' },
                es: { 'Search:': 'Buscar:', '(Use /re/ syntax for regexp search)': '(Usa /re/ para expresiones regulares)', 'With:': 'Reemplazar por:', 'Replace?': '¿Reemplazar?', 'Yes': 'Sí', 'No': 'No', 'All': 'Todos', 'Stop': 'Detener', 'Replace all:': 'Reemplazar todo:', 'Replace:': 'Reemplazar:', 'Replace with:': 'Reemplazar por:' }
            };
            CodeMirror.defineExtension('phrase', function (text) {
                var lang = typeof PGZI18n !== 'undefined' && PGZI18n.getLang ? PGZI18n.getLang() : 'ru';
                return searchPhrases[lang] && searchPhrases[lang][text] || text;
            });
        }
        cm.setOption('extraKeys', Object.assign({}, cm.getOption('extraKeys'), {
            'Backspace': backspaceIndent,
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
            'Ctrl--': zoomOut
        }));

        var completionTimer = null;
        var autoCompleteEnabled = true;
        function loadPreference(key) {
            try { return localStorage.getItem(key) !== 'false'; } catch (_e) { return true; }
        }
        function bindPreference(id, key, callback) {
            var checkbox = document.getElementById(id);
            var enabled = loadPreference(key);
            callback(enabled);
            if (!checkbox) return;
            checkbox.checked = enabled;
            checkbox.addEventListener('change', function () {
                try { localStorage.setItem(key, String(checkbox.checked)); } catch (_e) {}
                callback(checkbox.checked);
            });
        }
        bindPreference('editorAutoPairs', 'pgz_editor_auto_pairs', function (enabled) { cm.setOption('autoCloseBrackets', enabled); });
        bindPreference('editorAutoComplete', 'pgz_editor_auto_complete', function (enabled) {
            autoCompleteEnabled = enabled;
            if (!enabled && completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
            if (!enabled && cm.state.completionActive) cm.state.completionActive.close();
        });
        cm.on('inputRead', function (editor, change) {
            if (completionTimer) clearTimeout(completionTimer);
            if (!autoCompleteEnabled || change.origin !== '+input' || !change.text || change.text.length !== 1 || !/[A-Za-z0-9_.]$/.test(change.text[0])) return;
            var cursor = editor.getCursor();
            var token = editor.getTokenAt(cursor);
            if (token.type && /comment|string/.test(token.type)) return;
            var before = editor.getLine(cursor.line).slice(0, cursor.ch);
            if (!/\.$/.test(before) && !/[A-Za-z_][A-Za-z_0-9]{1,}$/.test(before)) return;
            completionTimer = setTimeout(function () {
                completionTimer = null;
                if (!autoCompleteEnabled || !editor.hasFocus() || editor.state.completionActive || typeof PythonIDE === 'undefined') return;
                var current = editor.getCursor();
                if (current.line !== cursor.line || current.ch !== cursor.ch) return;
                CodeMirror.showHint(editor, PythonIDE.autoComplete, { completeSingle: false });
            }, 180);
        });
        cm.on('keydown', function (_editor, event) {
            if (event.key === 'Escape' && completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
        });
        cm.on('blur', function () {
            if (completionTimer) { clearTimeout(completionTimer); completionTimer = null; }
        });
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
