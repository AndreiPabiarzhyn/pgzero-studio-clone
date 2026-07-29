/**
 * Нагрузочный тест: N «пользователей» одновременно открывают IDE.
 * Запуск: node scripts/load-test.mjs [--url=http://127.0.0.1:8100] [--users=50]
 */
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const hit = args.find(function (a) { return a.startsWith('--' + name + '='); });
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const BASE = arg('url', 'http://127.0.0.1:8100').replace(/\/$/, '');
const USERS = Math.max(1, parseInt(arg('users', '50'), 10) || 50);

/** Файлы, которые браузер тянет при первом открытии index.html */
const SESSION_ASSETS = [
  '/index.html',
  '/theme.css',
  '/styles.css',
  '/lib/lib.js',
  '/lib/i18n.js',
  '/lib/editor-ide.js',
  '/lib/session.js',
  '/lib/extlibs.js',
  '/lib/skulpt/skulpt.min.js',
  '/lib/skulpt/skulpt-stdlib.js',
  '/locales/ru.json',
  '/locales/handbook.ru.json',
  '/lib/handbook-page.js',
  '/version.json'
];

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function fetchAsset(path) {
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { redirect: 'follow' });
    const buf = await res.arrayBuffer();
    return {
      path: path,
      ok: res.ok,
      status: res.status,
      ms: performance.now() - t0,
      bytes: buf.byteLength,
      error: null
    };
  } catch (err) {
    return {
      path: path,
      ok: false,
      status: 0,
      ms: performance.now() - t0,
      bytes: 0,
      error: err.message || String(err)
    };
  }
}

async function simulateUser(userId) {
  const t0 = performance.now();
  const results = [];
  for (const path of SESSION_ASSETS) {
    results.push(await fetchAsset(path));
  }
  return {
    userId: userId,
    sessionMs: performance.now() - t0,
    results: results
  };
}

async function warmup() {
  try {
    const res = await fetch(BASE + '/index.html');
    if (!res.ok) throw new Error('HTTP ' + res.status);
  } catch (err) {
    console.error('Сервер недоступен:', BASE, '-', err.message);
    console.error('Запустите: npm run dev');
    process.exit(1);
  }
}

function printReport(sessions, wallMs) {
  const allRequests = [];
  const sessionTimes = [];
  let errors = 0;
  let totalBytes = 0;
  const byPath = new Map();

  for (const session of sessions) {
    sessionTimes.push(session.sessionMs);
    for (const r of session.results) {
      allRequests.push(r);
      if (!r.ok) errors += 1;
      totalBytes += r.bytes;
      if (!byPath.has(r.path)) byPath.set(r.path, []);
      byPath.get(r.path).push(r);
    }
  }

  const reqMs = allRequests.map(function (r) { return r.ms; }).sort(function (a, b) { return a - b; });
  const sessSorted = sessionTimes.slice().sort(function (a, b) { return a - b; });

  console.log('\n=== Нагрузочный тест PGZero Studio ===');
  console.log('URL:        ' + BASE);
  console.log('Пользователей одновременно: ' + USERS);
  console.log('Запросов всего: ' + allRequests.length + ' (' + SESSION_ASSETS.length + ' на пользователя)');
  console.log('Wall time:  ' + wallMs.toFixed(0) + ' ms');
  console.log('Успешных:   ' + (allRequests.length - errors) + ' / ' + allRequests.length);
  console.log('Ошибок:     ' + errors);
  console.log('Трафик:     ' + (totalBytes / 1024 / 1024).toFixed(2) + ' MB');
  console.log('\n--- Время сессии (все файлы одного пользователя) ---');
  console.log('min:  ' + sessSorted[0].toFixed(0) + ' ms');
  console.log('p50:  ' + percentile(sessSorted, 50).toFixed(0) + ' ms');
  console.log('p95:  ' + percentile(sessSorted, 95).toFixed(0) + ' ms');
  console.log('max:  ' + sessSorted[sessSorted.length - 1].toFixed(0) + ' ms');
  console.log('\n--- Время одного HTTP-запроса ---');
  console.log('p50:  ' + percentile(reqMs, 50).toFixed(0) + ' ms');
  console.log('p95:  ' + percentile(reqMs, 95).toFixed(0) + ' ms');
  console.log('p99:  ' + percentile(reqMs, 99).toFixed(0) + ' ms');
  console.log('max:  ' + reqMs[reqMs.length - 1].toFixed(0) + ' ms');

  if (errors) {
    console.log('\n--- Ошибки ---');
    const seen = new Set();
    for (const r of allRequests) {
      if (r.ok) continue;
      const key = r.path + '|' + r.status + '|' + r.error;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log('  ' + r.path + ' → ' + (r.error || ('HTTP ' + r.status)));
    }
  }

  console.log('\n--- Медленные ресурсы (p95) ---');
  const pathStats = [];
  for (const [path, rows] of byPath) {
    const times = rows.map(function (r) { return r.ms; }).sort(function (a, b) { return a - b; });
    pathStats.push({ path: path, p95: percentile(times, 95), fail: rows.filter(function (r) { return !r.ok; }).length });
  }
  pathStats.sort(function (a, b) { return b.p95 - a.p95; });
  for (const s of pathStats.slice(0, 5)) {
    console.log('  ' + s.p95.toFixed(0) + ' ms  ' + s.path + (s.fail ? ' (' + s.fail + ' fail)' : ''));
  }

  const ok = errors === 0;
  console.log('\n' + (ok ? 'PASS' : 'FAIL') + ': ' + (ok ? 'все запросы успешны' : 'есть ошибки при нагрузке'));
  process.exitCode = ok ? 0 : 1;
}

await warmup();
console.log('Прогрев OK. Запуск ' + USERS + ' параллельных сессий…');

const wallStart = performance.now();
const sessions = await Promise.all(
  Array.from({ length: USERS }, function (_, i) { return simulateUser(i + 1); })
);
const wallMs = performance.now() - wallStart;

printReport(sessions, wallMs);
