# PGZero Studio

Браузерная среда для создания игр на [Pygame Zero](https://pygame-zero.readthedocs.io/).
Python выполняется в браузере через Skulpt — установка не нужна.

Русскоязычный форк [PGZ Studio](https://ed-info.github.io/pgz/) с собственным дизайном для детей и начинающих.

**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone

## Возможности

- Редактор кода: Monokai, Fira Code, автодополнение PGZ, +/- масштаб
- Запуск игр в браузере (F5)
- Стартовый пример — мини-раннер
- Галерея ресурсов, редактор спрайтов, ZIP import/export
- Справочник и FAQ по коду
- Панели с изменяемым размером (splitter)

## Запуск

```bash
python -m http.server 8100
```

Откройте http://localhost:8100/index.html

> Нужен HTTP-сервер — через `file://` IDE не заработает.

## GitHub Pages

1. Settings → Pages → Branch: `master`, folder `/ (root)`
2. Файл `.nojekyll` уже в репозитории

## Структура

| Путь | Назначение |
|------|------------|
| `index.html` | Главная страница IDE |
| `lib/lib.js` | Ядро PythonIDE |
| `lib/editor-ide.js` | Улучшения редактора |
| `lib/layout-splitters.js` | Resize панелей |
| `lib/starter-code.js` | Код при первом запуске |
| `theme.css` | Тема приложения |
| `lib/cm/monokai.css` | Тема редактора |

Подробный снимок версии: [CHECKPOINT.md](CHECKPOINT.md)

## Лицензия

[GNU GPL v3](LICENSE) — как у исходного PGZ Studio.
