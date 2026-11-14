let fs;
let selected = { image: null, audio: null, music: null };
let currentAudio = null;
let isPlaying = false;
let currentMusicAudio = null; // отдельный проигрыватель для музыки
let isMusicPlaying = false;

function L(key, params, fallback) {
  if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
    return PGZI18n.uiText(key, params, fallback);
  }
  return fallback != null ? fallback : key;
}
// --- ИМПОРТ ---
let externalFiles = [];       // полный список файлов из files.txt
let categories = [];          // уникальные категории
let currentCategory = 'things';
let selectedExternalImage = null; // URL выбранного изображения для импорта

async function openImportModal() {
  document.getElementById('importModal').style.display = 'flex';
  await loadExternalFiles();
}

function closeImportModal() {
  document.getElementById('importModal').style.display = 'none';
  selectedExternalImage = null;
  document.getElementById('importFileBtnContainer').style.display = 'none';
}

async function loadExternalFiles() {
  try {
    const response = await fetch('https://ed-info.github.io/images/files.txt');
    if (!response.ok) throw new Error(L('assets.importListError', { detail: 'files.txt' }, 'Не удалось загрузить files.txt'));
    const text = await response.text();
    externalFiles = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.startsWith('images/'));

    // Выделяем уникальные категории
    const catSet = new Set();
    externalFiles.forEach(file => {
      const parts = file.split('/');
      if (parts.length >= 3) {
        catSet.add(parts[1]);
      }
    });
    categories = Array.from(catSet).sort();

    renderImportCategories();
    loadCategory('things');
  } catch (err) {
    await message('', L('assets.importListError', { detail: err.message }, 'Ошибка загрузки списка файлов:\n' + err.message));
    console.error(err);
  }
}

function renderImportCategories() {
  const container = document.getElementById('importCategories');
  container.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.style.background = cat === currentCategory ? '#007bff' : '#444';
    btn.style.color = 'white';
    btn.style.border = '1px solid #666';
    btn.style.borderRadius = '20px';
    btn.style.padding = '4px 12px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => loadCategory(cat);
    container.appendChild(btn);
  });
}

function loadCategory(category) {
  currentCategory = category;
  renderImportCategories(); // обновляет активную кнопку

  const container = document.getElementById('importImages');
  container.innerHTML = '<div style="width:100%; text-align:center; color:#aaa;">' + L('assets.loading', null, 'Загрузка...') + '</div>';

  const filesInCategory = externalFiles.filter(file => {
    const parts = file.split('/');
    return parts.length >= 3 && parts[1] === category;
  });

  // Загружаем превью последовательно, чтобы не перегружать
  container.innerHTML = '';
  filesInCategory.forEach(file => {
    const url = `https://ed-info.github.io/${file}`;
    const item = document.createElement('div');
    item.style.textAlign = 'center';
    item.style.cursor = 'pointer';
    item.style.opacity = '0.8';
    item.onclick = () => selectExternalImage(url, item);

    const img = document.createElement('img');
    img.src = url;
    img.style.width = '80px';
    img.style.height = '80px';
    img.style.objectFit = 'contain';
    img.style.background = '#999';
    img.style.borderRadius = '4px';

    const name = stripExtension(file.split('/').pop());
    const label = document.createElement('span');
    label.className = 'item-name';
    label.textContent = name;
    label.style.fontSize = '12px';
    label.style.marginTop = '4px';
    label.style.color = '#ddd';
    label.title = L('assets.copyHint', { name: name }, name + ' — выделите, чтобы скопировать');

    item.appendChild(img);
    item.appendChild(label);
    container.appendChild(item);
  });
}

function selectExternalImage(url, element) {
  // Снимаем выделение со всех
  document.querySelectorAll('#importImages > div').forEach(el => {
    el.style.opacity = '0.8';
    el.style.outline = 'none';
  });

  // Выделяем выбранный
  element.style.opacity = '1';
  element.style.outline = '2px solid #007bff';
  element.style.borderRadius = '6px';

  selectedExternalImage = url;
  document.getElementById('importFileBtnContainer').style.display = 'block';
}

