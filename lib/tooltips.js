/** Shared tooltips for static and dynamically created controls. */
(function (global) {
    'use strict';
    var selector = '[title], [data-tip], [data-i18n-title]';
    var tipEl, activeTarget, ready = false;

    function ensureTip() {
        if (tipEl) return tipEl;
        tipEl = document.createElement('div');
        tipEl.id = 'pz-tooltip';
        tipEl.className = 'pz-tooltip';
        tipEl.setAttribute('role', 'tooltip');
        tipEl.style.display = 'none';
        document.body.appendChild(tipEl);
        return tipEl;
    }
    function prepare(el) {
        if (!el || el.tagName === 'IFRAME') return;
        var title = el.getAttribute('title');
        if (title && !el.hasAttribute('data-i18n-title')) el.setAttribute('data-tip', title);
        if (el.hasAttribute('title')) el.removeAttribute('title');
    }
    function textFor(el) {
        var key = el.getAttribute('data-i18n-title');
        if (key && global.PGZI18n && global.PGZI18n.t) {
            var translated = global.PGZI18n.t(key);
            if (translated && translated !== key) return translated;
        }
        return el.getAttribute('data-tip') || '';
    }
    function position(x, y) {
        var tip = ensureTip(), rect = tip.getBoundingClientRect(), pad = 14;
        var left = x + pad, top = y + pad;
        if (left + rect.width > global.innerWidth - 8) left = Math.max(8, x - rect.width - pad);
        if (top + rect.height > global.innerHeight - 8) top = Math.max(8, y - rect.height - pad);
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }
    function show(text, x, y) {
        if (!text) return;
        var tip = ensureTip();
        tip.textContent = text;
        tip.style.display = 'block';
        position(x, y);
    }
    function hide() { if (tipEl) tipEl.style.display = 'none'; activeTarget = null; }
    function scan(root) {
        root = root || document;
        if (root.matches && root.matches(selector)) prepare(root);
        root.querySelectorAll(selector).forEach(prepare);
    }
    function refresh(root) { hide(); scan(root || document); }
    function init() {
        if (ready) return;
        ready = true;
        ensureTip();
        scan(document);
        document.addEventListener('mouseover', function (event) {
            var el = event.target.closest && event.target.closest(selector);
            if (!el || el.contains(event.relatedTarget)) return;
            prepare(el);
            activeTarget = el;
            show(textFor(el), event.clientX, event.clientY);
        });
        document.addEventListener('mousemove', function (event) {
            if (activeTarget && tipEl.style.display !== 'none') position(event.clientX, event.clientY);
        });
        document.addEventListener('mouseout', function (event) {
            if (activeTarget && !activeTarget.contains(event.relatedTarget)) hide();
        });
        document.addEventListener('focusin', function (event) {
            var el = event.target.closest && event.target.closest(selector);
            if (!el) return;
            prepare(el);
            activeTarget = el;
            var r = el.getBoundingClientRect();
            show(textFor(el), r.left, r.bottom);
        });
        document.addEventListener('focusout', hide);
        document.addEventListener('mousedown', hide);
        document.addEventListener('scroll', hide, true);
        global.addEventListener('blur', hide);
        global.addEventListener('pgz:langchange', function () { refresh(document); });
    }
    global.PZTooltip = { init: init, scan: scan, refresh: refresh, show: show, hide: hide };
})(window);
