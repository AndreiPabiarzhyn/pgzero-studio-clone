/** Просмотр файлов текущего проекта в виртуальной файловой системе */
function pfText(key, params, fallback) {
    if (typeof PGZI18n !== 'undefined' && PGZI18n.uiText) {
        return PGZI18n.uiText(key, params, fallback);
    }
    return fallback != null ? fallback : key;
}

async function showProjectFiles() {
    const modal = document.getElementById('projectFilesModal');
    const list = document.getElementById('projectFilesList');
    const countEl = document.getElementById('projectFilesCount');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    list.innerHTML = '<p class="pf-loading">' + pfText('projectFiles.loading', null, 'Загрузка списка файлов...') + '</p>';
    if (countEl) countEl.textContent = '';

    let total = 0;
    let html = '';

    if (typeof PythonIDE !== 'undefined' && PythonIDE.files) {
        const pyFiles = Object.keys(PythonIDE.files);
        if (pyFiles.length) {
            html += '<div class="pf-section"><h4>' + pfText('projectFiles.pythonSection', null, 'Python-код') + '</h4><ul>';
            pyFiles.forEach(function(name) {
                html += '<li>' + escapeHtml(name) + '</li>';
                total++;
            });
            html += '</ul></div>';
        }
    }

    try {
        const fs = window.jsfs || new FileSystem('PGZfs');
        const folders = [
            { path: 'images', labelKey: 'projectFiles.imagesSection', label: 'Изображения' },
            { path: 'sounds', labelKey: 'projectFiles.soundsSection', label: 'Звуки' },
            { path: 'music', labelKey: 'projectFiles.musicSection', label: 'Музыка' }
        ];

        for (const folder of folders) {
            let entries = [];
            try {
                entries = await fs.ls(folder.path);
            } catch (e) {
                entries = [];
            }
            if (entries.length) {
                const sectionLabel = pfText(folder.labelKey, null, folder.label);
                html += '<div class="pf-section"><h4>' + sectionLabel + '</h4><ul>';
                entries.forEach(function(name) {
                    html += '<li>' + escapeHtml(folder.path + '/' + name) + '</li>';
                    total++;
                });
                html += '</ul></div>';
            }
        }
    } catch (err) {
        html += '<p class="pf-empty">' + pfText('projectFiles.readError', { detail: String(err.message || err) }, 'Ошибка чтения файловой системы: ' + String(err.message || err)) + '</p>';
    }

    if (!html) {
        html = '<p class="pf-empty">' + pfText('projectFiles.empty', null, 'В проекте пока нет файлов.\nСоздайте код или добавьте ресурсы через галерею.').replace(/\n/g, '<br>') + '</p>';
    }

    list.innerHTML = html;
    if (countEl) {
        countEl.textContent = total ? pfText('projectFiles.total', { n: total }, 'Всего файлов: ' + total) : '';
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