async function importSelectedImage() {
  if (!selectedExternalImage) return;

  try {
    await initFS();
    // Загружаем изображение как Blob
    const response = await fetch(selectedExternalImage);
    if (!response.ok) throw new Error('Не удалось загрузить изображение');
    const blob = await response.blob();

    // Конвертируем в Data URL
    const dataUrlRaw = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });

    const filename = selectedExternalImage.split('/').pop();
    const inspection = PGZImageAssets.inspectImageUpload({ name: filename, type: blob.type });
    if (!inspection.ok) {
      await message(
        L('assets.imageFormatTitle', null, 'Неподдерживаемый формат'),
        L('assets.imageFormatUnsupported', {
          name: filename,
          ext: inspection.ext || getExtension(filename),
          supported: PGZImageAssets.SUPPORTED_FORMATS_LABEL
        }, 'Файл «' + filename + '» нельзя использовать в игре.\n\nПоддерживаются: ' + PGZImageAssets.SUPPORTED_FORMATS_LABEL + '.')
      );
      return;
    }
    let dataUrl = dataUrlRaw;
    if (typeof PGZStorageGuard !== 'undefined') {
      const optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrlRaw, filename);
      dataUrl = optimized.dataUrl;
    }

    let name = PGZImageAssets.normalizeImageFileName(inspection.uploadName || filename, dataUrl);
    if (inspection.converted && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
      PythonIDE.showHint(L('assets.imageFormatConverted', {
        name: filename,
        saved: name,
        supported: PGZImageAssets.SUPPORTED_FORMATS_LABEL
      }, 'Формат «' + filename + '» не подходит для игры. Сохранили как «' + name + '».'));
    }
    await PGZImageAssets.writeImageReplacing(fs, name, dataUrl);

    await message(L('library.importFile', null, 'Импорт файла'), L('assets.importSuccess', null, 'Файл успешно импортирован!'));
    await afterImageAssetsChanged();
    await showGallery();
    closeImportModal();
  } catch (err) {
    await message('', L('assets.importError', { detail: err.message }, 'Ошибка импорта:\n' + err.message));
    console.error(err);
  }
}
async function initFS() {
  if (!fs) fs = window.jsfs || new FileSystem("PGZfs");
  window.jsfs = fs;
  await fs.mkdir('/images');
  await fs.mkdir('/sounds');
  await fs.mkdir('/music');
  return fs;
}

async function getActiveFs() {
  await initFS();
  return window.jsfs || fs;
}

function scheduleProjectSave() {
  if (typeof PGZProjectGallery !== 'undefined' &&
      PGZProjectGallery.getActiveSlot() !== null &&
      typeof PGZProjectGallery.saveActiveSlotQuiet === 'function') {
    PGZProjectGallery.saveActiveSlotQuiet().catch(function (e) {
      console.warn('PGZ: save slot after asset change failed', e);
    });
    return;
  }
  if (typeof PGZSession !== 'undefined') {
    PGZSession.scheduleSave();
  }
}

async function refreshGallery() {
  await initFS();
  const activeFs = window.jsfs || fs;
  if (activeFs && typeof activeFs.invalidateMetadataCache === 'function') {
    activeFs.invalidateMetadataCache();
  }
  if (typeof PGZImageAssets !== 'undefined' && typeof PGZImageAssets.repairConvertibleImages === 'function') {
    const repaired = await PGZImageAssets.repairConvertibleImages(activeFs);
    if (repaired.length && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
      const sample = repaired[0];
      PythonIDE.showHint(L('assets.imageFormatRepaired', {
        from: sample.from,
        to: sample.to,
        supported: PGZImageAssets.SUPPORTED_FORMATS_LABEL
      }, 'Файл «' + sample.from + '» не подходит для игры и сохранён как «' + sample.to + '». Поддерживаются: ' + PGZImageAssets.SUPPORTED_FORMATS_LABEL + '.'));
    }
  }
  await renderImages();
  await renderSounds();
  await renderMusic(); 
}

async function afterImageAssetsChanged() {
  clearImageCache();
  const activeFs = window.jsfs || fs;
  if (activeFs && typeof activeFs.invalidateMetadataCache === 'function') {
    activeFs.invalidateMetadataCache();
  }
  if (typeof PythonIDE !== 'undefined' && PythonIDE.running && typeof PythonIDE.stop === 'function') {
    PythonIDE.stop();
    if (typeof PythonIDE.showHint === 'function') {
      PythonIDE.showHint(L('assets.imagesUpdatedRestart', null, 'Картинки обновлены. Нажми «Играть», чтобы увидеть изменения.'));
    }
  }
  await refreshGallery();
  scheduleProjectSave();
}

async function refreshAssetsAfterEditorChange() {
  await afterImageAssetsChanged();
}

function hideItemPopovers() {
  document.querySelectorAll('.item-actions-popover').forEach(function (pop) {
    pop.remove();
  });
  document.querySelectorAll('#resourceGallery [aria-expanded="true"]').forEach(function (el) { el.setAttribute('aria-expanded', 'false'); });
}

var GALLERY_POPOVER_ACTIONS = {
  image: [
    { icon: 'pView', titleKey: 'assets.view', title: 'Посмотреть', run: function () { showSelected('image'); } },
    { icon: 'pRename', titleKey: 'assets.rename', title: 'Переименовать', run: function () { renameSelected('image'); } },
    { icon: 'pDraw', titleKey: 'assets.draw', title: 'Нарисовать', run: function () { showEditor('image'); } },
    { icon: 'pDownload', titleKey: 'assets.downloadSprite', title: 'Скачать спрайт', run: function () { downloadSelectedImage(); } },
    { icon: 'pDelete', titleKey: 'assets.delete', title: 'Удалить', run: function () { deleteSelected('image'); } }
  ],
  audio: [
    { icon: 'gPlay', id: 'playBtn', titleKey: 'assets.play', title: 'Слушать', run: function () { togglePlayPause(); } },
    { icon: 'pRename', titleKey: 'assets.rename', title: 'Переименовать', run: function () { renameSelected('audio'); } },
    { icon: 'pDelete', titleKey: 'assets.delete', title: 'Удалить', run: function () { deleteSelected('audio'); } }
  ],
  music: [
    { icon: 'gPlay', id: 'playMusicBtn', titleKey: 'assets.play', title: 'Слушать', run: function () { togglePlayPauseMusic(); } },
    { icon: 'pRename', titleKey: 'assets.rename', title: 'Переименовать', run: function () { renameSelected('music'); } },
    { icon: 'pDelete', titleKey: 'assets.delete', title: 'Удалить', run: function () { deleteSelected('music'); } }
  ]
};

