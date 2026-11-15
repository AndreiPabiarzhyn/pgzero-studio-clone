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
        if (typeof PGZProjectGallery !== 'undefined' && typeof PGZProjectGallery.getActiveSlot === 'function') {
            return PGZProjectGallery.getActiveSlot();
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

    async function publishProject(options) {
        options = options || {};
        if (typeof PGZProjectIO !== 'undefined' && PGZProjectIO.syncEditorToFiles) {
            PGZProjectIO.syncEditorToFiles();
        }

        if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.flushAndSaveActive) {
            if (getActiveSlotIndex() !== null && !await PGZProjectGallery.flushAndSaveActive()) return { error: 'save_failed' };
        } else if (typeof PGZProjectGallery !== 'undefined' && PGZProjectGallery.saveActiveSlotNow) {
            await PGZProjectGallery.saveActiveSlotNow();
        }

        if (typeof PGZProjectIO === 'undefined') {
            throw new Error('PGZProjectIO не загружен');
        }

        var built = await PGZProjectIO.buildProjectZipBlob({ requireDraw: true });
        if (built.error) {
            return { error: built.error };
        }

        if (options.title) built.title = options.title;
        var blob = built.blob;
        if (!blob || blob.size > MAX_PUBLISH_BYTES) {
            if (blob && blob.size > MAX_PUBLISH_BYTES) {
                return { error: 'size', maxBytes: MAX_PUBLISH_BYTES, size: blob.size };
            }
            return { error: 'empty' };
        }

        var slotIndex = getActiveSlotIndex();
        var slotMap = readSlotMap();
        var previousId = slotIndex !== null ? slotMap[String(slotIndex)] : null;
        var id = previousId || generatePublishId();
        var arrayBuffer = await blob.arrayBuffer();

        var record = {
            id: id,
            title: built.title,
            blob: arrayBuffer,
            size: blob.size,
            updatedAt: Date.now()
        };

        await savePublished(record);

        var preview = options.preview || null;
        if (!preview && options.autoPreview) {
            try { preview = await captureProjectPreview(id); }
            catch (error) { console.warn('Preview capture failed:', error); return { error: 'preview_failed' }; }
        }

        if (slotIndex !== null) {
            slotMap[String(slotIndex)] = id;
            writeSlotMap(slotMap);
        }

        var hostedResult = null;
        if (typeof PGZPublishStatic !== 'undefined' && PGZPublishStatic.canUpload()) {
            try {
                hostedResult = await PGZPublishStatic.uploadGame(id, blob, built.title, preview);
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
                updated: Boolean(previousId)
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

        if (!portable || !portable.url || portable.error) {
            return { error: 'host_and_link_failed', hostMessage: (hostedResult && hostedResult.message) || '' };
        }

        return {
            id: id,
            title: built.title,
            url: portable.url,
            portable: Boolean(portable && portable.url),
            short: false,
            needToken: false,
            hostFailed: Boolean(hostedResult && hostedResult.error === 'host_failed'),
            updated: Boolean(previousId)
        };
    }

    function canvasBlob(canvas) {
        return new Promise(function (resolve, reject) {
            var scaled = document.createElement('canvas');
            var factor = Math.min(1, 800 / canvas.width, 600 / canvas.height);
            scaled.width = Math.max(1, Math.round(canvas.width * factor));
            scaled.height = Math.max(1, Math.round(canvas.height * factor));
            scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
            scaled.toBlob(function (blob) {
                if (!blob || blob.type !== 'image/webp') reject(new Error('WebP unavailable'));
                else resolve(blob);
            }, 'image/webp', 0.86);
        });
    }

    async function imageFileToPreview(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Invalid image');
        var bitmap = await createImageBitmap(file);
        try { return await canvasBlob(bitmap); } finally { bitmap.close(); }
    }

    async function captureProjectPreview(id) {
        var frame = document.createElement('iframe');
        frame.title = 'Game preview';
        frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:900px;height:700px;opacity:0;pointer-events:none';
        frame.src = './play.html?capture=' + encodeURIComponent(id);
        document.body.appendChild(frame);
        var end = Date.now() + 25000;
        var started = false;
        try {
            while (Date.now() < end) {
                await new Promise(function (resolve) { setTimeout(resolve, 250); });
                var win = frame.contentWindow, doc = win && win.document;
                if (!doc) continue;
                var error = doc.getElementById('playError');
                if (error && !error.hidden) throw new Error('Game could not start');
                var intro = doc.getElementById('playIntro');
                if (!started && intro && !intro.hidden) {
                    started = true; doc.getElementById('playPageStartBtn').click();
                }
                var canvas = doc.getElementById('gameCanvas');
                if (started && canvas && win.PythonIDE && win.PythonIDE.running && canvas.width && canvas.height) {
                    var pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                    var painted = false;
                    for (var i = 3; i < pixels.length; i += 4) { if (pixels[i]) { painted = true; break; } }
                    if (painted) {
                        await new Promise(function (resolve) { setTimeout(resolve, 1200); });
                        return await canvasBlob(canvas);
                    }
                }
            }
            throw new Error('Game did not draw a frame');
        } finally {
            try { if (frame.contentWindow.PythonIDE && frame.contentWindow.PythonIDE.stop) frame.contentWindow.PythonIDE.stop(); } catch (e) {}
            try { if (frame.contentWindow.jsfs) (await frame.contentWindow.jsfs._dbPromise).close(); } catch (e) {}
            frame.remove();
            try { indexedDB.deleteDatabase('PGZCapture_' + id + '_filesystem'); } catch (e) {}
        }
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
                if (!global.document.execCommand('copy')) throw new Error('Copy failed');
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

    async function submitPublication(options) {
        showLoadingOverlay();

        try {
            var result = await publishProject(options);
            if (result.error === 'preview_failed') {
                var details = document.getElementById('publishDetailsDialog');
                var errorEl = document.getElementById('publishDetailsError');
                errorEl.textContent = t('publish.captureFailed', null, 'Не удалось сделать снимок. Проверь игру или загрузи картинку вручную.');
                errorEl.hidden = false;
                details.showModal();
                return;
            }
            if (result.error === 'save_failed') {
                await message('', t('gallery.saveFailed', null, 'Не удалось сохранить проект.'));
                return;
            }
            if (result.error === 'empty') {
                await message('', t('publish.empty'));
                return;
            }
            if (result.error === 'no_code') {
                await message('', t('publish.noCode'));
                return;
            }
            if (result.error === 'no_draw') {
                await message('', t('publish.noDraw'));
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
            if (result.portable && (options.preview || options.autoPreview) && typeof PythonIDE !== 'undefined' && PythonIDE.showHint) {
                PythonIDE.showHint(t('publish.coverPortable', null, 'Обложка доступна только при публикации в библиотеку.'));
            }
            showSuccessScreen(result);
        } catch (err) {
            console.error('Publish error:', err);
            await message('', t('publish.failed', { detail: formatHostError(err.message || String(err)) }));
        } finally {
            hideLoadingOverlay();
        }
    }

    function handlePublishClick() {
        var dialog = document.getElementById('publishDetailsDialog');
        var name = document.getElementById('publishGameName');
        var file = document.getElementById('publishCoverFile');
        var image = document.getElementById('publishCoverPreview');
        var remove = document.getElementById('publishCoverRemove');
        var errorEl = document.getElementById('publishDetailsError');
        var sourceName = document.getElementById('projectNameInput');
        file.value = ''; image.hidden = true; image.removeAttribute('src'); remove.hidden = true; errorEl.hidden = true;
        name.value = sourceName ? sourceName.value.trim() : '';
        name.setCustomValidity('');
        dialog.showModal();
        name.focus();
        if (dialog.dataset.bound) return;
        dialog.dataset.bound = '1';
        document.getElementById('publishDetailsClose').onclick = function () { dialog.close(); };
        document.getElementById('publishDetailsCancel').onclick = function () { dialog.close(); };
        document.getElementById('publishCoverChoose').onkeydown = function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); file.click(); }
        };
        name.oninput = function () { name.setCustomValidity(''); };
        file.onchange = async function () {
            errorEl.hidden = true;
            if (!file.files[0]) return;
            try {
                var blob = await imageFileToPreview(file.files[0]);
                if (image.dataset.url) URL.revokeObjectURL(image.dataset.url);
                image.dataset.url = URL.createObjectURL(blob); image.src = image.dataset.url; image.hidden = false; remove.hidden = false;
            } catch (e) {
                file.value = ''; image.hidden = true; remove.hidden = true;
                errorEl.textContent = t('publish.coverInvalid', null, 'Выбери PNG, JPEG или WebP размером до 8 МБ.'); errorEl.hidden = false;
            }
        };
        remove.onclick = function () { file.value = ''; image.hidden = true; remove.hidden = true; if (image.dataset.url) URL.revokeObjectURL(image.dataset.url); delete image.dataset.url; };
        document.getElementById('publishDetailsForm').onsubmit = async function (event) {
            event.preventDefault();
            var title = name.value.trim();
            if (!title) { name.setCustomValidity(t('publish.nameRequired', null, 'Введи название игры.')); name.reportValidity(); return; }
            var preview = null;
            if (file.files[0]) {
                try { preview = await imageFileToPreview(file.files[0]); }
                catch (e) { errorEl.textContent = t('publish.coverInvalid', null, 'Выбери PNG, JPEG или WebP размером до 8 МБ.'); errorEl.hidden = false; return; }
            }
            dialog.close();
            await submitPublication({ title: title, preview: preview, autoPreview: !preview });
        };
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
