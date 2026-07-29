/** Публикация проектов (GitHub Pages published/ + fallback в URL) */
(function (global) {
    'use strict';

    var DB_NAME = 'PGZPublished';
    var STORE = 'projects';
    var DB_VERSION = 1;
    var MAX_PUBLISH_BYTES = 8 * 1024 * 1024;
    var SLOT_MAP_KEY = 'pgz_publish_by_slot';
    var ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

    function t(key, params, fallback) {
        if (typeof PGZI18n !== 'undefined' && PGZI18n.t) {
            var text = PGZI18n.t(key, params);
            if (text && text !== key) return text;
        }
        return fallback != null ? fallback : key;
    }

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

        var hostedResult = null;
        if (typeof PGZPublishStatic !== 'undefined' && PGZPublishStatic.canUpload()) {
            try {
                hostedResult = await PGZPublishStatic.uploadGame(id, blob, built.title);
            } catch (hostErr) {
                console.warn('GitHub publish failed:', hostErr);
                hostedResult = { error: 'host_failed', message: hostErr.message || String(hostErr) };
            }
        }

        if (hostedResult && !hostedResult.error) {
            return {
                id: id,
                title: built.title,
                url: buildPlayUrl(id),
                short: true,
                updated: Boolean(slotMap[String(slotIndex)] && slotMap[String(slotIndex)] === id)
            };
        }

        var portable = null;
        if (typeof PGZPublishLink !== 'undefined') {
            portable = await PGZPublishLink.encodePortableUrl(blob, built.title);
        }

        if (portable && portable.error === 'link_too_large') {
            if (hostedResult && hostedResult.error === 'host_failed') {
                return {
                    error: 'host_and_link_failed',
                    hostMessage: hostedResult.message
                };
            }
            if (typeof PGZPublishStatic !== 'undefined' && !PGZPublishStatic.canUpload()) {
                return {
                    error: 'link_too_large',
                    maxBytes: portable.maxBytes,
                    compressedSize: portable.compressedSize,
                    needToken: true
                };
            }
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
            short: false,
            needToken: false,
            hostFailed: Boolean(hostedResult && hostedResult.error === 'host_failed'),
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

    function showLoadingOverlay() {
        var overlay = global.document.getElementById('projectPublishLoading');
        if (!overlay) return;

        var textEl = overlay.querySelector('.pg-publish-loading__text');
        if (textEl) textEl.textContent = t('publish.publishing');
        var hintEl = overlay.querySelector('.pg-publish-loading__hint');
        if (hintEl) hintEl.textContent = t('publish.publishingHint');

        overlay.hidden = false;
        var publishBtn = global.document.getElementById('btn_pgz_publish');
        if (publishBtn) publishBtn.disabled = true;
    }

    function hideLoadingOverlay() {
        var overlay = global.document.getElementById('projectPublishLoading');
        if (overlay) overlay.hidden = true;
        var publishBtn = global.document.getElementById('btn_pgz_publish');
        if (publishBtn) publishBtn.disabled = false;
    }

    function showSuccessScreen(result) {
        var screen = global.document.getElementById('projectPublishScreen');
        if (!screen) return;

        var titleEl = global.document.getElementById('publishSuccessTitle');
        var urlEl = global.document.getElementById('publishSuccessUrl');
        var copyBtn = global.document.getElementById('publishCopyLinkBtn');
        var openBtn = global.document.getElementById('publishOpenLinkBtn');

        if (titleEl) titleEl.textContent = '«' + result.title + '»';
        var urlLabel = global.document.querySelector('label[for="publishSuccessUrl"]');
        if (urlLabel) {
            urlLabel.textContent = result.short
                ? t('publish.urlLabel')
                : t('publish.urlLabelLong');
        }
        if (urlEl) {
            urlEl.value = result.url;
            urlEl.rows = result.short ? 1 : 3;
            urlEl.onclick = function () { urlEl.select(); };
            urlEl.onfocus = function () { urlEl.select(); };
        }
        if (copyBtn) {
            copyBtn.textContent = t('publish.copyLink');
            copyBtn.onclick = async function () {
                try {
                    await copyText(result.url);
                    if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                        PythonIDE.showHint(t('publish.linkCopied'));
                    }
                    copyBtn.textContent = t('publish.copied');
                    setTimeout(function () {
                        copyBtn.textContent = t('publish.copyLink');
                    }, 2000);
                } catch (e) {
                    if (typeof message === 'function') {
                        await message('', t('publish.copyFailed'));
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

    function formatHostError(message) {
        message = message || '';
        if (message.indexOf('401') >= 0 || message.indexOf('403') >= 0) {
            return t('publish.hostToken');
        }
        if (message.indexOf('Failed to fetch') >= 0 || message.indexOf('NetworkError') >= 0) {
            return t('publish.hostNetwork');
        }
        return message;
    }

    async function handlePublishClick() {
        showLoadingOverlay();

        try {
            var result = await publishProject();
            if (result.error === 'empty') {
                await message('', t('publish.empty'));
                return;
            }
            if (result.error === 'no_code') {
                await message('', t('publish.noCode'));
                return;
            }
            if (result.error === 'size') {
                var maxMb = Math.round(result.maxBytes / (1024 * 1024));
                await message('', t('publish.tooBig', { mb: maxMb }));
                return;
            }
            if (result.error === 'link_too_large') {
                var maxLinkKb = Math.round(result.maxBytes / 1024);
                await message('', t('publish.linkTooBig', { kb: maxLinkKb }));
                return;
            }
            if (result.error === 'host_and_link_failed') {
                await message('', t('publish.hostAndLinkFailed', { detail: formatHostError(result.hostMessage) }));
                return;
            }
            if (result.hostFailed && result.portable) {
                if (typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                    PythonIDE.showHint(t('publish.githubFallback'));
                }
            }
            showSuccessScreen(result);
        } catch (err) {
            console.error('Publish error:', err);
            await message('', t('publish.failed', { detail: formatHostError(err.message || String(err)) }));
        } finally {
            hideLoadingOverlay();
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
