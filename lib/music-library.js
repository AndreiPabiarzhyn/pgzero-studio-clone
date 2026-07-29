/** Библиотека музыки для игр: Scratch loops + Kenney (CC0) */
(function () {
  'use strict';

  var GAME_MUSIC_JSON = './assets/sound-library/game-music.json';
  var SCRATCH_CDN = 'https://cdn.assets.scratch.mit.edu/internalapi/asset/';
  var KENNEY_MIRROR = 'https://cdn.jsdelivr.net/gh/ETdoFresh/kenney.nl@master/';

  function assetVersion() {
    return (typeof PGZRUN_ASSET_VERSION !== 'undefined') ? PGZRUN_ASSET_VERSION : '1';
  }

  function currentLang() {
    return (typeof PGZI18n !== 'undefined' && PGZI18n.getLang) ? PGZI18n.getLang() : 'ru';
  }

  var MUSIC_GROUP_LABELS = {
    all: 'Все',
    menu: 'Меню',
    action: 'Экшен',
    calm: 'Спокойная',
    retro: 'Ретро',
    jingle: 'Джинглы'
  };

  function L(key, params, fallback) {
    if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
      return PGZI18n.uiText(key, params, fallback);
    }
    return fallback != null ? fallback : key;
  }

  function musicGroupLabel(group) {
    return L('library.musicGroups.' + group, null, MUSIC_GROUP_LABELS[group] || group);
  }

  var tracks = [];
  var musicLabels = {};
  var loadedLabelsLang = '';
  var currentGroup = 'all';
  var searchQuery = '';
  var selectedTrack = null;
  var previewAudio = null;
  var previewingKey = null;

  function scratchSoundUrl(md5ext) {
    return SCRATCH_CDN + encodeURIComponent(md5ext) + '/get/';
  }

  function kenneyMirrorUrl(relativePath) {
    return KENNEY_MIRROR + relativePath.split('/').map(encodeURIComponent).join('/');
  }

  function getEntryExt(entry) {
    if (entry.file) {
      var dot = entry.file.lastIndexOf('.');
      if (dot !== -1) return entry.file.slice(dot + 1).toLowerCase();
    }
    return 'wav';
  }

  function resolveTrackUrl(entry) {
    if (entry.source === 'scratch') return scratchSoundUrl(entry.md5ext);
    if (entry.source === 'kenney-mirror') return kenneyMirrorUrl(entry.file);
    if (entry.source === 'local') return './' + String(entry.file).replace(/^\.\//, '');
    throw new Error('Неизвестный источник: ' + entry.source);
  }

  function mimeForExt(ext) {
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'mp3') return 'audio/mpeg';
    return 'audio/wav';
  }

  async function loadMusicLabels(lang) {
    var normalized = lang || currentLang();
    if (normalized === 'ru') {
      musicLabels = {};
      loadedLabelsLang = 'ru';
      return;
    }
    if (loadedLabelsLang === normalized && Object.keys(musicLabels).length) return;
    try {
      var url = './locales/music-labels.' + normalized + '.json?v=' + assetVersion();
      var response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      musicLabels = await response.json();
      loadedLabelsLang = normalized;
    } catch (err) {
      console.warn('Music labels load failed', err);
      musicLabels = {};
      loadedLabelsLang = normalized;
    }
  }

  function musicDisplayName(entry) {
    if (currentLang() !== 'ru' && musicLabels[entry.id]) {
      return musicLabels[entry.id];
    }
    return entry.label;
  }

  function mapMusicEntry(entry) {
    return {
      name: musicDisplayName(entry),
      importName: entry.id,
      group: entry.group,
      scratchName: entry.scratchName || entry.file || '',
      url: resolveTrackUrl(entry),
      ext: getEntryExt(entry),
      previewKey: entry.id
    };
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

  async function fetchPlayableTrackBuffer(track) {
    var response = await fetch(track.url);
    if (!response.ok) throw new Error('Не удалось скачать трек');
    var arrayBuffer = await response.arrayBuffer();
    if ((track.ext || 'wav') !== 'wav') return arrayBuffer;
    if (typeof WavAdpcm !== 'undefined') {
      return WavAdpcm.ensurePlayableWav(arrayBuffer).buffer;
    }
    return arrayBuffer;
  }

  function resetPreviewPlayButtons() {
    document.querySelectorAll('#musicLibraryGrid .sound-library-play').forEach(function (btn) {
      if (typeof PZIcon !== 'undefined') PZIcon.setLibraryPlayButton(btn, false);
    });
  }

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause();
      if (previewAudio._objectUrl) URL.revokeObjectURL(previewAudio._objectUrl);
      previewAudio = null;
    }
    previewingKey = null;
    document.querySelectorAll('#musicLibraryGrid .sound-library-item.is-previewing').forEach(function (el) {
      el.classList.remove('is-previewing');
    });
    resetPreviewPlayButtons();
  }

  async function openMusicLibraryModal() {
    var modal = document.getElementById('musicLibraryModal');
    if (!modal) return;
    modal.style.display = 'flex';
    searchQuery = '';
    currentGroup = 'all';
    var searchInput = document.getElementById('musicLibrarySearch');
    if (searchInput) searchInput.value = '';
    await loadMusicLibrary();
  }

  function closeMusicLibraryModal() {
    stopPreview();
    selectedTrack = null;
    var modal = document.getElementById('musicLibraryModal');
    if (modal) modal.style.display = 'none';
    var importBtn = document.getElementById('musicLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'none';
    document.querySelectorAll('#musicLibraryGrid .sound-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
  }

  async function loadMusicLibrary() {
    var grid = document.getElementById('musicLibraryGrid');
    if (!grid) return;

    if (!tracks.length) {
      grid.innerHTML = '<div class="sound-library-status">' + L('library.loadingMusic', null, 'Загрузка музыки…') + '</div>';
      try {
        var response = await fetch(GAME_MUSIC_JSON);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        tracks = await response.json();
      } catch (err) {
        grid.innerHTML = '<div class="sound-library-status sound-library-error">' + L('library.loadErrorNetwork', null, 'Не удалось загрузить библиотеку.\nПроверьте интернет.').replace(/\n/g, '<br>') + '</div>';
        console.error(err);
        return;
      }
    }

    await loadMusicLabels(currentLang());
    renderMusicLibrary();
  }

  function filteredTracks() {
    var q = searchQuery.trim().toLowerCase();
    return tracks.map(mapMusicEntry).filter(function (t) {
      if (currentGroup !== 'all' && t.group !== currentGroup) return false;
      if (!q) return true;
      return t.name.toLowerCase().indexOf(q) !== -1 ||
        t.importName.toLowerCase().indexOf(q) !== -1 ||
        (t.scratchName && t.scratchName.toLowerCase().indexOf(q) !== -1);
    });
  }

  function renderMusicGroups() {
    var container = document.getElementById('musicLibraryGroups');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(MUSIC_GROUP_LABELS).forEach(function (group) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-library-group' + (currentGroup === group ? ' active' : '');
      btn.textContent = musicGroupLabel(group);
      btn.addEventListener('click', function () {
        currentGroup = group;
        renderMusicLibrary();
      });
      container.appendChild(btn);
    });
  }

  function renderMusicLibrary() {
    renderMusicGroups();
    var grid = document.getElementById('musicLibraryGrid');
    if (!grid) return;

    var list = filteredTracks();
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = '<div class="sound-library-status">' + L('library.notFound', null, 'Ничего не найдено') + '</div>';
      return;
    }

    list.forEach(function (track) {
      var item = document.createElement('div');
      item.className = 'sound-library-item sound-library-item-game';
      item.dataset.key = track.previewKey;
      if (selectedTrack && selectedTrack.previewKey === track.previewKey) {
        item.classList.add('selected');
      }
      if (previewingKey === track.previewKey) {
        item.classList.add('is-previewing');
      }

      var playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'sound-library-play';
      playBtn.title = L('library.preview', null, 'Послушать');
      playBtn.setAttribute('aria-label', L('library.previewNamed', { name: track.name }, 'Послушать ' + track.name));
      if (typeof PZIcon !== 'undefined') {
        PZIcon.setLibraryPlayButton(playBtn, previewingKey === track.previewKey);
      } else {
        playBtn.textContent = previewingKey === track.previewKey ? '⏸' : '▶';
      }
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        previewTrack(track, item);
      });

      var label = document.createElement('div');
      label.className = 'sound-library-name';
      label.textContent = track.name;
      label.title = L('library.musicCodeHint', { name: track.name, code: track.importName },
        track.name + ' → music.play(\'' + track.importName + '\')');

      item.appendChild(playBtn);
      item.appendChild(label);
      item.addEventListener('click', function () {
        selectTrack(track, item);
      });
      grid.appendChild(item);
    });
  }

  function selectTrack(track, element) {
    selectedTrack = track;
    document.querySelectorAll('#musicLibraryGrid .sound-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
    if (element) element.classList.add('selected');
    var importBtn = document.getElementById('musicLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'inline-block';
  }

  async function previewTrack(track, element) {
    if (previewingKey === track.previewKey) {
      stopPreview();
      return;
    }
    stopPreview();
    previewingKey = track.previewKey;
    if (element) {
      element.classList.add('is-previewing');
      var playBtn = element.querySelector('.sound-library-play');
      if (typeof PZIcon !== 'undefined') PZIcon.setLibraryPlayButton(playBtn, true);
      else if (playBtn) playBtn.textContent = '⏸';
    }

    try {
      var buffer = await fetchPlayableTrackBuffer(track);
      var objectUrl = bufferToObjectUrl(buffer, track.ext);
      previewAudio = new Audio(objectUrl);
      previewAudio._objectUrl = objectUrl;
      previewAudio.loop = track.group !== 'jingle';
      previewAudio.onended = function () {
        if (!previewAudio || !previewAudio.loop) stopPreview();
      };
      previewAudio.onerror = stopPreview;
      await previewAudio.play();
    } catch (err) {
      stopPreview();
      console.error('Music preview failed:', track.name, err);
      if (typeof message === 'function') {
        await message('', L('library.previewFailed', null, 'Не удалось воспроизвести музыку'));
      }
    }
  }

  async function importSelectedMusic() {
    if (!selectedTrack) return;

    try {
      if (typeof initFS === 'function') await initFS();
      var fsRef = window.jsfs || fs;
      if (!fsRef) throw new Error('Файловая система не готова');

      var ext = selectedTrack.ext || 'wav';
      var buffer = await fetchPlayableTrackBuffer(selectedTrack);
      var dataUrl = bufferToDataUrl(buffer, ext);

      if (typeof PGZStorageGuard !== 'undefined') {
        PGZStorageGuard.checkAudioFile({ name: selectedTrack.importName + '.' + ext, size: buffer.byteLength }, true);
        await PGZStorageGuard.warnIfStorageHigh();
      }

      var baseName = selectedTrack.importName;
      var name = baseName + '.' + ext;
      var dotExt = '.' + ext;
      var counter = 1;
      while (await fsRef.type('/music/' + name) === 'file') {
        name = baseName + ' (' + counter++ + ')' + dotExt;
      }

      await fsRef.write('/music/' + name, dataUrl);

      if (typeof refreshGallery === 'function') await refreshGallery();
      if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
      if (typeof showGallery === 'function') await showGallery();

      var displayName = selectedTrack.name;
      closeMusicLibraryModal();
      if (typeof message === 'function') {
        await message(
          L('library.musicAdded', null, 'Музыка добавлена'),
          L('library.musicAddedBody', { name: displayName, file: name, code: baseName },
            '«' + displayName + '» сохранена как ' + name + '.\n\nВ коде:\nmusic.play(\'' + baseName + '\')\n\nОдин раз:\nmusic.play_once(\'' + baseName + '\')')
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
    renderMusicLibrary();
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pgz:langchange', function () {
      loadMusicLabels(currentLang()).then(function () {
        var modal = document.getElementById('musicLibraryModal');
        if (modal && modal.style.display === 'flex') renderMusicLibrary();
      });
    });
  }

  window.openMusicLibraryModal = openMusicLibraryModal;
  window.closeMusicLibraryModal = closeMusicLibraryModal;
  window.importSelectedMusic = importSelectedMusic;

  function bindMusicLibraryUi() {
    var search = document.getElementById('musicLibrarySearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', onSearchInput);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMusicLibraryUi);
  } else {
    bindMusicLibraryUi();
  }

  window._musicLibraryTest = {
    mapMusicEntry: mapMusicEntry,
    musicDisplayName: musicDisplayName,
    setMusicLabels: function (labels, lang) {
      musicLabels = labels || {};
      loadedLabelsLang = lang || 'en';
    },
    resolveTrackUrl: resolveTrackUrl,
    getEntryExt: getEntryExt,
    MUSIC_GROUP_LABELS: MUSIC_GROUP_LABELS
  };
})();
