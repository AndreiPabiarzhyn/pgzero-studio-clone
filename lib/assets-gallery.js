let fs;
let selected = { image: null, audio: null, music: null };
let currentAudio = null;
let isPlaying = false;
let currentMusicAudio = null; // отдельный проигрыватель для музыки
let isMusicPlaying = false;
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
    if (!response.ok) throw new Error('Не удалось загрузить files.txt');
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
    await message('','Ошибка загрузки списка файлов:\n' + err.message);
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
  container.innerHTML = '<div style="width:100%; text-align:center; color:#aaa;">Загрузка...</div>';

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
    const label = document.createElement('div');
    label.textContent = name;
    label.style.fontSize = '12px';
    label.style.marginTop = '4px';
    label.style.color = '#ddd';

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
    let dataUrl = dataUrlRaw;
    if (typeof PGZStorageGuard !== 'undefined') {
      const optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrlRaw, filename);
      dataUrl = optimized.dataUrl;
    }

    let name = filename;
    let counter = 1;
    while (await fs.type(`/images/${name}`) === 'file') {
      const ext = getExtension(filename);
      const base = stripExtension(filename);
      name = `${base} (${counter++})${ext}`;
    }
    // Сохраняем во внутреннее хранилище
    await fs.write(`/images/${name}`, dataUrl);

    await message('Импорт файла','Файл успешно импортирован!');
    await refreshGallery();
    scheduleProjectSave();
    await showGallery();
    closeImportModal();
  } catch (err) {
    await message('','Ошибка импорта:\n' + err.message);
    console.error(err);
  }
}
async function initFS() {
  if (!fs) fs = window.jsfs || new FileSystem("PGZfs");
  window.jsfs = fs;
  await fs.mkdir('/images');
  await fs.mkdir('/sounds');
  await fs.mkdir('/music');
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
  await renderImages();
  await renderSounds();
  await renderMusic(); 
}

function hideItemPopovers() {
  document.querySelectorAll('.item-actions-popover').forEach(function (pop) {
    pop.remove();
  });
}

