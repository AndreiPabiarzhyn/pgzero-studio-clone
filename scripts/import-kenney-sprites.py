#!/usr/bin/env python3
"""
Import Kenney CC0 sprite sets into assets/image-library.

Sources:
- Platformer Pack Redux (128x256 players, 128x128 enemies/items, 1024 backgrounds)
  https://opengameart.org/content/platformer-pack-redux-360-assets
- Background Elements (1024 sample backdrops)
  https://opengameart.org/content/background-elements
"""
from __future__ import annotations

import json
import shutil
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "assets" / "image-library"
TMP = ROOT / ".tmp-kenney-import"

REDUX_URL = (
    "https://opengameart.org/sites/default/files/"
    + urllib.parse.quote("Platformer Pack Redux (360 assets).zip")
)
BG_URL = "https://opengameart.org/sites/default/files/kenney_backgroundElements.zip"

# id, label, group, zip_name, path_inside_zip
CATALOG = [
    # Characters 128x256
    {"id": "hero_green_stand", "label": "Герой зелёный (стоит)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Green/alienGreen_stand.png", "pack": "platformer-redux"},
    {"id": "hero_green_walk", "label": "Герой зелёный (шаг)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Green/alienGreen_walk1.png", "pack": "platformer-redux"},
    {"id": "hero_green_jump", "label": "Герой зелёный (прыжок)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Green/alienGreen_jump.png", "pack": "platformer-redux"},
    {"id": "hero_green_duck", "label": "Герой зелёный (присел)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Green/alienGreen_duck.png", "pack": "platformer-redux"},
    {"id": "hero_blue_stand", "label": "Герой синий (стоит)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Blue/alienBlue_stand.png", "pack": "platformer-redux"},
    {"id": "hero_blue_walk", "label": "Герой синий (шаг)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Blue/alienBlue_walk1.png", "pack": "platformer-redux"},
    {"id": "hero_pink_stand", "label": "Герой розовый (стоит)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Pink/alienPink_stand.png", "pack": "platformer-redux"},
    {"id": "hero_yellow_stand", "label": "Герой жёлтый (стоит)", "group": "characters",
     "zip": "redux", "path": "PNG/Players/128x256/Yellow/alienYellow_stand.png", "pack": "platformer-redux"},

    # Enemies 128x128
    {"id": "slime_blue", "label": "Слайм синий", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/slimeBlue.png", "pack": "platformer-redux"},
    {"id": "slime_green", "label": "Слайм зелёный", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/slimeGreen.png", "pack": "platformer-redux"},
    {"id": "bee", "label": "Пчела", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/bee.png", "pack": "platformer-redux"},
    {"id": "fish_blue", "label": "Рыба", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/fishBlue.png", "pack": "platformer-redux"},
    {"id": "snail", "label": "Улитка", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/snail.png", "pack": "platformer-redux"},
    {"id": "frog", "label": "Лягушка", "group": "enemies",
     "zip": "redux", "path": "PNG/Enemies/frog.png", "pack": "platformer-redux"},

    # Items
    {"id": "coin_gold", "label": "Монетка золото", "group": "items",
     "zip": "redux", "path": "PNG/Items/coinGold.png", "pack": "platformer-redux"},
    {"id": "coin_silver", "label": "Монетка серебро", "group": "items",
     "zip": "redux", "path": "PNG/Items/coinSilver.png", "pack": "platformer-redux"},
    {"id": "gem_blue", "label": "Кристалл", "group": "items",
     "zip": "redux", "path": "PNG/Items/gemBlue.png", "pack": "platformer-redux"},
    {"id": "key_green", "label": "Ключ", "group": "items",
     "zip": "redux", "path": "PNG/Items/keyGreen.png", "pack": "platformer-redux"},
    {"id": "star", "label": "Звезда", "group": "items",
     "zip": "redux", "path": "PNG/Items/star.png", "pack": "platformer-redux"},
    {"id": "flag_green", "label": "Флаг", "group": "items",
     "zip": "redux", "path": "PNG/Items/flagGreen1.png", "pack": "platformer-redux"},

    # Tiles
    {"id": "grass", "label": "Трава", "group": "tiles",
     "zip": "redux", "path": "PNG/Tiles/grass.png", "pack": "platformer-redux"},
    {"id": "brick", "label": "Кирпич", "group": "tiles",
     "zip": "redux", "path": "PNG/Tiles/brickBrown.png", "pack": "platformer-redux"},
    {"id": "spikes", "label": "Шипы", "group": "tiles",
     "zip": "redux", "path": "PNG/Tiles/spikes.png", "pack": "platformer-redux"},
    {"id": "ladder", "label": "Лестница", "group": "tiles",
     "zip": "redux", "path": "PNG/Tiles/ladderMid.png", "pack": "platformer-redux"},
    {"id": "crate", "label": "Ящик", "group": "tiles",
     "zip": "redux", "path": "PNG/Tiles/boxCrate.png", "pack": "platformer-redux"},

    # Full backgrounds 1024 (Redux)
    {"id": "bg_grass", "label": "Фон: луг", "group": "backgrounds",
     "zip": "redux", "path": "PNG/Backgrounds/colored_grass.png", "pack": "platformer-redux"},
    {"id": "bg_desert", "label": "Фон: пустыня", "group": "backgrounds",
     "zip": "redux", "path": "PNG/Backgrounds/colored_desert.png", "pack": "platformer-redux"},
    {"id": "bg_land", "label": "Фон: холмы", "group": "backgrounds",
     "zip": "redux", "path": "PNG/Backgrounds/colored_land.png", "pack": "platformer-redux"},
    {"id": "bg_shroom", "label": "Фон: грибы", "group": "backgrounds",
     "zip": "redux", "path": "PNG/Backgrounds/colored_shroom.png", "pack": "platformer-redux"},

    # Full backgrounds 1024 (Background Elements)
    {"id": "bg_forest", "label": "Фон: лес", "group": "backgrounds",
     "zip": "bg", "path": "Samples/colored_forest.png", "pack": "background-elements"},
    {"id": "bg_castle", "label": "Фон: замок", "group": "backgrounds",
     "zip": "bg", "path": "Samples/colored_castle.png", "pack": "background-elements"},
    {"id": "bg_peaks", "label": "Фон: горы", "group": "backgrounds",
     "zip": "bg", "path": "Samples/uncolored_peaks.png", "pack": "background-elements"},
    {"id": "bg_plain", "label": "Фон: равнина", "group": "backgrounds",
     "zip": "bg", "path": "Samples/uncolored_plain.png", "pack": "background-elements"},

    # UI / HUD
    {"id": "heart_full", "label": "Сердце (HUD)", "group": "ui",
     "zip": "redux", "path": "PNG/HUD/hudHeart_full.png", "pack": "platformer-redux"},
    {"id": "hud_player", "label": "Иконка игрока", "group": "ui",
     "zip": "redux", "path": "PNG/HUD/hudPlayer_green.png", "pack": "platformer-redux"},
]


def download(url: str, dest: Path) -> None:
    print("Downloading", dest.name, "...")
    req = urllib.request.Request(url, headers={"User-Agent": "pgz-studio"})
    with urllib.request.urlopen(req) as response, dest.open("wb") as out:
        shutil.copyfileobj(response, out)


def extract_all() -> None:
    if LIB.exists():
        shutil.rmtree(LIB)
    LIB.mkdir(parents=True)

    TMP.mkdir(parents=True, exist_ok=True)
    redux_zip = TMP / "redux.zip"
    bg_zip = TMP / "bg.zip"

    download(REDUX_URL, redux_zip)
    download(BG_URL, bg_zip)

    archives = {
        "redux": zipfile.ZipFile(redux_zip),
        "bg": zipfile.ZipFile(bg_zip),
    }

    try:
        for entry in CATALOG:
            archive = archives[entry["zip"]]
            src = entry["path"]
            names = set(archive.namelist())
            if src not in names:
                raise SystemExit(f"Missing in {entry['zip']}: {src}")

            rel = f"{entry['group']}/{entry['id']}.png"
            dest = LIB / "kenney" / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(src) as src_file, dest.open("wb") as dest_file:
                dest_file.write(src_file.read())
    finally:
        for archive in archives.values():
            archive.close()

    json_entries = []
    for entry in CATALOG:
        rel = f"assets/image-library/kenney/{entry['group']}/{entry['id']}.png"
        json_entries.append({
            "id": entry["id"],
            "label": entry["label"],
            "group": entry["group"],
            "source": "local",
            "file": rel,
            "pack": entry["pack"],
        })

    (LIB / "game-sprites.json").write_text(
        json.dumps(json_entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (LIB / "LICENSE.txt").write_text(
        "Kenney.nl — CC0 1.0 Universal (public domain)\n\n"
        "Packs used:\n"
        "- Platformer Pack Redux\n"
        "  https://kenney.nl/assets/platformer-pack-redux\n"
        "- Background Elements\n"
        "  https://kenney.nl/assets/background-elements\n\n"
        "Author: Kenney Vleugels\n",
        encoding="utf-8",
    )

    shutil.rmtree(TMP, ignore_errors=True)
    print(f"Imported {len(json_entries)} sprites into {LIB / 'kenney'}")


if __name__ == "__main__":
    extract_all()
