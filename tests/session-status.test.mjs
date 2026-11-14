import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../lib/session.js', import.meta.url), 'utf8');
function setup() {
  let resolveSave;
  const classes = new Set();
  const status = { textContent: '', title: '', classList: { add: (...a) => a.forEach(x => classes.add(x)), remove: (...a) => a.forEach(x => classes.delete(x)), contains: x => classes.has(x) } };
  const context = { console, setTimeout, clearTimeout, localStorage: {}, document: { getElementById(id) { return id === 'footerProjectStatus' ? status : null; } }, PythonIDE: { files: { 'my_pgz.py': 'pass' } }, PGZProjectGallery: { getActiveSlot: () => 0, cellLabel: () => 'Ячейка 1', saveActiveSlotQuiet: () => new Promise(resolve => { resolveSave = resolve; }) } };
  context.window = context;
  vm.runInNewContext(source, context);
  return { session: context.PGZSession, status, resolve: value => resolveSave(value) };
}
test('статус сохранения ждёт завершения записи', async () => {
  const s = setup(); s.session.save();
  assert.match(s.status.textContent, /Сохранение/);
  s.resolve(true); await new Promise(resolve => setImmediate(resolve));
  assert.match(s.status.textContent, /Сохранено/);
});
test('неудачная запись показывает ошибку', async () => {
  const s = setup(); s.session.save(); s.resolve(false);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(s.status.textContent, /Ошибка сохранения/);
});
test('новые изменения не помечаются сохранёнными после старой записи', async () => {
  const s = setup(); s.session.save(); s.session.scheduleSave(); s.resolve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(s.status.textContent, /Сохранено/);
  s.session.flush();
});
