/** Настройки публикации: GitHub Pages (published/) — работает в РФ */
(function (global) {
    'use strict';

    /**
     * Короткие ссылки: play.html?id=abc123 → published/abc123.pgz на этом же сайте.
     *
     * Token НЕ коммитить в git (GitHub заблокирует push).
     * Один раз в консоли Studio (F12):
     *   PGZPublishStatic.saveToken('github_pat_...')
     *
     * PAT: github.com/settings/tokens → pgzero-studio-clone → Contents: Read and write
     */
    global.PGZPublishConfig = {
        github: {
            owner: 'AndreiPabiarzhyn',
            repo: 'pgzero-studio-clone',
            branch: 'master',
            token: '',
            path: 'published'
        }
    };
})(typeof window !== 'undefined' ? window : global);
