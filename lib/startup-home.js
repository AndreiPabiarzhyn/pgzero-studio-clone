(function () {
  'use strict';
  var page = 0, paused = false, search = '', pageSize = 20, catalogMode = 'library', catalogPromise = null, renderSequence = 0;
  function t(key, fallback) { var value = window.PGZI18n && PGZI18n.t(key); return value && value !== key ? value : fallback; }
  function updateNavigation(view) {
    document.querySelectorAll('.startup-nav [data-startup-view]').forEach(function (button) {
      var active = button.dataset.startupView === view;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
  }
  function setView(view) {
    var home = view === 'home';
    document.getElementById('startupHomeView').hidden = !home;
    document.getElementById('startupProjectsView').hidden = home;
    updateNavigation(view);
    if (!home) {
      search = ''; document.getElementById('startupProjectSearch').value = '';
      setCatalogMode(view === 'mine' ? 'mine' : 'library');
    }
    var workspace = document.querySelector('.startup-workspace'); if (workspace) workspace.scrollTop = 0;
  }
  function projectPage(slots, query, requestedPage) {
    var projects = slots.map(function (data, index) { return data ? { data: data, index: index } : null; }).filter(Boolean).filter(function (item) { return String(item.data.projectName || '').toLocaleLowerCase().includes(query.toLocaleLowerCase()); });
    projects.sort(function (a, b) { return (b.data.savedAt || 0) - (a.data.savedAt || 0); });
    var pages = Math.ceil(projects.length / pageSize);
    var current = Math.max(0, Math.min(requestedPage, Math.max(0, pages - 1)));
    return { items: projects.slice(current * pageSize, (current + 1) * pageSize), total: projects.length, pages: pages, page: current };
  }
  function recentGames(games, now) {
    var cutoff = now - 10 * 24 * 60 * 60 * 1000;
    return games.filter(function (game) {
      var date = Number(game.publishedAt || game.updatedAt);
      return game.preview === true && Number.isFinite(date) && date >= cutoff && date <= now;
    }).sort(function (a, b) { return Number(b.publishedAt || b.updatedAt) - Number(a.publishedAt || a.updatedAt); }).slice(0, 15);
  }
  var libraryPreviews = {
    '3u6jzz': 'space-cats.png', 'fqjs93': 'clicker-heroes.png', 'q33jsj': 'runner.png',
    'gr57ko': 'soul-knight.png', '0xuy0b': 'meteorites.jpg', '3ryh7r': 'begat.png', '1wn18o': 'clicker.jpg'
  };
  function loadLibrary() {
    if (!catalogPromise) catalogPromise = fetch('./published/catalog.json', { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('Library unavailable');
      return response.json();
    }).catch(function (error) { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function setCatalogMode(mode) {
    catalogMode = mode; page = 0;
    var library = mode === 'library';
    ['catalogLibrary', 'catalogMine'].forEach(function (id) {
      var button = document.getElementById(id), active = (id === 'catalogLibrary') === library;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    updateNavigation(library ? 'projects' : 'mine');
    var title = document.getElementById('allProjectsTitle');
    title.setAttribute('data-i18n', library ? 'startup.navProjects' : 'startup.myGamesNav');
    title.textContent = library ? t('startup.navProjects', 'Все проекты') : t('startup.myGamesNav', 'Мои игры');
    document.getElementById('startupCreateProject').hidden = library;
    document.getElementById('startupBackupActions').hidden = library;
    var hint = document.getElementById('startupCatalogHint');
    hint.setAttribute('data-i18n', library ? 'startup.libraryHint' : 'startup.projectsHint');
    hint.textContent = library ? t('startup.libraryHint', 'Опубликованные игры сообщества') : t('startup.projectsHint', 'Сохранённые проекты в этом браузере');
    renderProjects();
  }
  async function renderProjects() {
    var grid = document.getElementById('allProjectsGrid'), empty = document.getElementById('allProjectsEmpty'), pagination = document.getElementById('startupPagination');
    if (!grid || !window.PGZProjectGallery) return;
    var sequence = ++renderSequence, mode = catalogMode, slots;
    try {
      if (mode === 'library') {
        var games = await loadLibrary();
        slots = games.map(function (game) { return { projectName: game.title, savedAt: game.updatedAt, libraryId: game.id, hasPreview: game.preview === true }; });
      } else slots = await PGZProjectGallery.listSlots();
    } catch (error) {
      if (sequence !== renderSequence) return;
      grid.replaceChildren(); pagination.replaceChildren(); empty.hidden = false;
      empty.textContent = t('startup.libraryError', 'Не удалось загрузить библиотеку. Обнови страницу.');
      return;
    }
    if (sequence !== renderSequence) return;
    var result = projectPage(slots, search, page); page = result.page; var pages = result.pages;
    grid.replaceChildren();
    result.items.forEach(function (item) {
      var card;
      if (mode === 'library') {
        card = document.createElement('a'); card.className = 'startup-library-card';
        card.href = './play.html?id=' + encodeURIComponent(item.data.libraryId); card.target = '_blank'; card.rel = 'noopener noreferrer';
        var imageName = libraryPreviews[item.data.libraryId];
        if (item.data.hasPreview || imageName) { var image = document.createElement('img'); image.className = 'startup-library-card__preview'; image.alt = ''; image.loading = 'lazy'; image.src = item.data.hasPreview ? './published/previews/' + encodeURIComponent(item.data.libraryId) + '.webp?v=' + encodeURIComponent(item.data.savedAt || 0) : './assets/featured-games/' + imageName; card.appendChild(image); }
        else { var icon = document.createElement('span'); icon.className = 'startup-library-card__placeholder'; icon.setAttribute('aria-hidden', 'true'); var symbol = document.createElement('span'); symbol.className = 'startup-svg startup-svg--gamepad'; icon.appendChild(symbol); card.appendChild(icon); }
      } else {
        card = document.createElement('div'); card.className = 'startup-project-card pg-slot'; card.dataset.slot = String(item.index); card.tabIndex = 0; card.setAttribute('role', 'button');
        if (typeof item.data.thumb === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(item.data.thumb)) { var img = document.createElement('img'); img.className = 'startup-project-card__preview'; img.alt = ''; img.src = item.data.thumb; card.appendChild(img); }
      }
      var title = document.createElement('strong'); title.textContent = item.data.projectName || t('common.untitled', 'Без названия'); card.appendChild(title);
      if (item.data.savedAt) { var date = document.createElement('span'); date.className = 'startup-card-date'; date.textContent = new Date(item.data.savedAt).toLocaleDateString(document.documentElement.lang || undefined); card.appendChild(date); }
      if (mode === 'mine') {
        var del = document.createElement('button'); del.type = 'button'; del.className = 'startup-project-card__delete'; del.textContent = '×'; del.title = t('assets.delete', 'Удалить'); del.setAttribute('aria-label', del.title + ': ' + title.textContent);
        del.addEventListener('click', async function (event) { event.stopPropagation(); await PGZProjectGallery.deleteSlotWithConfirm(item.index); await renderProjects(); }); card.appendChild(del);
      }
      grid.appendChild(card);
    });
    empty.hidden = result.total > 0; empty.textContent = search ? t('startup.noResults','Ничего не найдено') : mode === 'library' ? t('startup.libraryEmpty','В библиотеке пока нет игр') : t('startup.noProjects','Сохранённых проектов пока нет'); pagination.replaceChildren();
    if (pages > 1) {
      var prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '‹'; prev.setAttribute('aria-label',t('startup.previous','Назад')); prev.disabled = page === 0; prev.onclick = function () { page--; renderProjects(); }; pagination.appendChild(prev);
      var label = document.createElement('span'); label.textContent = (page + 1) + ' / ' + pages; pagination.appendChild(label);
      var next = document.createElement('button'); next.type = 'button'; next.textContent = '›'; next.setAttribute('aria-label',t('startup.next','Далее')); next.disabled = page >= pages - 1; next.onclick = function () { page++; renderProjects(); }; pagination.appendChild(next);
    }
  }
  function init() {
    var root = document.getElementById('projectStartupScreen'); if (!root) return;
    root.querySelectorAll('[data-startup-view]').forEach(function (el) { el.addEventListener('click', function () { setView(el.dataset.startupView); }); });
    document.getElementById('catalogLibrary').addEventListener('click', function () { setCatalogMode('library'); });
    document.getElementById('catalogMine').addEventListener('click', function () { setCatalogMode('mine'); });
    document.getElementById('startupProjectSearch').addEventListener('input', function (event) { search = event.target.value.trim(); page = 0; renderProjects(); });
    document.getElementById('startupCreateProject').addEventListener('click', async function () { var empty = await PGZProjectGallery.findEmptySlots(); if (empty.length) await PGZProjectGallery.pickSlot(empty[0]); });
    var backupStatus = document.getElementById('startupBackupStatus');
    var backupDownload = document.getElementById('startupBackupDownload');
    var backupRestore = document.getElementById('startupBackupRestore');
    var backupFile = document.getElementById('startupBackupFile');
    backupDownload.addEventListener('click', async function () {
      backupDownload.disabled = true; backupStatus.textContent = t('startup.backupPreparing', 'Подготавливаем копию…');
      try {
        var result = await PGZProjectBackup.create();
        var url = URL.createObjectURL(result.blob), link = document.createElement('a');
        link.href = url; link.download = 'pgzero-backup-' + new Date().toISOString().slice(0, 10) + '.pgzbackup';
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        backupStatus.textContent = t('startup.backupDownloaded', 'Копия подготовлена. Игр: ') + result.count;
      } catch (error) { console.error('Backup failed', error); backupStatus.textContent = t('startup.backupError', 'Не удалось создать копию.'); }
      finally { backupDownload.disabled = false; }
    });
    backupRestore.addEventListener('click', function () { backupFile.click(); });
    backupFile.addEventListener('change', async function () {
      var file = backupFile.files && backupFile.files[0]; if (!file) return;
      backupRestore.disabled = true; backupStatus.textContent = t('startup.backupRestoring', 'Восстанавливаем игры…');
      try {
        var count = await PGZProjectBackup.restore(file);
        backupStatus.textContent = t('startup.backupRestored', 'Добавлено игр: ') + count;
        await renderProjects();
      } catch (error) { console.error('Backup restore failed', error); backupStatus.textContent = t('startup.backupRestoreError', 'Не удалось восстановить копию. Существующие игры не изменены.'); }
      finally { backupFile.value = ''; backupRestore.disabled = false; }
    });
    var carousel = document.getElementById('featuredCarousel'), track = document.getElementById('featuredTrack'), pause = document.getElementById('featuredPause');
    var lastFrame = 0, position = carousel.scrollLeft, manualUntil = 0;
    var motion = matchMedia('(prefers-reduced-motion: reduce)');
    var curatedCards = Array.from(track.children), selectedFeed = 'curated', feedRequest = 0;
    var feedControls = document.querySelector('.startup-carousel__controls'), feedMessage = document.getElementById('feedMessage');
    function updateFeedControls() {
      if (!carousel.hidden && carousel.clientWidth === 0) return;
      var overflowing = !carousel.hidden && carousel.scrollWidth > carousel.clientWidth + 1;
      feedControls.hidden = !overflowing;
      carousel.classList.toggle('is-overflowing', overflowing);
    }
    function makeRecentCard(game) {
      var card = document.createElement('a'); card.className = 'startup-game';
      card.href = './play.html?id=' + encodeURIComponent(game.id); card.target = '_blank'; card.rel = 'noopener noreferrer';
      if (game.preview === true) { var image = document.createElement('img'); image.src = './published/previews/' + encodeURIComponent(game.id) + '.webp?v=' + encodeURIComponent(game.updatedAt || 0); image.alt = ''; image.onerror = function () { card.remove(); if (!track.children.length && selectedFeed === 'recent') { carousel.hidden = true; feedMessage.hidden = false; feedMessage.textContent = t('startup.feedEmpty', 'За последние 10 дней нет новых игр с обложкой.'); } updateFeedControls(); }; card.appendChild(image); }
      else { var placeholder = document.createElement('span'); placeholder.className = 'startup-game__placeholder'; var icon = document.createElement('span'); icon.className = 'startup-svg startup-svg--gamepad'; icon.setAttribute('aria-hidden', 'true'); placeholder.appendChild(icon); card.appendChild(placeholder); }
      var body = document.createElement('span'); body.className = 'startup-game__body';
      var title = document.createElement('strong'); title.textContent = game.title; body.appendChild(title);
      var date = document.createElement('span'); date.textContent = new Date(Number(game.publishedAt || game.updatedAt)).toLocaleDateString(document.documentElement.lang || undefined); body.appendChild(date);
      var play = document.createElement('span'); play.className = 'startup-game__play'; play.textContent = t('startup.featuredPlay', 'Играть'); body.appendChild(play); card.appendChild(body);
      return card;
    }
    async function selectFeed(feed) {
      selectedFeed = feed; var request = ++feedRequest;
      ['feedCurated','feedRecent'].forEach(function (id) {
        var button = document.getElementById(id), active = (id === 'feedCurated') === (feed === 'curated');
        button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
      });
      carousel.scrollLeft = 0; position = 0; manualUntil = 0;
      if (feed === 'curated') {
        track.replaceChildren.apply(track, curatedCards); feedMessage.hidden = true; carousel.hidden = false;
        updateFeedControls(); return;
      }
      feedMessage.hidden = false; feedMessage.textContent = t('startup.feedLoading', 'Загружаем игры…'); carousel.hidden = true; updateFeedControls();
      try {
        var games = recentGames(await loadLibrary(), Date.now());
        if (request !== feedRequest) return;
        track.replaceChildren();
        games.forEach(function (game) { track.appendChild(makeRecentCard(game)); });
        feedMessage.hidden = games.length > 0;
        if (!games.length) feedMessage.textContent = t('startup.feedEmpty', 'За последние 10 дней нет новых игр с обложкой.');
        carousel.hidden = games.length === 0; updateFeedControls();
      } catch (error) {
        if (request !== feedRequest) return;
        feedMessage.hidden = false; feedMessage.textContent = t('startup.feedError', 'Не удалось загрузить игры. Попробуй ещё раз.'); carousel.hidden = true; updateFeedControls();
      }
    }
    document.getElementById('feedCurated').addEventListener('click', function () { selectFeed('curated'); });
    document.getElementById('feedRecent').addEventListener('click', function () { selectFeed('recent'); });
    window.addEventListener('resize', updateFeedControls);

    function cardWidth() {
      var card = track.querySelector('.startup-game');
      return card ? card.offsetWidth + (parseFloat(getComputedStyle(track).gap) || 0) : 0;
    }
    function normalize() {
      var width = cardWidth();
      while (width && carousel.scrollLeft >= width - 0.5 && track.children.length > 3) {
        var remainder = Math.max(0, carousel.scrollLeft - width);
        track.appendChild(track.firstElementChild);
        carousel.scrollLeft = remainder;
      }
    }
    function step(direction) {
      var width = cardWidth(); if (!width || carousel.scrollWidth <= carousel.clientWidth + 1) return;
      normalize();
      if (direction < 0) {
        track.insertBefore(track.lastElementChild, track.firstElementChild);
        carousel.scrollLeft += width;
      }
      manualUntil = performance.now() + 800;
      carousel.scrollTo({left: Math.max(0, carousel.scrollLeft + direction * width), behavior: motion.matches ? 'auto' : 'smooth'});
    }
    document.getElementById('featuredPrev').onclick = function () { step(-1); };
    document.getElementById('featuredNext').onclick = function () { step(1); };
    function updatePause() { pause.innerHTML = '<span class="startup-svg startup-svg--' + (paused ? 'play' : 'pause') + '" aria-hidden="true"></span>'; var label = paused ? t('startup.resume','Продолжить') : t('startup.pause','Пауза'); pause.setAttribute('aria-label', label); pause.setAttribute('data-tip', label); if (window.PZTooltip) PZTooltip.hide(); pause.setAttribute('aria-pressed', String(paused)); }
    pause.onclick = function () { paused = !paused; updatePause(); };
    carousel.addEventListener('focusin', function (event) {
      var card = event.target.closest('.startup-game'); if (!card) return;
      var cardRect = card.getBoundingClientRect(), area = carousel.getBoundingClientRect();
      if (cardRect.left < area.left + 5) carousel.scrollLeft -= area.left + 5 - cardRect.left;
      else if (cardRect.right > area.right - 5) carousel.scrollLeft += cardRect.right - area.right + 5;
      position = carousel.scrollLeft;
    });
    updatePause();
    function animate(now) {
      var delta = lastFrame ? Math.min(now - lastFrame, 50) : 0;
      lastFrame = now;
      var inFocus = carousel.contains(document.activeElement) || carousel.closest('.startup-featured').querySelector(':focus-visible');
      var canMove = carousel.scrollWidth > carousel.clientWidth + 1 && !carousel.hidden && !paused && !document.hidden && !carousel.matches(':hover') && !inFocus && !motion.matches && !root.hidden && !document.getElementById('startupHomeView').hidden;
      if (now < manualUntil) {
        position = carousel.scrollLeft;
      } else {
        var beforeNormalize = carousel.scrollLeft;
        normalize();
        if (carousel.scrollLeft !== beforeNormalize) position = carousel.scrollLeft;
        if (canMove) {
          position += delta * 0.025;
          carousel.scrollLeft = position;
          // Keep subpixel progress even where the browser rounds scrollLeft.
          if (carousel.scrollLeft === 0 && position < 1) position = Math.max(position, 0);
        }
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    window.addEventListener('pgz:langchange', function () { updatePause(); if (selectedFeed === 'recent') selectFeed('recent'); if (!document.getElementById('startupProjectsView').hidden) setCatalogMode(catalogMode); });
  }
  window.PGZStartupHome = { projectPage: projectPage, recentGames: recentGames };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