var GALLERY_POPOVER_ACTIONS = {
  image: [
    { icon: 'gView', title: 'Посмотреть', run: function () { showSelected('image'); } },
    { icon: 'gRename', title: 'Переименовать', run: function () { renameSelected('image'); } },
    { icon: 'gDraw', title: 'Нарисовать', run: function () { showEditor('image'); } },
    { icon: 'gDelete', title: 'Удалить', run: function () { deleteSelected('image'); } }
  ],
  audio: [
    { icon: 'gPlay', id: 'playBtn', title: 'Слушать', run: function () { togglePlayPause(); } },
    { icon: 'gRename', title: 'Переименовать', run: function () { renameSelected('audio'); } },
    { icon: 'gDelete', title: 'Удалить', run: function () { deleteSelected('audio'); } }
  ],
  music: [
    { icon: 'gPlay', id: 'playMusicBtn', title: 'Слушать', run: function () { togglePlayPauseMusic(); } },
    { icon: 'gRename', title: 'Переименовать', run: function () { renameSelected('music'); } },
    { icon: 'gDelete', title: 'Удалить', run: function () { deleteSelected('music'); } }
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
    btn.className = 'gallery-btn gallery-btn-pop';
    btn.setAttribute('data-pz-icon', action.icon);
    btn.title = action.title;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      action.run();
    });
    if (action.id) btn.id = action.id;
    pop.appendChild(btn);
  });

  if (typeof PZIcon !== 'undefined') {
    pop.querySelectorAll('[data-pz-icon]').forEach(function (el) {
      PZIcon.setButtonIcon(el, el.getAttribute('data-pz-icon'), 22);
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
  container.innerHTML = '';
  
  const files = await fs.ls('/images', 'files'); 
  updateGalleryFrameTitle('imagesFrame', 'image', 'Картинки', files.length);

  for (const name of files) { 
    const data = await fs.read(`/images/${name}`);
    const path = `/images/${name}`;
    const displayName = stripExtension(name);
    
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.type = 'image';
    item.dataset.path = path;
        
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'thumb-container';
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = data;
    thumbContainer.appendChild(img);
    
    item.appendChild(thumbContainer);
    item.appendChild(document.createElement('br'));
    item.appendChild(document.createTextNode(displayName));
    container.appendChild(item);
  }
}
async function renderAudioItems(containerId, folder, type, icon) {
  const container = document.getElementById(containerId);
  if (!container) return; // Защита от отсутствия контейнера в DOM
  
  container.innerHTML = '';
  
  // Используем активную файловую систему
  const activeFs = window.jsfs || fs;
  const files = await activeFs.ls(folder, 'files');
  const frameId = type === 'music' ? 'musicFrame' : 'soundsFrame';
  const iconName = type === 'music' ? 'music' : 'sound';
  const label = type === 'music' ? 'Музыка' : 'Звуки';
  updateGalleryFrameTitle(frameId, iconName, label, files.length);

  for (const name of files) {
    const path = `${folder}/${name}`.replace(/\/+/g, '/');
    const displayName = stripExtension(name);
    
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.type = type;
    item.dataset.path = path;
    item.draggable = true;    
    
    const iconDiv = document.createElement('div');
    iconDiv.className = 'audio-icon';
    if (typeof PZIcon !== 'undefined') {
      iconDiv.innerHTML = PZIcon.svg(icon, 24);
    }
    
    item.appendChild(iconDiv);
    item.appendChild(document.createElement('br'));
    item.appendChild(document.createTextNode(displayName));
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

  if (type === 'image') input.accept = 'image/*';
  else if (type === 'audio' || type === 'music') input.accept = 'audio/*';
  else return;

input.addEventListener('change', async (e) => {
  const files = Array.from(input.files);
  if (files.length === 0) return;

  for (const file of files) {
    try {
      let folder, baseName, ext, dataUrl, optimizeNote;

      if (type === 'image') {
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

      let name = file.name;
      if (type === 'image' && typeof PGZStorageGuard !== 'undefined' && dataUrl.indexOf('image/jpeg') !== -1 && /\.png$/i.test(name)) {
        name = baseName + '.jpg';
      }

      let counter = 1;
      while (await fs.type(folder + name) === 'file') {
        name = `${baseName} (${counter++})${ext}`;
      }

      await fs.write(folder + name, dataUrl);
      if (optimizeNote && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
        PythonIDE.showHint(optimizeNote);
      }
    } catch (err) {
      console.error('Ошибка загрузки файла:', file.name, err);
      if (typeof message === 'function') {
        await message('', err.message || 'Не удалось добавить файл');
      }
    }
  }

  await refreshGallery();
  scheduleProjectSave();
});

  input.click();
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

    newAudio.play().catch(e => message('', 'Ошибка воспроизведения: ' + e.message));
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
  btn.title = playing ? 'Остановить' : 'Слушать';
}

function updatePlayMusicButton(playing) {
  const btn = document.getElementById('playMusicBtn');
  if (!btn) return;
  if (typeof PZIcon !== 'undefined') {
    PZIcon.setButtonIcon(btn, playing ? 'stop' : 'play', 18);
  }
  btn.title = playing ? 'Остановить' : 'Слушать';
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
// --- ПЕРЕИМЕНОВАНИЕ (без расширения в диалоге) ---
async function renameSelected(type) {
  const path = selected[type];
  if (!path) return;
  
  const oldName = path.split('/').pop();
  const oldDisplayName = stripExtension(oldName);
  const ext = getExtension(oldName);

  const newName = prompt("Новое имя:", oldDisplayName);
  if (!newName || newName === oldDisplayName) return;

  const newFullName = newName + ext;
  const dir = path.substring(0, path.lastIndexOf('/') + 1);

  if (newFullName === oldName) return;

  if (await fs.type(dir + newFullName) === 'file') {
    await message('','Файл с таким именем уже существует!');
    return;
  }

  await fs.mv(path, dir + newFullName);
  clearSelection(type);
  await refreshGallery();
  scheduleProjectSave();
}
async function deleteSelected(type) {
  const path = selected[type];
  if (!path) return;
  if (await askConfirm('','Удалить файл?')) {
    await fs.rm(path); 
    clearSelection(type);
    await refreshGallery();
    scheduleProjectSave();
  }
}

// --- ЭКСПОРТ В ZIP ---
async function exportGallery() {
  if (typeof PGZSession !== 'undefined') PGZSession.flush();
  if (!fs) await initFS();
  const zip = new JSZip();

  // Изображения
  const imageFiles = await fs.ls('/images', 'files');
  for (const name of imageFiles) {
    const dataUrl = await fs.read(`/images/${name}`);
    const blob = await dataURLToBlob(dataUrl);
    zip.file(`images/${name}`, blob);
  }

  // Аудио
  const soundFiles = await fs.ls('/sounds', 'files');
  for (const name of soundFiles) {
    const dataUrl = await fs.read(`/sounds/${name}`);
    const blob = await dataURLToBlob(dataUrl);
    zip.file(`sounds/${name}`, blob);
  }

  // Музыка
  const musicFiles = await fs.ls('/music', 'files');
  for (const name of musicFiles) {
    const dataUrl = await fs.read(`/music/${name}`);
    const blob = await dataURLToBlob(dataUrl);
    zip.file(`music/${name}`, blob);
  }

  // Добавляем файл с кодом Python
  if (typeof PythonIDE !== 'undefined' && PythonIDE.files && PythonIDE.currentFile) {
    const pythonCode = PythonIDE.files[PythonIDE.currentFile];
    const codeBlob = new Blob([pythonCode], { type: "text/plain", endings: "transparent" });
    zip.file("my_pgz.py", codeBlob);
  } else {
    console.warn("PythonIDE или текущий файл не найдены — файл my_pgz.py не будет добавлен.");
  }

  if (imageFiles.length === 0 && soundFiles.length === 0 && musicFiles.length === 0 &&
      (!PythonIDE || !PythonIDE.files || !PythonIDE.currentFile)) {
    await message('','Нет файлов для экспорта.');
    return;
  }

  const content = await zip.generateAsync({ type: 'blob' });
  var fileName = document.getElementById('projectNameInput').value || 'my_game';
  saveAs(content, fileName + '.pgz');
  if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
    PythonIDE.showHint('Файл «' + fileName + '.pgz» скачан на компьютер');
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
    e.stopPropagation();
    selectGalleryFile(item.dataset.type, item.dataset.path, item);
    return;
  }

  if (e.target.closest('.assets-items-scroll')) {
    clearAllSelections();
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
    GALLERY_POPOVER_ACTIONS: GALLERY_POPOVER_ACTIONS
  };
}
// --- ПЕРЕТАСКИВАНИЕ (DRAG AND DROP) ---
function enableDragAndDrop() {
  // Делаем элементы галереи перетаскиваемыми
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

// удаление всех файлов
async function clearProjectResources() { 
	await initFS();   
    await clearFolder('/images');
    await clearFolder('/sounds');
    await clearFolder('/music');
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
async function importGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgz';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            await clearProjectResources();
            clearAllSelections();

            const zip = await JSZip.loadAsync(file);
            
            // Загрузка кода
            const codeEntry = zip.file('my_pgz.py');
            if (codeEntry && typeof PythonIDE !== 'undefined') {
                const code = await codeEntry.async('text');
                PythonIDE.files['my_pgz.py'] = code;
                PythonIDE.currentFile = 'my_pgz.py';
                PythonIDE.editor.setValue(code);
                PythonIDE.updateFileTabs();
            }

            // Обработка медиафайлов одним циклом
            const allFiles = Object.keys(zip.files).filter(name => !name.endsWith('/'));
            for (const path of allFiles) {
                const folder = path.split('/')[0];
                if (['images', 'sounds', 'music'].includes(folder)) {
                    const fileData = await zip.file(path).async('base64');
                    let dataUrl = `data:application/octet-stream;base64,${fileData}`;
                    if (folder === 'images' && typeof PGZStorageGuard !== 'undefined') {
                        const mime = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                        dataUrl = `data:${mime};base64,${fileData}`;
                        const optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrl, path.split('/').pop());
                        dataUrl = optimized.dataUrl;
                    }
                    await fs.write('/' + path, dataUrl);
                }
            }

            await refreshGallery();
            const projectName = file.name.replace(/\.pgz$/, '');
            document.getElementById('projectNameInput').value = projectName;
            scheduleProjectSave();
            if (typeof PGZSession !== 'undefined') PGZSession.save();
            if (typeof PythonIDE !== 'undefined' && PythonIDE.refreshEditorView) PythonIDE.refreshEditorView();
            await message('', 'Проект успешно импортирован!');
        } catch (err) {
            console.error('Ошибка импорта:', err);
        }
    };
    input.click();
}

function normalizePgzUrl(input) {
  input = input.trim();
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
   if (input.startsWith('//')) {
    return 'https:' + input;
  }
  if (!input.includes('/') && !input.includes('.')) {

    throw new Error('Некорректный адрес проекта');
  }
  return 'https://' + input;
}

// === ЗАГРУЗКА ПРОЕКТА ИЗ URL ===
async function loadProjectFromUrl(rawUrl) {
  let pgzUrl;
  try {
    pgzUrl = normalizePgzUrl(rawUrl);
  } catch (e) {
    await message('', 'Некорректный адрес проекта:\n' + rawUrl);
    return;
  }

  try {
    const response = await fetch(pgzUrl);
    if (!response.ok) {
      throw new Error(`Ошибка загрузки: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);

    // 1. Загрузка кода (my_pgz.py)
    const codeEntry = zip.file('my_pgz.py');
    if (codeEntry && typeof PythonIDE !== 'undefined') {
      const code = await codeEntry.async('text');
      PythonIDE.files['my_pgz.py'] = code;
      PythonIDE.currentFile = 'my_pgz.py';
      PythonIDE.editor.setValue(code);
      PythonIDE.updateFileTabs();
      PythonIDE.editor.refresh();
      console.log('Код загружен');
    }

    // 2. Обработка всех медиафайлов одним циклом (как в importGallery)
    const allFiles = Object.keys(zip.files).filter(name => !name.endsWith('/'));
    for (const path of allFiles) {
      const folder = path.split('/')[0];
      
      // Проверяем, относится ли файл к одной из медиапапок
      if (['images', 'sounds', 'music'].includes(folder)) {
        const fileEntry = zip.file(path);
        if (!fileEntry) continue;

        // Используем универсальный метод получения base64 (как в importGallery)
        const fileData = await fileEntry.async('base64');
        let dataUrl = `data:application/octet-stream;base64,${fileData}`;
        if (folder === 'images' && typeof PGZStorageGuard !== 'undefined') {
          const mime = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          dataUrl = `data:${mime};base64,${fileData}`;
          const optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrl, path.split('/').pop());
          dataUrl = optimized.dataUrl;
        }

        await fs.write('/' + path, dataUrl);
        console.log(`Импортировано: ${path}`);
      }
    }

    // Настройка интерфейса для запуска игры
    document.getElementById('topPanel').style.display = 'none';
    document.getElementById('mainLayout').style.display = 'none';
    document.getElementById('gameModal').style.background = '#222';
    document.getElementById('closeGameBtn').style.display = 'none';
    document.getElementById('cgb').style.display = 'block';
	
    const playBtn = document.getElementById('playGameBtn');
    if (playBtn) {
      // Очищаем старые обработчики и добавляем новый
      const newPlayBtn = playBtn.cloneNode(true);
      playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
      
      newPlayBtn.addEventListener('click', function() {
        this.style.display = 'none';
        PythonIDE.runCode();
      });
    }

  } catch (err) {
    console.error('Ошибка импорта из URL:', err);
    await message('', 'Не удалось загрузить проект:\n' + (err.message || err.toString()));
  }
}
