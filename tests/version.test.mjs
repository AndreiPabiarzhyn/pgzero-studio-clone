/**
 * Тесты версии приложения.
 * Запуск: node tests/version.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('version.json имеет формат 0.0xx', () => {
    const data = JSON.parse(readFileSync(join(root, 'version.json'), 'utf8'));
    assert.match(data.version, /^0\.\d{3}$/);
});

test('bump-version увеличивает версию на 0.001', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pgz-version-'));
    const versionPath = join(dir, 'version.json');
    writeFileSync(versionPath, JSON.stringify({ version: '0.011' }, null, 2) + '\n');

    const script = `
        import { readFileSync, writeFileSync } from 'node:fs';
        const path = process.argv[1];
        const data = JSON.parse(readFileSync(path, 'utf8'));
        const next = (Math.round(Number.parseFloat(data.version) * 1000) + 1) / 1000;
        data.version = next.toFixed(3);
        writeFileSync(path, JSON.stringify(data, null, 2) + '\\n');
    `;

    execFileSync(process.execPath, ['-e', script, versionPath], { stdio: 'pipe' });
    const bumped = JSON.parse(readFileSync(versionPath, 'utf8'));
    assert.equal(bumped.version, '0.012');
});
