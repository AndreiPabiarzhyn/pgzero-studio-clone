# PGZero Studio

Браузерная среда для создания игр на [Pygame Zero](https://pygame-zero.readthedocs.io/).
Python выполняется в браузере через Skulpt — установка не нужна.

Русскоязычный форк [PGZ Studio](https://ed-info.github.io/pgz/) с собственным дизайном для детей и начинающих.

**Репозиторий:** https://github.com/AndreiPabiarzhyn/pgzero-studio-clone

## Возможности

- Редактор кода: Monokai, Fira Code, автодополнение PGZ, +/- масштаб
- Запуск игр в браузере (кнопка «Играть»)
- Стартовый пример — мини-раннер
- Галерея ресурсов, редактор спрайтов, ZIP import/export
- Справочник и FAQ по коду
- Панели с изменяемым размером (splitter)
- Автосохранение, история кода (5 версий), сжатие картинок

## Хранение данных

- **Код** — автосохранение и история в localStorage браузера
- **Картинки и звуки** — IndexedDB; картинки сжимаются до 1024px
- **Перенос между ПК** — сохраните игру как `.pgz` на диск

## Запуск

```bash
python -m http.server 8100
```

Откройте http://localhost:8100/index.html

> Нужен HTTP-сервер — через `file://` IDE не заработает.

## GitHub Pages

Сайт: **https://andreipabiarzhyn.github.io/pgzero-studio-clone/**

Автодеплой при push в `master` (workflow `.github/workflows/deploy-pages.yml`).

Первый раз: репозиторий → **Settings → Pages → Build and deployment → GitHub Actions**.

Файл `.nojekyll` уже в корне.

## Структура

| Путь | Назначение |
|------|------------|
| `index.html` | Главная страница IDE |
| `lib/lib.js` | Ядро PythonIDE |
| `lib/editor-ide.js` | Улучшения редактора |
| `lib/layout-splitters.js` | Resize панелей |
| `lib/session.js` | Автосохранение сессии |
| `lib/code-history.js` | История версий кода |
| `lib/storage-guard.js` | Сжатие картинок, лимиты |
| `lib/starter-code.js` | Код при первом запуске |
| `theme.css` | Тема приложения |
| `lib/cm/monokai.css` | Тема редактора |

Подробный снимок версии: [CHECKPOINT.md](CHECKPOINT.md)

## Attribution / Благодарности

**PGZero Studio** — производная работа (fork) проекта [PGZ Studio](https://ed-info.github.io/pgz/), распространяемого под [GNU GPL v3](LICENSE).

| | |
|---|---|
| **Оригинал** | [PGZ Studio](https://ed-info.github.io/pgz/) — браузерная IDE для Pygame Zero |
| **Этот форк** | Русский интерфейс, свой дизайн, заготовки игр, галерея слотов, доработки движка |
| **Автор форка** | Andrei Pabiarzhyn |

Изменения в PGZero Studio распространяются на тех же условиях **GPL-3.0**: исходный код открыт, лицензия сохраняется, производные работы — тоже под GPL.

## Лицензия

[GNU GPL v3](LICENSE) — как у исходного PGZ Studio. Полный текст лицензии — в файле [LICENSE](LICENSE).
