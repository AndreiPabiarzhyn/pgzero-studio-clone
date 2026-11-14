(function (global) {
    'use strict';
    var FORMAT = 'pgzero-studio-project-backup';
    var MAX_BYTES = 200 * 1024 * 1024;

    async function create() {
        var slots = await global.PGZProjectGallery.listSlots();
        var projects = [];
        slots.forEach(function (data, index) { if (data) projects.push({ index: index, data: data }); });
        var json = JSON.stringify({ format: FORMAT, version: 1, createdAt: Date.now(), projects: projects });
        if (new Blob([json]).size > MAX_BYTES) throw new Error('Backup too large');
        var zip = new JSZip();
        zip.file('projects.json', json);
        return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), count: projects.length };
    }

    async function restore(blob) {
        if (!blob || blob.size > MAX_BYTES) throw new Error('Invalid backup size');
        var zip = await JSZip.loadAsync(blob);
        var entry = zip.file('projects.json');
        if (!entry || !entry._data || entry._data.uncompressedSize > MAX_BYTES) throw new Error('Invalid backup archive');
        var data = JSON.parse(await entry.async('string'));
        if (!data || data.format !== FORMAT || data.version !== 1 || !Array.isArray(data.projects)) throw new Error('Invalid backup format');
        return global.PGZProjectGallery.restoreBackupProjects(data.projects);
    }
    global.PGZProjectBackup = { create: create, restore: restore };
})(window);
