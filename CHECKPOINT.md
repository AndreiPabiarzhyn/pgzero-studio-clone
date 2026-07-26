# Checkpoint — PGZero Studio

**Дата:** 2026-07-26  
**Ветка:** `master`  
**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone

## Состояние на чекпоинт

### UI и брендинг
- Русский интерфейс, детская светлая тема приложения
- SVG-иконки вместо эмодзи (`lib/icons.js`)
- Упрощённая панель: Играть, файлы, спрайт, ресурсы, сохранить, «Ещё»
- Скрытие/показ правой панели

### Редактор кода (IDE)
- Тема **Monokai**, шрифт **Fira Code**
- Панель вкладок, строка состояния, +/- масштаб кода
- Горячие клавиши: F5, Ctrl+/, Ctrl+F, Ctrl+S, Ctrl+/−
- Автодополнение Pygame Zero (`lib/editor-ide.js`)
- Стартовый код — мини-раннер (`lib/starter-code.js`)

### Макет
- Изменяемые размеры панелей (splitter): редактор / консоль / sidebar
- Закрытие модалок: кнопка, Esc, клик снаружи (`lib/modals.js`)

### Контент
- Справочник + FAQ (`pgz-handbook.html`)
- Встроенный редактор спрайтов (`draw-editor.html`)
- Модалка «Файлы проекта» (`lib/project-files.js`)

## Запуск локально

```bash
python -m http.server 8100
```

http://localhost:8100/index.html

## Следующие шаги (идеи)

- Шаблоны игр при «Новая игра»
- Snippets по Tab (`def`, `draw`, `update`)
- GitHub Pages из коробки
