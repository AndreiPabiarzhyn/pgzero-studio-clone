/** Скрывает подписи на кнопках панели, если они не помещаются */
(function (global) {
    'use strict';

    var scheduled = false;

    var stages = ['topPanel--compact', 'topPanel--hide-files', 'topPanel--hide-learn', 'topPanel--hide-publish', 'topPanel--hide-save'];

    function measureNeedsCompact(topPanel) {
        var toolPanel = topPanel.querySelector('.toolPanel--kids');
        var more = topPanel.querySelector('#btn_more');
        var theme = topPanel.querySelector('#btn_toggle_theme');
        if (!toolPanel || !more || !theme || !topPanel.getClientRects().length) return false;
        var toolRect = toolPanel.getBoundingClientRect();
        var moreRect = more.getBoundingClientRect();
        var themeRect = theme.getBoundingClientRect();
        return toolPanel.scrollWidth > toolPanel.clientWidth + 1 ||
            moreRect.right > Math.min(toolRect.right, themeRect.left) + 1;
    }

    function updateToolbarCompact() {
        scheduled = false;
        var topPanel = global.document.getElementById('topPanel');
        if (!topPanel || !topPanel.getClientRects().length) return;
        stages.forEach(function (stage) { topPanel.classList.remove(stage); });
        for (var i = 0; i < stages.length && measureNeedsCompact(topPanel); i++) {
            topPanel.classList.add(stages[i]);
        }
    }

    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        global.requestAnimationFrame(updateToolbarCompact);
    }

    function init() {
        scheduleUpdate();
        global.addEventListener('resize', scheduleUpdate);
        global.addEventListener('pgz:langchange', scheduleUpdate);

        var topPanel = global.document.getElementById('topPanel');
        if (topPanel && typeof ResizeObserver !== 'undefined') {
            var observer = new ResizeObserver(scheduleUpdate);
            observer.observe(topPanel);
            var toolPanel = topPanel.querySelector('.toolPanel--kids');
            if (toolPanel) observer.observe(toolPanel);
        }

        if (global.document.fonts && global.document.fonts.ready) {
            global.document.fonts.ready.then(scheduleUpdate);
        }
    }

    global.PGZToolbarCompact = {
        init: init,
        update: updateToolbarCompact
    };
})(window);