function buildItemPopover(type) {
  var actions = GALLERY_POPOVER_ACTIONS[type] || [];
  var pop = document.createElement('div');
  pop.className = 'item-actions-popover';
  pop.addEventListener('click', function (e) { e.stopPropagation(); });

  actions.forEach(function (action) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gallery-btn gallery-btn-pop' + (action.icon === 'pDelete' ? ' is-danger' : '');
    btn.setAttribute('data-pz-icon', action.icon);
    btn.title = L(action.titleKey, null, action.title);
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      action.run();
    });
    if (action.id) btn.id = action.id;
    pop.appendChild(btn);
  });

  if (typeof PZIcon !== 'undefined') {
    pop.querySelectorAll('[data-pz-icon]').forEach(function (el) {
      PZIcon.setButtonIcon(el, el.getAttribute('data-pz-icon'), 20);
    });
  }
  return pop;
}

function positionItemPopover(pop, item) {
  pop.style.position = 'fixed';
  pop.style.zIndex = '10050';
  document.body.appendChild(pop);

  var anchor = item.querySelector('.thumb-container') || item.querySelector('.audio-icon') || item;
  var rect = anchor.getBoundingClientRect();
  var popRect = pop.getBoundingClientRect();
  var gap = 6;
  var left = rect.left + rect.width / 2 - popRect.width / 2;
  var top = rect.top - popRect.height - gap;
  left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - popRect.height - 8));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function showItemPopover(item, type) {
  hideItemPopovers();
  var pop = buildItemPopover(type);
  pop.dataset.galleryPopover = '1';
  positionItemPopover(pop, item);
  var trigger = item.querySelector('.thumb-container, .audio-icon');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

function isSameGallerySelection(type, path, current) {
  return !!(current && current[type] === path);
}

function clearSelection(type) {
  selected[type] = null;
  document.querySelectorAll('.item[data-type="' + type + '"]').forEach(function (el) {
    el.classList.remove('selected');
  });
  hideItemPopovers();

  if (type === 'audio') updatePlayButton(false);
  if (type === 'music') updatePlayMusicButton(false);
}

function clearAllSelections() {
  selected.image = null;
  selected.audio = null;
  selected.music = null;
  hideItemPopovers();

  document.querySelectorAll('.item.selected').forEach(function (el) {
    el.classList.remove('selected');
  });

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    isPlaying = false;
    updatePlayButton(false);
  }
  if (currentMusicAudio) {
    currentMusicAudio.pause();
    currentMusicAudio = null;
    isMusicPlaying = false;
    updatePlayMusicButton(false);
  }
}

function selectGalleryFile(type, path, itemEl) {
  if (isSameGallerySelection(type, path, selected)) {
    if (!document.querySelector('.item-actions-popover') && itemEl) { showItemPopover(itemEl, type); return; }
    clearSelection(type);
    return;
  }

  clearAllSelections();
  selected[type] = path;

  var item = itemEl || document.querySelector('.item[data-path="' + CSS.escape(path) + '"]');
  if (item) {
    item.classList.add('selected');
    showItemPopover(item, type);
  }
}

// --- Вспомогательные функции ---
function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0 && lastDot < filename.length - 1) {
    return filename.substring(0, lastDot);
  }
  return filename;
}

function getExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot > 0 && lastDot < filename.length - 1) {
    return filename.substring(lastDot);
  }
  return '';
}

function appendItemName(item, displayName) {
  const nameEl = document.createElement('span');
  nameEl.className = 'item-name';
  nameEl.textContent = displayName;
  nameEl.title = L('assets.copyHint', { name: displayName }, displayName + ' — выделите, чтобы скопировать');
  item.appendChild(nameEl);
  return nameEl;
}

function isAssetNameInteraction(target) {
  return !!(target && target.closest && target.closest('.item-name'));
}

function hasTextSelectionInGallery() {
  const sel = window.getSelection && window.getSelection();
  return !!(sel && sel.toString().length > 0);
}

function updateGalleryFrameTitle(frameId, iconName, label, count) {
  const frame = document.getElementById(frameId);
  if (!frame) return;
  const h3 = frame.querySelector('.frame-title') || frame.querySelector('h3');
  if (!h3) return;
  const countHtml = count > 0 ? ' <span class="gallery-count">' + count + '</span>' : '';
  if (typeof PZIcon !== 'undefined') {
    h3.innerHTML = '<span class="pz-icon-wrap" data-pz-icon="' + iconName + '"></span> ' + label + countHtml;
    const iconEl = h3.querySelector('[data-pz-icon]');
    if (iconEl) iconEl.innerHTML = PZIcon.svg(iconName, 18);
  } else {
    h3.textContent = label + (count > 0 ? ' (' + count + ')' : '');
  }
}

