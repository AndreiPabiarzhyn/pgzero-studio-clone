/** PGZero Studio — упрощённый редактор спрайтов */
(function () {
    'use strict';

    var ZOOM_STEPS = [1, 2, 4, 8, 16, 32];
    var DEFAULT_COLORS = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
        '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0',
        '#ffa500', '#800080', '#008000', '#ffc0cb', '#90ee90',
        '#add8e6', '#8b4513', '#2f4f4f', '#b22222', '#daa520'
    ];

    var canvas, ctx, viewport, canvasStage, canvasContainer, resizeHandle;
    var colorPicker, brushSizeInput, brushSizeLabel, zoomLabel;
    var tool = 'brush';
    var isDrawing = false;
    var currentPath = [];
    var history = [];
    var historyIndex = -1;
    var brushSize = 1;
    var zoomIndex = 2;
    var isResizingCanvas = false;
    var resizeStart = {};
    var openedFromFS = false;
    var openedFSPath = null;
    var loadPath = null;

    function $(id) {
        return document.getElementById(id);
    }

    function saveState() {
        history = history.slice(0, historyIndex + 1);
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        historyIndex++;
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        restoreHistoryState(history[historyIndex]);
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        restoreHistoryState(history[historyIndex]);
    }

    function restoreHistoryState(state) {
        canvas.width = state.width;
        canvas.height = state.height;
        syncContainerSize();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = false;
        ctx.putImageData(state, 0, 0);
        render();
    }

    function syncContainerSize() {
        canvasContainer.style.width = canvas.width + 'px';
        canvasContainer.style.height = canvas.height + 'px';
        updateResizeHandle();
    }

    function getZoom() {
        return ZOOM_STEPS[zoomIndex];
    }

    function applyZoom(index) {
        zoomIndex = Math.max(0, Math.min(ZOOM_STEPS.length - 1, index));
        var scale = getZoom();
        canvasStage.style.transform = 'scale(' + scale + ')';
        if (zoomLabel) zoomLabel.textContent = scale + '×';
        updateResizeHandle();
    }

    function fitZoom() {
        var pad = 64;
        var vw = viewport.clientWidth - pad;
        var vh = viewport.clientHeight - pad;
        if (vw <= 0 || vh <= 0) return;
        var fit = Math.min(vw / canvas.width, vh / canvas.height);
        var best = 0;
        for (var i = 0; i < ZOOM_STEPS.length; i++) {
            if (ZOOM_STEPS[i] <= fit) best = i;
        }
        applyZoom(best);
    }

    function updateResizeHandle() {
        var inv = 1 / getZoom();
        resizeHandle.style.transform = 'translate(8px, 8px) scale(' + inv + ')';
    }

    function setTool(name) {
        tool = name;
        document.querySelectorAll('.de-tool').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tool === name);
        });
        canvas.style.cursor = name === 'eyedropper' ? 'crosshair' : 'default';
        render();
    }

    function getCanvasCoords(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: Math.floor(x * scaleX),
            y: Math.floor(y * scaleY)
        };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (x) {
            return x.toString(16).padStart(2, '0');
        }).join('');
    }

    function floodFill(x, y, fillHex, tolerance) {
        tolerance = tolerance || 32;
        var w = canvas.width;
        var h = canvas.height;
        var imageData = ctx.getImageData(0, 0, w, h);
        var data = imageData.data;

        function getColor(px, py) {
            var i = (py * w + px) * 4;
            return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
        }

        function setColor(px, py, c) {
            var i = (py * w + px) * 4;
            data[i] = c.r;
            data[i + 1] = c.g;
            data[i + 2] = c.b;
            data[i + 3] = 255;
        }

        function hexToRgb(hex) {
            return {
                r: parseInt(hex.slice(1, 3), 16),
                g: parseInt(hex.slice(3, 5), 16),
                b: parseInt(hex.slice(5, 7), 16)
            };
        }

        function dist(c1, c2) {
            var dr = c1.r - c2.r;
            var dg = c1.g - c2.g;
            var db = c1.b - c2.b;
            return Math.sqrt(dr * dr + dg * dg + db * db);
        }

        var target = getColor(x, y);
        var fill = hexToRgb(fillHex);
        if (target.r === fill.r && target.g === fill.g && target.b === fill.b && target.a === 255) return;

        var visited = new Uint8Array(w * h);
        var stack = [{ x: x, y: y }];
        visited[y * w + x] = 1;

        while (stack.length) {
            var pt = stack.pop();
            setColor(pt.x, pt.y, fill);
            var neighbors = [[pt.x + 1, pt.y], [pt.x - 1, pt.y], [pt.x, pt.y + 1], [pt.x, pt.y - 1]];
            for (var n = 0; n < neighbors.length; n++) {
                var nx = neighbors[n][0];
                var ny = neighbors[n][1];
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                var idx = ny * w + nx;
                if (visited[idx]) continue;
                var nc = getColor(nx, ny);
                if (target.a === 0) {
                    if (nc.a !== 0) continue;
                } else {
                    if (nc.a === 0 || dist(nc, target) > tolerance) continue;
                }
                visited[idx] = 1;
                stack.push({ x: nx, y: ny });
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function drawBrushStroke(path, color, size, preview) {
        if (!path.length) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (path.length === 1) {
            ctx.beginPath();
            ctx.arc(path[0].x, path[0].y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (var i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawEraserStroke(path, size) {
        if (!path.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (path.length === 1) {
            ctx.beginPath();
            ctx.arc(path[0].x, path[0].y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (var i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (historyIndex >= 0) ctx.putImageData(history[historyIndex], 0, 0);
        if (isDrawing && tool === 'brush') {
            drawBrushStroke(currentPath, colorPicker.value, brushSize, true);
        }
    }

    function onPointerDown(e) {
        if (e.button !== 0) return;
        var pt = getCanvasCoords(e);
        if (tool === 'eyedropper') {
            var px = ctx.getImageData(pt.x, pt.y, 1, 1).data;
            colorPicker.value = rgbToHex(px[0], px[1], px[2]);
            return;
        }
        if (tool === 'fill') {
            floodFill(pt.x, pt.y, colorPicker.value, 48);
            saveState();
            render();
            return;
        }
        if (tool === 'brush' || tool === 'eraser') {
            isDrawing = true;
            currentPath = [pt];
            if (tool === 'eraser') drawEraserStroke(currentPath, brushSize);
        }
    }

    function onPointerMove(e) {
        if (!isDrawing) return;
        var pt = getCanvasCoords(e);
        currentPath.push(pt);
        if (tool === 'eraser') {
            if (currentPath.length < 2) return;
            var last = currentPath[currentPath.length - 2];
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
            ctx.restore();
        } else {
            render();
        }
    }

    function onPointerUp() {
        if (!isDrawing) return;
        isDrawing = false;
        if (tool === 'brush') {
            drawBrushStroke(currentPath, colorPicker.value, brushSize);
        }
        currentPath = [];
        saveState();
        render();
    }

    async function clearCanvas() {
        var ok = await askConfirm('Очистить холст?', 'Все пиксели будут удалены.');
        if (!ok) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
        render();
    }

    async function saveToFS(path) {
        var exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        exportCanvas.getContext('2d').putImageData(history[historyIndex], 0, 0);
        await window.jsfs.write(path, exportCanvas.toDataURL('image/png'));
    }

    function saveImage() {
        var exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        exportCanvas.getContext('2d').putImageData(history[historyIndex], 0, 0);
        var link = document.createElement('a');
        link.download = 'sprite.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }

    function openImage(file) {
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                syncContainerSize();
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                saveState();
                fitZoom();
                render();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    async function preload() {
        var params = new URLSearchParams(window.location.search);
        loadPath = params.get('load');
        if (!loadPath) return;
        try {
            var base64 = await window.jsfs.read(loadPath);
            var img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                syncContainerSize();
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                saveState();
                openedFromFS = true;
                openedFSPath = loadPath;
                fitZoom();
                render();
            };
            img.onerror = function () { message('Ошибка', 'Не удалось загрузить изображение'); };
            img.src = base64;
        } catch (err) {
            message('Ошибка', err.message || 'Не удалось открыть файл');
        }
    }

    function buildPalette() {
        var palette = $('colorPalette');
        DEFAULT_COLORS.forEach(function (color) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'de-swatch';
            btn.style.backgroundColor = color;
            btn.title = color;
            btn.addEventListener('click', function () {
                colorPicker.value = color;
            });
            palette.appendChild(btn);
        });
    }

    function bindUI() {
        document.querySelectorAll('.de-tool[data-tool]').forEach(function (btn) {
            btn.addEventListener('click', function () { setTool(btn.dataset.tool); });
        });

        $('undoBtn').addEventListener('click', undo);
        $('redoBtn').addEventListener('click', redo);
        $('openBtn').addEventListener('click', function () { $('fileInput').click(); });
        $('saveBtn').addEventListener('click', saveImage);
        $('clearBtn').addEventListener('click', clearCanvas);
        $('zoomInBtn').addEventListener('click', function () { applyZoom(zoomIndex + 1); });
        $('zoomOutBtn').addEventListener('click', function () { applyZoom(zoomIndex - 1); });
        $('zoomFitBtn').addEventListener('click', fitZoom);
        $('zoom11Btn').addEventListener('click', function () {
            var idx = ZOOM_STEPS.indexOf(1);
            applyZoom(idx >= 0 ? idx : 0);
        });

        brushSizeInput.addEventListener('input', function () {
            brushSize = parseInt(brushSizeInput.value, 10);
            brushSizeLabel.textContent = brushSize;
        });

        $('fileInput').addEventListener('change', function (e) {
            openImage(e.target.files[0]);
            e.target.value = '';
        });

        viewport.addEventListener('wheel', function (e) {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            applyZoom(zoomIndex + (e.deltaY < 0 ? 1 : -1));
        }, { passive: false });

        canvas.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        canvas.addEventListener('dragstart', function (e) { e.preventDefault(); });

        resizeHandle.addEventListener('mousedown', function (e) {
            e.preventDefault();
            e.stopPropagation();
            isResizingCanvas = true;
            resizeStart = {
                w: canvas.width,
                h: canvas.height,
                x: e.clientX,
                y: e.clientY
            };
        });

        window.addEventListener('mousemove', function (e) {
            if (!isResizingCanvas) return;
            var dx = Math.round((e.clientX - resizeStart.x) / getZoom());
            var dy = Math.round((e.clientY - resizeStart.y) / getZoom());
            var nw = Math.max(8, resizeStart.w + dx);
            var nh = Math.max(8, resizeStart.h + dy);
            if (nw === canvas.width && nh === canvas.height) return;
            var snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = nw;
            canvas.height = nh;
            syncContainerSize();
            ctx.imageSmoothingEnabled = false;
            ctx.putImageData(snap, 0, 0);
        });

        window.addEventListener('mouseup', function () {
            if (!isResizingCanvas) return;
            isResizingCanvas = false;
            saveState();
            render();
        });

        $('closeBtn').addEventListener('click', onClose);
    }

    async function onClose() {
        var shouldExit = false;
        if (loadPath) {
            await saveToFS(loadPath);
            shouldExit = await askConfirm('Закончить?', 'Изменения сохранены в проект.');
        } else {
            var changed = historyIndex > 0;
            if (changed) {
                var save = await askConfirm('Сохранить?', 'Есть несохранённые изменения.');
                if (save) {
                    var name = await input('Имя файла', 'Например: hero');
                    if (name && name.trim()) {
                        await saveToFS('images/' + name.trim() + '.png');
                    }
                }
                shouldExit = await askConfirm('Закончить?', '');
            } else {
                shouldExit = true;
            }
        }
        if (shouldExit) window.parent.postMessage('closeEditor', '*');
    }

    window.initDrawEditor = function () {
        canvas = $('cd-canvas');
        ctx = canvas.getContext('2d', { willReadFrequently: true });
        viewport = $('viewport');
        canvasStage = $('canvasStage');
        canvasContainer = $('canvasContainer');
        resizeHandle = $('canvasResizeHandle');
        colorPicker = $('colorPicker');
        brushSizeInput = $('brushSize');
        brushSizeLabel = $('brushSizeLabel');
        zoomLabel = $('zoomLabel');

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = false;

        syncContainerSize();
        saveState();
        buildPalette();
        bindUI();
        setTool('brush');
        fitZoom();
        preload();

        window.addEventListener('resize', fitZoom);
    };
})();
