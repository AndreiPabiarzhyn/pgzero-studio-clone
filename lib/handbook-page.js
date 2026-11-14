/** pgz-handbook.html — локализованный справочник Pygame Zero */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'pgz_lang';
    var THEME_KEY = 'OPT_appTheme';
    var currentQuery = '';
    var renderSequence = 0;
    function applyTheme() {
        var theme = 'light';
        try { theme = localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (_e) {}
        global.document.documentElement.setAttribute('data-app-theme', theme);
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeLang(code) {
        var value = String(code || '').toLowerCase().split('-')[0];
        return ['ru', 'en', 'es'].indexOf(value) !== -1 ? value : 'ru';
    }

    function getLang() {
        if (typeof PGZI18n !== 'undefined' && PGZI18n.getLang) {
            return PGZI18n.getLang();
        }
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return normalizeLang(saved);
        } catch (e) { /* ignore */ }
        return 'ru';
    }

    async function fetchHandbook(lang) {
        var tryLangs = [lang, 'ru'];
        for (var i = 0; i < tryLangs.length; i++) {
            var code = tryLangs[i];
            try {
                var resp = await fetch('./locales/handbook.' + code + '.json', { cache: 'no-store' });
                if (resp.ok) return resp.json();
            } catch (e) { /* try fallback */ }
        }
        throw new Error('Handbook locale load failed');
    }

    function bindScroll() {
        global.document.querySelectorAll('.toc a').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                var target = global.document.querySelector(this.getAttribute('href'));
                if (target) {
                    var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    target.setAttribute('tabindex', '-1');
                    target.focus({ preventScroll: true });
                    global.scrollTo({ top: target.offsetTop - 20, behavior: reduceMotion ? 'auto' : 'smooth' });
                }
            });
        });
        global.document.querySelectorAll('.back-to-top').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
                var search = global.document.getElementById('handbookSearch');
                if (search) search.focus({ preventScroll: true });
                global.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            });
        });
    }

    function render(data, language) {
        var root = global.document.getElementById('handbookRoot');
        if (!root || !data) return;

        var lang = normalizeLang(language);
        var labels = {
            ru: ['Поиск по справочнику', 'Ничего не найдено', 'Найдено разделов:'],
            en: ['Search the handbook', 'No results found', 'Sections found:'],
            es: ['Buscar en la guía', 'No se encontraron resultados', 'Secciones encontradas:']
        }[lang];
        var html = '<h1>' + escapeHtml(data.title) + '</h1>';
        html += '<label class="handbook-search-label" for="handbookSearch">' + escapeHtml(labels[0]) + '</label><input id="handbookSearch" type="search" autocomplete="off" placeholder="' + escapeHtml(labels[0]) + '" aria-describedby="handbookSearchStatus"><p id="handbookSearchStatus" class="handbook-search-status" role="status" aria-live="polite"></p><p id="handbookNoResults" hidden>' + escapeHtml(labels[1]) + '</p>';
        html += '<div class="toc"><h2>' + escapeHtml(data.tocTitle) + '</h2><ul>';
        (data.sections || []).forEach(function (section) {
            html += '<li><a href="#' + escapeHtml(section.id) + '">' + escapeHtml(section.toc) + '</a></li>';
        });
        html += '</ul></div>';

        (data.sections || []).forEach(function (section) {
            html += '<div class="section" id="' + escapeHtml(section.id) + '">';
            html += '<h2>' + escapeHtml(section.title) + '</h2>';
            html += section.body || '';
            html += '<a href="#" class="back-to-top">' + escapeHtml(data.backToTop) + '</a></div>';
        });

        root.innerHTML = html;
        bindScroll();
        var search = global.document.getElementById('handbookSearch');
        search.value = currentQuery;
        function filterSections() {
            currentQuery = search.value;
            var query = currentQuery.trim().toLocaleLowerCase();
            var searchTerms = query.split(/\s+/).filter(Boolean).map(function (word) {
                return word.length > 5 && /[аыяиеоею]$/.test(word) ? word.slice(0, -1) : word;
            });
            var visible = 0;
            global.document.querySelectorAll('#handbookRoot .section').forEach(function (section) {
                var text = section.textContent.toLocaleLowerCase();
                var matches = searchTerms.every(function (term) { return text.indexOf(term) !== -1; });
                section.hidden = !matches;
                var tocLink = global.document.querySelector('.toc a[href="#' + section.id + '"]');
                if (tocLink) tocLink.parentElement.hidden = !matches;
                if (matches) visible++;
            });
            global.document.getElementById('handbookNoResults').hidden = visible !== 0;
            global.document.getElementById('handbookSearchStatus').textContent = query ? labels[2] + ' ' + visible : '';
            var toc = root.querySelector('.toc');
            if (toc) toc.hidden = visible === 0;
        }
        search.addEventListener('input', filterSections);
        filterSections();
    }

    async function loadAndRender(lang) {
        var sequence = ++renderSequence;
        var data = await fetchHandbook(lang);
        if (sequence !== renderSequence) return data;
        global.document.documentElement.lang = normalizeLang(lang);
        global.document.title = data.title;
        render(data, lang);
        return data;
    }

    function bindLangSync() {
        if (typeof global.addEventListener !== 'function') return;

        global.addEventListener('storage', function (e) {
            if (e.key === THEME_KEY) { applyTheme(); return; }
            if (e.key !== STORAGE_KEY || !e.newValue) return;
            loadAndRender(normalizeLang(e.newValue)).catch(function (err) {
                console.error(err);
            });
        });
    }

    async function initHandbook() {
        applyTheme();
        if (typeof PGZI18n !== 'undefined') {
            await PGZI18n.init();
        }
        await loadAndRender(getLang());
        bindLangSync();
    }

    global.PGZHandbookPage = { init: initHandbook };
})(window);
