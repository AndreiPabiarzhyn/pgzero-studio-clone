from pathlib import Path
from PIL import Image, ImageStat
import json

folder = Path('published/previews')
report_path = folder / 'capture-report.json'
report = json.loads(report_path.read_text(encoding='utf-8'))
saved = flat = 0
for item in report:
    if item.get('status') != 'captured':
        continue
    source = folder / (item['id'] + '.png')
    if not source.is_file():
        continue
    try:
        with Image.open(source) as original:
            img = original.convert('RGBA')
            sample = img.convert('RGB').resize((64, 36))
            if sum(ImageStat.Stat(sample).stddev) < 5:
                item['status'] = 'blank'
                flat += 1
            else:
                img.thumbnail((480, 300), Image.Resampling.LANCZOS)
                img.save(folder / (item['id'] + '.webp'), 'WEBP', quality=82, method=4)
                saved += 1
        source.unlink()
    except Exception as exc:
        item['status'] = 'conversion_failed'
        item['reason'] = str(exc)
report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Готовых скриншотов: {saved}, пустых кадров: {flat}, не запустились: {sum(i["status"] == "failed" for i in report)}')
