/**
 * Запись и замена картинок во внутреннем хранилище (/images/).
 * Один базовый name = один Actor('name') в PGZ — при замене удаляем старые варианты (.png/.jpg).
 */
(function (global) {
    'use strict';

    var IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

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
        stripExtension: stripExtension,
        getExtension: getExtension,
        isImageFileName: isImageFileName,
        normalizeImageFileName: normalizeImageFileName,
        removeImageVariants: removeImageVariants,
        writeImageReplacing: writeImageReplacing,
        resolveUploadImageName: resolveUploadImageName,
        clearRuntimeImageCache: clearRuntimeImageCache
    };

    global.clearRuntimeImageCache = clearRuntimeImageCache;
})(typeof window !== 'undefined' ? window : global);
