import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../locales');

function merge(base, overlay) {
  const out = {
    title: overlay.title || base.title,
    tocTitle: overlay.tocTitle || base.tocTitle,
    backToTop: overlay.backToTop || base.backToTop,
    sections: base.sections.map(function (section) {
      const meta = (overlay.sections || []).find(function (s) { return s.id === section.id; }) || {};
      const body = meta.body || section.body;
      return {
        id: section.id,
        toc: meta.toc || section.toc,
        title: meta.title || section.title,
        body: body
      };
    })
  };
  return out;
}

const ru = JSON.parse(fs.readFileSync(path.join(localesDir, 'handbook.ru.json'), 'utf8'));

for (const lang of ['en', 'es']) {
  const meta = JSON.parse(fs.readFileSync(path.join(localesDir, 'handbook.' + lang + '.json'), 'utf8'));
  const bodies = JSON.parse(fs.readFileSync(path.join(localesDir, 'handbook-bodies.' + lang + '.json'), 'utf8'));
  const overlay = {
    title: meta.title,
    tocTitle: meta.tocTitle,
    backToTop: meta.backToTop,
    sections: ru.sections.map(function (s) {
      return {
        id: s.id,
        toc: meta.sections.find(function (m) { return m.id === s.id; })?.toc,
        title: meta.sections.find(function (m) { return m.id === s.id; })?.title,
        body: bodies[s.id]
      };
    })
  };
  fs.writeFileSync(path.join(localesDir, 'handbook.' + lang + '.json'), JSON.stringify(merge(ru, overlay), null, 2));
  console.log('merged handbook.' + lang + '.json');
}
