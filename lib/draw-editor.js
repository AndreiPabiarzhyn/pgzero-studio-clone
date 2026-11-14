/** PGZero Studio — упрощённый редактор спрайтов */
(function () {
    'use strict';

    var DEFAULT_COLORS = [
        '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
        '#ffff00', '#ff00ff', '#00ffff', '#808080', '#c0c0c0',
        '#ffa500', '#800080', '#008000', '#ffc0cb', '#90ee90',
        '#add8e6', '#8b4513', '#2f4f4f', '#b22222', '#daa520'
    ];

    var canvas, ctx, viewport, canvasStage, canvasContainer;
    var colorPicker, brushSizeInput, brushSizeLabel, brushSizeTitle, zoomLabel, brushCursor;
    var tool = 'brush';
    var cropStart = null;
    var cropEnd = null;
    var cropDragging = false, cropInteraction = null;
    var panX = 0, panY = 0, panStart = null, spaceHeld = false;
    var isDrawing = false;
    var currentPath = [];
    var lastPencilPoint = null;
    var history = [];
    var historyIndex = -1;
    var brushSize = 1;
    var zoom = 4;
    var openedFromFS = false;
    var openedFSPath = null;
    var loadPath = null;

    var CURSOR_TOOLS = { brush: true, eraser: true, mirror: true, pencil: true };

    function L(key, params, fallback) {
        if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
            return PGZI18n.uiText(key, params, fallback);
        }
        return fallback != null ? fallback : key;
    }

    function $(id) {
        return document.getElementById(id);
    }

    function saveState() {
        history = history.slice(0, historyIndex + 1);
        history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        historyIndex++;
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        $('undoBtn').disabled = historyIndex <= 0;
        $('redoBtn').disabled = historyIndex >= history.length - 1;
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        updateHistoryButtons();
        restoreHistoryState(history[historyIndex]);
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        updateHistoryButtons();
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
    }

    function getZoom() {
        return zoom;
    }

    function applyZoom(scale) {
        zoom = Math.max(0.125, Math.min(32, scale));
        canvasStage.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + zoom + ')';
        if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
        if (canvasContainer) canvasContainer.style.setProperty('--crop-handle', (12 / zoom) + 'px');
        positionCropActions();
    }

    function stepZoom(direction) {
        var steps = [0.125, 0.25, 0.5, 1, 2, 4, 8, 16, 32];
        if (direction > 0) {
            for (var i = 0; i < steps.length; i++) if (steps[i] > zoom + 0.001) return applyZoom(steps[i]);
        } else {
            for (var j = steps.length - 1; j >= 0; j--) if (steps[j] < zoom - 0.001) return applyZoom(steps[j]);
        }
    }

    function fitZoom() {
        panX = 0; panY = 0;
        var vw = viewport.clientWidth - 64;
        var vh = viewport.clientHeight - 64;
        if (vw <= 0 || vh <= 0) return;
        applyZoom(Math.min(vw / canvas.width, vh / canvas.height));
    }

    function mirrorX(x) {
        return canvas.width - 1 - x;
    }

    function usesBrushCursor() {
        return Boolean(CURSOR_TOOLS[tool]);
    }

    function updateBrushSizeTitle() {
        if (!brushSizeTitle) return;
        var titles = {
            brush: L('drawEditor.brush', null, 'Кисть'),
            eraser: L('drawEditor.eraser', null, 'Ластик'),
            mirror: L('drawEditor.mirror', null, 'Зеркало'),
            pencil: L('drawEditor.pencil', null, 'Пиксель')
        };
        brushSizeTitle.textContent = titles[tool] || L('drawEditor.size', null, 'Размер');
    }

    function hideBrushCursor() {
        if (brushCursor) brushCursor.hidden = true;
    }

    function updateBrushCursor(e) {
        if (!brushCursor || spaceHeld || panStart || !usesBrushCursor()) {
            hideBrushCursor();
            return;
        }
        var rect = canvas.getBoundingClientRect();
        if (
            e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top || e.clientY > rect.bottom
        ) {
            hideBrushCursor();
            return;
        }
        var scale = rect.width / canvas.width;
        var sizePx = Math.max(2, brushSize * scale);
        brushCursor.hidden = false;
        brushCursor.style.left = e.clientX + 'px';
        brushCursor.style.top = e.clientY + 'px';
        brushCursor.style.width = sizePx + 'px';
        brushCursor.style.height = sizePx + 'px';
        brushCursor.classList.toggle('is-square', tool === 'pencil');
        if (tool === 'eraser') {
            brushCursor.classList.add('is-eraser');
        } else {
            brushCursor.classList.remove('is-eraser');
        }
    }

    function updateToolHint() {
        var hints = {
            crop: ['drawEditor.cropHelp', 'Зажмите кнопку мыши и выделите область, которую нужно оставить. Для отмены нажмите стрелку «Отменить» сверху.'],
            pan: ['drawEditor.panHelp', 'Зажмите кнопку мыши и переместите изображение. Также можно удерживать пробел.'],
            removeBackground: ['drawEditor.backgroundHelp', 'Нажмите на однотонный фон: соседние похожие пиксели станут прозрачными. Для отмены нажмите стрелку «Отменить» сверху.']
        };
        var hint = hints[tool] || ['drawEditor.hint', 'Круг у курсора — размер кисти · Ctrl + колёсико — зум'];
        $('toolHint').textContent = L(hint[0], null, hint[1]);
    }

    function setTool(name) {
        cropStart = cropEnd = null;
        cropDragging = false; cropInteraction = null;
        updateCropOverlay();
        tool = name;
        viewport.classList.toggle('can-pan', spaceHeld || tool === 'pan');
        document.querySelectorAll('.de-tool').forEach(function (btn) {
            var active = btn.dataset.tool === name;
            btn.classList.toggle('active', active);
            if (btn.dataset.tool) btn.setAttribute('aria-pressed', String(active));
        });
        if (usesBrushCursor()) {
            canvas.style.cursor = 'none';
        } else {
            canvas.style.cursor = name === 'pan' ? 'grab' : (name === 'eyedropper' || name === 'crop' || name === 'removeBackground') ? 'crosshair' : 'default';
            hideBrushCursor();
        }
        updateBrushSizeTitle();
        updateToolHint();
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

    function drawBrushStroke(path, color, size, options) {
        options = options || {};
        drawBrushStrokeSide(path, color, size);
        if (options.mirror) {
            var mirrored = path.map(function (p) {
                return { x: mirrorX(p.x), y: p.y };
            });
            drawBrushStrokeSide(mirrored, color, size);
        }
    }

    function drawBrushStrokeSide(path, color, size) {
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

    function drawEraserStroke(path, size, mirror) {
        drawEraserStrokeSide(path, size);
        if (mirror) {
            var mirrored = path.map(function (p) {
                return { x: mirrorX(p.x), y: p.y };
            });
            drawEraserStrokeSide(mirrored, size);
        }
    }

    function drawEraserStrokeSide(path, size) {
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

    function plotPixelBlock(x, y, color, size) {
        var half = Math.floor(size / 2);
        ctx.fillStyle = color;
        ctx.fillRect(x - half, y - half, size, size);
    }

    function plotPencilPoint(x, y, color, size, mirror) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        plotPixelBlock(x, y, color, size);
        if (mirror) plotPixelBlock(mirrorX(x), y, color, size);
        ctx.restore();
    }

    function drawPencilLine(x0, y0, x1, y1, color, size, mirror) {
        var dx = Math.abs(x1 - x0);
        var dy = Math.abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1;
        var sy = y0 < y1 ? 1 : -1;
        var err = dx - dy;
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        while (true) {
            plotPixelBlock(x0, y0, color, size);
            if (mirror) plotPixelBlock(mirrorX(x0), y0, color, size);
            if (x0 === x1 && y0 === y1) break;
            var e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        ctx.restore();
    }

    function strokeEraserSegment(from, to, size, mirror) {
        strokeEraserSegmentSide(from, to, size);
        if (mirror) {
            strokeEraserSegmentSide(
                { x: mirrorX(from.x), y: from.y },
                { x: mirrorX(to.x), y: to.y },
                size
            );
        }
    }

    function strokeEraserSegmentSide(from, to, size) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (historyIndex >= 0) ctx.putImageData(history[historyIndex], 0, 0);
        if (isDrawing && (tool === 'brush' || tool === 'mirror')) {
            drawBrushStroke(currentPath, colorPicker.value, brushSize, { mirror: tool === 'mirror' });
        }
    }

    function onPointerDown(e) {
        if (e.button !== 0) return;
        var pt = getCanvasCoords(e);
        if (tool === 'crop') {
            cropStart = cropEnd = clampPoint(pt);
            cropDragging = true;
            updateCropOverlay();
            return;
        }
        if (tool === 'removeBackground') {
            removeBackground(pt);
            return;
        }
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
        if (tool === 'brush' || tool === 'mirror' || tool === 'eraser' || tool === 'pencil') {
            isDrawing = true;
            currentPath = [pt];
            lastPencilPoint = pt;
            if (tool === 'eraser') {
                drawEraserStroke(currentPath, brushSize, false);
            } else if (tool === 'pencil') {
                plotPencilPoint(pt.x, pt.y, colorPicker.value, brushSize, false);
            }
        }
    }

    function onPointerMove(e) {
        updateBrushCursor(e);
        if (cropInteraction) {
            var p = clampPoint(getCanvasCoords(e));
            if (cropInteraction.mode === 'move') {
                var dx = p.x - cropInteraction.point.x, dy = p.y - cropInteraction.point.y;
                dx = Math.max(-cropInteraction.left, Math.min(canvas.width - 1 - cropInteraction.right, dx));
                dy = Math.max(-cropInteraction.top, Math.min(canvas.height - 1 - cropInteraction.bottom, dy));
                cropStart = { x: cropInteraction.left + dx, y: cropInteraction.top + dy };
                cropEnd = { x: cropInteraction.right + dx, y: cropInteraction.bottom + dy };
            } else {
                cropStart = cropInteraction.anchor;
                cropEnd = p;
            }
            updateCropOverlay(); return;
        }
        if (cropDragging) { cropEnd = clampPoint(getCanvasCoords(e)); updateCropOverlay(); return; }
        if (!isDrawing) return;
        var pt = getCanvasCoords(e);
        if (tool === 'pencil') {
            if (lastPencilPoint) {
                drawPencilLine(lastPencilPoint.x, lastPencilPoint.y, pt.x, pt.y, colorPicker.value, brushSize, false);
            }
            lastPencilPoint = pt;
            return;
        }
        currentPath.push(pt);
        if (tool === 'eraser') {
            if (currentPath.length < 2) return;
            var last = currentPath[currentPath.length - 2];
            strokeEraserSegment(last, pt, brushSize, false);
        } else if (tool === 'brush' || tool === 'mirror') {
            render();
        }
    }

    function onPointerUp() {
        if (cropDragging || cropInteraction) {
            cropDragging = false; cropInteraction = null;
            updateCropOverlay();
            return;
        }
        if (!isDrawing) return;
        isDrawing = false;
        if (tool === 'brush' || tool === 'mirror') {
            drawBrushStroke(currentPath, colorPicker.value, brushSize, { mirror: tool === 'mirror' });
        } else if (tool === 'eraser' && currentPath.length === 1) {
            drawEraserStroke(currentPath, brushSize, false);
        }
        currentPath = [];
        lastPencilPoint = null;
        saveState();
        render();
    }

    function clampPoint(pt) {
        return { x: Math.max(0, Math.min(canvas.width - 1, pt.x)), y: Math.max(0, Math.min(canvas.height - 1, pt.y)) };
    }

    function updateCropOverlay() {
        var overlay = $('cropOverlay');
        if (!overlay) return;
        overlay.hidden = !cropStart;
        var actions = $('cropActions');
        if (actions) actions.hidden = !cropStart;
        if (!cropStart) return;
        overlay.style.left = Math.min(cropStart.x, cropEnd.x) + 'px';
        overlay.style.top = Math.min(cropStart.y, cropEnd.y) + 'px';
        overlay.style.width = (Math.abs(cropStart.x - cropEnd.x) + 1) + 'px';
        overlay.style.height = (Math.abs(cropStart.y - cropEnd.y) + 1) + 'px';
        positionCropActions();
    }

    function positionCropActions() {
        var actions = $('cropActions'), overlay = $('cropOverlay');
        if (!actions || actions.hidden || !overlay || overlay.hidden || !viewport) return;
        var rect = overlay.getBoundingClientRect(), area = viewport.getBoundingClientRect();
        var width = actions.offsetWidth, height = actions.offsetHeight, gap = 8;
        var left = rect.left + (rect.width - width) / 2;
        var top = rect.top - height - gap;
        if (top < area.top + gap) top = rect.bottom + gap;
        left = Math.max(area.left + gap, Math.min(left, area.right - width - gap));
        top = Math.max(area.top + gap, Math.min(top, area.bottom - height - gap));
        actions.style.left = left + 'px';
        actions.style.top = top + 'px';
    }

    function cancelCrop() {
        cropStart = cropEnd = null; cropDragging = false; cropInteraction = null;
        updateCropOverlay();
    }

    function applyCrop() {
        if (!cropStart || !cropEnd) return;
        var x = Math.min(cropStart.x, cropEnd.x), y = Math.min(cropStart.y, cropEnd.y);
        var w = Math.abs(cropStart.x - cropEnd.x) + 1, h = Math.abs(cropStart.y - cropEnd.y) + 1;
        var selection = ctx.getImageData(x, y, w, h);
        cancelCrop();
        canvas.width = w; canvas.height = h;
        syncContainerSize();
        ctx.putImageData(selection, 0, 0);
        saveState(); fitZoom(); render();
    }

    // Remove only the connected region selected by the user, preserving matching colors elsewhere.
    function removeBackground(point) {
        var pt = clampPoint(point), w = canvas.width, h = canvas.height;
        var image = ctx.getImageData(0, 0, w, h), data = image.data;
        var start = pt.y * w + pt.x, offset = start * 4;
        var target = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
        if (!target[3]) return;
        var visited = new Uint8Array(w * h), stack = [start];
        visited[start] = 1;
        while (stack.length) {
            var index = stack.pop(), i = index * 4;
            if (Math.abs(data[i] - target[0]) > 24 || Math.abs(data[i + 1] - target[1]) > 24 || Math.abs(data[i + 2] - target[2]) > 24 || Math.abs(data[i + 3] - target[3]) > 24) continue;
            data[i + 3] = 0;
            var x = index % w, y = Math.floor(index / w);
            var neighbors = [];
            if (x > 0) neighbors.push(index - 1);
            if (x + 1 < w) neighbors.push(index + 1);
            if (y > 0) neighbors.push(index - w);
            if (y + 1 < h) neighbors.push(index + w);
            neighbors.forEach(function (n) { if (!visited[n]) { visited[n] = 1; stack.push(n); } });
        }
        ctx.putImageData(image, 0, 0);
        saveState(); render();
    }

    async function clearCanvas() {
        var ok = await askConfirm(
            L('drawEditor.clearConfirmTitle', null, 'Очистить холст?'),
            L('drawEditor.clearConfirmBody', null, 'Все пиксели будут удалены.')
        );
        if (!ok) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveState();
        render();
    }

    function normalizeImagePath(path) {
        if (!path) return path;
        var clean = String(path).replace(/\\/g, '/');
        if (clean.charAt(0) !== '/') clean = '/' + clean;
        return clean;
    }

    function notifySpriteSaved(path) {
        if (!window.parent || window.parent === window) return;
        window.parent.postMessage({ type: 'spriteSaved', path: normalizeImagePath(path) }, '*');
    }

    async function saveToFS(path) {
        var targetPath = normalizeImagePath(path);
        var exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        exportCanvas.getContext('2d').putImageData(history[historyIndex], 0, 0);
        await window.jsfs.mkdir('/images');
        await window.jsfs.write(targetPath, exportCanvas.toDataURL('image/png'));
        notifySpriteSaved(targetPath);
        return targetPath;
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
            img.onerror = function () { message(L('drawEditor.errorTitle', null, 'Ошибка'), L('drawEditor.loadImageError', null, 'Не удалось загрузить изображение')); };
            img.src = base64;
        } catch (err) {
            message(L('drawEditor.errorTitle', null, 'Ошибка'), err.message || L('drawEditor.openFileError', null, 'Не удалось открыть файл'));
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

        $('cropApplyBtn').addEventListener('click', applyCrop);
        $('cropCancelBtn').addEventListener('click', cancelCrop);
        $('cropOverlay').addEventListener('mousedown', function (e) {
            if (e.button !== 0 || spaceHeld || tool !== 'crop' || !cropStart) return;
            e.preventDefault(); e.stopPropagation();
            var left = Math.min(cropStart.x, cropEnd.x), right = Math.max(cropStart.x, cropEnd.x);
            var top = Math.min(cropStart.y, cropEnd.y), bottom = Math.max(cropStart.y, cropEnd.y);
            var handle = e.target.dataset.cropHandle;
            cropInteraction = { mode: handle ? 'resize' : 'move', point: clampPoint(getCanvasCoords(e)), left: left, right: right, top: top, bottom: bottom };
            if (handle) cropInteraction.anchor = { x: handle.indexOf('w') !== -1 ? right : left, y: handle.indexOf('n') !== -1 ? bottom : top };
        });
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && tool === 'crop' && cropStart) { e.preventDefault(); cancelCrop(); }
        });

        $('undoBtn').addEventListener('click', undo);
        $('redoBtn').addEventListener('click', redo);
        $('openBtn').addEventListener('click', function () { $('fileInput').click(); });
        $('saveBtn').addEventListener('click', saveImage);
        $('clearBtn').addEventListener('click', clearCanvas);
        $('zoomInBtn').addEventListener('click', function () { stepZoom(1); });
        $('zoomOutBtn').addEventListener('click', function () { stepZoom(-1); });
        $('zoomFitBtn').addEventListener('click', fitZoom);
        $('zoom11Btn').addEventListener('click', function () {
            applyZoom(1);
        });

        brushSizeInput.addEventListener('input', function () {
            brushSize = parseInt(brushSizeInput.value, 10);
            brushSizeLabel.textContent = brushSize;
        });

        viewport.addEventListener('scroll', positionCropActions);
        window.addEventListener('resize', positionCropActions);
        viewport.addEventListener('mousemove', updateBrushCursor);
        viewport.addEventListener('mouseleave', hideBrushCursor);

        $('fileInput').addEventListener('change', function (e) {
            openImage(e.target.files[0]);
            e.target.value = '';
        });

        viewport.addEventListener('wheel', function (e) {
            e.preventDefault();
            if (!e.deltaY) return;
            var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight : 1);
            var before = canvas.getBoundingClientRect();
            var anchorX = (e.clientX - before.left) / before.width;
            var anchorY = (e.clientY - before.top) / before.height;
            applyZoom(getZoom() * Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.0014));
            var after = canvas.getBoundingClientRect();
            panX += e.clientX - (after.left + anchorX * after.width);
            panY += e.clientY - (after.top + anchorY * after.height);
            applyZoom(getZoom());
        }, { passive: false });

        function updatePanCursor() {
            viewport.classList.toggle('is-panning', !!panStart);
            viewport.classList.toggle('can-pan', spaceHeld || tool === 'pan');
            if (spaceHeld || tool === 'pan') hideBrushCursor();
        }
        window.addEventListener('keydown', function (e) {
            var target = e.target;
            if (e.code !== 'Space' || (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) return;
            e.preventDefault(); spaceHeld = true; updatePanCursor();
        });
        window.addEventListener('keyup', function (e) {
            if (e.code === 'Space') { spaceHeld = false; updatePanCursor(); }
        });
        window.addEventListener('blur', function () { spaceHeld = false; panStart = null; updatePanCursor(); });
        viewport.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || !(spaceHeld || tool === 'pan')) return;
            e.preventDefault(); e.stopPropagation();
            panStart = { x: e.clientX, y: e.clientY, panX: panX, panY: panY };
            updatePanCursor();
        }, true);
        window.addEventListener('mousemove', function (e) {
            if (!panStart) return;
            panX = panStart.panX + e.clientX - panStart.x;
            panY = panStart.panY + e.clientY - panStart.y;
            applyZoom(getZoom());
        });
        window.addEventListener('mouseup', function () {
            if (panStart) { panStart = null; updatePanCursor(); }
        });

        canvas.addEventListener('mousedown', onPointerDown);
        window.addEventListener('mousemove', onPointerMove);
        window.addEventListener('mouseup', onPointerUp);
        canvas.addEventListener('dragstart', function (e) { e.preventDefault(); });

        $('closeBtn').addEventListener('click', onClose);
    }

    async function onClose() {
        var shouldExit = false;
        if (loadPath) {
            await saveToFS(loadPath);
            shouldExit = await askConfirm(
                L('drawEditor.exitSavedTitle', null, 'Закончить?'),
                L('drawEditor.exitSavedBody', null, 'Изменения сохранены в проект.')
            );
        } else {
            var changed = historyIndex > 0;
            if (changed) {
                var save = await askConfirm(
                    L('drawEditor.savePromptTitle', null, 'Сохранить?'),
                    L('drawEditor.savePromptBody', null, 'Есть несохранённые изменения.')
                );
                if (save) {
                    var name = await input(
                        L('drawEditor.fileNameTitle', null, 'Имя файла'),
                        L('drawEditor.fileNamePlaceholder', null, 'Например: hero')
                    );
                    if (name && name.trim()) {
                        await saveToFS('/images/' + name.trim() + '.png');
                    }
                }
                shouldExit = await askConfirm(L('drawEditor.exitTitle', null, 'Закончить?'), '');
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
        colorPicker = $('colorPicker');
        brushSizeInput = $('brushSize');
        brushSizeLabel = $('brushSizeLabel');
        brushSizeTitle = $('brushSizeTitle');
        zoomLabel = $('zoomLabel');
        brushCursor = $('brushCursor');

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

        if (typeof window.addEventListener === 'function') {
            window.addEventListener('pgz:langchange', function () {
                updateBrushSizeTitle();
                updateToolHint();
                if (typeof PGZI18n !== 'undefined' && PGZI18n.apply) {
                    PGZI18n.apply(document);
                }
            });
        }
    };
})();
