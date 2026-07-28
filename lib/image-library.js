/** Библиотека 8-bit спрайтов Kenney (CC0) для игр */
(function () {
  'use strict';

  var GAME_SPRITES_JSON = './assets/image-library/game-sprites.json';

  var IMAGE_GROUP_LABELS = {
    all: 'Все',
    characters: 'Персонажи',
    enemies: 'Враги',
    items: 'Предметы',
    effects: 'Эффекты',
    tiles: 'Тайлы',
    backgrounds: 'Фоны',
    ui: 'Интерфейс'
  };

  var sprites = [];
  var currentGroup = 'all';
  var searchQuery = '';
  var selectedSprite = null;

  function getEntryExt(entry) {
    if (entry.file) {
      var dot = entry.file.lastIndexOf('.');
      if (dot !== -1) return entry.file.slice(dot + 1).toLowerCase();
    }
    return 'png';
  }

  function resolveSpriteUrl(entry) {
    if (entry.source === 'local') return './' + String(entry.file).replace(/^\.\//, '');
    throw new Error('Неизвестный источник: ' + entry.source);
  }

  function mapSpriteEntry(entry) {
    var ext = getEntryExt(entry);
    return {
      name: entry.label,
      importName: entry.id,
      group: entry.group,
      url: resolveSpriteUrl(entry),
      ext: ext,
      key: entry.id
    };
  }

  async function openImageLibraryModal() {
    var modal = document.getElementById('imageLibraryModal');
    if (!modal) return;
    modal.style.display = 'flex';
    searchQuery = '';
    currentGroup = 'all';
    selectedSprite = null;
    var searchInput = document.getElementById('imageLibrarySearch');
    if (searchInput) searchInput.value = '';
    var importBtn = document.getElementById('imageLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'none';
    await loadImageLibrary();
  }

  function closeImageLibraryModal() {
    selectedSprite = null;
    var modal = document.getElementById('imageLibraryModal');
    if (modal) modal.style.display = 'none';
    var importBtn = document.getElementById('imageLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'none';
    document.querySelectorAll('#imageLibraryGrid .image-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
  }

  async function loadImageLibrary() {
    var grid = document.getElementById('imageLibraryGrid');
    if (!grid) return;

    if (!sprites.length) {
      grid.innerHTML = '<div class="sound-library-status">Загрузка спрайтов…</div>';
      try {
        var response = await fetch(GAME_SPRITES_JSON);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        sprites = await response.json();
      } catch (err) {
        grid.innerHTML = '<div class="sound-library-status sound-library-error">Не удалось загрузить библиотеку.</div>';
        console.error(err);
        return;
      }
    }
    renderImageLibrary();
  }

  function filteredSprites() {
    var q = searchQuery.trim().toLowerCase();
    return sprites.map(mapSpriteEntry).filter(function (sprite) {
      if (currentGroup !== 'all' && sprite.group !== currentGroup) return false;
      if (!q) return true;
      return sprite.name.toLowerCase().indexOf(q) !== -1 ||
        sprite.importName.toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderImageGroups() {
    var container = document.getElementById('imageLibraryGroups');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(IMAGE_GROUP_LABELS).forEach(function (group) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sound-library-group' + (currentGroup === group ? ' active' : '');
      btn.textContent = IMAGE_GROUP_LABELS[group];
      btn.addEventListener('click', function () {
        currentGroup = group;
        renderImageLibrary();
      });
      container.appendChild(btn);
    });
  }

  function renderImageLibrary() {
    renderImageGroups();
    var grid = document.getElementById('imageLibraryGrid');
    if (!grid) return;

    var list = filteredSprites();
    grid.innerHTML = '';

    if (!list.length) {
      grid.innerHTML = '<div class="sound-library-status">Ничего не найдено</div>';
      return;
    }

    list.forEach(function (sprite) {
      var item = document.createElement('div');
      item.className = 'sound-library-item image-library-item';
      item.dataset.key = sprite.key;
      if (selectedSprite && selectedSprite.key === sprite.key) {
        item.classList.add('selected');
      }

      var thumb = document.createElement('img');
      thumb.className = 'image-library-thumb';
      thumb.src = sprite.url;
      thumb.alt = sprite.name;
      thumb.loading = 'lazy';
      thumb.draggable = false;

      var label = document.createElement('div');
      label.className = 'sound-library-name';
      label.textContent = sprite.name;
      label.title = sprite.name + ' → Actor(\'' + sprite.importName + '\')';

      var codeHint = document.createElement('div');
      codeHint.className = 'sound-library-code';
      codeHint.textContent = "Actor('" + sprite.importName + "')";

      item.appendChild(thumb);
      item.appendChild(label);
      item.appendChild(codeHint);
      item.addEventListener('click', function () {
        selectSprite(sprite, item);
      });
      grid.appendChild(item);
    });
  }

  function selectSprite(sprite, element) {
    selectedSprite = sprite;
    document.querySelectorAll('#imageLibraryGrid .image-library-item.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
    if (element) element.classList.add('selected');
    var importBtn = document.getElementById('imageLibraryImportBtn');
    if (importBtn) importBtn.style.display = 'inline-block';
  }

  async function importSelectedImageFromLibrary() {
    if (!selectedSprite) return;

    try {
      if (typeof initFS === 'function') await initFS();
      var fsRef = window.jsfs || fs;
      if (!fsRef) throw new Error('Файловая система не готова');

      var response = await fetch(selectedSprite.url);
      if (!response.ok) throw new Error('Не удалось загрузить картинку');
      var blob = await response.blob();

      var dataUrlRaw = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      var ext = selectedSprite.ext || 'png';
      var filename = selectedSprite.importName + '.' + ext;
      var dataUrl = dataUrlRaw;
      if (typeof PGZStorageGuard !== 'undefined') {
        var optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrlRaw, filename);
        dataUrl = optimized.dataUrl;
        if (typeof PGZStorageGuard.checkImageFile === 'function') {
          PGZStorageGuard.checkImageFile({ name: filename, size: blob.size }, true);
        }
        await PGZStorageGuard.warnIfStorageHigh();
      }

      var baseName = selectedSprite.importName;
      var name = baseName + '.' + ext;
      var dotExt = '.' + ext;
      var counter = 1;
      while (await fsRef.type('/images/' + name) === 'file') {
        name = baseName + ' (' + counter++ + ')' + dotExt;
      }

      await fsRef.write('/images/' + name, dataUrl);

      if (typeof refreshGallery === 'function') await refreshGallery();
      if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
      if (typeof showGallery === 'function') await showGallery();

      var displayName = selectedSprite.name;
      closeImageLibraryModal();
      if (typeof message === 'function') {
        await message(
          'Картинка добавлена',
          '«' + displayName + '» сохранена как ' + name + '.\n\nВ коде:\nhero = Actor(\'' + baseName + '\')'
        );
      }
    } catch (err) {
      console.error(err);
      if (typeof message === 'function') {
        await message('', 'Ошибка импорта:\n' + (err.message || err));
      }
    }
  }

  function onSearchInput(e) {
    searchQuery = e.target.value || '';
    renderImageLibrary();
  }

  window.openImageLibraryModal = openImageLibraryModal;
  window.closeImageLibraryModal = closeImageLibraryModal;
  window.importSelectedImageFromLibrary = importSelectedImageFromLibrary;

  function bindImageLibraryUi() {
    var search = document.getElementById('imageLibrarySearch');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', onSearchInput);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindImageLibraryUi);
  } else {
    bindImageLibraryUi();
  }

  window._imageLibraryTest = {
    mapSpriteEntry: mapSpriteEntry,
    resolveSpriteUrl: resolveSpriteUrl,
    getEntryExt: getEntryExt,
    IMAGE_GROUP_LABELS: IMAGE_GROUP_LABELS
  };
})();
