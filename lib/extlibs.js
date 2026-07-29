// Пути к внешним библиотекам, доступным для import из Python-кода
// PGZRUN_ASSET_VERSION синхронизируется scripts/bump-version.mjs
const PGZRUN_ASSET_VERSION = '0.053';
const externalLibs = {
    './pgzrun/__init__.js': 'lib/skulpt/pgzrun/__init__.js?v=' + PGZRUN_ASSET_VERSION
};
