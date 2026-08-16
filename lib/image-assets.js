/**
 * Запись и замена картинок во внутреннем хранилище (/images/).
 * Один базовый name = один Actor('name') в PGZ — при замене удаляем старые варианты (.png/.jpg).
 */
(function (global) {
    'use strict';

    var IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    var CONVERTIBLE_TO_JPG = ['.jfif', '.jpe', '.pjpeg', '.pjp'];
    var BLOCKED_EXTENSIONS = ['.svg', '.heic', '.heif', '.avif', '.psd', '.ico'];
    var SUPPORTED_FORMATS_LABEL = 'PNG, JPG, GIF, WEBP';

    function stripExtension(filename) {
        var lastDot = filename.lastIndexOf('.');
        if (lastDot > 0 && lastDot < filename.length - 1) {
            return filename.substring(0, lastDot);
        }
        return filename;
    }

    function getExtension(filename) {
        var lastDot = filename.lastIndexOf('.');
        if (lastDot > 0 && lastDot < filename.length - 1) {
            return filename.substring(lastDot);
        }
        return '';
    }

    function isImageFileName(name) {
        var lower = String(name || '').toLowerCase();
        return IMAGE_EXTENSIONS.some(function (ext) { return lower.endsWith(ext); });
    }

    function isConvertibleToJpg(name, mimeType) {
        var ext = getExtension(name).toLowerCase();
        var mime = String(mimeType || '').toLowerCase();
        if (CONVERTIBLE_TO_JPG.indexOf(ext) >= 0) return true;
        return mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/pjpeg';
    }

    function isBlockedImageFormat(name, mimeType) {
        var ext = getExtension(name).toLowerCase();
        var mime = String(mimeType || '').toLowerCase();
        if (BLOCKED_EXTENSIONS.indexOf(ext) >= 0) return true;
        if (mime === 'image/svg+xml') return true;
        return false;
    }

    /**
     * Проверка файла перед загрузкой.
     * Возвращает { ok, uploadName, ext, converted, blocked }.
     */
    function inspectImageUpload(fileMeta) {
        fileMeta = fileMeta || {};
        var name = String(fileMeta.name || 'image');
        var ext = getExtension(name).toLowerCase();
        var mime = String(fileMeta.type || fileMeta.mimeType || '').toLowerCase();

        if (isBlockedImageFormat(name, mime)) {
            return { ok: false, blocked: true, ext: ext || mime, name: name };
        }
        if (isImageFileName(name)) {
            return { ok: true, uploadName: name, ext: ext };
        }
        if (isConvertibleToJpg(name, mime)) {
            return {
                ok: true,
                uploadName: stripExtension(name) + '.jpg',
                ext: ext || '.jpg',
                converted: true,
                name: name
            };
        }
        if (ext) {
            return { ok: false, blocked: true, ext: ext, name: name };
        }
        return { ok: true, uploadName: stripExtension(name) + '.png', ext: '.png' };
    }

    function inspectStoredImageName(fileName) {
        if (isImageFileName(fileName)) {
            return { ok: true, fileName: fileName };
        }
        var ext = getExtension(fileName).toLowerCase();
        if (CONVERTIBLE_TO_JPG.indexOf(ext) >= 0) {
            return {
                ok: false,
                fileName: fileName,
                ext: ext,
                repairTo: stripExtension(fileName) + '.jpg',
                converted: true
            };
        }
        return { ok: false, fileName: fileName, ext: ext, unsupported: true };
    }

    function listUnsupportedStoredImages(fileNames) {
        var bad = [];
        (fileNames || []).forEach(function (fileName) {
            var info = inspectStoredImageName(fileName);
            if (!info.ok) bad.push(info);
        });
        return bad;
    }

    async function repairConvertibleImages(fs) {
        var repaired = [];
        var files = await fs.ls('/images', 'files');
        for (var i = 0; i < files.length; i++) {
            var info = inspectStoredImageName(files[i]);
            if (!info.repairTo || info.repairTo === files[i]) continue;
            var data = await fs.read('/images/' + files[i]);
            await writeImageReplacing(fs, info.repairTo, data);
            if (files[i] !== info.repairTo) {
                await fs.rm('/images/' + files[i]);
            }
            repaired.push({ from: files[i], to: info.repairTo });
        }
        return repaired;
    }

    function normalizeImageFileName(originalName, dataUrl) {
        var lastDot = originalName.lastIndexOf('.');
        var baseName;
        var ext;
        if (lastDot > 0 && lastDot < originalName.length - 1) {
            baseName = originalName.substring(0, lastDot);
            ext = originalName.substring(lastDot);
        } else {
            baseName = originalName;
            ext = '.png';
        }
        var name = baseName + ext;
        if (dataUrl && dataUrl.indexOf('image/jpeg') !== -1 && /\.png$/i.test(name)) {
            name = baseName + '.jpg';
        }
        return name;
    }

    async function removeImageVariants(fs, baseName, keepName) {
        var files = await fs.ls('/images', 'files');
        for (var i = 0; i < files.length; i++) {
            var fileName = files[i];
            if (keepName && fileName === keepName) continue;
            if (stripExtension(fileName) === baseName && isImageFileName(fileName)) {
                await fs.rm('/images/' + fileName);
            }
        }
    }

    async function writeImageReplacing(fs, name, dataUrl) {
        var baseName = stripExtension(name);
        await removeImageVariants(fs, baseName, null);
        await fs.write('/images/' + name, dataUrl);
        return '/images/' + name;
    }

    /**
     * Имя для загрузки: заменяет существующий спрайт с тем же базовым именем;
     * дубликаты в одной пачке файлов получают « (1)», « (2)» и т.д.
     */
    async function resolveUploadImageName(fs, originalName, dataUrl, usedBaseNames) {
        usedBaseNames = usedBaseNames || new Set();
        var name = normalizeImageFileName(originalName, dataUrl);
        var baseName = stripExtension(name);
        var ext = getExtension(name) || '.png';

        if (usedBaseNames.has(baseName)) {
            var counter = 1;
            var candidate;
            do {
                candidate = baseName + ' (' + counter++ + ')' + ext;
            } while (usedBaseNames.has(stripExtension(candidate)));
            name = candidate;
            baseName = stripExtension(name);
        }

        usedBaseNames.add(baseName);
        return name;
    }

    function clearRuntimeImageCache() {
        if (!global.PGZ_IMAGE_CACHE) {
            global.PGZ_IMAGE_CACHE = {};
        } else {
            Object.keys(global.PGZ_IMAGE_CACHE).forEach(function (key) {
                delete global.PGZ_IMAGE_CACHE[key];
            });
        }
        if (!global.PGZ_IMAGE_PROMISES) {
            global.PGZ_IMAGE_PROMISES = {};
        } else {
            Object.keys(global.PGZ_IMAGE_PROMISES).forEach(function (key) {
                delete global.PGZ_IMAGE_PROMISES[key];
            });
        }
        global.PGZ_PRELOAD_COMPLETE = false;
    }

    global.PGZImageAssets = {
        IMAGE_EXTENSIONS: IMAGE_EXTENSIONS,
        CONVERTIBLE_TO_JPG: CONVERTIBLE_TO_JPG,
        SUPPORTED_FORMATS_LABEL: SUPPORTED_FORMATS_LABEL,
        stripExtension: stripExtension,
        getExtension: getExtension,
        isImageFileName: isImageFileName,
        isConvertibleToJpg: isConvertibleToJpg,
        isBlockedImageFormat: isBlockedImageFormat,
        inspectImageUpload: inspectImageUpload,
        inspectStoredImageName: inspectStoredImageName,
        listUnsupportedStoredImages: listUnsupportedStoredImages,
        repairConvertibleImages: repairConvertibleImages,
        normalizeImageFileName: normalizeImageFileName,
        removeImageVariants: removeImageVariants,
        writeImageReplacing: writeImageReplacing,
        resolveUploadImageName: resolveUploadImageName,
        clearRuntimeImageCache: clearRuntimeImageCache
    };

    global.clearRuntimeImageCache = clearRuntimeImageCache;
})(typeof window !== 'undefined' ? window : global);
