/** PGZero Studio — цветные SVG-иконки */
(function () {
    'use strict';

    var SVGS = {
        play: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#34c759"/><path d="M10 7.5v9l7-4.5-7-4.5z" fill="#fff"/></svg>',

        playInv: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',

        stop: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ef4444"/><rect x="8" y="8" width="8" height="8" rx="1" fill="#fff"/></svg>',

        panel: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="#dbeafe"/><rect x="5" y="6" width="7" height="12" rx="1" fill="#5b8def"/><rect x="14" y="6" width="5" height="12" rx="1" fill="#93c5fd"/></svg>',

        panelOff: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="#dbeafe"/><rect x="5" y="6" width="14" height="12" rx="1" fill="#5b8def"/></svg>',

        gallery: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="14" height="11" rx="2" fill="#fb923c"/><rect x="8" y="9" width="14" height="11" rx="2" fill="#f97316"/><circle cx="7" cy="9" r="1.5" fill="#fff"/><path d="M4 13l3-3 2 2 3-4 4 5H4v0z" fill="#fff" opacity=".9"/></svg>',

        palette: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="14" height="11" rx="2" fill="#fb923c"/><rect x="8" y="9" width="14" height="11" rx="2" fill="#f97316"/><circle cx="7" cy="9" r="1.5" fill="#fff"/><path d="M4 13l3-3 2 2 3-4 4 5H4v0z" fill="#fff" opacity=".9"/></svg>',

        save: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#5b8def"/><rect x="7" y="3" width="8" height="6" rx="1" fill="#93c5fd"/><rect x="7" y="13" width="10" height="7" rx="1" fill="#fff"/><rect x="9" y="15" width="6" height="3" rx=".5" fill="#bfdbfe"/></svg>',

        download: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#14b8a6"/><path d="M14 3v4h4" fill="#5eead4"/><path d="M12 9v5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 12.5L12 15l2.5-2.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="8" y="17.5" width="8" height="2" rx="1" fill="#ccfbf1"/></svg>',

        folderOpen: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h6l2 2h10v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10a2 2 0 012-2z" fill="#fbbf24"/><path d="M4 8h6l2 2h10v2H4V8z" fill="#f59e0b"/></svg>',

        projects: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="7" rx="1.5" fill="#5b8def"/><rect x="13" y="4" width="8" height="7" rx="1.5" fill="#93c5fd"/><rect x="3" y="13" width="8" height="7" rx="1.5" fill="#34c759"/><rect x="13" y="13" width="8" height="7" rx="1.5" fill="#fbbf24"/></svg>',

        templates: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2" fill="#5b8def"/><rect x="13" y="3" width="8" height="8" rx="2" fill="#34c759"/><rect x="3" y="13" width="8" height="8" rx="2" fill="#fbbf24"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#ec4899"/><path d="M7 7h2v2H7V7zm10 0h2v2h-2V7zm-10 10h2v2H7v-2zm10 0h2v2h-2v-2z" fill="#fff" opacity=".85"/></svg>',

        files: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" fill="#14b8a6"/><rect x="6" y="10" width="12" height="2" rx="1" fill="#fff" opacity=".85"/><rect x="6" y="14" width="8" height="2" rx="1" fill="#fff" opacity=".85"/></svg>',

        paint: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 3-9 9H3v-3l9-9z" fill="#ec4899"/><path d="M15 5l4 4-2 2-4-4 2-2z" fill="#f472b6"/><ellipse cx="8" cy="19" rx="4" ry="2" fill="#a855f7"/></svg>',

        more: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="2" fill="#94a3b8"/><circle cx="12" cy="12" r="2" fill="#64748b"/><circle cx="18" cy="12" r="2" fill="#94a3b8"/></svg>',

        plus: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#34c759"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',

        console: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="#1e293b"/><path d="M6 9l3 3-3 3" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><rect x="11" y="14" width="7" height="2" rx="1" fill="#64748b"/><rect x="11" y="10" width="5" height="2" rx="1" fill="#64748b"/></svg>',

        book: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h8a2 2 0 012 2v14H8a2 2 0 01-2-2V4z" fill="#ef4444"/><path d="M16 6h2a1 1 0 011 1v12a2 2 0 01-2 2h-1V6z" fill="#fca5a5"/><rect x="8" y="8" width="6" height="1.5" rx=".5" fill="#fff" opacity=".8"/><rect x="8" y="11" width="5" height="1.5" rx=".5" fill="#fff" opacity=".8"/></svg>',

        code: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="#6366f1"/><path d="M9 9l-3 3 3 3M15 9l3 3-3 3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',

        history: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#0ea5e9"/><path d="M12 7v5l3 2" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M7 3a9 9 0 101.5 3.5" stroke="#bae6fd" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',

        settings: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="#64748b"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/></svg>',

        image: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="#38bdf8"/><circle cx="9" cy="10" r="1.5" fill="#fff"/><path d="M5 16l4-4 3 3 3-4 4 5H5z" fill="#fff" opacity=".9"/></svg>',

        sound: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 5V4L8 9H4z" fill="#8b5cf6"/><path d="M16 8a4 4 0 010 8" stroke="#c4b5fd" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18 6a7 7 0 010 12" stroke="#a78bfa" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',

        music: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="18" r="3" fill="#a855f7"/><circle cx="17" cy="16" r="3" fill="#c084fc"/><rect x="11" y="4" width="2" height="12" rx="1" fill="#7c3aed"/><rect x="11" y="4" width="7" height="2" rx="1" fill="#7c3aed"/></svg>',

        add: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#34c759"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',

        eye: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" fill="#0ea5e9"/><circle cx="12" cy="12" r="3" fill="#fff"/></svg>',

        edit: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h2l9-9-2-2-9 9v2z" fill="#f59e0b"/><path d="M14 5l3 3-2 2-3-3 2-2z" fill="#fbbf24"/></svg>',

        trash: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12l-1 12H7L6 7z" fill="#ef4444"/><path d="M9 4h6l1 2H8l1-2z" fill="#fca5a5"/></svg>',

        themeDark: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="#6366f1"/><path d="M12 3a9 9 0 100 18 7 7 0 010-18z" fill="#312e81"/></svg>',

        themeLight: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#fbbf24"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/></svg>',

        /* Плитки галереи (32×32) */
        gAdd: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#22c55e"/><path d="M16 10v12M10 16h12" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/></svg>',

        gView: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#0ea5e9"/><ellipse cx="16" cy="16" rx="8" ry="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>',

        gRename: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#f59e0b"/><path d="M9 23h3l9-9-3-3-9 9v3z" fill="#fff"/><path d="M20 10l2 2-2 2-2-2 2-2z" fill="#fde68a"/></svg>',

        gDraw: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#ec4899"/><path d="M10 22l8-8 4 4-8 8H10v-4z" fill="#fff"/><circle cx="22" cy="10" r="2.5" fill="#fbcfe8"/></svg>',

        gDelete: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#ef4444"/><path d="M12 11h8l-1 12H13L12 11z" fill="#fff"/><path d="M14 9h4l1 2h-6l1-2z" fill="#fecaca"/></svg>',

        gPlay: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#8b5cf6"/><path d="M13 10v12l9-6-9-6z" fill="#fff"/></svg>',

        gPause: '<svg class="pz-icon pz-icon-tile" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#8b5cf6"/><rect x="11" y="10" width="3.5" height="12" rx="1" fill="#fff"/><rect x="17.5" y="10" width="3.5" height="12" rx="1" fill="#fff"/></svg>',

        publish: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="3.5" fill="#8b5cf6"/><circle cx="6" cy="12" r="3.5" fill="#a78bfa"/><circle cx="18" cy="18.5" r="3.5" fill="#c084fc"/><path d="M9.1 10.4l5.8-2.7M9.1 13.6l5.8 2.7" stroke="#7c3aed" stroke-width="2.2" stroke-linecap="round"/></svg>',

        linkCopy: '<svg class="pz-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" fill="#0ea5e9"/><path d="M6 14a3 3 0 013-3h5" stroke="#7dd3fc" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M16 6a3 3 0 013 3v5a3 3 0 01-3 3" stroke="#bae6fd" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
    };

    function svg(name, size) {
        size = size || 22;
        var html = SVGS[name];
        if (!html) return '';
        return html.replace('<svg class="pz-icon"', '<svg class="pz-icon" width="' + size + '" height="' + size + '"');
    }

    function setButtonIcon(btn, name, size) {
        if (!btn) return;
        if (btn.classList.contains('tb-play')) name = 'playInv';
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
