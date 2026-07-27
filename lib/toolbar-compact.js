/** Скрывает подписи на кнопках панели, если они не помещаются */
(function (global) {
    'use strict';

    var scheduled = false;

    function measureNeedsCompact(topPanel) {
        var toolPanel = topPanel.querySelector('.toolPanel--kids');
        if (!toolPanel) return false;

        if (topPanel.scrollWidth > topPanel.clientWidth + 1) {
            return true;
        }
        if (toolPanel.scrollWidth > toolPanel.clientWidth + 1) {
            return true;
        }

        var labels = toolPanel.querySelectorAll('.tb-label');
        for (var i = 0; i < labels.length; i++) {
            var label = labels[i];
            if (!label.offsetParent) continue;
            if (label.scrollWidth > label.clientWidth + 1) {
                return true;
            }
        }
        return false;
    }

    function updateToolbarCompact() {
        scheduled = false;
        var topPanel = global.document.getElementById('topPanel');
        if (!topPanel) return;

        topPanel.classList.remove('topPanel--compact');
        if (measureNeedsCompact(topPanel)) {
            topPanel.classList.add('topPanel--compact');
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
