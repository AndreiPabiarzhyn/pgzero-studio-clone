/**
 * Запуск всех unit-тестов.
 * npm test  или  node tests/run-all.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'tests');
const files = readdirSync(testsDir)
    .filter(function (name) { return name.endsWith('.test.mjs'); })
    .sort();

let failed = 0;

for (const file of files) {
    const result = spawnSync(process.execPath, [join(testsDir, file)], {
        stdio: 'inherit',
        cwd: root
    });
    if (result.status !== 0) failed += 1;
}

if (failed) {
    process.exitCode = 1;
    console.error('\n' + failed + ' test file(s) failed.');
} else {
    console.log('\nAll ' + files.length + ' test files passed.');
}