// --- РЕНДЕРИНГ ---
async function renderImages() {
  const container = document.getElementById('imagesList');
  if (!container) return;
  container.innerHTML = '';

  const activeFs = await getActiveFs();
  const files = await activeFs.ls('/images', 'files');
  updateGalleryFrameTitle('imagesFrame', 'image', L('sidebar.images', null, 'Картинки'), files.length);

  for (const name of files) { 
    const data = await activeFs.read(`/images/${name}`);
    const path = `/images/${name}`;
    const displayName = stripExtension(name);
    const formatInfo = (typeof PGZImageAssets !== 'undefined' && PGZImageAssets.inspectStoredImageName)
      ? PGZImageAssets.inspectStoredImageName(name)
      : { ok: true };
    
    const item = document.createElement('div');
    item.className = 'item';
    if (!formatInfo.ok && formatInfo.unsupported) {
      item.classList.add('item-unsupported-image');
    }
    item.dataset.type = 'image';
    item.dataset.path = path;
        
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'thumb-container';
    thumbContainer.setAttribute('role', 'button');
    thumbContainer.tabIndex = 0;
    thumbContainer.setAttribute('aria-label', displayName);
    thumbContainer.setAttribute('aria-haspopup', 'true');
    thumbContainer.setAttribute('aria-expanded', 'false');
    const img = document.createElement('img');
    img.className = 'thumb';
    img.alt = '';
    img.src = data;
    img.draggable = false;
    thumbContainer.draggable = true;
    thumbContainer.appendChild(img);
    
    item.appendChild(thumbContainer);
    const nameEl = appendItemName(item, displayName);
    if (!formatInfo.ok && formatInfo.unsupported) {
      const supported = (typeof PGZImageAssets !== 'undefined' && PGZImageAssets.SUPPORTED_FORMATS_LABEL)
        ? PGZImageAssets.SUPPORTED_FORMATS_LABEL
        : 'PNG, JPG, GIF, WEBP';
      nameEl.title = L('assets.imageFormatBadFile', {
        name: name,
        ext: formatInfo.ext || '',
        supported: supported
      }, 'Формат «' + (formatInfo.ext || name) + '» не работает в игре. Сохраните файл как ' + supported + ' и загрузите снова.');
    }
    container.appendChild(item);
  }
}
async function renderAudioItems(containerId, folder, type, icon) {
  const container = document.getElementById(containerId);
  if (!container) return; // Защита от отсутствия контейнера в DOM
  
  container.innerHTML = '';
  
  // Используем активную файловую систему
  const activeFs = await getActiveFs();
  const files = await activeFs.ls(folder, 'files');
  const frameId = type === 'music' ? 'musicFrame' : 'soundsFrame';
  const iconName = type === 'music' ? 'music' : 'sound';
  const label = type === 'music'
    ? L('sidebar.music', null, 'Музыка')
    : L('sidebar.sounds', null, 'Звуки');
  updateGalleryFrameTitle(frameId, iconName, label, files.length);

  for (const name of files) {
    const path = `${folder}/${name}`.replace(/\/+/g, '/');
    const displayName = stripExtension(name);
    
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.type = type;
    item.dataset.path = path;
    
    const iconDiv = document.createElement('div');
      iconDiv.className = 'audio-icon';
      iconDiv.setAttribute('role', 'button');
      iconDiv.tabIndex = 0;
      iconDiv.setAttribute('aria-label', displayName);
      iconDiv.setAttribute('aria-haspopup', 'true');
      iconDiv.setAttribute('aria-expanded', 'false');
      iconDiv.draggable = true;
      if (typeof PZIcon !== 'undefined') {
        iconDiv.innerHTML = PZIcon.svg(icon, 18);
      }
    
    item.appendChild(iconDiv);
    appendItemName(item, displayName);
    container.appendChild(item);
  }
}

async function renderSounds() {
  await renderAudioItems('soundsList', '/sounds', 'audio', 'sound');
}

async function renderMusic() {
  await renderAudioItems('musicList', '/music', 'music', 'music');
}

