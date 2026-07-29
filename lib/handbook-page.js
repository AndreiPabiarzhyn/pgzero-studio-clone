/** pgz-handbook.html — локализованный справочник Pygame Zero */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'pgz_lang';

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
                    global.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
                }
            });
        });
        global.document.querySelectorAll('.back-to-top').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                global.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    function render(data) {
        var root = global.document.getElementById('handbookRoot');
        if (!root || !data) return;

        var html = '<h1>' + escapeHtml(data.title) + '</h1>';
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
    }

    async function loadAndRender(lang) {
        var data = await fetchHandbook(lang);
        global.document.title = data.title;
        render(data);
        return data;
    }

    function bindLangSync() {
        if (typeof global.addEventListener !== 'function') return;

        global.addEventListener('storage', function (e) {
            if (e.key !== STORAGE_KEY || !e.newValue) return;
            loadAndRender(normalizeLang(e.newValue)).catch(function (err) {
                console.error(err);
            });
        });
    }

    async function initHandbook() {
        if (typeof PGZI18n !== 'undefined') {
            await PGZI18n.init();
        }
        await loadAndRender(getLang());
        bindLangSync();
    }

    global.PGZHandbookPage = { init: initHandbook };
})(window);
