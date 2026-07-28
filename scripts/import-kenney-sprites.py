#!/usr/bin/env python3
"""Import Kenney Pixel Platformer (CC0) into assets/image-library."""
from __future__ import annotations

import json
import shutil
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "assets" / "image-library"
ZIP_URL = "https://opengameart.org/sites/default/files/kenney_pixel-platformer.zip"
ZIP_PATH = ROOT / ".tmp-kenney_pixel-platformer.zip"

CATALOG = [
    {"id": "hero_green_idle", "label": "Герой (зелёный)", "group": "characters", "zip": "Tiles/Characters/tile_0000.png"},
    {"id": "hero_green_run", "label": "Герой бежит", "group": "characters", "zip": "Tiles/Characters/tile_0001.png"},
    {"id": "hero_green_jump", "label": "Герой прыгает", "group": "characters", "zip": "Tiles/Characters/tile_0002.png"},
    {"id": "hero_pink_idle", "label": "Герой (розовый)", "group": "characters", "zip": "Tiles/Characters/tile_0003.png"},
    {"id": "hero_pink_run", "label": "Розовый бежит", "group": "characters", "zip": "Tiles/Characters/tile_0004.png"},
    {"id": "hero_yellow_idle", "label": "Герой (жёлтый)", "group": "characters", "zip": "Tiles/Characters/tile_0006.png"},
    {"id": "hero_yellow_run", "label": "Жёлтый бежит", "group": "characters", "zip": "Tiles/Characters/tile_0007.png"},
    {"id": "hero_purple_idle", "label": "Герой (фиолетовый)", "group": "characters", "zip": "Tiles/Characters/tile_0009.png"},
    {"id": "hero_purple_run", "label": "Фиолетовый бежит", "group": "characters", "zip": "Tiles/Characters/tile_0010.png"},
    {"id": "slime_green", "label": "Слайм (зелёный)", "group": "enemies", "zip": "Tiles/Characters/tile_0012.png"},
    {"id": "slime_pink", "label": "Слайм (розовый)", "group": "enemies", "zip": "Tiles/Characters/tile_0013.png"},
    {"id": "slime_yellow", "label": "Слайм (жёлтый)", "group": "enemies", "zip": "Tiles/Characters/tile_0014.png"},
    {"id": "slime_purple", "label": "Слайм (фиолетовый)", "group": "enemies", "zip": "Tiles/Characters/tile_0015.png"},
    {"id": "bee", "label": "Пчела", "group": "enemies", "zip": "Tiles/Characters/tile_0016.png"},
    {"id": "snail", "label": "Улитка", "group": "enemies", "zip": "Tiles/Characters/tile_0017.png"},
    {"id": "fish", "label": "Рыба", "group": "enemies", "zip": "Tiles/Characters/tile_0018.png"},
    {"id": "frog", "label": "Лягушка", "group": "enemies", "zip": "Tiles/Characters/tile_0019.png"},
    {"id": "coin", "label": "Монетка", "group": "items", "zip": "Tiles/tile_0069.png"},
    {"id": "gem", "label": "Кристалл", "group": "items", "zip": "Tiles/tile_0070.png"},
    {"id": "key", "label": "Ключ", "group": "items", "zip": "Tiles/tile_0071.png"},
    {"id": "heart", "label": "Сердце", "group": "items", "zip": "Tiles/tile_0072.png"},
    {"id": "flag", "label": "Флаг", "group": "items", "zip": "Tiles/tile_0073.png"},
    {"id": "chest", "label": "Сундук", "group": "items", "zip": "Tiles/tile_0074.png"},
    {"id": "star", "label": "Звезда", "group": "effects", "zip": "Tiles/tile_0075.png"},
    {"id": "bomb", "label": "Бомба", "group": "effects", "zip": "Tiles/tile_0076.png"},
    {"id": "fire", "label": "Огонь", "group": "effects", "zip": "Tiles/tile_0077.png"},
    {"id": "grass_block", "label": "Блок (трава)", "group": "tiles", "zip": "Tiles/tile_0000.png"},
    {"id": "dirt_block", "label": "Блок (земля)", "group": "tiles", "zip": "Tiles/tile_0001.png"},
    {"id": "stone_block", "label": "Блок (камень)", "group": "tiles", "zip": "Tiles/tile_0002.png"},
    {"id": "brick_block", "label": "Кирпич", "group": "tiles", "zip": "Tiles/tile_0003.png"},
    {"id": "spike", "label": "Шипы", "group": "tiles", "zip": "Tiles/tile_0048.png"},
    {"id": "ladder", "label": "Лестница", "group": "tiles", "zip": "Tiles/tile_0055.png"},
    {"id": "btn_play", "label": "Кнопка Play", "group": "ui", "zip": "Tiles/tile_0120.png"},
    {"id": "btn_pause", "label": "Кнопка Pause", "group": "ui", "zip": "Tiles/tile_0121.png"},
    {"id": "btn_home", "label": "Кнопка Home", "group": "ui", "zip": "Tiles/tile_0122.png"},
    {"id": "bg_sky", "label": "Фон: небо", "group": "backgrounds", "zip": "Tiles/Backgrounds/tile_0000.png"},
    {"id": "bg_hills", "label": "Фон: холмы", "group": "backgrounds", "zip": "Tiles/Backgrounds/tile_0001.png"},
    {"id": "bg_clouds", "label": "Фон: облака", "group": "backgrounds", "zip": "Tiles/Backgrounds/tile_0002.png"},
    {"id": "bg_city", "label": "Фон: город", "group": "backgrounds", "zip": "Tiles/Backgrounds/tile_0008.png"},
    {"id": "bg_night", "label": "Фон: ночь", "group": "backgrounds", "zip": "Tiles/Backgrounds/tile_0012.png"},
]


def download_zip() -> None:
    print("Downloading Kenney Pixel Platformer (CC0)...")
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "pgz-studio"})
    with urllib.request.urlopen(req) as response, ZIP_PATH.open("wb") as out:
        shutil.copyfileobj(response, out)


def extract() -> None:
    for sub in ("pixel", "backgrounds", "kenney"):
        path = LIB / sub
        if path.is_dir():
            shutil.rmtree(path)

    with zipfile.ZipFile(ZIP_PATH) as archive:
        names = set(archive.namelist())
        for entry in CATALOG:
            src = entry["zip"]
            if src not in names:
                raise SystemExit(f"Missing in zip: {src}")
            dest = LIB / "kenney" / entry["group"] / f"{entry['id']}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(src) as src_file, dest.open("wb") as dest_file:
                dest_file.write(src_file.read())

    json_entries = []
    for entry in CATALOG:
        rel = f"assets/image-library/kenney/{entry['group']}/{entry['id']}.png"
        json_entries.append({
            "id": entry["id"],
            "label": entry["label"],
            "group": entry["group"],
            "source": "local",
            "file": rel,
            "pack": "kenney-pixel-platformer",
        })

    (LIB / "game-sprites.json").write_text(
        json.dumps(json_entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (LIB / "LICENSE.txt").write_text(
        "Kenney Pixel Platformer\n"
        "https://kenney.nl/assets/pixel-platformer\n"
        "License: CC0 1.0 Universal (public domain)\n"
        "Author: Kenney Vleugels\n",
        encoding="utf-8",
    )
    print(f"Imported {len(json_entries)} sprites into assets/image-library/kenney/")


def main() -> None:
    if not ZIP_PATH.is_file():
        download_zip()
    extract()
    if ZIP_PATH.is_file():
        ZIP_PATH.unlink()


if __name__ == "__main__":
    main()