// --- ДЕЙСТВИЯ С ФАЙЛАМИ ---
async function addFile(type) {
  clearSelection(type);

  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true; // множественный выбор

  if (type === 'image') input.accept = '.png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp';
  else if (type === 'audio' || type === 'music') input.accept = 'audio/*';
  else return;

input.addEventListener('change', async (e) => {
  const files = Array.from(input.files);
  if (files.length === 0) return;
  const usedImageBaseNames = new Set();
  let imagesChanged = false;

  for (const file of files) {
    try {
      let folder, baseName, ext, dataUrl, optimizeNote, inspection;

      if (type === 'image') {
        inspection = PGZImageAssets.inspectImageUpload(file);
        if (!inspection.ok) {
          await message(
            L('assets.imageFormatTitle', null, 'Неподдерживаемый формат'),
            L('assets.imageFormatUnsupported', {
              name: file.name,
              ext: inspection.ext || getExtension(file.name),
              supported: PGZImageAssets.SUPPORTED_FORMATS_LABEL
            }, 'Файл «' + file.name + '» нельзя использовать в игре.\n\nФормат: ' + (inspection.ext || getExtension(file.name)) + '\nПоддерживаются: ' + PGZImageAssets.SUPPORTED_FORMATS_LABEL + '.')
          );
          continue;
        }
        folder = '/images/';
        if (typeof PGZStorageGuard !== 'undefined') {
          const optimized = await PGZStorageGuard.prepareImageFile(file);
          dataUrl = optimized.dataUrl;
          optimizeNote = optimized.note;
        } else {
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        if (inspection.converted && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
          PythonIDE.showHint(L('assets.imageFormatConverted', {
            name: file.name,
            saved: inspection.uploadName,
            supported: PGZImageAssets.SUPPORTED_FORMATS_LABEL
          }, 'Формат «' + file.name + '» не подходит для игры. Сохранили как «' + inspection.uploadName + '» (' + PGZImageAssets.SUPPORTED_FORMATS_LABEL + ').'));
        }
      } else if (type === 'audio' || type === 'music') {
        folder = type === 'audio' ? '/sounds/' : '/music/';
        if (typeof PGZStorageGuard !== 'undefined') {
          PGZStorageGuard.checkAudioFile(file, type === 'music');
          await PGZStorageGuard.warnIfStorageHigh();
        }
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        continue;
      }

      const lastDot = file.name.lastIndexOf('.');
      if (lastDot > 0 && lastDot < file.name.length - 1) {
        baseName = file.name.substring(0, lastDot);
        ext = file.name.substring(lastDot);
      } else {
        baseName = file.name;
        ext = type === 'image' ? '.png' : '';
      }

      let name;
      if (type === 'image') {
        const uploadSourceName = inspection.uploadName || file.name;
        name = await PGZImageAssets.resolveUploadImageName(fs, uploadSourceName, dataUrl, usedImageBaseNames);
        await PGZImageAssets.writeImageReplacing(fs, name, dataUrl);
        imagesChanged = true;
      } else {
        name = file.name;
        let counter = 1;
        while (await fs.type(folder + name) === 'file') {
          name = `${baseName} (${counter++})${ext}`;
        }
        await fs.write(folder + name, dataUrl);
      }
      if (optimizeNote && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
        PythonIDE.showHint(optimizeNote);
      }
    } catch (err) {
      console.error('Ошибка загрузки файла:', file.name, err);
      if (typeof message === 'function') {
        await message('', err.message || L('assets.addFileError', null, 'Не удалось добавить файл'));
      }
    }
  }

  if (imagesChanged) {
    await afterImageAssetsChanged();
  } else {
    await refreshGallery();
    scheduleProjectSave();
  }
});

  input.click();
}


async function downloadSelectedImage() {
  var path = selected.image;
  if (!path) return;
  try {
    var data = await fs.read(path);
    var link = document.createElement('a');
    link.href = data;
    link.download = path.split('/').pop();
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    await message('', L('assets.downloadError', null, 'Не удалось скачать спрайт.'));
  }
}

async function showSelected(type) {
  if (!selected[type]) return;
  const data = await fs.read(selected[type]);
  document.getElementById('modalImg').src = data;
  document.getElementById('modal').style.display = 'flex';
}
async function toggleAudioPlayback(type) {
  const isMusic = type === 'music';
  const path = selected[type];
  if (!path) return;

  // Выбор нужных переменных в зависимости от типа
  let audioVar = isMusic ? currentMusicAudio : currentAudio;
  let playingVar = isMusic ? isMusicPlaying : isPlaying;
  const updateFunc = isMusic ? updatePlayMusicButton : updatePlayButton;

  if (playingVar) {
    if (audioVar) audioVar.pause();
    if (isMusic) {
        isMusicPlaying = false;
    } else {
        isPlaying = false;
    }
    updateFunc(false);
  } else {
    // Останавливаем предыдущий трек перед запуском нового
    if (audioVar) audioVar.pause();

    const activeFs = window.jsfs || fs;
    const data = await activeFs.read(path); 
    
    const newAudio = new Audio(data);
    
    // Обновление глобальных ссылок
    if (isMusic) {
        currentMusicAudio = newAudio;
        isMusicPlaying = true;
    } else {
        currentAudio = newAudio;
        isPlaying = true;
    }

    newAudio.play().catch(e => message('', L('assets.playError', { detail: e.message }, 'Ошибка воспроизведения: ' + e.message)));
    updateFunc(true);

    newAudio.onended = () => {
      if (isMusic) {
          isMusicPlaying = false;
          currentMusicAudio = null;
      } else {
          isPlaying = false;
          currentAudio = null;
      }
      updateFunc(false);
    };
  }
}

function updatePlayButton(playing) {
  const btn = document.getElementById('playBtn');
  if (!btn) return;
  if (typeof PZIcon !== 'undefined') {
    PZIcon.setButtonIcon(btn, playing ? 'stop' : 'play', 18);
  }
  btn.title = playing
    ? L('assets.stop', null, 'Остановить')
    : L('assets.play', null, 'Слушать');
}

function updatePlayMusicButton(playing) {
  const btn = document.getElementById('playMusicBtn');
  if (!btn) return;
  if (typeof PZIcon !== 'undefined') {
    PZIcon.setButtonIcon(btn, playing ? 'stop' : 'play', 18);
  }
  btn.title = playing
    ? L('assets.stop', null, 'Остановить')
    : L('assets.play', null, 'Слушать');
}

// Для звуковых эффектов
async function togglePlayPause() {
  await toggleAudioPlayback('audio');
}

// Для музыки
async function togglePlayPauseMusic() {
  await toggleAudioPlayback('music');
}
// 
function getPath(type) {
  const path = selected[type];
  return path;
}
// Переименование без изменения расширения файла.
function isValidAssetBaseName(name) {
  return !!name && name !== '.' && name !== '..' && !/[\\/:*?"<>|\x00-\x1f]/.test(name);
}

async function renameSelected(type) {
  const path = selected[type];
  if (!path) return;
  const oldName = path.split('/').pop();
  const oldDisplayName = stripExtension(oldName);
  const ext = getExtension(oldName);
  const dir = path.substring(0, path.lastIndexOf('/') + 1);
  let proposed = oldDisplayName;

  while (true) {
    const result = await input(L('assets.renameTitle', null, 'Переименовать файл'), L('assets.renamePrompt', null, 'Новое имя:'), proposed);
    if (result === null) return;
    proposed = result.trim();
    // Accept an explicitly typed original extension without appending it twice.
    if (ext && proposed.toLowerCase().endsWith(ext.toLowerCase())) proposed = proposed.slice(0, -ext.length).trim();
    if (!isValidAssetBaseName(proposed)) {
      await message('', L('assets.invalidRename', null, 'Введите имя без символов / \\ : * ? " < > |.'));
      continue;
    }
    const newFullName = proposed + ext;
    if (newFullName === oldName) return;
    try {
      const activeFs = await getActiveFs();
      if (!activeFs) throw new Error(L('assets.renameFailed', null, 'Не удалось переименовать файл.'));
      const targetType = await activeFs.type(dir + newFullName);
      let conflictingImageName = false;
      if (type === 'image') {
        const names = await activeFs.ls(dir, 'files');
        conflictingImageName = names.some(function (name) {
          return name !== oldName && stripExtension(name).toLowerCase() === proposed.toLowerCase();
        });
      }
      if (targetType || conflictingImageName) {
        await message('', L('assets.nameExists', null, 'Файл с таким именем уже существует!'));
        continue;
      }
      await activeFs.mv(path, dir + newFullName);
      clearSelection(type);
      if (type === 'image') await afterImageAssetsChanged();
      else { await refreshGallery(); scheduleProjectSave(); }
      return;
    } catch (err) {
      console.error('Asset rename failed:', err);
      await message('', L('assets.renameFailed', null, 'Не удалось переименовать файл.'));
      return;
    }
  }
}
async function deleteSelected(type) {
  const path = selected[type];
  if (!path) return;
  if (await askConfirm('', L('assets.deleteConfirm', null, 'Удалить файл?'))) {
    await fs.rm(path); 
    clearSelection(type);
    if (type === 'image') {
      await afterImageAssetsChanged();
    } else {
      await refreshGallery();
      scheduleProjectSave();
    }
  }
}

// --- ЭКСПОРТ В ZIP ---
async function exportGallery() {
  if (typeof PGZProjectIO === 'undefined') {
    await message('', L('assets.exportModuleMissing', null, 'Модуль экспорта не загружен.'));
    return;
  }
  const built = await PGZProjectIO.buildProjectZipBlob({ allowIncomplete: true });
  if (built.error || !built.blob) {
    await message('', built.error === 'save_failed' ? L('gallery.saveFailed', null, 'Не удалось сохранить проект.') : L('assets.nothingToExport', null, 'Нет файлов для экспорта.'));
    return;
  }
  var fileName = document.getElementById('projectNameInput').value || built.title || 'my_game';
  saveAs(built.blob, fileName + '.pgz');
  if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
    PythonIDE.showHint(L('assets.exportedHint', { name: fileName }, 'Файл «' + fileName + '.pgz» скачан на компьютер'));
  }
}

function dataURLToBlob(dataUrl) {
  return new Promise((resolve) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    resolve(new Blob([u8arr], { type: mime }));
  });
}
document.addEventListener('click', function(e) {
  if (e.target.closest('[data-gallery-popover]') || e.target.closest('.item-actions-popover')) {
    return;
  }
  if (e.target.closest('.controls-bar .gallery-btn')) {
    return;
  }

  const item = e.target.closest('.item[data-type][data-path]');
  if (item) {
    if (isAssetNameInteraction(e.target)) {
      return;
    }
    e.stopPropagation();
    selectGalleryFile(item.dataset.type, item.dataset.path, item);
    return;
  }

  if (hasTextSelectionInGallery() && e.target.closest('.assets-items-scroll')) {
    return;
  }

  if (e.target.closest('.assets-items-scroll')) {
    clearAllSelections();
  } else {
    hideItemPopovers();
  }
});

