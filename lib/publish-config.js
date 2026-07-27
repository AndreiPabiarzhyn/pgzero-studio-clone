/** Настройки публикации: GitHub Pages (published/) — работает в РФ */
(function (global) {
    'use strict';

    /**
     * Token подставляется при деплое из GitHub Secret PGZ_PUBLISH_TOKEN.
     * Добавь: Settings → Secrets → Actions → PGZ_PUBLISH_TOKEN
     * PAT: Contents Read and write для pgzero-studio-clone
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
