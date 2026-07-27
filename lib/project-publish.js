/** Публикация проектов (локальное хранилище; позже — облако) */
(function (global) {
    'use strict';

    var DB_NAME = 'PGZPublished';
    var STORE = 'projects';
    var DB_VERSION = 1;
    var MAX_PUBLISH_BYTES = 8 * 1024 * 1024;
    var SLOT_MAP_KEY = 'pgz_publish_by_slot';
    var ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

    function generatePublishId(length) {
        length = length || 6;
        var id = '';
        for (var i = 0; i < length; i++) {
            id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
        }
        return id;
    }

    function getAppBasePath() {
        if (!global.location) return '/';
        var path = global.location.pathname || '/';
        if (path.endsWith('/index.html')) {
            return path.slice(0, -('/index.html'.length)) || '/';
        }
        if (path.endsWith('/play.html')) {
            return path.slice(0, -('/play.html'.length)) || '/';
        }
        if (path.endsWith('/')) {
            return path;
        }
        var lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }

    function buildPlayUrl(id) {
        var origin = global.location.origin;
        var base = getAppBasePath();
        if (!base.endsWith('/')) base += '/';
        return origin + base + 'play.html?id=' + encodeURIComponent(id);
    }

    function readSlotMap() {
        try {
            return JSON.parse(global.localStorage.getItem(SLOT_MAP_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function writeSlotMap(map) {
        global.localStorage.setItem(SLOT_MAP_KEY, JSON.stringify(map));
    }

    function getActiveSlotIndex() {
        if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.getActiveSlotIndex) {
            return PGZProjectGallery.getActiveSlotIndex();
        }
        var raw = global.localStorage.getItem('pgz_active_slot');
        if (raw === null || raw === '') return null;
        return parseInt(raw, 10);
    }

    function openDb() {
        return new Promise(function (resolve, reject) {
            var request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = function (event) {
                var db = event.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    function idbRequest(request) {
        return new Promise(function (resolve, reject) {
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    async function savePublished(record) {
        var db = await openDb();
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        return new Promise(function (resolve, reject) {
            tx.oncomplete = function () { resolve(record); };
            tx.onerror = function () { reject(tx.error); };
        });
    }

    async function loadPublished(id) {
        var db = await openDb();
        var tx = db.transaction(STORE, 'readonly');
        return idbRequest(tx.objectStore(STORE).get(id));
    }

    async function publishProject() {
        if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.saveActiveSlotNow) {
            await PGZProjectGallery.saveActiveSlotNow();
        }

        if (typeof PGZProjectIO === 'undefined') {
            throw new Error('PGZProjectIO не загружен');
        }

        var built = await PGZProjectIO.buildProjectZipBlob();
        if (built.error === 'empty') {
            return { error: 'empty' };
        }

        var blob = built.blob;
        if (blob.size > MAX_PUBLISH_BYTES) {
            return { error: 'size', maxBytes: MAX_PUBLISH_BYTES, size: blob.size };
        }

        var code = '';
        if (typeof PythonIDE !== 'undefined' && PythonIDE.files && PythonIDE.files['my_pgz.py']) {
            code = PythonIDE.files['my_pgz.py'].trim();
        }
        if (!code) {
            return { error: 'no_code' };
        }

        var slotIndex = getActiveSlotIndex();
        var slotMap = readSlotMap();
        var id = (slotIndex !== null && slotMap[String(slotIndex)]) || generatePublishId();
        var arrayBuffer = await blob.arrayBuffer();

        var record = {
            id: id,
            title: built.title,
            blob: arrayBuffer,
            size: blob.size,
            updatedAt: Date.now()
        };

        await savePublished(record);

        if (slotIndex !== null) {
            slotMap[String(slotIndex)] = id;
            writeSlotMap(slotMap);
        }

        var portable = null;
        if (typeof PGZPublishLink !== 'undefined') {
            portable = await PGZPublishLink.encodePortableUrl(blob, built.title);
        }

        if (portable && portable.error === 'link_too_large') {
            return {
                error: 'link_too_large',
                maxBytes: portable.maxBytes,
                compressedSize: portable.compressedSize
            };
        }

        return {
            id: id,
            title: built.title,
            url: portable && portable.url ? portable.url : buildPlayUrl(id),
            portable: Boolean(portable && portable.url),
            updated: Boolean(slotMap[String(slotIndex)] && slotMap[String(slotIndex)] === id)
        };
    }

    function copyText(text) {
        if (global.navigator.clipboard && global.navigator.clipboard.writeText) {
            return global.navigator.clipboard.writeText(text);
        }
        return new Promise(function (resolve, reject) {
            var area = global.document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            global.document.body.appendChild(area);
            area.select();
            try {
                global.document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            } finally {
                area.remove();
            }
        });
    }

    function showSuccessScreen(result) {
        var screen = global.document.getElementById('projectPublishScreen');
        if (!screen) return;

        var titleEl = global.document.getElementById('publishSuccessTitle');
        var urlEl = global.document.getElementById('publishSuccessUrl');
        var copyBtn = global.document.getElementById('publishCopyLinkBtn');
        var openBtn = global.document.getElementById('publishOpenLinkBtn');

        if (titleEl) titleEl.textContent = '«' + result.title + '»';
        if (urlEl) {
            urlEl.value = result.url;
            urlEl.onclick = function () { urlEl.select(); };
            urlEl.onfocus = function () { urlEl.select(); };
        }

        if (copyBtn) {
            copyBtn.onclick = async function () {
                try {
                    await copyText(result.url);
                    if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                        PythonIDE.showHint('Ссылка скопирована!');
                    }
                    copyBtn.textContent = 'Скопировано!';
                    setTimeout(function () {
                        copyBtn.textContent = 'Скопировать ссылку';
                    }, 2000);
                } catch (e) {
                    if (typeof message === 'function') {
                        await message('', 'Не удалось скопировать ссылку');
                    }
                }
            };
        }

        if (openBtn) {
            openBtn.onclick = function () {
                global.open(result.url, '_blank', 'noopener');
            };
        }

        screen.hidden = false;
    }

    function hideSuccessScreen() {
        var screen = global.document.getElementById('projectPublishScreen');
        if (screen) screen.hidden = true;
    }

    async function handlePublishClick() {
        if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
            PythonIDE.showHint('Публикуем…');
        }

        try {
            var result = await publishProject();
            if (result.error === 'empty') {
                await message('', 'Нечего публиковать — добавь код или ресурсы.');
                return;
            }
            if (result.error === 'no_code') {
                await message('', 'Добавь код в my_pgz.py перед публикацией.');
                return;
            }
            if (result.error === 'size') {
                var maxMb = Math.round(result.maxBytes / (1024 * 1024));
                await message('', 'Проект слишком большой (макс. ' + maxMb + ' МБ). Уменьши картинки или звуки.');
                return;
            }
            if (result.error === 'link_too_large') {
                var maxLinkKb = Math.round(result.maxBytes / 1024);
                await message('', 'Игра слишком большая для ссылки (макс. ~' + maxLinkKb + ' КБ после сжатия).\n\nУменьши картинки и звуки, или скачай .pgz и загрузи файл в интернет.');
                return;
            }
            showSuccessScreen(result);
        } catch (err) {
            console.error('Publish error:', err);
            await message('', 'Не удалось опубликовать:\n' + (err.message || err));
        }
    }

    global.PGZProjectPublish = {
        publish: publishProject,
        load: loadPublished,
        getPlayUrl: buildPlayUrl,
        showSuccess: showSuccessScreen,
        hideSuccess: hideSuccessScreen,
        publishFromUi: handlePublishClick
    };

    global.PGZProjectPublish._test = {
        generatePublishId: generatePublishId,
        getAppBasePath: getAppBasePath,
        buildPlayUrl: buildPlayUrl,
        MAX_PUBLISH_BYTES: MAX_PUBLISH_BYTES
    };
})(typeof window !== 'undefined' ? window : global);
