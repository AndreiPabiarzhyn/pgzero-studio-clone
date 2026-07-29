/** Тема приложения: светлая / тёмная */
(function () {
    'use strict';

    var STORAGE_KEY = 'OPT_appTheme';

    function getTheme() {
        return localStorage[STORAGE_KEY] === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        theme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-app-theme', theme);
        localStorage[STORAGE_KEY] = theme;

        var btn = document.getElementById('btn_toggle_theme');
        if (btn && typeof PZIcon !== 'undefined') {
            PZIcon.setButtonIcon(btn, theme === 'dark' ? 'themeLight' : 'themeDark', 24);
            var tipKey = theme === 'dark' ? 'theme.light' : 'theme.dark';
            var tip = (typeof PGZI18n !== 'undefined' && PGZI18n.t)
                ? PGZI18n.t(tipKey)
                : (theme === 'dark' ? 'Светлая тема' : 'Тёмная тема');
            btn.setAttribute('data-tip', tip);
            btn.removeAttribute('title');
            if (typeof PZTooltip !== 'undefined') PZTooltip.scan(btn);
        }

        var radioLight = document.getElementById('radio_app_theme_light');
        var radioDark = document.getElementById('radio_app_theme_dark');
        if (radioLight) radioLight.checked = theme === 'light';
        if (radioDark) radioDark.checked = theme === 'dark';
    }

    function toggleTheme() {
        applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    }

    function init() {
        applyTheme(getTheme());

        var btn = document.getElementById('btn_toggle_theme');
        if (btn) btn.addEventListener('click', toggleTheme);

        var radioLight = document.getElementById('radio_app_theme_light');
        var radioDark = document.getElementById('radio_app_theme_dark');
        if (radioLight) {
            radioLight.addEventListener('change', function () {
                if (radioLight.checked) applyTheme('light');
            });
        }
        if (radioDark) {
            radioDark.addEventListener('change', function () {
                if (radioDark.checked) applyTheme('dark');
            });
        }
    }

    window.AppTheme = {
        init: init,
        apply: applyTheme,
        toggle: toggleTheme,
        get: getTheme
    };
})();
