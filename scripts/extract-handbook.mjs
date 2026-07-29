import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '../pgz-handbook.html'), 'utf8');
const sections = [];
const re = /<div class="section" id="([^"]+)">\s*<h2>([^<]+)<\/h2>([\s\S]*?)<a href="#" class="back-to-top">/g;
const toc = {};
const tocRe = /<a href="#([^"]+)">([^<]+)<\/a>/g;
let tm;
while ((tm = tocRe.exec(html))) toc[tm[1]] = tm[2];
let m;
while ((m = re.exec(html))) {
  sections.push({
    id: m[1],
    toc: toc[m[1]] || m[2],
    title: m[2],
    body: m[3].trim()
  });
}
const out = {
  title: 'Справочник по Pygame Zero',
  tocTitle: 'Содержание',
  backToTop: '↑ К содержанию',
  sections
};
fs.writeFileSync(path.join(__dirname, '../locales/handbook.ru.json'), JSON.stringify(out, null, 2));
console.log('handbook.ru sections:', sections.length);
