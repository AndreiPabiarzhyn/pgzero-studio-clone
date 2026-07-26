/** SVG-иконки PGZero Studio (детский интерфейс) */
(function () {
    var paths = {
        play: 'M8 5v14l11-7z',
        stop: 'M6 6h12v12H6z',
        console: 'M4 5h16a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm2 3h5v2H6V8zm0 4h8v2H6v-2z',
        plus: 'M11 5h2v14h-2V5zM5 11h14v2H5v-2z',
        folderOpen: 'M4 8h6l2 2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2zm0 2v8h16v-6h-9l-2-2H4z',
        save: 'M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm2 2v5h10V5H7zm0 9v4h10v-4H7z',
        files: 'M6 4h7l3 3v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm7 1v4h4',
        palette: 'M12 3a9 9 0 109 9 2 2 0 002-2 1 1 0 011-1h1a3 3 0 000-6 1 1 0 01-1-1 3 3 0 00-3-3zM8 12a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
        code: 'M8 8l-4 4 4 4M16 8l4 4-4 4M13 6l-2 12',
        settings: 'M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM19.4 13a7.9 7.9 0 000-2l2-1.6-2-3.4-2.4 1a8 8 0 00-1.7-1l-.4-2.6H11l-.4 2.6a8 8 0 00-1.7 1l-2.4-1-2 3.4 2 1.6a7.9 7.9 0 000 2l-2 1.6 2 3.4 2.4-1a8 8 0 001.7 1l.4 2.6h6l.4-2.6a8 8 0 001.7-1l2.4 1 2-3.4-2-1.6z',
        image: 'M4 5h16v14H4V5zm2 2v10h12V7H6zm2 2h8l-2.5 3.5L11 10 8 14l-2-5z',
        sound: 'M11 5L7 9H4v6h3l4 4V5zm4.7 2.3a1 1 0 011.4 0 6 6 0 010 8.5 1 1 0 01-1.4-1.4 4 4 0 000-5.7 1 1 0 010-1.4z',
        music: 'M12 3v10.5a3.5 3.5 0 101 3.4V7h5V3h-8z',
        add: 'M11 5h2v14h-2V5zM5 11h14v2H5v-2z',
        eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 4a4 4 0 100-8 4 4 0 000 8z',
        edit: 'M4 18h2l9-9-2-2-9 9v2zm12-11l-2-2 2-2 2 2-2 2z',
        paint: 'M12 2l3 3-9 9H3v-3l9-9zm7 7l2 2-2 2-2-2 2-2z',
        trash: 'M6 7h12l-1 12H7L6 7zm3-3h6l1 2H8l1-2z',
        more: 'M6 12a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z',
        book: 'M5 4h9a2 2 0 012 2v13H7a2 2 0 01-2-2V4zm2 2v11h7V6H7zm9-1h2a1 1 0 011 1v12a2 2 0 01-2 2h-1V5z',
        panel: 'M4 4h16v16H4V4zm2 2v12h12V6H6zm0 3h5v2H6V9zm0 4h8v2H6v-2z',
        panelOff: 'M4 4h10v16H4V4zm2 2v12h6V6H6zm12 0h2v12h-2V6z',
    };

    function svg(name, size) {
        size = size || 20;
        var d = paths[name];
        if (!d) return '';
        return '<svg class="pz-icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + d + '"/></svg>';
    }

    function setButtonIcon(btn, name, size) {
        if (!btn) return;
        var iconEl = btn.querySelector('.pz-icon-wrap');
        if (!iconEl) {
            iconEl = document.createElement('span');
            iconEl.className = 'pz-icon-wrap';
            btn.insertBefore(iconEl, btn.firstChild);
        }
        iconEl.innerHTML = svg(name, size);
    }

    window.PZIcon = {
        svg: svg,
        setButtonIcon: setButtonIcon
    };
})();
