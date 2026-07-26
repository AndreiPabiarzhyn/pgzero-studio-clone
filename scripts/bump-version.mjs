/**
 * Увеличивает patch-версию на 0.001 (0.011 -> 0.012).
 * Синхронизирует version.json и cache-bust в lib/extlibs.js.
 * Запуск: node scripts/bump-version.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionPath = join(root, 'version.json');
const extlibsPath = join(root, 'lib/extlibs.js');

const data = JSON.parse(readFileSync(versionPath, 'utf8'));
const current = Number.parseFloat(data.version);
if (!Number.isFinite(current)) {
    throw new Error('Invalid version in version.json: ' + data.version);
}

const next = (Math.round(current * 1000) + 1) / 1000;
const nextVersion = next.toFixed(3);
data.version = nextVersion;

writeFileSync(versionPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

const extlibsSource = readFileSync(extlibsPath, 'utf8');
const updatedExtlibs = extlibsSource.replace(
    /const PGZRUN_ASSET_VERSION = '[^']+';/,
    "const PGZRUN_ASSET_VERSION = '" + nextVersion + "';"
);
writeFileSync(extlibsPath, updatedExtlibs, 'utf8');

console.log('Version bumped to ' + nextVersion);
