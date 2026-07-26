/**
 * Защита хранилища: сжатие картинок, лимиты, контроль quota.
 */
(function (global) {
    'use strict';

    var MAX_IMAGE_DIM = 1024;
    var JPEG_QUALITY = 0.85;
    var MAX_RAW_IMAGE = 12 * 1024 * 1024;
    var MAX_AUDIO = 4 * 1024 * 1024;
    var MAX_MUSIC = 10 * 1024 * 1024;
    var STORAGE_WARN_RATIO = 0.82;

    function formatBytes(bytes) {
        if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function loadImageFromDataUrl(dataUrl) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('Не удалось прочитать изображение')); };
            img.src = dataUrl;
        });
    }

    function canvasToBlob(canvas, mime, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) reject(new Error('Не удалось сжать изображение'));
                else resolve(blob);
            }, mime, quality);
        });
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function scaledSize(w, h, maxDim) {
        if (w <= maxDim && h <= maxDim) return { width: w, height: h };
        var scale = maxDim / Math.max(w, h);
        return {
            width: Math.max(1, Math.round(w * scale)),
            height: Math.max(1, Math.round(h * scale))
        };
    }

    async function optimizeImageDataUrl(dataUrl, options) {
        options = options || {};
        var maxDim = options.maxDim || MAX_IMAGE_DIM;
        var img = await loadImageFromDataUrl(dataUrl);
        var size = scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim);
        var canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size.width, size.height);

        var usePng = /\.png$/i.test(options.filename || '') || dataUrl.indexOf('image/png') !== -1;
        var mime = usePng ? 'image/png' : 'image/jpeg';
        var quality = usePng ? undefined : JPEG_QUALITY;
        var blob = await canvasToBlob(canvas, mime, quality);
        var result = await blobToDataUrl(blob);

        var resized = size.width !== img.naturalWidth || size.height !== img.naturalHeight;
        var note = null;
        if (resized) {
            note = 'Изображение уменьшено до ' + size.width + '×' + size.height;
        }
        return { dataUrl: result, width: size.width, height: size.height, note: note, bytes: blob.size };
    }

    async function prepareImageFile(file) {
        if (!file || !file.type || file.type.indexOf('image/') !== 0) {
            throw new Error('Выберите файл изображения');
        }
        if (file.size > MAX_RAW_IMAGE) {
            throw new Error('Файл слишком большой (' + formatBytes(file.size) + '). Максимум ' + formatBytes(MAX_RAW_IMAGE) + '.');
        }

        var dataUrl = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        var optimized = await optimizeImageDataUrl(dataUrl, { filename: file.name });
        await warnIfStorageHigh();
        return optimized;
    }

    function checkAudioFile(file, isMusic) {
        var limit = isMusic ? MAX_MUSIC : MAX_AUDIO;
        var label = isMusic ? 'музыки' : 'звука';
        if (!file) throw new Error('Файл не выбран');
        if (file.size > limit) {
            throw new Error('Файл ' + label + ' слишком большой (' + formatBytes(file.size) + '). Максимум ' + formatBytes(limit) + '.');
        }
    }

    async function getStorageEstimate() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { usage: null, quota: null, ratio: null };
        }
        try {
            var est = await navigator.storage.estimate();
            var usage = est.usage || 0;
            var quota = est.quota || 0;
            return {
                usage: usage,
                quota: quota,
                ratio: quota ? usage / quota : null
            };
        } catch (e) {
            return { usage: null, quota: null, ratio: null };
        }
    }

    async function warnIfStorageHigh() {
        var est = await getStorageEstimate();
        if (est.ratio === null || est.ratio < STORAGE_WARN_RATIO) return;
        if (typeof message === 'function') {
            await message(
                'Мало места в браузере',
                'Хранилище почти заполнено (' + Math.round(est.ratio * 100) + '%).\n' +
                'Удалите лишние картинки или сохраните игру в .pgz и начните новую.'
            );
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
                throw new Error('Недостаточно места в localStorage браузера. Сохраните .pgz и удалите лишнее.');
            }
            throw e;
        }
    }

    async function prepareImageDataUrl(dataUrl, filename) {
        if (!dataUrl || dataUrl.indexOf('data:image/') !== 0) return { dataUrl: dataUrl, note: null };
        return optimizeImageDataUrl(dataUrl, { filename: filename || '' });
    }

    global.PGZStorageGuard = {
        prepareImageFile: prepareImageFile,
        prepareImageDataUrl: prepareImageDataUrl,
        optimizeImageDataUrl: optimizeImageDataUrl,
        checkAudioFile: checkAudioFile,
        getStorageEstimate: getStorageEstimate,
        warnIfStorageHigh: warnIfStorageHigh,
        safeLocalStorageSet: safeLocalStorageSet,
        formatBytes: formatBytes,
        limits: {
            maxImageDim: MAX_IMAGE_DIM,
            maxRawImage: MAX_RAW_IMAGE,
            maxAudio: MAX_AUDIO,
            maxMusic: MAX_MUSIC
        }
    };
})(window);
