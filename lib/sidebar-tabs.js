/** Вкладки боковой панели: Ресурсы | Справочник (как в Scratch) */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'OPT_sidebarTab';
    var TAB_ASSETS = 'assets';
    var TAB_HANDBOOK = 'handbook';

    function setActiveTab(tabId) {
        var tabs = global.document.querySelectorAll('[data-sidebar-tab]');
        for (var i = 0; i < tabs.length; i++) {
            var btn = tabs[i];
            var active = btn.getAttribute('data-sidebar-tab') === tabId;
            btn.classList.toggle('sidebar-tab--active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        }

        var assetsPanel = global.document.getElementById('sidebarPanelAssets');
        var handbookPanel = global.document.getElementById('sidebarPanelHandbook');
        if (assetsPanel) {
            assetsPanel.classList.toggle('sidebar-panel--active', tabId === TAB_ASSETS);
            assetsPanel.hidden = tabId !== TAB_ASSETS;
        }
        if (handbookPanel) {
            handbookPanel.classList.toggle('sidebar-panel--active', tabId === TAB_HANDBOOK);
            handbookPanel.hidden = tabId !== TAB_HANDBOOK;
        }

        try {
            global.localStorage[STORAGE_KEY] = tabId;
        } catch (_e) { /* ignore */ }
    }

    function switchTab(tabId) {
        if (tabId !== TAB_ASSETS && tabId !== TAB_HANDBOOK) {
            tabId = TAB_ASSETS;
        }
        setActiveTab(tabId);
        if (typeof global.PZTooltip !== 'undefined' && global.PZTooltip.hide) {
            global.PZTooltip.hide();
        }
        if (tabId === TAB_ASSETS && typeof global.initializeAssetsGallery === 'function') {
            return global.initializeAssetsGallery();
        }
        return Promise.resolve();
    }

    function init() {
        var saved = TAB_ASSETS;
        try {
            saved = global.localStorage[STORAGE_KEY] || TAB_ASSETS;
        } catch (_e) { /* ignore */ }
        if (saved !== TAB_HANDBOOK) saved = TAB_ASSETS;

        var tabs = global.document.querySelectorAll('[data-sidebar-tab]');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                switchTab(this.getAttribute('data-sidebar-tab'));
            });
        }

        setActiveTab(saved);
    }

    global.PGZSidebarTabs = {
        init: init,
        switchTab: switchTab,
        TAB_ASSETS: TAB_ASSETS,
        TAB_HANDBOOK: TAB_HANDBOOK
    };

    global.showGallery = function () {
        return switchTab(TAB_ASSETS);
    };

    global.showHandbook = function () {
        return switchTab(TAB_HANDBOOK);
    };

    global.hideGallery = function () { /* вкладки заменяют скрытие галереи */ };

    global.toggleShowGallery = function () {
        var current = TAB_ASSETS;
        try {
            current = global.localStorage[STORAGE_KEY] || TAB_ASSETS;
        } catch (_e) { /* ignore */ }
        return switchTab(current === TAB_ASSETS ? TAB_HANDBOOK : TAB_ASSETS);
    };
})(window);
