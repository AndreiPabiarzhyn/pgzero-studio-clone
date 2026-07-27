/** Публикация на GitHub Pages (папка published/) — короткие ссылки, без зарубежного облака */
(function (global) {
    'use strict';

    function getConfig() {
        var cfg = global.PGZPublishConfig || {};
        return cfg.github || {};
    }

    function detectFromLocation(location) {
        location = location || global.location;
        if (!location || !location.hostname) return null;
        var host = location.hostname;
        var match = host.match(/^([^.]+)\.github\.io$/i);
        if (!match) return null;
        var owner = match[1];
        var segments = (location.pathname || '/').split('/').filter(Boolean);
        if (segments.length === 0) return { owner: owner, repo: owner };
        var repo = segments[0].replace(/\.html$/i, '');
        if (repo === 'index' || repo === 'play') {
            return segments.length > 1 ? { owner: owner, repo: segments[0] } : null;
        }
        return { owner: owner, repo: repo };
    }

    function resolveToken(cfg) {
        if (cfg.token) return cfg.token;
        try {
            return global.localStorage.getItem('pgz_publish_github_token') || '';
        } catch (e) {
            return '';
        }
    }

    function resolveRepo() {
        var cfg = getConfig();
        var detected = detectFromLocation();
        return {
            owner: cfg.owner || (detected && detected.owner) || '',
            repo: cfg.repo || (detected && detected.repo) || '',
            branch: cfg.branch || 'master',
            token: resolveToken(cfg),
            path: (cfg.path || 'published').replace(/^\/+|\/+$/g, '')
        };
    }

    function saveToken(token) {
        try {
            if (!token) {
                global.localStorage.removeItem('pgz_publish_github_token');
            } else {
                global.localStorage.setItem('pgz_publish_github_token', token);
            }
        } catch (e) {
            throw new Error('localStorage недоступен');
        }
    }

    function getAppBasePath() {
        if (!global.location) return '/';
        var path = global.location.pathname || '/';
        if (path.endsWith('/index.html')) {
            return path.slice(0, -('/index.html'.length)) || '/';
        }
        if (path.endsWith('/play.html')) {
            return path.slice(0, -('/play.html'.length)) || '/';
        }
        if (path.endsWith('/')) return path;
        var lastSlash = path.lastIndexOf('/');
        return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }

    function fileName(id, ext) {
        return encodeURIComponent(id + '.' + ext);
    }

    function objectPath(id, ext) {
        var repo = resolveRepo();
        return repo.path + '/' + fileName(id, ext);
    }

    function canUpload() {
        var repo = resolveRepo();
        return Boolean(repo.owner && repo.repo && repo.token);
    }

    function getStaticUrl(id) {
        var base = getAppBasePath();
        if (!base.endsWith('/')) base += '/';
        var repo = resolveRepo();
        return base + repo.path + '/' + fileName(id, 'pgz');
    }

    function getMetaStaticUrl(id) {
        var base = getAppBasePath();
        if (!base.endsWith('/')) base += '/';
        var repo = resolveRepo();
        return base + repo.path + '/' + fileName(id, 'json');
    }

    async function blobToBase64(blob) {
        var buffer = await blob.arrayBuffer();
        var bytes = new Uint8Array(buffer);
        var chunk = 0x8000;
        var binary = '';
        for (var i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    }

    function encodeGitHubPath(path) {
        return path.split('/').map(encodeURIComponent).join('/');
    }

    async function githubRequest(path, options) {
        var repo = resolveRepo();
        var url = 'https://api.github.com/repos/' + encodeURIComponent(repo.owner) + '/' +
            encodeURIComponent(repo.repo) + '/contents/' + encodeGitHubPath(path);
        var headers = Object.assign({
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + repo.token
        }, options.headers || {});
        var response = await fetch(url, Object.assign({}, options, { headers: headers }));
        return response;
    }

    async function getExistingSha(path) {
        var response = await githubRequest(path, { method: 'GET' });
        if (response.status === 404) return null;
        if (!response.ok) {
            var text = await response.text();
            throw new Error('github_read_failed:' + response.status + ':' + text.slice(0, 160));
        }
        var data = await response.json();
        return data.sha || null;
    }

    async function putFile(path, base64Content, message) {
        var repo = resolveRepo();
        var sha = await getExistingSha(path);
        var body = {
            message: message,
            content: base64Content,
            branch: repo.branch
        };
        if (sha) body.sha = sha;
        var response = await githubRequest(path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            var detail = await response.text();
            throw new Error('github_upload_failed:' + response.status + ':' + detail.slice(0, 200));
        }
    }

    async function uploadGame(id, blob, title) {
        if (!canUpload()) {
            return { error: 'not_configured' };
        }
        var pgzPath = objectPath(id, 'pgz');
        var metaPath = objectPath(id, 'json');
        var base64 = await blobToBase64(blob);
        var label = title ? ('Publish: ' + title) : ('Publish game ' + id);

        await putFile(pgzPath, base64, label);

        if (title) {
            var metaJson = JSON.stringify({
                id: id,
                title: title,
                updatedAt: Date.now()
            });
            var metaBase64 = btoa(unescape(encodeURIComponent(metaJson)));
            await putFile(metaPath, metaBase64, label + ' (meta)');
        }

        return {
            id: id,
            staticUrl: getStaticUrl(id),
            hosted: true
        };
    }

    async function fetchTitle(id) {
        try {
            var response = await fetch(getMetaStaticUrl(id));
            if (!response.ok) return null;
            var meta = await response.json();
            return meta.title || null;
        } catch (e) {
            return null;
        }
    }

    global.PGZPublishStatic = {
        canUpload: canUpload,
        uploadGame: uploadGame,
        getStaticUrl: getStaticUrl,
        fetchTitle: fetchTitle,
        saveToken: saveToken,
        detectFromLocation: detectFromLocation,
        resolveRepo: resolveRepo
    };

    global.PGZPublishStatic._test = {
        getStaticUrl: getStaticUrl,
        detectFromLocation: detectFromLocation,
        objectPath: objectPath
    };
})(typeof window !== 'undefined' ? window : global);
