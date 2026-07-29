/** Библиотека звуков: Scratch + Kenney (CC0) */
(function () {
  'use strict';

  var SCRATCH_SOUNDS_JSON = 'https://cdn.jsdelivr.net/npm/scratch-gui@5.0.0/dist/libraries/sounds.json';
  var GAME_SOUNDS_JSON = './assets/sound-library/game-sounds.json';
  var SCRATCH_CDN = 'https://cdn.assets.scratch.mit.edu/internalapi/asset/';

  var KENNEY_BASE = {
    'kenney-interface': 'https://cdn.jsdelivr.net/gh/Calinou/kenney-interface-sounds@master/addons/kenney_interface_sounds/',
    'kenney-impact': 'https://cdn.jsdelivr.net/gh/Boyquotes/kenney-impact-sounds-for-godot@main/addons/kenney%20impact%20sounds/'
  };

  var TAG_LABELS = {
    game: 'Для игры',
    effects: 'Эффекты',
    animals: 'Животные',
    music: 'Ноты',
    wacky: 'Смешные',
    human: 'Люди',
    percussion: 'Ударные',
    space: 'Космос',
    cartoon: 'Мультфильм',
    sports: 'Спорт',
    electronic: 'Электроника',
    loops: 'Петли',
    notes: 'Ноты',
    chords: 'Аккорды',
    instruments: 'Инструменты',
    voice: 'Голос',
    other: 'Разное'
  };

  var GAME_GROUP_LABELS = {
    all: 'Все',
    ui: 'Кнопки',
    player: 'Персонаж',
    combat: 'Бой',
    items: 'Предметы',
    life: 'Жизнь',
    game: 'Игра'
  };

  var CATEGORY_ORDER = [
    'effects', 'animals', 'wacky', 'cartoon', 'human', 'percussion',
    'space', 'sports', 'electronic', 'music', 'other'
  ];

  function assetVersion() {
    return (typeof PGZRUN_ASSET_VERSION !== 'undefined') ? PGZRUN_ASSET_VERSION : '1';
  }

  function currentLang() {
    return (typeof PGZI18n !== 'undefined' && PGZI18n.getLang) ? PGZI18n.getLang() : 'ru';
  }

  var items = [];
  var gameSounds = [];
  var soundLabels = {};
  var loadedLabelsLang = '';
  var categories = [];
  var currentCategory = 'game';
  var currentGameGroup = 'all';
  var searchQuery = '';
  var selectedSound = null;
  var previewAudio = null;
  var previewingKey = null;

  function scratchSoundUrl(md5ext) {
    return SCRATCH_CDN + encodeURIComponent(md5ext) + '/get/';
  }

  function getEntryExt(entry) {
    if (entry.file) {
      var dot = entry.file.lastIndexOf('.');
      if (dot !== -1) return entry.file.slice(dot + 1).toLowerCase();
    }
    return 'wav';
  }

  function resolveGameSoundUrl(entry) {
    if (entry.source === 'scratch') {
      return scratchSoundUrl(entry.md5ext);
    }
    var base = KENNEY_BASE[entry.source];
    if (!base || !entry.file) {
      throw new Error('Неизвестный источник: ' + entry.source);
    }
    return base + entry.file;
  }

  function mimeForExt(ext) {
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'mp3') return 'audio/mpeg';
    return 'audio/wav';
  }

  async function fetchPlayableSoundBuffer(sound) {
    var url = sound.url;
    if (!url && sound.md5ext) url = scratchSoundUrl(sound.md5ext);
    if (!url) throw new Error('URL звука не задан');

    var response = await fetch(url);
    if (!response.ok) throw new Error('Не удалось скачать звук');
    var arrayBuffer = await response.arrayBuffer();
    var ext = sound.ext || 'wav';

    if (ext !== 'wav') return arrayBuffer;

    if (typeof WavAdpcm !== 'undefined') {
      var result = WavAdpcm.ensurePlayableWav(arrayBuffer);
      return result.buffer;
    }
    if (sound.dataFormat === 'adpcm') {
      throw new Error('ADPCM не поддерживается');
    }
    return arrayBuffer;
  }

  function bufferToDataUrl(arrayBuffer, ext) {
    var bytes = new Uint8Array(arrayBuffer);
    var binary = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:' + mimeForExt(ext || 'wav') + ';base64,' + btoa(binary);
  }

  function bufferToObjectUrl(arrayBuffer, ext) {
    return URL.createObjectURL(new Blob([arrayBuffer], { type: mimeForExt(ext || 'wav') }));
  }

  function sanitizeSoundFilename(name) {
    var base = String(name || 'sound').trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\u0400-\u04FF-]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    if (!base) base = 'sound';
    return base + '.wav';
  }

  function soundPrimaryTag(sound) {
    var tags = sound.tags || [];
    if (!tags.length) return 'other';
    for (var i = 0; i < CATEGORY_ORDER.length; i++) {
      if (tags.indexOf(CATEGORY_ORDER[i]) !== -1) return CATEGORY_ORDER[i];
    }
    return tags[0];
  }

  async function loadSoundLabels(lang) {
    var normalized = lang || currentLang();
    if (normalized === 'ru') {
      soundLabels = {};
      loadedLabelsLang = 'ru';
      return;
    }
    if (loadedLabelsLang === normalized && Object.keys(soundLabels).length) return;
    try {
      var url = './locales/sound-labels.' + normalized + '.json?v=' + assetVersion();
      var response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      soundLabels = await response.json();
      loadedLabelsLang = normalized;
    } catch (err) {
      console.warn('Sound labels load failed', err);
      soundLabels = {};
      loadedLabelsLang = normalized;
    }
  }

  function soundDisplayName(entry) {
    if (currentLang() !== 'ru' && soundLabels[entry.id]) {
      return soundLabels[entry.id];
    }
    return entry.label;
  }

  function mapGameSoundEntry(entry) {
    return {
      name: soundDisplayName(entry),
      importName: entry.id,
      group: entry.group,
      scratchName: entry.scratchName || entry.file || '',
      isGamePack: true,
      source: entry.source,
      url: resolveGameSoundUrl(entry),
      ext: getEntryExt(entry),
      previewKey: entry.id,
      md5ext: entry.md5ext || entry.file || entry.id
    };
  }

  function buildCategories(list) {
    var ordered = ['game'];
    var set = new Set(['game']);
    list.forEach(function (s) {
      set.add(soundPrimaryTag(s));
    });
    CATEGORY_ORDER.forEach(function (c) {
      if (set.has(c)) ordered.push(c);
    });
    set.forEach(function (c) {
      if (ordered.indexOf(c) === -1) ordered.push(c);
    });
    return ordered;
  }

  function L(key, params, fallback) {
    if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
      return PGZI18n.uiText(key, params, fallback);
    }
    return fallback != null ? fallback : key;
  }

  function tagLabel(tag) {
    return L('library.soundTags.' + tag, null, TAG_LABELS[tag] || tag);
  }

  function gameGroupLabel(group) {
    return L('library.soundGameGroups.' + group, null, GAME_GROUP_LABELS[group] || group);
  }

  function isSameSoundSelection(a, b) {
    if (!a || !b) return false;
    if (a.previewKey && b.previewKey) return a.previewKey === b.previewKey;
    return a.md5ext === b.md5ext;
  }

  function resetPreviewPlayButtons() {
    document.querySelectorAll('#soundLibraryGrid .sound-library-play').forEach(function (btn) {
      if (typeof PZIcon !== 'undefined') PZIcon.setLibraryPlayButton(btn, false);
    });
  }

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause();
      if (previewAudio._objectUrl) {
        URL.revokeObjectURL(previewAudio._objectUrl);
      }
      previewAudio = null;
    }
    previewingKey = null;
    document.querySelectorAll('.sound-library-item.is-previewing').forEach(function (el) {
      el.classList.remove('is-previewing');
    });
    resetPreviewPlayButtons();
  }

  async function openSoundLibraryModal() {
    var modal = document.getElementById('soundLibraryModal');
    if (!modal) return;
    modal.style.display = 'flex';
    searchQuery = '';
    currentGameGroup = 'all';
    var searchInput = document.getElementById('soundLibrarySearch');
    if (searchInput) searchInput.value = '';
    await loadSoundLibrary();
  }

  function closeSoundLibraryModal() {
    stopPreview();
    selectedSound = null;
    var modal = document.getElementById('soundLibraryModal');
    if (modal) modal.style.display = 'none';
    var importBtn = document.getElementById('soundLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'none';
    document.querySelectorAll('.sound-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
  }

  async function loadSoundLibrary() {
    var grid = document.getElementById('soundLibraryGrid');
    var cats = document.getElementById('soundLibraryCategories');
    if (!grid || !cats) return;

    if (!items.length || !gameSounds.length) {
      grid.innerHTML = '<div class="sound-library-status">' + L('library.loadingSounds', null, 'Загрузка библиотеки…') + '</div>';
      cats.innerHTML = '';
      try {
        var requests = [];
        requests.push(items.length
          ? Promise.resolve(items)
          : fetch(SCRATCH_SOUNDS_JSON).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          }));
        requests.push(gameSounds.length
          ? Promise.resolve(gameSounds)
          : fetch(GAME_SOUNDS_JSON).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
          }));

        var results = await Promise.all(requests);
        items = results[0];
        gameSounds = results[1];
        categories = buildCategories(items);
        if (categories.indexOf(currentCategory) === -1) {
          currentCategory = 'game';
        }
      } catch (err) {
        grid.innerHTML = '<div class="sound-library-status sound-library-error">' + L('library.loadErrorNetwork', null, 'Не удалось загрузить библиотеку.\nПроверьте интернет.').replace(/\n/g, '<br>') + '</div>';
        console.error(err);
        return;
      }
    }

    await loadSoundLabels(currentLang());
    renderSoundLibrary();
  }

  function filteredSounds() {
    var q = searchQuery.trim().toLowerCase();
    if (currentCategory === 'game') {
      return gameSounds
        .map(mapGameSoundEntry)
        .filter(function (s) {
          if (currentGameGroup !== 'all' && s.group !== currentGameGroup) return false;
          if (!q) return true;
          return s.name.toLowerCase().indexOf(q) !== -1 ||
            (s.scratchName && s.scratchName.toLowerCase().indexOf(q) !== -1) ||
            (s.importName && s.importName.toLowerCase().indexOf(q) !== -1);
        });
    }
    return items.filter(function (s) {
      if (currentCategory !== 'all' && soundPrimaryTag(s) !== currentCategory) return false;
      if (!q) return true;
      return s.name.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderSoundLibraryCategories() {
    var container = document.getElementById('soundLibraryCategories');
    if (!container) return;
    container.innerHTML = '';

    var gameBtn = document.createElement('button');
    gameBtn.type = 'button';
    gameBtn.className = 'sound-library-cat sound-library-cat-game' + (currentCategory === 'game' ? ' active' : '');
    gameBtn.textContent = tagLabel('game');
    gameBtn.addEventListener('click', function () {
      currentCategory = 'game';
      renderSoundLibrary();
    });
    container.appendChild(gameBtn);

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'sound-library-cat' + (currentCategory === 'all' ? ' active' : '');
    allBtn.textContent = L('library.all', null, 'Все');
    allBtn.addEventListener('click', function () {
      currentCategory = 'all';
      renderSoundLibrary();
    });
    container.appendChild(allBtn);

    categories.forEach(function (cat) {
      if (cat === 'game') return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-library-cat' + (currentCategory === cat ? ' active' : '');
      btn.textContent = tagLabel(cat);
      btn.addEventListener('click', function () {
        currentCategory = cat;
        renderSoundLibrary();
      });
      container.appendChild(btn);
    });
  }

  function renderGameGroups() {
    var container = document.getElementById('soundLibraryGroups');
    if (!container) return;
    container.innerHTML = '';
    if (currentCategory !== 'game') {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    Object.keys(GAME_GROUP_LABELS).forEach(function (group) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-library-group' + (currentGameGroup === group ? ' active' : '');
      btn.textContent = gameGroupLabel(group);
      btn.addEventListener('click', function () {
        currentGameGroup = group;
        renderSoundLibrary();
      });
      container.appendChild(btn);
    });
  }

  function renderSoundLibrary() {
    renderSoundLibraryCategories();
    renderGameGroups();
    var grid = document.getElementById('soundLibraryGrid');
    if (!grid) return;

    var list = filteredSounds();
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = '<div class="sound-library-status">' + L('library.notFound', null, 'Ничего не найдено') + '</div>';
      return;
    }

    list.forEach(function (sound) {
      var item = document.createElement('div');
      item.className = 'sound-library-item' + (sound.isGamePack ? ' sound-library-item-game' : '');
      item.dataset.key = sound.previewKey || sound.md5ext;
      if (selectedSound && isSameSoundSelection(selectedSound, sound)) {
        item.classList.add('selected');
      }
      if (previewingKey === (sound.previewKey || sound.md5ext)) {
        item.classList.add('is-previewing');
      }

      var playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'sound-library-play';
      playBtn.title = L('library.preview', null, 'Послушать');
      playBtn.setAttribute('aria-label', L('library.previewNamed', { name: sound.name }, 'Послушать ' + sound.name));
      var soundKey = sound.previewKey || sound.md5ext;
      if (typeof PZIcon !== 'undefined') {
        PZIcon.setLibraryPlayButton(playBtn, previewingKey === soundKey);
      } else {
        playBtn.textContent = previewingKey === soundKey ? '⏸' : '▶';
      }
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        previewSound(sound, item);
      });

      var label = document.createElement('div');
      label.className = 'sound-library-name';
      label.textContent = sound.name;
      label.title = sound.isGamePack
        ? L('library.soundCodeHint', { name: sound.name, code: sound.importName },
          sound.name + ' → sounds.' + sound.importName + '.play()')
        : sound.name;

      item.appendChild(playBtn);
      item.appendChild(label);

      item.addEventListener('click', function () {
        selectSound(sound, item);
      });

      grid.appendChild(item);
    });
  }

  function selectSound(sound, element) {
    selectedSound = sound;
    document.querySelectorAll('.sound-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
    if (element) element.classList.add('selected');
    var importBtn = document.getElementById('soundLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'inline-block';
  }

  async function previewSound(sound, element) {
    var key = sound.previewKey || sound.md5ext;
    if (previewingKey === key) {
      stopPreview();
      return;
    }
    stopPreview();
    previewingKey = key;
    if (element) {
      element.classList.add('is-previewing');
      var playBtn = element.querySelector('.sound-library-play');
      if (typeof PZIcon !== 'undefined') PZIcon.setLibraryPlayButton(playBtn, true);
      else if (playBtn) playBtn.textContent = '⏸';
    }

    try {
      var playableBuffer = await fetchPlayableSoundBuffer(sound);
      var objectUrl = bufferToObjectUrl(playableBuffer, sound.ext);
      previewAudio = new Audio(objectUrl);
      previewAudio._objectUrl = objectUrl;
      previewAudio.onended = stopPreview;
      previewAudio.onerror = stopPreview;
      await previewAudio.play();
    } catch (err) {
      stopPreview();
      console.error('Sound preview failed:', sound.name, err);
      if (typeof message === 'function') {
        await message('', L('library.previewFailed', null, 'Не удалось воспроизвести звук'));
      }
    }
  }

  async function importSelectedSound() {
    if (!selectedSound) return;

    try {
      if (typeof initFS === 'function') await initFS();
      var fsRef = window.jsfs || fs;
      if (!fsRef) throw new Error('Файловая система не готова');

      var ext = selectedSound.ext || 'wav';
      var playableBuffer = await fetchPlayableSoundBuffer(selectedSound);
      var dataUrl = bufferToDataUrl(playableBuffer, ext);

      if (typeof PGZStorageGuard !== 'undefined') {
        var guardName = (selectedSound.importName || 'sound') + '.' + ext;
        PGZStorageGuard.checkAudioFile({ name: guardName, size: playableBuffer.byteLength }, false);
        await PGZStorageGuard.warnIfStorageHigh();
      }

      var name;
      var baseName;
      if (selectedSound.importName) {
        baseName = selectedSound.importName;
        name = baseName + '.' + ext;
      } else {
        name = sanitizeSoundFilename(selectedSound.name);
        baseName = name.replace(/\.[^.]+$/, '');
      }

      var dotExt = '.' + ext;
      var counter = 1;
      while (await fsRef.type('/sounds/' + name) === 'file') {
        name = baseName + ' (' + counter++ + ')' + dotExt;
      }

      await fsRef.write('/sounds/' + name, dataUrl);

      if (typeof refreshGallery === 'function') await refreshGallery();
      if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
      if (typeof showGallery === 'function') await showGallery();

      var displayName = selectedSound.name;
      var codeName = baseName.replace(/[^\w]/g, '_');
      closeSoundLibraryModal();
      if (typeof message === 'function') {
        await message(
          L('library.soundAdded', null, 'Звук добавлен'),
          L('library.soundAddedBody', { name: displayName, file: name, code: codeName },
            '«' + displayName + '» сохранён как ' + name + '.\n\nВ коде:\nsounds.' + codeName + '.play()')
        );
      }
    } catch (err) {
      console.error(err);
      if (typeof message === 'function') {
        await message('', L('library.importError', { detail: err.message || err }, 'Ошибка импорта:\n' + (err.message || err)));
      }
    }
  }

  function onSearchInput(e) {
    searchQuery = e.target.value || '';
    renderSoundLibrary();
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pgz:langchange', function () {
      loadSoundLabels(currentLang()).then(function () {
        var modal = document.getElementById('soundLibraryModal');
        if (modal && modal.style.display === 'flex') renderSoundLibrary();
      });
    });
  }

  window.openSoundLibraryModal = openSoundLibraryModal;
  window.closeSoundLibraryModal = closeSoundLibraryModal;
  window.importSelectedSound = importSelectedSound;

  function bindSoundLibraryUi() {
    var search = document.getElementById('soundLibrarySearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', onSearchInput);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSoundLibraryUi);
  } else {
    bindSoundLibraryUi();
  }

  window._soundLibraryTest = {
    sanitizeSoundFilename: sanitizeSoundFilename,
    soundPrimaryTag: soundPrimaryTag,
    scratchSoundUrl: scratchSoundUrl,
    mapGameSoundEntry: mapGameSoundEntry,
    soundDisplayName: soundDisplayName,
    setSoundLabels: function (labels, lang) {
      soundLabels = labels || {};
      loadedLabelsLang = lang || 'en';
    },
    buildCategories: buildCategories,
    resolveGameSoundUrl: resolveGameSoundUrl,
    getEntryExt: getEntryExt,
    mimeForExt: mimeForExt,
    GAME_GROUP_LABELS: GAME_GROUP_LABELS
  };
})();
