import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'published');
const files = new Set(await readdir(dir));
const previews = new Set(await readdir(join(dir, 'previews')).catch(() => []));
const games = [];
for (const file of files) {
  const match = /^([a-z0-9]+)\.json$/i.exec(file);
  if (!match || !files.has(match[1] + '.pgz')) continue;
  try {
    const metadata = JSON.parse(await readFile(join(dir, file), 'utf8'));
    if (metadata.id !== match[1] || typeof metadata.title !== 'string' || !metadata.title.trim()) continue;
    games.push({ id: metadata.id, title: metadata.title.trim(), updatedAt: Number(metadata.updatedAt) || 0, publishedAt: Number(metadata.publishedAt) || Number(metadata.updatedAt) || 0, publicationDateApproximate: !Number(metadata.publishedAt), preview: previews.has(metadata.id + '.webp') });
  } catch (err) { console.warn('Skipping invalid published metadata:', file, err.message); }
}
games.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
await writeFile(join(dir, 'catalog.json'), JSON.stringify(games, null, 2) + '\n');
console.log('Indexed ' + games.length + ' published games.');
