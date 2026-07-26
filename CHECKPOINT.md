# Checkpoint — PGZero Studio

**Дата:** 2026-07-26  
**Коммит:** *(после push — см. `git log -1`)*  
**Ветка:** `master`  
**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone  
**GitHub Pages:** https://andreipabiarzhyn.github.io/pgzero-studio-clone/

## Состояние на чекпоинт

### UI и панель
- Основная панель: **Играть** · панель · галерея · сохранить · открыть · тема ☀/🌙 · «…»
- В «…»: мои файлы, спрайт, новая игра, консоль, справочник, код, настройки
- Цветные SVG-иконки (`lib/icons.js`), плитки в галерее (gAdd, gView, gRename…)
- **Светлая / тёмная тема** всего приложения (`lib/app-theme.js`, `data-app-theme`)
- При старте справа открыта **галерея «Картинки и звуки»**

### Редактор и игра
- Monokai IDE, splitters, без автозакрытия скобок
- `Actor.size = (w, h)` — масштаб спрайта
- Фикс кэша картинок (`PGZ_IMAGE_CACHE`) при запуске
- **Окно игры перетаскиваемое** (`lib/game-modal.js`), позиция в localStorage
- Редактор спрайтов упрощён (`draw-editor.html`, `lib/draw-editor.js`)

### Макет и модалки
- Splitter: редактор / консоль / sidebar
- Закрытие модалок: Esc, клик снаружи (`lib/modals.js`)
- Стартовый код — мини-раннер (`lib/starter-code.js`)

### Деплой
- GitHub Actions: `.github/workflows/deploy-pages.yml`
- Первый раз: Settings → Pages → Source: **GitHub Actions**

## Запуск локально

```bash
python -m http.server 8100
```

http://localhost:8100/index.html

> Один процесс на порт 8100 — иначе `ERR_EMPTY_RESPONSE`.

## Безопасность (кратко)

- Иконки: только статический SVG из `icons.js`
- `gameTitle`: `textContent` (не HTML)
- Тема / позиция окна игры: валидация localStorage
- `postMessage`: проверка `event.source` для редактора спрайтов

## Следующие шаги (идеи)

- Шаблоны игр при «Новая игра»
- Tab-snippets (`def`, `draw`, `update`)
- Пауза / play-pause для звука в галерее (иконка gPause)
