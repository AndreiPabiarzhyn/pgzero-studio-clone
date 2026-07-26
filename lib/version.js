/**
 * Версия приложения — читается из version.json.
 */
(function (global) {
    'use strict';

    async function load() {
        try {
            var res = await fetch('./version.json?ts=' + Date.now());
            if (!res.ok) return null;
            var data = await res.json();
            var version = data && data.version ? String(data.version) : null;
            if (!version) return null;

            global.PGZ_VERSION = version;

            var el = document.getElementById('footerVersion');
            if (el) {
                el.textContent = 'v' + version;
                el.title = 'PGZero Studio v' + version;
            }
            return version;
        } catch (e) {
            console.warn('PGZVersion: load failed', e);
            return null;
        }
    }

    global.PGZVersion = { load: load };
})(window);