document.addEventListener('keydown', function (e) {
  var trigger = e.target.closest && e.target.closest('#resourceGallery .thumb-container[role="button"], #resourceGallery .audio-icon[role="button"]');
  if (trigger && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    var item = trigger.closest('.item[data-type][data-path]');
    if (!item) return;
    selectGalleryFile(item.dataset.type, item.dataset.path, item);
    var firstAction = document.querySelector('.item-actions-popover button');
    if (firstAction) firstAction.focus();
  } else if (e.key === 'Escape' && e.target.closest && e.target.closest('.item-actions-popover')) {
    e.preventDefault();
    var selectedItem = document.querySelector('#resourceGallery .item.selected .thumb-container, #resourceGallery .item.selected .audio-icon');
    hideItemPopovers();
    if (selectedItem) selectedItem.focus();
  }
});

document.addEventListener('mouseup', function (e) {
  if (!e.target.closest('.item-name')) return;
  if (hasTextSelectionInGallery()) {
    e.stopPropagation();
  }
});

document.addEventListener('scroll', function (e) {
  if (e.target.closest('.assets-items-scroll') || e.target.id === 'resourceGallery') {
    hideItemPopovers();
  }
}, true);

if (typeof window !== 'undefined') {
  window._galleryUiTest = {
    isSameGallerySelection: isSameGallerySelection,
    GALLERY_POPOVER_ACTIONS: GALLERY_POPOVER_ACTIONS,
    isAssetNameInteraction: isAssetNameInteraction,
    appendItemName: appendItemName
  };
}
// --- ПЕРЕТАСКИВАНИЕ (DRAG AND DROP) ---
let dragDropEnabled = false;

