/** Сборка и импорт .pgz (общая логика для экспорта, публикации и play.html) */
(function (global) {
    'use strict';

    var MEDIA_FOLDERS = ['images', 'sounds', 'music'];

    function dataURLToUint8Array(dataUrl) {
        if (dataUrl == null || typeof dataUrl !== 'string' || dataUrl.indexOf(',') === -1) {
            throw new Error('Повреждённый файл ресурса (нет данных). Удалите и загрузите картинку заново.');
        }
        var arr = dataUrl.split(',');
        var mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
            throw new Error('Неверный формат файла ресурса');
        }
        var bstr = atob(arr[1]);
        var n = bstr.length;
        var u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return u8arr;
    }

    function dataURLToBlob(dataUrl) {
        if (dataUrl == null || typeof dataUrl !== 'string' || dataUrl.indexOf(',') === -1) {
            throw new Error('Повреждённый файл ресурса (нет данных). Удалите и загрузите картинку заново.');
        }
        return new Promise(function (resolve, reject) {
            try {
                var mimeMatch = dataUrl.split(',')[0].match(/:(.*?);/);
                if (!mimeMatch) {
                    throw new Error('Неверный формат файла ресурса');
                }
                resolve(new Blob([dataURLToUint8Array(dataUrl)], { type: mimeMatch[1] }));
            } catch (e) {
                reject(e);
            }
        });
    }

    async function ensureFs() {
        if (typeof initFS === 'function') {
            await initFS();
        }
        var filesystem = global.jsfs || global.fs;
        if (!filesystem) {
            throw new Error('Файловая система не инициализирована');
        }
        return filesystem;
    }

    function getProjectTitle() {
        var input = global.document && global.document.getElementById('projectNameInput');
        if (input && input.value && input.value.trim()) {
            return input.value.trim();
        }
        return 'Моя игра';
    }

    function getProjectCode() {
        if (typeof PythonIDE === 'undefined' || !PythonIDE.files) {
            return '';
        }
        if (PythonIDE.files['my_pgz.py']) {
            return PythonIDE.files['my_pgz.py'];
        }
        if (PythonIDE.currentFile && PythonIDE.files[PythonIDE.currentFile]) {
            return PythonIDE.files[PythonIDE.currentFile];
        }
        return '';
    }

    function syncEditorToFiles() {
        if (typeof PythonIDE !== 'undefined' && PythonIDE.editor && PythonIDE.currentFile) {
            PythonIDE.files[PythonIDE.currentFile] = PythonIDE.editor.getValue();
        }
    }

    async function addAssetsToZip(zip, assets) {
        assets = assets || {};
        var folders = ['images', 'sounds', 'music'];
        for (var f = 0; f < folders.length; f++) {
            var folder = folders[f];
            var items = assets[folder] || [];
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                if (!item || !item.name || !item.dataUrl) continue;
                zip.file(folder + '/' + item.name, dataURLToUint8Array(item.dataUrl));
            }
        }
    }

    async function zipToBlob(zip) {
        var bytes = await zip.generateAsync({ type: 'uint8array' });
        return new Blob([bytes], { type: 'application/zip' });
    }

    async function buildProjectZipFromData(data) {
        if (!data || !data.files) return { error: 'empty' };
        var zip = new JSZip();
        var code = data.files['my_pgz.py'];
        if (!code && data.currentFile && data.files[data.currentFile]) {
            code = data.files[data.currentFile];
        }
        code = code ? String(code) : '';
        if (!code.trim()) {
            return { error: 'no_code' };
        }
        zip.file('my_pgz.py', code);
        await addAssetsToZip(zip, data.assets);
        return {
            blob: await zipToBlob(zip),
            title: (data.projectName && data.projectName.trim()) || getProjectTitle(),
            size: 0
        };
    }

    async function buildProjectZipFromActiveSlot() {
        if (typeof PGZProjectGallery === 'undefined' ||
            typeof PGZProjectGallery.getActiveSlot !== 'function' ||
            typeof PGZProjectGallery.getSlot !== 'function') {
            return null;
        }
        var idx = PGZProjectGallery.getActiveSlot();
        if (idx === null) return null;
        var data = await PGZProjectGallery.getSlot(idx);
        if (!data) return null;
        return buildProjectZipFromData(data);
    }

    async function buildProjectZipBlob() {
        syncEditorToFiles();
        if (typeof PGZSession !== 'undefined') PGZSession.flush();

        var fromSlot = await buildProjectZipFromActiveSlot();
        if (fromSlot && !fromSlot.error) {
            return fromSlot;
        }

        var filesystem = await ensureFs();
        var zip = new JSZip();

        var imageFiles = await filesystem.ls('/images', 'files');
        var soundFiles = await filesystem.ls('/sounds', 'files');
        var musicFiles = await filesystem.ls('/music', 'files');

        for (var i = 0; i < imageFiles.length; i++) {
            var imageName = imageFiles[i];
            var imageDataUrl = await filesystem.read('/images/' + imageName);
            if (!imageDataUrl || typeof imageDataUrl !== 'string') {
                console.warn('PGZProjectIO: skip broken image', imageName);
                continue;
            }
            zip.file('images/' + imageName, dataURLToUint8Array(imageDataUrl));
        }

        for (var s = 0; s < soundFiles.length; s++) {
            var soundName = soundFiles[s];
            var soundDataUrl = await filesystem.read('/sounds/' + soundName);
            if (!soundDataUrl || typeof soundDataUrl !== 'string') {
                console.warn('PGZProjectIO: skip broken sound', soundName);
                continue;
            }
            zip.file('sounds/' + soundName, dataURLToUint8Array(soundDataUrl));
        }

        for (var m = 0; m < musicFiles.length; m++) {
            var musicName = musicFiles[m];
            var musicDataUrl = await filesystem.read('/music/' + musicName);
            if (!musicDataUrl || typeof musicDataUrl !== 'string') {
                console.warn('PGZProjectIO: skip broken music', musicName);
                continue;
            }
            zip.file('music/' + musicName, dataURLToUint8Array(musicDataUrl));
        }

        var pythonCode = getProjectCode().trim();
        if (!pythonCode) {
            return { error: 'no_code' };
        }
        zip.file('my_pgz.py', pythonCode);

        return {
            blob: await zipToBlob(zip),
            title: getProjectTitle(),
            size: 0
        };
    }

    function zipHasMediaEntries(zip) {
        return Object.keys(zip.files).some(function (name) {
            if (name.endsWith('/')) return false;
            var folder = name.split('/')[0];
            return MEDIA_FOLDERS.indexOf(folder) !== -1;
        });
    }

    async function isZipBlob(blob) {
        if (!blob || !blob.size) return false;
        var head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        return head[0] === 0x50 && head[1] === 0x4B;
    }

    async function loadZipFromBlob(blob) {
        if (!(await isZipBlob(blob))) {
            throw new Error('invalid_pgz');
        }
        return JSZip.loadAsync(blob);
    }

    function mimeFromMediaPath(path) {
        var lower = path.toLowerCase();
        if (lower.endsWith('.ogg')) return 'audio/ogg';
        if (lower.endsWith('.mp3')) return 'audio/mpeg';
        if (lower.endsWith('.wav')) return 'audio/wav';
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        return 'application/octet-stream';
    }

    async function importZipMedia(zip) {
        var filesystem = await ensureFs();
        var allFiles = Object.keys(zip.files).filter(function (name) {
            return !name.endsWith('/');
        });

        for (var i = 0; i < allFiles.length; i++) {
            var path = allFiles[i];
            var folder = path.split('/')[0];
            if (MEDIA_FOLDERS.indexOf(folder) === -1) continue;

            var fileEntry = zip.file(path);
            if (!fileEntry) continue;

            var fileData = await fileEntry.async('base64');
            var dataUrl = 'data:' + mimeFromMediaPath(path) + ';base64,' + fileData;
            if (folder === 'images' && typeof PGZStorageGuard !== 'undefined') {
                var mime = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
                dataUrl = 'data:' + mime + ';base64,' + fileData;
                var optimized = await PGZStorageGuard.prepareImageDataUrl(dataUrl, path.split('/').pop());
                dataUrl = optimized.dataUrl;
            }
            await filesystem.write('/' + path, dataUrl);
        }
    }

    async function importZipToProject(zip, options) {
        options = options || {};
        var codeEntry = zip.file('my_pgz.py');
        var code = codeEntry ? await codeEntry.async('text') : '';
        code = code ? String(code) : '';

        if (!code.trim() && !zipHasMediaEntries(zip)) {
            throw new Error('empty_project');
        }

        if (!options.skipMedia) {
            await importZipMedia(zip);
        }

        if (!options.skipIde && typeof PythonIDE !== 'undefined') {
            PythonIDE.files['my_pgz.py'] = code.trim() ? code : '# Пустой проект\n';
            PythonIDE.currentFile = 'my_pgz.py';
            if (PythonIDE.editor) {
                PythonIDE.editor.setValue(PythonIDE.files['my_pgz.py']);
            }
            if (PythonIDE.updateFileTabs) PythonIDE.updateFileTabs();
        }

        return {
            code: code,
            title: options.title || getProjectTitle()
        };
    }

    async function loadZipFromUrl(rawUrl) {
        var pgzUrl = normalizePgzUrl(rawUrl);
        var response = await fetch(pgzUrl);
        if (!response.ok) {
            throw new Error('Ошибка загрузки: ' + response.status + ' ' + response.statusText);
        }
        var blob = await response.blob();
        return loadZipFromBlob(blob);
    }

    function normalizePgzUrl(input) {
        input = input.trim();
        if (input.startsWith('http://') || input.startsWith('https://')) {
            return input;
        }
        if (input.startsWith('//')) {
            return 'https:' + input;
        }
        if (!input.includes('/') && !input.includes('.')) {
            throw new Error('Некорректный адрес проекта');
        }
        return 'https://' + input;
    }

    global.PGZProjectIO = {
        buildProjectZipBlob: buildProjectZipBlob,
        buildProjectZipFromActiveSlot: buildProjectZipFromActiveSlot,
        buildProjectZipFromData: buildProjectZipFromData,
        importZipToProject: importZipToProject,
        importZipMedia: importZipMedia,
        loadZipFromUrl: loadZipFromUrl,
        loadZipFromBlob: loadZipFromBlob,
        isZipBlob: isZipBlob,
        normalizePgzUrl: normalizePgzUrl,
        dataURLToBlob: dataURLToBlob,
        mimeFromMediaPath: mimeFromMediaPath,
        syncEditorToFiles: syncEditorToFiles
    };
})(typeof window !== 'undefined' ? window : global);
