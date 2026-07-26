/** Подсказки у курсора для кнопок и элементов с data-tip / title */
(function (global) {
    'use strict';

    var tipEl = null;
    var activeTarget = null;
    var moveHandler = null;

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

    function getTipText(el) {
        if (!el) return '';
        return el.getAttribute('data-tip') || el.getAttribute('title') || el.getAttribute('aria-label') || '';
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

    function isTooltipTarget(el) {
        if (!el || !el.closest) return null;
        return el.closest(
            '#topPanel .toolButton, #topPanel .tb-btn, ' +
            '.gallery-btn, .ide-tab-btn, .layout-splitter, ' +
            '.pg-slot-icon-btn, .modal-close, [data-tip]'
        );
    }

    function bindTarget(el) {
        if (el.dataset.pzTipBound) return;
        el.dataset.pzTipBound = '1';

        var text = getTipText(el);
        if (!text) return;

        if (el.hasAttribute('title')) {
            el.setAttribute('data-tip', text);
            el.removeAttribute('title');
        }

        el.addEventListener('mouseenter', function (e) {
            activeTarget = el;
            show(getTipText(el), e.clientX, e.clientY);
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
        var selector =
            '#topPanel .toolButton, #topPanel .tb-btn, ' +
            '.gallery-btn, .ide-tab-btn, .layout-splitter, ' +
            '.pg-slot-icon-btn, [data-tip]';
        root.querySelectorAll(selector).forEach(bindTarget);
    }

    function init() {
        ensureTip();
        scan(document);
        document.addEventListener('scroll', hide, true);
        window.addEventListener('blur', hide);
    }

    global.PZTooltip = {
        init: init,
        scan: scan,
        show: show,
        hide: hide
    };
})(window);
