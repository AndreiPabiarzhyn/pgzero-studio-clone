# Checkpoint — PGZero Studio

**Дата:** 2026-07-26  
**Коммит:** `dc180ee`  
**Ветка:** `master`  
**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone  
**GitHub Pages:** https://andreipabiarzhyn.github.io/pgzero-studio-clone/

## Состояние на чекпоинт

### Сессия и автосохранение (Фаза 1)
- **`lib/session.js`** — автосохранение кода и названия проекта в `localStorage.pgz_session`
- Debounce 2 с после правок в редакторе + сохранение при закрытии вкладки
- При старте: модалка **«Продолжить игру?»** / **«Новая игра»**
- Индикатор в тулбаре: «Сохранение…» / «Сохранено ✓»
- «Новая игра» из модалки очищает сессию и IndexedDB-ассеты
- Ctrl+S / кнопка Save → `.pgz` на диск (с flush сессии перед экспортом)
- Fix: очистка `vault` теперь пишет в `localStorage`

### UI и панель
- Тулбар без двойных рамок; надпись **PGZero Studio** (градиент)
- Credits в футере: *Crafted by Andrei Pabiarzhyn*
- Светлая / тёмная тема; контраст галереи в dark mode
- F5 убран — запуск только кнопкой **Играть**
- Лого + favicon в `assets/logo.svg`, `favicon.svg/png/ico`

### Редактор и игра
- Monokai IDE, splitters, `Actor.size`, фикс кэша картинок
- Перетаскиваемое окно игры (`lib/game-modal.js`)
- Редактор спрайтов (`draw-editor.html`)
- Стартовый код — мини-раннер (`lib/starter-code.js`)

### Персистентность (архитектура)
| Слой | Где | Назначение |
|------|-----|------------|
| Сессия | `localStorage.pgz_session` | Код + имя проекта, автовосстановление |
| Ассеты | IndexedDB `PGZfs` | Картинки, звуки, музыка |
| Снимки | `localStorage.vault` | История при Run (legacy) |
| Файл | `.pgz` ZIP | Перенос между компьютерами |

### Деплой
- GitHub Actions: `.github/workflows/deploy-pages.yml`

## Запуск локально

```bash
python -m http.server 8100
```

http://localhost:8100/index.html

## Следующие шаги (идеи)

- Экспорт всех `.py` файлов в `.pgz`
- История версий (3–5 снимков) вместо vault
- Шаблоны игр при «Новая игра»
- PWA / офлайн-установка
