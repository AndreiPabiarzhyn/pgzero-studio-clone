# Checkpoint — PGZero Studio

**Дата:** 2026-07-27  
**Ветка:** `master`  
**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone  
**GitHub Pages:** https://andreipabiarzhyn.github.io/pgzero-studio-clone/

## Состояние на чекпоинт

### Заготовки игр
- Кнопка **«Заготовки»** в тулбаре → модалка «Выбери проект» (4 плашки)
- **`lib/game-templates.js`** — пустой код + картинки из `.pgz`
- Ассеты в `assets/templates/`:

| № | Игра | Файл |
|---|------|------|
| 1 | RunnerGame | `runner/RunnerGame.pgz` (~934 KB) |
| 2 | MeteorGame | `meteor/MeteorGame.pgz` (~297 KB) |
| 3 | ClickerGame | `clicker/ClickerGame.pgz` (~519 KB) |
| 4 | Roguelike | `roguelike/Roguelike.pgz` (~22 KB) |

### Движок
- `keyboard.enter` работает как алиас для `return`
- Canvas очищается перед каждым `draw()`
- Mouse handlers: `on_mouse_down(button, pos)` — правильный порядок аргументов

### Хранилище и UI
- 6 слотов проектов, автосохранение, история кода (5 версий)
- Галерея ресурсов, сжатие картинок (`storage-guard.js`)
- Версия в футере (`version.json`, авто-bump через `.githooks/pre-commit`)
- Тёмная тема, favicon, без автозапуска на F5

### Тесты
```bash
npm test
```
6 файлов, 18 тестов.

## Запуск локально

```bash
cd D:\Projects\pgzStudio
python -m http.server 8100 --bind 127.0.0.1
```

Открыть: http://localhost:8100/index.html

> Если `ERR_EMPTY_RESPONSE` — зависший Python-сервер. Убить процесс на порту 8100 и перезапустить.

## Следующие шаги

- Превью-картинки на плашках заготовок в модалке
- Drag-and-drop в галерею
- PWA / офлайн
