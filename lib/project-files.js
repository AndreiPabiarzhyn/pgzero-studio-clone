/** Просмотр файлов текущего проекта в виртуальной файловой системе */
async function showProjectFiles() {
    const modal = document.getElementById('projectFilesModal');
    const list = document.getElementById('projectFilesList');
    const countEl = document.getElementById('projectFilesCount');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    list.innerHTML = '<p class="pf-loading">Загрузка списка файлов...</p>';
    if (countEl) countEl.textContent = '';

    let total = 0;
    let html = '';

    // Python-файлы редактора
    if (typeof PythonIDE !== 'undefined' && PythonIDE.files) {
        const pyFiles = Object.keys(PythonIDE.files);
        if (pyFiles.length) {
            html += '<div class="pf-section"><h4>Python-код</h4><ul>';
            pyFiles.forEach(function(name) {
                html += '<li>' + escapeHtml(name) + '</li>';
                total++;
            });
            html += '</ul></div>';
        }
    }

    // Файлы в IndexedDB
    try {
        const fs = window.jsfs || new FileSystem('PGZfs');
        const folders = [
            { path: 'images', label: 'Изображения' },
            { path: 'sounds', label: 'Звуки' },
            { path: 'music', label: 'Музыка' }
        ];

        for (const folder of folders) {
            let entries = [];
            try {
                entries = await fs.ls(folder.path);
            } catch (e) {
                entries = [];
            }
            if (entries.length) {
                html += '<div class="pf-section"><h4>' + folder.label + '</h4><ul>';
                entries.forEach(function(name) {
                    html += '<li>' + escapeHtml(folder.path + '/' + name) + '</li>';
                    total++;
                });
                html += '</ul></div>';
            }
        }
    } catch (err) {
        html += '<p class="pf-empty">Ошибка чтения файловой системы: ' + escapeHtml(String(err.message || err)) + '</p>';
    }

    if (!html) {
        html = '<p class="pf-empty">В проекте пока нет файлов.<br>Создайте код или добавьте ресурсы через галерею.</p>';
    }

    list.innerHTML = html;
    if (countEl) {
        countEl.textContent = total ? 'Всего файлов: ' + total : '';
    }
}

function closeProjectFiles() {
    const modal = document.getElementById('projectFilesModal');
    if (modal) modal.style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
