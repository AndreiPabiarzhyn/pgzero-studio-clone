/** Локализация UI (фаза 1: стартовый экран). */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'pgz_lang';
  var SUPPORTED = ['ru', 'en', 'es'];
  var DEFAULT_LANG = 'ru';

  var currentLang = DEFAULT_LANG;
  var messages = {};
  var ready = false;
  var readyPromise = null;

  function normalizeLang(code) {
    var value = String(code || '').toLowerCase().split('-')[0];
    return SUPPORTED.indexOf(value) !== -1 ? value : DEFAULT_LANG;
  }

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeLang(saved);
    } catch (e) { /* ignore */ }
    var nav = (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || DEFAULT_LANG;
    return normalizeLang(nav);
  }

  function localeUrl(lang) {
    return './locales/' + lang + '.json';
  }

  function getByPath(obj, path) {
    var parts = String(path || '').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== 'object') return null;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : null;
  }

  function interpolate(text, params) {
    if (!params) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, key) {
      return params[key] != null ? String(params[key]) : '{' + key + '}';
    });
  }

  async function loadLocale(lang) {
    var normalized = normalizeLang(lang);
    var response = await fetch(localeUrl(normalized), { cache: 'no-store' });
    if (!response.ok) throw new Error('Locale load failed: ' + normalized);
    messages = await response.json();
    currentLang = normalized;
    ready = true;
    if (global.document && global.document.documentElement) {
      global.document.documentElement.lang = normalized;
    }
    return normalized;
  }

  function t(key, params) {
    var text = getByPath(messages, key);
    if (!text) return key;
    return interpolate(text, params);
  }

  function apply(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return;

    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });

    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });

    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', t(key));
    });
  }

  function updateLangButtons(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-lang]').forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      var active = lang === currentLang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function setLang(lang) {
    var normalized = normalizeLang(lang);
    await loadLocale(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (e) { /* ignore */ }
    apply(global.document.getElementById('projectStartupScreen'));
    updateLangButtons(global.document.getElementById('projectStartupScreen'));
    if (typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('pgz:langchange', { detail: { lang: normalized } }));
    }
    return normalized;
  }

  function bindStartupLangSwitch(root) {
    if (!root) return;
    root.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (!lang || lang === currentLang) return;
        setLang(lang).catch(function (err) {
          console.error('PGZI18n.setLang failed', err);
        });
      });
    });
    updateLangButtons(root);
  }

  async function init(lang) {
    if (readyPromise) return readyPromise;
    readyPromise = loadLocale(lang || detectLang()).then(function (normalized) {
      apply(global.document.getElementById('projectStartupScreen'));
      bindStartupLangSwitch(global.document.getElementById('projectStartupScreen'));
      return normalized;
    });
    return readyPromise;
  }

  global.PGZI18n = {
    init: init,
    setLang: setLang,
    t: t,
    apply: apply,
    getLang: function () { return currentLang; },
    isReady: function () { return ready; },
    bindStartupLangSwitch: bindStartupLangSwitch,
    SUPPORTED: SUPPORTED.slice()
  };

  global._pgzI18nTest = {
    normalizeLang: normalizeLang,
    interpolate: interpolate,
    getByPath: getByPath,
    t: t,
    messages: function () { return messages; },
    setMessages: function (obj) { messages = obj; ready = true; }
  };
})(window);
