/**
 * Подставляет PGZ_PUBLISH_TOKEN в publish-config.js при деплое (не в git).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const token = process.env.PGZ_PUBLISH_TOKEN;
const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/publish-config.js');

if (!token) {
    console.log('PGZ_PUBLISH_TOKEN not set — publish will use fallback links');
    process.exit(0);
}

let source = readFileSync(configPath, 'utf8');
if (!source.includes("token: ''")) {
    console.log('publish-config.js token already set — skip inject');
    process.exit(0);
}

const escaped = token.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
source = source.replace("token: ''", "token: '" + escaped + "'");
writeFileSync(configPath, source, 'utf8');
console.log('Publish token injected for GitHub Pages deploy');
