/** Перетаскиваемое окно игры */
(function () {
    'use strict';

    var POS_KEY = 'OPT_gameModalPos';

    function getOverlay() {
        return document.getElementById('gameModal');
    }

    function getWindow() {
        return document.getElementById('gameModalWindow');
    }

    function readPos() {
        try {
            return JSON.parse(localStorage[POS_KEY] || 'null');
        } catch (e) {
            return null;
        }
    }

    function savePos(left, top) {
        localStorage[POS_KEY] = JSON.stringify({ left: left, top: top });
    }

    function clampWindow() {
        var win = getWindow();
        if (!win) return;
        var rect = win.getBoundingClientRect();
        var maxL = Math.max(0, window.innerWidth - rect.width);
        var maxT = Math.max(0, window.innerHeight - rect.height);
        var left = Math.min(maxL, Math.max(0, rect.left));
        var top = Math.min(maxT, Math.max(0, rect.top));
        win.style.left = left + 'px';
        win.style.top = top + 'px';
    }

    function centerWindow() {
        var win = getWindow();
        if (!win) return;
        var saved = readPos();
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
            win.style.left = saved.left + 'px';
            win.style.top = saved.top + 'px';
            clampWindow();
            return;
        }
        requestAnimationFrame(function () {
            var w = win.offsetWidth || 400;
            var h = win.offsetHeight || 300;
            win.style.left = Math.max(8, (window.innerWidth - w) / 2) + 'px';
            win.style.top = Math.max(8, (window.innerHeight - h) / 2) + 'px';
        });
    }

    function openModal() {
        var overlay = getOverlay();
        if (!overlay) return;
        overlay.classList.add('is-open');
        overlay.style.display = 'block';
        centerWindow();
    }

    function closeModal() {
        var overlay = getOverlay();
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.style.display = 'none';
    }

    function bindDrag() {
        var win = getWindow();
        var header = document.getElementById('gameModalHeader');
        if (!win || !header) return;

        header.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || e.target.closest('#closeGameBtn')) return;
            e.preventDefault();
            var rect = win.getBoundingClientRect();
            var offsetX = e.clientX - rect.left;
            var offsetY = e.clientY - rect.top;

            function onMove(ev) {
                var left = ev.clientX - offsetX;
                var top = ev.clientY - offsetY;
                win.style.left = left + 'px';
                win.style.top = top + 'px';
            }

            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.classList.remove('game-modal-dragging');
                var r = win.getBoundingClientRect();
                savePos(r.left, r.top);
                clampWindow();
            }

            document.body.classList.add('game-modal-dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function resetChrome() {
        var titleEl = document.getElementById('gameTitle');
        if (titleEl) {
            var nameInput = document.getElementById('projectNameInput');
            titleEl.textContent = (nameInput && nameInput.value.trim()) || 'Pygame Zero';
        }
        var win = getWindow();
        if (win) {
            win.style.width = '';
            win.style.height = '';
        }
    }

    function init() {
        bindDrag();
        window.addEventListener('resize', function () {
            if (getOverlay() && getOverlay().classList.contains('is-open')) clampWindow();
        });
    }

    window.GameModal = {
        init: init,
        open: openModal,
        close: closeModal,
        reposition: centerWindow,
        resetChrome: resetChrome
    };
})();
