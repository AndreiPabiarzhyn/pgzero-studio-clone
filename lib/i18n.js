/** Локализация UI */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'pgz_lang';
  var SUPPORTED = ['ru', 'en', 'es'];
  var DEFAULT_LANG = 'ru';

  var LOCALE_MAP = { ru: 'ru-RU', en: 'en-US', es: 'es-ES' };

  var currentLang = DEFAULT_LANG;
  var messages = {};
  var ready = false;
  var readyPromise = null;
  var langSwitchBound = false;

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

  function uiText(key, params, fallback) {
    var text = t(key, params);
    if (text && text !== key) return text;
    return fallback != null ? fallback : key;
  }

  function plural(baseKey, count) {
    var n = Number(count) || 0;
    if (currentLang === 'ru') {
      var mod10 = n % 10;
      var mod100 = n % 100;
      var form = (mod10 === 1 && mod100 !== 11) ? 'One'
        : (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) ? 'Few'
        : 'Many';
      var text = getByPath(messages, baseKey + form);
      if (text) return interpolate(text, { n: n });
    }
    var fallback = getByPath(messages, n === 1 ? baseKey + 'One' : baseKey + 'Other');
    if (fallback) return interpolate(fallback, { n: n });
    return String(n);
  }

  function getLocaleTag() {
    return LOCALE_MAP[currentLang] || LOCALE_MAP.ru;
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
      if (!key) return;
      var text = t(key);
      if (typeof global.PZTooltip !== 'undefined') {
        el.removeAttribute('title');
        el.removeAttribute('data-tip');
      } else if (text && text !== key) {
        el.setAttribute('title', text);
      }
    });

    scope.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria-label');
      if (key) el.setAttribute('aria-label', t(key));
    });

    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      if (!key) return;
      var html = t(key);
      if (html && html !== key) el.innerHTML = html;
    });
  }

  function applyAll() {
    apply(global.document);
    if (typeof global.AppTheme !== 'undefined' && global.AppTheme.apply) {
      global.AppTheme.apply(global.AppTheme.get());
    }
    if (typeof global.PGZSession !== 'undefined' && global.PGZSession.refreshFooterStatus) {
      global.PGZSession.refreshFooterStatus();
    }
    if (typeof global.PZTooltip !== 'undefined' && global.PZTooltip.refresh) {
      global.PZTooltip.refresh(global.document);
    }
  }

  function updateLangButtons(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return;

    var badge = global.document.getElementById('editorLangBadge');
    if (badge) badge.textContent = currentLang.toUpperCase();

    scope.querySelectorAll('[data-lang]').forEach(function (btn) {
      var lang = btn.getAttribute('data-lang');
      var active = lang === currentLang;
      if (btn.classList.contains('pg-lang-switch__btn')) {
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      if (btn.classList.contains('more-menu-lang__option')) {
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      }
    });
  }

  function closeEditorLangMenu() {
    var menu = global.document.getElementById('editorLangMenu');
    var trigger = global.document.getElementById('btn_editor_lang');
    if (menu) menu.hidden = true;
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('is-open');
    }
  }

  function bindEditorLangMenu() {
    var trigger = global.document.getElementById('btn_editor_lang');
    var menu = global.document.getElementById('editorLangMenu');
    if (!trigger || !menu || trigger.dataset.bound) return;
    trigger.dataset.bound = '1';

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = menu.hidden;
      closeEditorLangMenu();
      if (willOpen) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('is-open');
      }
    });
  }

  function bindLangSwitch() {
    if (langSwitchBound || !global.document) return;
    langSwitchBound = true;

    bindEditorLangMenu();

    global.document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
      if (!btn) return;
      var lang = btn.getAttribute('data-lang');
      if (!lang) return;

      if (lang === currentLang) {
        if (btn.closest('#editorLangMenu')) closeEditorLangMenu();
        return;
      }

      setLang(lang).then(function () {
        closeEditorLangMenu();
        if (typeof global.closeMoreMenu === 'function') global.closeMoreMenu();
      }).catch(function (err) {
        console.error('PGZI18n.setLang failed', err);
      });
    });
    updateLangButtons(global.document);
  }

  async function setLang(lang) {
    var normalized = normalizeLang(lang);
    await loadLocale(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch (e) { /* ignore */ }
    applyAll();
    updateLangButtons(global.document);
    if (typeof global.dispatchEvent === 'function') {
      global.dispatchEvent(new CustomEvent('pgz:langchange', { detail: { lang: normalized } }));
    }
    return normalized;
  }

  async function init(lang) {
    if (readyPromise) return readyPromise;
    readyPromise = loadLocale(lang || detectLang()).then(function (normalized) {
      bindLangSwitch();
      applyAll();
      return normalized;
    });
    return readyPromise;
  }

  global.PGZI18n = {
    init: init,
    setLang: setLang,
    t: t,
    uiText: uiText,
    plural: plural,
    apply: apply,
    applyAll: applyAll,
    closeEditorLangMenu: closeEditorLangMenu,
    getLang: function () { return currentLang; },
    getLocaleTag: getLocaleTag,
    isReady: function () { return ready; },
    SUPPORTED: SUPPORTED.slice()
  };

  global._pgzI18nTest = {
    normalizeLang: normalizeLang,
    interpolate: interpolate,
    getByPath: getByPath,
    t: t,
    plural: plural,
    messages: function () { return messages; },
    setMessages: function (obj) { messages = obj; ready = true; currentLang = 'en'; }
  };
})(window);
