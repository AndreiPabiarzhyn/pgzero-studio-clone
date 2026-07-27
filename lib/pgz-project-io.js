/** Сборка и импорт .pgz (общая логика для экспорта, публикации и play.html) */
(function (global) {
    'use strict';

    var MEDIA_FOLDERS = ['images', 'sounds', 'music'];

    function dataURLToBlob(dataUrl) {
        return new Promise(function (resolve) {
            var arr = dataUrl.split(',');
            var mime = arr[0].match(/:(.*?);/)[1];
            var bstr = atob(arr[1]);
            var n = bstr.length;
            var u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            resolve(new Blob([u8arr], { type: mime }));
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

    async function buildProjectZipBlob() {
        if (typeof PGZSession !== 'undefined') PGZSession.flush();
        var filesystem = await ensureFs();
        var zip = new JSZip();

        var imageFiles = await filesystem.ls('/images', 'files');
        var soundFiles = await filesystem.ls('/sounds', 'files');
        var musicFiles = await filesystem.ls('/music', 'files');

        for (var i = 0; i < imageFiles.length; i++) {
            var imageName = imageFiles[i];
            var imageDataUrl = await filesystem.read('/images/' + imageName);
            zip.file('images/' + imageName, await dataURLToBlob(imageDataUrl));
        }

        for (var s = 0; s < soundFiles.length; s++) {
            var soundName = soundFiles[s];
            var soundDataUrl = await filesystem.read('/sounds/' + soundName);
            zip.file('sounds/' + soundName, await dataURLToBlob(soundDataUrl));
        }

        for (var m = 0; m < musicFiles.length; m++) {
            var musicName = musicFiles[m];
            var musicDataUrl = await filesystem.read('/music/' + musicName);
            zip.file('music/' + musicName, await dataURLToBlob(musicDataUrl));
        }

        var pythonCode = getProjectCode();
        if (pythonCode) {
            zip.file('my_pgz.py', new Blob([pythonCode], { type: 'text/plain', endings: 'transparent' }));
        }

        var hasAssets = imageFiles.length + soundFiles.length + musicFiles.length > 0;
        if (!pythonCode && !hasAssets) {
            return { error: 'empty' };
        }

        return {
            blob: await zip.generateAsync({ type: 'blob' }),
            title: getProjectTitle(),
            size: 0
        };
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
            var dataUrl = 'data:application/octet-stream;base64,' + fileData;
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

        if (!options.skipMedia) {
            await importZipMedia(zip);
        }

        if (!options.skipIde && typeof PythonIDE !== 'undefined') {
            PythonIDE.files['my_pgz.py'] = code || '# Пустой проект\n';
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
        return JSZip.loadAsync(blob);
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
        importZipToProject: importZipToProject,
        importZipMedia: importZipMedia,
        loadZipFromUrl: loadZipFromUrl,
        normalizePgzUrl: normalizePgzUrl,
        dataURLToBlob: dataURLToBlob
    };
})(typeof window !== 'undefined' ? window : global);