function enableDragAndDrop() {
  if (dragDropEnabled) return;
  dragDropEnabled = true;

document.addEventListener('dragstart', function(e) {
    const item = e.target.closest('.item[data-type]');
    if (item && item.dataset.path) {
        const type = item.dataset.type; // 'image', 'audio', 'music'
        const filename = item.dataset.path.split('/').pop();
        const nameWithoutExt = stripExtension(filename);
        
        let codeToInsert = '';
        
        switch(type) {
            case 'image':
                codeToInsert = `\n${nameWithoutExt} = Actor('${nameWithoutExt}')\n`;
                break;
            case 'audio':
                codeToInsert = `\nsounds.${nameWithoutExt}.play()\n`;
                break;
            case 'music':
                codeToInsert = `\nmusic.play('${nameWithoutExt}')\n`;
                break;
        }
        
        // Сохраняем код для вставки в dataTransfer
        e.dataTransfer.setData('text/plain', codeToInsert);
        e.dataTransfer.effectAllowed = 'copy';
        
        // Опционально: показываем превью изображения во время перетаскивания
        if (type === 'image') {
            const img = item.querySelector('img');
            if (img) {
                e.dataTransfer.setDragImage(img, 50, 50);
            }
        }
    }
});
}
//
// удаление всех файлов
async function clearFolder(folderPath) {
    // Используем уже инициализированный объект fs
    if (!fs) {
        console.error("Файловая система не инициализирована");
        return;
    }

    try {
        // Получаем список всех элементов в папке
        const entries = await fs.ls(folderPath, 'all');
        
        for (const entry of entries) {
            const fullPath = `${folderPath}/${entry}`.replace(/\/+/g, '/');
            const entryType = await fs.type(fullPath);

            if (entryType === 'folder') {
                // Рекурсивно очищаем вложенную папку
                await clearFolder(fullPath);
                // Удаляем уже пустую папку
                await fs.rm(fullPath);
            } else {
                // Удаляем файл
                await fs.rm(fullPath);
            }
        }
    } catch (e) {
        // Игнорируем только ошибку отсутствия папки, остальные выводим
        if (!e.message?.includes('Invalid folder') && !e.message?.includes('not found')) {
            console.error(`Ошибка очистки ${folderPath}:`, e);
        }
    }
}

function clearImageCache() {
    if (typeof clearRuntimeImageCache === 'function') {
        clearRuntimeImageCache();
        return;
    }
    if (!window.PGZ_IMAGE_CACHE) window.PGZ_IMAGE_CACHE = {};
    else Object.keys(window.PGZ_IMAGE_CACHE).forEach(function (key) { delete window.PGZ_IMAGE_CACHE[key]; });
    if (!window.PGZ_IMAGE_PROMISES) window.PGZ_IMAGE_PROMISES = {};
    else Object.keys(window.PGZ_IMAGE_PROMISES).forEach(function (key) { delete window.PGZ_IMAGE_PROMISES[key]; });
    window.PGZ_PRELOAD_COMPLETE = false;
}

// удаление всех файлов
async function clearProjectResources() {
    clearImageCache();
    await initFS();
    var activeFs = window.jsfs || fs;
    await clearFolder('/images');
    await clearFolder('/sounds');
    await clearFolder('/music');
    if (activeFs && typeof activeFs.invalidateMetadataCache === 'function') {
        activeFs.invalidateMetadataCache();
    }
    // Очистка DOM
    ['imagesList', 'soundsList', 'musicList'].forEach(id => {
        document.getElementById(id).innerHTML = "";
    });
    document.getElementById('output').innerHTML = '';
}
//
// --- ИНИЦИАЛИЗАЦИЯ ---
async function initializeAssetsGallery() {
  await initFS();
  await refreshGallery();
  enableDragAndDrop();
}

if (typeof window.addEventListener === 'function') {
  window.addEventListener('pgz:langchange', function () {
    if (typeof refreshGallery === 'function') {
      refreshGallery().catch(function (err) {
        console.warn('refreshGallery on lang change failed', err);
      });
    }
  });
}

