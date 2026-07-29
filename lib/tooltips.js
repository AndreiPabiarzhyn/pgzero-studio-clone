/** Подсказки у курсора для кнопок и элементов с data-tip / title */
(function (global) {
    'use strict';

    var tipEl = null;
    var activeTarget = null;
    var moveHandler = null;
    var ready = false;

    var SELECTOR =
        '#topPanel .toolButton, #topPanel .tb-btn, ' +
        '.gallery-btn, .ide-tab-btn, .layout-splitter, ' +
        '.pg-slot-icon-btn, .modal-close, [data-tip], [data-i18n-title]';

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

    function resolveI18nTip(el) {
        if (!el) return '';
        var key = el.getAttribute('data-i18n-title') || el.getAttribute('data-i18n-aria-label');
        if (!key) return '';
        if (typeof PGZI18n !== 'undefined' && PGZI18n.t) {
            var text = PGZI18n.t(key);
            if (text && text !== key) return text;
        }
        return '';
    }

    function getTipText(el) {
        if (!el) return '';
        var i18nText = resolveI18nTip(el);
        if (i18nText) return i18nText;
        return el.getAttribute('data-tip') || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    }

    function stripNativeTitle(el) {
        if (!el) return;
        if (el.hasAttribute('data-i18n-title') || el.hasAttribute('data-i18n-aria-label')) {
            el.removeAttribute('title');
        }
    }

    function positionTip(clientX, clientY) {
        var tip = ensureTip();
        var pad = 14;
        var x = clientX + pad;
        var y = clientY + pad;
        var rect = tip.getBoundingClientRect();
        var maxX = window.innerWidth - rect.width - 8;
        var maxY = window.innerHeight - rect.height - 8;
        if (x > maxX) x = Math.max(8, clientX - rect.width - pad);
        if (y > maxY) y = Math.max(8, clientY - rect.height - pad);
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    }

    function show(text, clientX, clientY) {
        if (!text) return;
        var tip = ensureTip();
        tip.textContent = text;
        tip.style.display = 'block';
        tip.style.left = '0';
        tip.style.top = '0';
        positionTip(clientX, clientY);
    }

    function hide() {
        if (tipEl) tipEl.style.display = 'none';
        activeTarget = null;
        if (moveHandler) {
            document.removeEventListener('mousemove', moveHandler);
            moveHandler = null;
        }
    }

    function bindTarget(el) {
        if (!el || el.tagName === 'IFRAME' || el.id === 'handbook') return;

        stripNativeTitle(el);

        var text = getTipText(el);
        if (!text && !el.getAttribute('data-i18n-title') && !el.getAttribute('data-i18n-aria-label')) return;

        if (el.dataset.pzTipBound) return;
        el.dataset.pzTipBound = '1';

        if (text && !el.getAttribute('data-i18n-title') && !el.hasAttribute('data-tip')) {
            if (el.hasAttribute('title')) {
                el.setAttribute('data-tip', el.getAttribute('title'));
                el.removeAttribute('title');
            }
        }

        el.addEventListener('mouseenter', function (e) {
            activeTarget = el;
            var tipText = getTipText(el);
            if (!tipText) return;
            show(tipText, e.clientX, e.clientY);
            moveHandler = function (ev) {
                if (activeTarget === el) positionTip(ev.clientX, ev.clientY);
            };
            document.addEventListener('mousemove', moveHandler);
        });

        el.addEventListener('mouseleave', hide);
        el.addEventListener('mousedown', hide);
        el.addEventListener('click', hide);
    }

    function scan(root) {
        root = root || document;
        root.querySelectorAll(SELECTOR).forEach(function (el) {
            stripNativeTitle(el);
            bindTarget(el);
        });
    }

    function refresh(root) {
        if (!ready) return;
        hide();
        root = root || document;
        root.querySelectorAll(SELECTOR).forEach(function (el) {
            if (el.hasAttribute('data-pz-tip-bound')) {
                el.removeAttribute('data-pz-tip-bound');
            }
            if (el.hasAttribute('data-i18n-title') || el.hasAttribute('data-i18n-aria-label')) {
                el.removeAttribute('data-tip');
            }
            stripNativeTitle(el);
        });
        scan(root);
    }

    function init() {
        ensureTip();
        scan(document);
        ready = true;
        document.addEventListener('scroll', hide, true);
        window.addEventListener('blur', hide);
        if (typeof global.addEventListener === 'function') {
            global.addEventListener('pgz:langchange', function () {
                refresh(document);
            });
        }
    }

    global.PZTooltip = {
        init: init,
        scan: scan,
        refresh: refresh,
        show: show,
        hide: hide
    };
})(window);
