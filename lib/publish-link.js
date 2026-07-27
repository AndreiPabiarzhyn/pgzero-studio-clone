/** Переносимые ссылки на опубликованные игры (данные в URL, без сервера) */
(function (global) {
    'use strict';

    var HASH_PREFIX = '#pgz1=';
    var MAX_PORTABLE_COMPRESSED = 1200000;

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

    function buildPlayPageUrl() {
        var origin = global.location ? global.location.origin : 'https://example.com';
        var base = getAppBasePath();
        if (!base.endsWith('/')) base += '/';
        return origin + base + 'play.html';
    }

    function bytesToBase64Url(bytes) {
        var binary = '';
        var chunk = 0x8000;
        for (var i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function base64UrlToBytes(value) {
        var base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    function canCompress() {
        return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
    }

    async function gzipBlob(blob) {
        if (!canCompress()) return blob;
        var stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
        return new Response(stream).blob();
    }

    async function gunzipBlob(blob) {
        if (!canCompress()) return blob;
        var stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).blob();
    }

    async function encodePortableUrl(blob, title) {
        var compressed = await gzipBlob(blob);
        var buffer = await compressed.arrayBuffer();
        if (buffer.byteLength > MAX_PORTABLE_COMPRESSED) {
            return {
                error: 'link_too_large',
                compressedSize: buffer.byteLength,
                maxBytes: MAX_PORTABLE_COMPRESSED
            };
        }
        var encoded = bytesToBase64Url(new Uint8Array(buffer));
        var url = buildPlayPageUrl() + HASH_PREFIX + encoded;
        return {
            url: url,
            portable: true,
            compressedSize: buffer.byteLength,
            title: title || 'Игра'
        };
    }

    function extractPortablePayload(location) {
        location = location || global.location;
        if (!location) return null;
        var hash = location.hash || '';
        if (hash.indexOf(HASH_PREFIX) === 0) {
            return hash.slice(HASH_PREFIX.length);
        }
        var params = new URLSearchParams(location.search || '');
        var queryPayload = params.get('pgz1');
        if (queryPayload) return queryPayload;
        return null;
    }

    async function decodePortablePayload(payload) {
        if (!payload) {
            throw new Error('Пустая ссылка на игру');
        }
        var bytes = base64UrlToBytes(payload);
        var compressed = new Blob([bytes], { type: 'application/gzip' });
        return gunzipBlob(compressed);
    }

    async function loadPortableFromLocation(location) {
        var payload = extractPortablePayload(location);
        if (!payload) return null;
        return decodePortablePayload(payload);
    }

    global.PGZPublishLink = {
        encodePortableUrl: encodePortableUrl,
        loadPortableFromLocation: loadPortableFromLocation,
        extractPortablePayload: extractPortablePayload,
        decodePortablePayload: decodePortablePayload,
        buildPlayPageUrl: buildPlayPageUrl,
        bytesToBase64Url: bytesToBase64Url,
        base64UrlToBytes: base64UrlToBytes,
        MAX_PORTABLE_COMPRESSED: MAX_PORTABLE_COMPRESSED,
        HASH_PREFIX: HASH_PREFIX
    };
})(typeof window !== 'undefined' ? window : global);