window.refreshAssetsAfterEditorChange = refreshAssetsAfterEditorChange;
window.afterImageAssetsChanged = afterImageAssetsChanged;
window.clearImageCache = clearImageCache;
async function importGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgz';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        let restoreData = null;
        let projectChanged = false;
        try {
            // Read and validate the entire archive before touching the open project.
            const zip = await JSZip.loadAsync(file);
            const codeEntry = zip.file('my_pgz.py');
            const code = codeEntry ? await codeEntry.async('text') : '';
            const staged = [];
            const allFiles = Object.keys(zip.files).filter(name => !name.endsWith('/'));
            for (const path of allFiles) {
                const parts = path.split('/');
                const folder = parts[0];
                if (!['images', 'sounds', 'music'].includes(folder) || parts.length !== 2 || !parts[1]) continue;
                const fileData = await zip.file(path).async('base64');
                let mime = typeof PGZProjectIO !== 'undefined' ? PGZProjectIO.mimeFromMediaPath(path) : 'application/octet-stream';
                let dataUrl = `data:${mime};base64,${fileData}`;
                if (folder === 'images' && typeof PGZStorageGuard !== 'undefined') {
                    const optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrl, parts[1]);
                    dataUrl = optimized.dataUrl;
                }
                staged.push({ path: '/' + path, data: dataUrl });
            }
            if (!codeEntry && !staged.length) throw new Error(L('assets.invalidProject', null, 'В файле нет кода или ресурсов проекта.'));
            const confirmed = await askConfirm(
                L('assets.importReplaceTitle', null, 'Открыть проект?'),
                L('assets.importReplaceBody', null, 'Текущая игра будет заменена содержимым файла. Сначала сохраните её в другой ячейке или скачайте .pgz, если хотите сохранить обе игры.')
            );
            if (!confirmed) return;
            if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.getActiveSlot() !== null) {
                if (typeof PGZSession !== 'undefined') PGZSession.flush();
                if (!await PGZProjectGallery.flushAndSaveActive()) return;
                restoreData = await PGZProjectGallery.getSlot(PGZProjectGallery.getActiveSlot());
            }
            projectChanged = true;
            await clearProjectResources();
            clearAllSelections();
            PythonIDE.files = { 'my_pgz.py': codeEntry ? code : '# Пустой проект\n' };
            PythonIDE.currentFile = 'my_pgz.py';
            PythonIDE.disableChangeEvent = true;
            try { PythonIDE.editor.setValue(PythonIDE.files['my_pgz.py']); }
            finally { PythonIDE.disableChangeEvent = false; }
            PythonIDE.updateFileTabs();
            for (const entry of staged) await fs.write(entry.path, entry.data);
            await refreshGallery();
            const projectName = file.name.replace(/\.pgz$/i, '');
            document.getElementById('projectNameInput').value = projectName;
            scheduleProjectSave();
            if (typeof PGZSession !== 'undefined') PGZSession.save();
            if (typeof PythonIDE.refreshEditorView === 'function') PythonIDE.refreshEditorView();
            await message('', L('assets.projectImported', null, 'Проект успешно импортирован!'));
        } catch (err) {
            console.error('Ошибка импорта:', err);
            if (projectChanged && restoreData && typeof PGZProjectGallery.applyProject === 'function') {
                try { await PGZProjectGallery.applyProject(restoreData); }
                catch (restoreError) { console.error('Не удалось восстановить проект:', restoreError); }
            }
            await message('', L('assets.loadProjectError', { detail: err.message || String(err) }, 'Не удалось загрузить проект:\n' + (err.message || String(err))));
        }
    };
    input.click();
}

function normalizePgzUrl(input) {
  if (typeof PGZProjectIO !== 'undefined') {
    return PGZProjectIO.normalizePgzUrl(input);
  }
  input = input.trim();
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  if (input.startsWith('//')) return 'https:' + input;
  if (!input.includes('/') && !input.includes('.')) throw new Error('Некорректный адрес проекта');
  return 'https://' + input;
}

// === ЗАГРУЗКА ПРОЕКТА ИЗ URL (legacy ?run= в index.html) ===
async function loadProjectFromUrl(rawUrl) {
  try {
    if (typeof PGZProjectIO === 'undefined') {
      throw new Error('PGZProjectIO не загружен');
    }
    const zip = await PGZProjectIO.loadZipFromUrl(rawUrl);
    await PGZProjectIO.importZipToProject(zip);

    document.getElementById('topPanel').style.display = 'none';
    document.getElementById('mainLayout').style.display = 'none';
    document.getElementById('gameModal').style.background = '#222';
    document.getElementById('closeGameBtn').style.display = 'none';
    document.getElementById('cgb').style.display = 'block';

    const playBtn = document.getElementById('playGameBtn');
    if (playBtn) {
      const newPlayBtn = playBtn.cloneNode(true);
      playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
      newPlayBtn.addEventListener('click', function () {
        this.style.display = 'none';
        PythonIDE.runCode();
      });
    }
  } catch (err) {
    console.error('Ошибка импорта из URL:', err);
    await message('', L('assets.loadProjectError', { detail: err.message || err.toString() }, 'Не удалось загрузить проект:\n' + (err.message || err.toString())));
  }
}
