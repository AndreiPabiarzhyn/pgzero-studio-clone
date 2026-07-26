/** Закрытие модальных окон: кнопка, клик снаружи, Escape */
(function () {
    function bindModal(modalId, closeFn) {
        var modal = document.getElementById(modalId);
        if (!modal) return;

        modal.querySelectorAll('[data-modal-close]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                closeFn();
            });
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeFn();
        });
    }

    window.setupAppModals = function () {
        bindModal('projectFilesModal', closeProjectFiles);
        bindModal('settingsModal', function () {
            var m = document.getElementById('settingsModal');
            if (m) m.style.display = 'none';
        });
        bindModal('saveModal', function () {
            if (typeof PythonIDE !== 'undefined' && PythonIDE.closeSaveModal) {
                PythonIDE.closeSaveModal();
            }
        });
        bindModal('recoverModal', function () {
            var m = document.getElementById('recoverModal');
            if (m) {
                m.style.opacity = '0';
                setTimeout(function () { m.style.display = 'none'; }, 200);
            }
        });
        bindModal('importModal', function () {
            if (typeof closeImportModal === 'function') closeImportModal();
        });
        bindModal('newProjectModal', function () {
            if (typeof closeNewProjectModal === 'function') closeNewProjectModal();
        });
        bindModal('codeHistoryModal', function () {
            if (typeof PGZCodeHistory !== 'undefined') PGZCodeHistory.closeModal();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var open = document.querySelector('.modal-overlay[style*="flex"]');
            if (!open || open.id === 'modal-container') return;
            if (open.id === 'projectFilesModal') closeProjectFiles();
            else if (open.id === 'settingsModal') open.style.display = 'none';
            else if (open.id === 'saveModal' && PythonIDE.closeSaveModal) PythonIDE.closeSaveModal();
            else if (open.id === 'recoverModal') {
                open.style.opacity = '0';
                setTimeout(function () { open.style.display = 'none'; }, 200);
            }
            else if (open.id === 'importModal' && typeof closeImportModal === 'function') closeImportModal();
            else if (open.id === 'newProjectModal' && typeof closeNewProjectModal === 'function') closeNewProjectModal();
            else if (open.id === 'codeHistoryModal' && typeof PGZCodeHistory !== 'undefined') PGZCodeHistory.closeModal();
        });
    };
})();
