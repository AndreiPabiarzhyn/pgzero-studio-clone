#!/usr/bin/env python3
"""
Import CC0 sprite sets into assets/image-library.

Sources (all CC0):
- Platformer Pack Redux — 128x256 players, 128 enemies/items/tiles, 1024 backgrounds
- Background Elements — 1024 sample backdrops + parallax pieces
- New Platformer Pack — 128 characters, 64 tiles/enemies, 256 backgrounds
- Space Shooter Redux — ships, enemies, lasers, meteors, fire
- Space Shooter Extension — ships, rockets, missiles, astronauts
- Tiny Dungeon — knights, monsters, weapons (16x16)
- Skeleton & Ghost (Balmer) — skeleton/ghost sprites
- Pixel Art Spells (DevWizard) — fireballs, magic bolts
"""
from __future__ import annotations

import json
import re
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
NEW_URL = "https://opengameart.org/sites/default/files/kenney_new-platformer-pack-1.0.zip"
SPACE_URL = "https://opengameart.org/sites/default/files/SpaceShooterRedux.zip"
SPACE_EXT_URL = "https://opengameart.org/sites/default/files/kenney_spaceShooterExtension.zip"
DUNGEON_URL = "https://opengameart.org/sites/default/files/kenney_tinydungeon.zip"
SKELETON_URL = "https://opengameart.org/sites/default/files/skeleton-ghost.zip"
SPELLS_URL = "https://opengameart.org/sites/default/files/pixelart_spells.zip"

COLOR_RU = {
    "Green": "зелёный",
    "Blue": "синий",
    "Pink": "розовый",
    "Yellow": "жёлтый",
    "Beige": "бежевый",
    "Purple": "фиолетовый",
}

POSE_RU = {
    "stand": "стоит",
    "walk1": "шаг 1",
    "walk2": "шаг 2",
    "jump": "прыжок",
    "duck": "присел",
    "hit": "удар",
    "climb1": "лазает 1",
    "climb2": "лазает 2",
    "swim1": "плавает 1",
    "swim2": "плавает 2",
    "front": "вперёд",
}

TILE_RU = {
    "grass": "Трава",
    "brickBrown": "Кирпич коричн.",
    "brickGrey": "Кирпич серый",
    "spikes": "Шипы",
    "ladderMid": "Лестница",
    "ladderTop": "Лестница (верх)",
    "boxCrate": "Ящик",
    "boxCoin": "Блок с монетой",
    "bomb": "Бомба",
    "bridgeA": "Мост A",
    "bridgeB": "Мост B",
    "cactus": "Кактус",
    "doorClosed_mid": "Дверь закрыта",
    "doorOpen_mid": "Дверь открыта",
    "lava": "Лава",
    "water": "Вода",
    "spring": "Пружина",
    "mushroomBrown": "Гриб коричн.",
    "mushroomRed": "Гриб красный",
    "rock": "Камень",
    "signExit": "Выход",
    "snow": "Снег",
    "torch1": "Факел",
    "fence": "Забор",
    "bush": "Куст",
    "chain": "Цепь",
    "window": "Окно",
}

ITEM_RU = {
    "coinBronze": "Монета бронза",
    "coinGold": "Монета золото",
    "coinSilver": "Монета серебро",
    "gemBlue": "Кристалл синий",
    "gemGreen": "Кристалл зелёный",
    "gemRed": "Кристалл красный",
    "gemYellow": "Кристалл жёлтый",
    "keyBlue": "Ключ синий",
    "keyGreen": "Ключ зелёный",
    "keyRed": "Ключ красный",
    "keyYellow": "Ключ жёлтый",
    "star": "Звезда",
    "flagGreen1": "Флаг зелёный",
    "flagBlue1": "Флаг синий",
    "flagRed1": "Флаг красный",
    "flagYellow1": "Флаг жёлтый",
}

ENEMY_RU = {
    "bee": "Пчела",
    "fishBlue": "Рыба синяя",
    "fishGreen": "Рыба зелёная",
    "fishPink": "Рыба розовая",
    "fly": "Муха",
    "frog": "Лягушка",
    "ladybug": "Божья коровка",
    "mouse": "Мышь",
    "saw": "Пила",
    "sawHalf": "Пила (половина)",
    "slimeBlock": "Слайм-блок",
    "slimeBlue": "Слайм синий",
    "slimeGreen": "Слайм зелёный",
    "slimePurple": "Слайм фиолетовый",
    "snail": "Улитка",
    "wormGreen": "Червь зелёный",
    "wormPink": "Червь розовый",
    "barnacle": "Утконос",
}


def slug(text: str) -> str:
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", text)
    text = text.lower().replace(" ", "_")
    text = re.sub(r"[^a-z0-9_]+", "", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "sprite"


def add(catalog: list, entry_id: str, label: str, group: str, zip_key: str, path: str, pack: str) -> None:
    catalog.append({
        "id": entry_id,
        "label": label,
        "group": group,
        "zip": zip_key,
        "path": path,
        "pack": pack,
    })


def build_catalog() -> list:
    catalog: list = []

    # --- Redux characters ---
    green_poses = [
        "stand", "walk1", "walk2", "jump", "duck", "hit", "climb1", "climb2", "swim1", "swim2", "front"
    ]
    basic_poses = ["stand", "walk1", "walk2", "jump", "duck", "hit"]
    for color in ["Green", "Blue", "Pink", "Yellow", "Beige"]:
        poses = green_poses if color == "Green" else basic_poses
        color_ru = COLOR_RU[color]
        prefix = f"alien{color}"
        for pose in poses:
            fname = f"{prefix}_{pose}.png"
            pose_ru = POSE_RU.get(pose, pose)
            entry_id = slug(f"hero_{color.lower()}_{pose}")
            add(
                catalog,
                entry_id,
                f"Герой {color_ru} ({pose_ru})",
                "characters",
                "redux",
                f"PNG/Players/128x256/{color}/{fname}",
                "platformer-redux",
            )

    # --- Redux enemies (idle/base frames) ---
    for name, label in ENEMY_RU.items():
        add(catalog, slug(name), label, "enemies", "redux", f"PNG/Enemies/{name}.png", "platformer-redux")

    # --- Redux items ---
    for fname, label in ITEM_RU.items():
        add(catalog, slug(fname.replace("coin", "coin_")), label, "items", "redux", f"PNG/Items/{fname}.png", "platformer-redux")

    # --- Redux tiles ---
    for fname, label in TILE_RU.items():
        add(catalog, slug(fname), label, "tiles", "redux", f"PNG/Tiles/{fname}.png", "platformer-redux")

    # --- Redux backgrounds ---
    for name, label in [
        ("colored_grass", "Фон: луг"),
        ("colored_desert", "Фон: пустыня"),
        ("colored_land", "Фон: холмы"),
        ("colored_shroom", "Фон: грибы"),
        ("blue_grass", "Фон: луг (синий)"),
        ("blue_desert", "Фон: пустыня (синий)"),
        ("blue_land", "Фон: холмы (синий)"),
        ("blue_shroom", "Фон: грибы (синий)"),
    ]:
        add(catalog, slug(f"bg_{name}"), label, "backgrounds", "redux", f"PNG/Backgrounds/{name}.png", "platformer-redux")

    # --- Redux HUD ---
    for name, label in [
        ("hudHeart_full", "Сердце"),
        ("hudHeart_half", "Сердце (половина)"),
        ("hudHeart_empty", "Сердце (пустое)"),
        ("hudCoin", "Монетка HUD"),
        ("hudPlayer_green", "Иконка игрока"),
        ("hudKey_green", "Ключ HUD"),
        ("hudJewel_blue", "Кристалл HUD"),
    ]:
        add(catalog, slug(name), label, "ui", "redux", f"PNG/HUD/{name}.png", "platformer-redux")

    # --- Background Elements: full samples ---
    for path, entry_id, label in [
        ("Samples/colored_forest.png", "bg_forest", "Фон: лес"),
        ("Samples/colored_castle.png", "bg_castle", "Фон: замок"),
        ("Samples/colored_desert.png", "bg_desert2", "Фон: пустыня 2"),
        ("Samples/colored_talltrees.png", "bg_talltrees", "Фон: высокие деревья"),
        ("Samples/uncolored_peaks.png", "bg_peaks", "Фон: горы"),
        ("Samples/uncolored_plain.png", "bg_plain", "Фон: равнина"),
        ("Samples/uncolored_hills.png", "bg_hills", "Фон: холмы 2"),
        ("Samples/uncolored_forest.png", "bg_forest2", "Фон: лес 2"),
        ("Samples/uncolored_desert.png", "bg_desert3", "Фон: пустыня 3"),
        ("Samples/uncolored_castle.png", "bg_castle2", "Фон: замок 2"),
        ("Samples/uncolored_piramids.png", "bg_pyramids", "Фон: пирамиды"),
        ("Samples/uncolored_talltrees.png", "bg_talltrees2", "Фон: деревья 2"),
    ]:
        add(catalog, entry_id, label, "backgrounds", "bg", path, "background-elements")

    # --- Background Elements: parallax pieces ---
    for fname, label in [
        ("cloud1.png", "Облако 1"),
        ("cloud2.png", "Облако 2"),
        ("cloud3.png", "Облако 3"),
        ("hills1.png", "Холмы (слой)"),
        ("hills2.png", "Холмы 2 (слой)"),
        ("mountain1.png", "Гора 1"),
        ("mountain2.png", "Гора 2"),
        ("mountain3.png", "Гора 3"),
        ("tree01.png", "Дерево 1"),
        ("tree02.png", "Дерево 2"),
        ("tree03.png", "Дерево 3"),
        ("castle.png", "Замок (слой)"),
        ("sky.png", "Небо (слой)"),
    ]:
        entry_id = slug(f"layer_{fname.replace('.png', '')}")
        add(catalog, entry_id, label, "backgrounds", "bg", f"PNG/Flat/{fname}", "background-elements")

    # --- New Platformer Pack: characters ---
    for color in ["green", "pink", "yellow", "purple", "beige"]:
        color_ru = COLOR_RU.get(color.capitalize(), color)
        for pose, pose_ru in [("idle", "стоит"), ("walk_a", "шаг"), ("jump", "прыжок"), ("duck", "присел"), ("hit", "удар")]:
            fname = f"character_{color}_{pose}.png"
            add(
                catalog,
                slug(f"np_{color}_{pose}"),
                f"Персонаж {color_ru} ({pose_ru})",
                "characters",
                "new",
                f"Sprites/Characters/Default/{fname}",
                "new-platformer",
            )

    # --- New Platformer Pack: enemies ---
    for fname, label in [
        ("bee_rest.png", "Пчела (NP)"),
        ("fish_blue_rest.png", "Рыба синяя (NP)"),
        ("fish_purple_rest.png", "Рыба фиол. (NP)"),
        ("frog_rest.png", "Лягушка (NP)"),
        ("snail_rest.png", "Улитка (NP)"),
        ("worm_normal_rest.png", "Червь (NP)"),
        ("block_idle.png", "Блок-враг (NP)"),
        ("barnacle_attack_rest.png", "Утконос (NP)"),
    ]:
        add(catalog, slug(f"np_{fname.replace('.png', '')}"), label, "enemies", "new", f"Sprites/Enemies/Default/{fname}", "new-platformer")

    # --- New Platformer Pack: tiles ---
    for fname, label in [
        ("block_green.png", "Блок зелёный"),
        ("block_blue.png", "Блок синий"),
        ("block_red.png", "Блок красный"),
        ("block_spikes.png", "Блок шипы"),
        ("block_coin.png", "Блок монета"),
        ("block_plank.png", "Доска"),
        ("block_planks.png", "Доски"),
        ("terrain_grass_block_center.png", "Земля трава"),
        ("terrain_stone_block_center.png", "Земля камень"),
        ("terrain_sand_block_center.png", "Земля песок"),
        ("terrain_snow_block_center.png", "Земля снег"),
        ("spikes.png", "Шипы (NP)"),
        ("ladder_top.png", "Лестница верх (NP)"),
        ("ladder_middle.png", "Лестница (NP)"),
        ("door_closed_top.png", "Дверь (NP)"),
        ("sign.png", "Табличка (NP)"),
    ]:
        add(catalog, slug(f"np_{fname.replace('.png', '')}"), label, "tiles", "new", f"Sprites/Tiles/Default/{fname}", "new-platformer")

    # --- New Platformer Pack: backgrounds (256) ---
    for fname, label in [
        ("background_color_hills.png", "Фон NP: холмы"),
        ("background_color_desert.png", "Фон NP: пустыня"),
        ("background_color_trees.png", "Фон NP: деревья"),
        ("background_color_mushrooms.png", "Фон NP: грибы"),
        ("background_fade_hills.png", "Фон NP: холмы fade"),
        ("background_fade_desert.png", "Фон NP: пустыня fade"),
        ("background_solid_sky.png", "Фон NP: небо"),
        ("background_solid_dirt.png", "Фон NP: земля"),
    ]:
        add(catalog, slug(f"np_{fname.replace('.png', '')}"), label, "backgrounds", "new", f"Sprites/Backgrounds/Default/{fname}", "new-platformer")

    # --- New Platformer Pack: collectibles ---
    for path, entry_id, label in [
        ("Sprites/Tiles/Default/gem_blue.png", "np_gem_blue", "Кристалл (NP)"),
        ("Sprites/Tiles/Default/heart.png", "np_heart", "Сердце (NP)"),
        ("Sprites/Tiles/Default/hud_key_green.png", "np_key_green", "Ключ (NP)"),
        ("Sprites/Tiles/Default/star.png", "np_star", "Звезда (NP)"),
        ("Sprites/Tiles/Default/flag_green_a.png", "np_flag_green_a", "Флаг (NP)"),
        ("Sprites/Tiles/Default/block_coin.png", "np_block_coin", "Монета (NP)"),
    ]:
        add(catalog, entry_id, label, "items", "new", path, "new-platformer")

    build_space_catalog(catalog)
    build_dungeon_catalog(catalog)
    build_skeleton_catalog(catalog)
    build_spells_catalog(catalog)

    # Deduplicate ids (keep first)
    seen: set[str] = set()
    unique: list = []
    for entry in catalog:
        if entry["id"] in seen:
            continue
        seen.add(entry["id"])
        unique.append(entry)
    return unique


def build_space_catalog(catalog: list) -> None:
    ship_colors = {
        "blue": "синий",
        "green": "зелёный",
        "orange": "оранжевый",
        "red": "красный",
    }
    for ship_num in (1, 2, 3):
        for color, color_ru in ship_colors.items():
            fname = f"playerShip{ship_num}_{color}.png"
            add(
                catalog,
                slug(f"ship{ship_num}_{color}"),
                f"Космический корабль {ship_num} ({color_ru})",
                "characters",
                "space",
                f"PNG/{fname}",
                "space-shooter-redux",
            )

    enemy_colors = {
        "Black": "чёрный",
        "Blue": "синий",
        "Green": "зелёный",
        "Red": "красный",
    }
    for color, color_ru in enemy_colors.items():
        for variant in range(1, 6):
            fname = f"enemy{color}{variant}.png"
            add(
                catalog,
                slug(f"enemy_{color.lower()}_{variant}"),
                f"Вражеский корабль ({color_ru} {variant})",
                "enemies",
                "space",
                f"PNG/Enemies/{fname}",
                "space-shooter-redux",
            )

    laser_colors = {
        "laserBlue": "синий",
        "laserGreen": "зелёный",
        "laserRed": "красный",
    }
    for prefix, color_ru in laser_colors.items():
        for num in range(1, 17):
            fname = f"{prefix}{num:02d}.png"
            add(
                catalog,
                slug(f"{prefix}_{num:02d}"),
                f"Лазер {color_ru} ({num})",
                "projectiles",
                "space",
                f"PNG/Lasers/{fname}",
                "space-shooter-redux",
            )

    meteor_labels = {
        "meteorBrown_big1": "Метеорит коричн. (большой 1)",
        "meteorBrown_big2": "Метеорит коричн. (большой 2)",
        "meteorBrown_big3": "Метеорит коричн. (большой 3)",
        "meteorBrown_big4": "Метеорит коричн. (большой 4)",
        "meteorBrown_med1": "Метеорит коричн. (средний 1)",
        "meteorBrown_med3": "Метеорит коричн. (средний 2)",
        "meteorBrown_small1": "Метеорит коричн. (малый 1)",
        "meteorBrown_small2": "Метеорит коричн. (малый 2)",
        "meteorBrown_tiny1": "Метеорит коричн. (крошечный 1)",
        "meteorBrown_tiny2": "Метеорит коричн. (крошечный 2)",
        "meteorGrey_big1": "Метеорит серый (большой 1)",
        "meteorGrey_big2": "Метеорит серый (большой 2)",
        "meteorGrey_big3": "Метеорит серый (большой 3)",
        "meteorGrey_big4": "Метеорит серый (большой 4)",
        "meteorGrey_med1": "Метеорит серый (средний 1)",
        "meteorGrey_med2": "Метеорит серый (средний 2)",
        "meteorGrey_small1": "Метеорит серый (малый 1)",
        "meteorGrey_small2": "Метеорит серый (малый 2)",
        "meteorGrey_tiny1": "Метеорит серый (крошечный 1)",
        "meteorGrey_tiny2": "Метеорит серый (крошечный 2)",
    }
    for fname, label in meteor_labels.items():
        add(catalog, slug(fname), label, "projectiles", "space", f"PNG/Meteors/{fname}.png", "space-shooter-redux")

    for num in range(20):
        fname = f"fire{num:02d}.png"
        add(
            catalog,
            slug(f"fire_{num:02d}"),
            f"Огонь ({num + 1})",
            "effects",
            "space",
            f"PNG/Effects/{fname}",
            "space-shooter-redux",
        )

    for fname, label in [
        ("shield1.png", "Щит (эффект 1)"),
        ("shield2.png", "Щит (эффект 2)"),
        ("shield3.png", "Щит (эффект 3)"),
        ("speed.png", "Ускорение"),
        ("star1.png", "Звезда (эффект 1)"),
        ("star2.png", "Звезда (эффект 2)"),
        ("star3.png", "Звезда (эффект 3)"),
    ]:
        add(catalog, slug(f"space_{fname.replace('.png', '')}"), label, "effects", "space", f"PNG/Effects/{fname}", "space-shooter-redux")

    for fname, label in [
        ("black.png", "Космос: чёрный"),
        ("blue.png", "Космос: синий"),
        ("darkPurple.png", "Космос: тёмно-фиолетовый"),
        ("purple.png", "Космос: фиолетовый"),
    ]:
        add(catalog, slug(f"space_bg_{fname.replace('.png', '')}"), label, "backgrounds", "space", f"Backgrounds/{fname}", "space-shooter-redux")

    for num in range(1, 10):
        fname = f"spaceShips_{num:03d}.png"
        add(
            catalog,
            slug(f"space_ext_ship_{num:03d}"),
            f"Космический корабль ({num})",
            "characters",
            "space_ext",
            f"PNG/Sprites X2/Ships/{fname}",
            "space-shooter-extension",
        )

    for num in range(1, 5):
        fname = f"spaceRockets_{num:03d}.png"
        add(
            catalog,
            slug(f"rocket_{num:03d}"),
            f"Ракета ({num})",
            "projectiles",
            "space_ext",
            f"PNG/Sprites X2/Rockets/{fname}",
            "space-shooter-extension",
        )

    for num in range(1, 41):
        fname = f"spaceMissiles_{num:03d}.png"
        add(
            catalog,
            slug(f"missile_{num:03d}"),
            f"Ракета-снаряд ({num})",
            "projectiles",
            "space_ext",
            f"PNG/Sprites X2/Missiles/{fname}",
            "space-shooter-extension",
        )

    for num in range(1, 19):
        fname = f"spaceAstronauts_{num:03d}.png"
        add(
            catalog,
            slug(f"astronaut_{num:03d}"),
            f"Космонавт ({num})",
            "characters",
            "space_ext",
            f"PNG/Sprites X2/Astronauts/{fname}",
            "space-shooter-extension",
        )


def build_dungeon_catalog(catalog: list) -> None:
    # Tile indices verified against kenney_tinydungeon Preview / tile PNGs.
    tiles = [
        # Characters / NPCs
        (84, "dungeon_wizard", "Маг", "characters"),
        (85, "dungeon_villager", "Селянин", "characters"),
        (86, "dungeon_bearded_man", "Бородач", "characters"),
        (87, "dungeon_viking", "Викинг", "characters"),
        (88, "dungeon_traveler", "Путник", "characters"),
        (96, "dungeon_knight_helmet", "Рыцарь (шлем)", "characters"),
        (97, "dungeon_knight_grille", "Рыцарь (решётка)", "characters"),
        (98, "dungeon_knight_face", "Рыцарь (лицо)", "characters"),
        (99, "dungeon_heroine", "Героиня", "characters"),
        (100, "dungeon_elder", "Старуха", "characters"),
        (112, "dungeon_rogue", "Разбойник", "characters"),
        # Enemies
        (92, "dungeon_mimic", "Мимик", "enemies"),
        (108, "dungeon_wisp", "Дух", "enemies"),
        (109, "dungeon_cyclops", "Циклоп", "enemies"),
        (110, "dungeon_crab", "Краб", "enemies"),
        (111, "dungeon_cultist", "Культист", "enemies"),
        (120, "dungeon_bat", "Летучая мышь", "enemies"),
        (121, "dungeon_ghost", "Призрак", "enemies"),
        (122, "dungeon_spider", "Паук", "enemies"),
        (123, "dungeon_rat_brown", "Крыса", "enemies"),
        (124, "dungeon_rat_grey", "Крыса (серая)", "enemies"),
        # Items
        (89, "dungeon_chest_closed", "Сундук (закрыт)", "items"),
        (90, "dungeon_chest_half", "Сундук (приоткрыт)", "items"),
        (91, "dungeon_chest_open", "Сундук (открыт)", "items"),
        (102, "dungeon_shield", "Щит", "items"),
        (103, "dungeon_dagger", "Кинжал", "items"),
        (104, "dungeon_sword", "Меч", "items"),
        (105, "dungeon_scimitar", "Сабля", "items"),
        (106, "dungeon_broadsword", "Палаш", "items"),
        (107, "dungeon_wooden_sword", "Деревянный меч", "items"),
        (113, "dungeon_potion_empty", "Зелье (пустое)", "items"),
        (114, "dungeon_potion_green", "Зелье зелёное", "items"),
        (115, "dungeon_potion_red", "Зелье красное", "items"),
        (116, "dungeon_potion_blue", "Зелье синее", "items"),
        (125, "dungeon_scroll", "Свиток", "items"),
        (126, "dungeon_vial_green", "Флакон зелёный", "items"),
        (127, "dungeon_vial_red", "Флакон красный", "items"),
        (128, "dungeon_vial_blue", "Флакон синий", "items"),
        # Weapons / magic gear
        (117, "dungeon_hammer", "Молот", "items"),
        (118, "dungeon_battle_axe", "Боевой топор", "items"),
        (119, "dungeon_hand_axe", "Топор", "items"),
        (129, "dungeon_staff_purple", "Посох (фиолет.)", "items"),
        (130, "dungeon_staff_blue", "Посох (синий)", "items"),
        (131, "dungeon_staff_silver", "Посох (серебр.)", "items"),
    ]
    for index, entry_id, label, group in tiles:
        add(
            catalog,
            entry_id,
            label,
            group,
            "dungeon",
            f"Tiles/tile_{index:04d}.png",
            "tiny-dungeon",
        )


def build_skeleton_catalog(catalog: list) -> None:
    for fname, entry_id, label in [
        ("skeleton-36x48.png", "skeleton_white", "Скелет"),
        ("skeleton-green-36x48.png", "skeleton_green", "Скелет зелёный"),
        ("ghost-25x35.png", "ghost_white", "Призрак"),
        ("ghost-green-25x35.png", "ghost_green", "Призрак зелёный"),
        ("ghost-red-25x35.png", "ghost_red", "Призрак красный"),
    ]:
        add(catalog, entry_id, label, "enemies", "skeleton", fname, "skeleton-ghost")


def build_spells_catalog(catalog: list) -> None:
    spells = [
        ("Pixelart Spells/PNG Files/Fireball.png", "spell_fireball", "Огненный шар", "projectiles"),
        ("Pixelart Spells/PNG Files/Firebomb.png", "spell_firebomb", "Огненная бомба", "projectiles"),
        ("Pixelart Spells/PNG Files/Ice Lance.png", "spell_ice_lance", "Ледяное копьё", "projectiles"),
        ("Pixelart Spells/PNG Files/Light Bolt.png", "spell_light_bolt", "Световой болт", "projectiles"),
        ("Pixelart Spells/PNG Files/Darkness Bolt.png", "spell_dark_bolt", "Болт тьмы", "projectiles"),
        ("Pixelart Spells/PNG Files/Wind Bolt.png", "spell_wind_bolt", "Болт ветра", "projectiles"),
        ("Pixelart Spells/PNG Files/Water Bolt.png", "spell_water_bolt", "Водяной болт", "projectiles"),
        ("Pixelart Spells/PNG Files/Arcane Bolt.png", "spell_arcane_bolt", "Тайный болт", "projectiles"),
        ("Pixelart Spells/PNG Files/Bolt Of Purity.png", "spell_purity_bolt", "Болт чистоты", "projectiles"),
        ("Pixelart Spells/PNG Files/Pure Bolt 2.png", "spell_pure_bolt", "Чистый болт", "projectiles"),
        ("Pixelart Spells/PNG Files/Magic Ray.png", "spell_magic_ray", "Магический луч", "projectiles"),
        ("Pixelart Spells/PNG Files/Black And White Ray.png", "spell_bw_ray", "Луч (ч/б)", "projectiles"),
        ("Pixelart Spells/PNG Files/Plant Missle.png", "spell_plant_missile", "Растительная ракета", "projectiles"),
        ("Pixelart Spells/PNG Files/Rock Sling.png", "spell_rock_sling", "Камень-праща", "projectiles"),
        ("Pixelart Spells/PNG Files/Magic Orb.png", "spell_magic_orb", "Магическая сфера", "projectiles"),
        ("Pixelart Spells/PNG Files/Darkness Orb.png", "spell_dark_orb", "Сфера тьмы", "projectiles"),
        ("Pixelart Spells/PNG Files/Water Orb.png", "spell_water_orb", "Водяная сфера", "projectiles"),
        ("Pixelart Spells/PNG Files/Magic Sparks.png", "spell_magic_sparks", "Магические искры", "effects"),
        ("Pixelart Spells/PNG Files/Black And White Sparks.png", "spell_bw_sparks", "Искры (ч/б)", "effects"),
        ("Pixelart Spells/PNG Files/Splash.png", "spell_splash", "Брызги", "effects"),
        ("Pixelart Spells/PNG Files/Pixelart Shield.png", "spell_shield", "Магический щит", "effects"),
        ("Pixelart Spells/PNG Files/Water Blast.png", "spell_water_blast", "Водяной взрыв", "effects"),
    ]
    for path, entry_id, label, group in spells:
        add(catalog, entry_id, label, group, "spells", path, "pixel-art-spells")


def download(url: str, dest: Path) -> None:
    if dest.is_file() and dest.stat().st_size > 1000:
        print("Using cached", dest.name)
        return
    print("Downloading", dest.name, "...")
    req = urllib.request.Request(url, headers={"User-Agent": "pgz-studio"})
    with urllib.request.urlopen(req) as response, dest.open("wb") as out:
        shutil.copyfileobj(response, out)


def extract_all() -> None:
    catalog = build_catalog()
    if LIB.exists():
        shutil.rmtree(LIB)
    LIB.mkdir(parents=True)
    TMP.mkdir(parents=True, exist_ok=True)

    redux_zip = TMP / "redux.zip"
    bg_zip = TMP / "bg.zip"
    new_zip = TMP / "new.zip"
    space_zip = TMP / "space.zip"
    space_ext_zip = TMP / "space_ext.zip"
    dungeon_zip = TMP / "dungeon.zip"
    skeleton_zip = TMP / "skeleton.zip"
    spells_zip = TMP / "spells.zip"

    download(REDUX_URL, redux_zip)
    download(BG_URL, bg_zip)
    download(NEW_URL, new_zip)
    download(SPACE_URL, space_zip)
    download(SPACE_EXT_URL, space_ext_zip)
    download(DUNGEON_URL, dungeon_zip)
    download(SKELETON_URL, skeleton_zip)
    download(SPELLS_URL, spells_zip)

    archives = {
        "redux": zipfile.ZipFile(redux_zip),
        "bg": zipfile.ZipFile(bg_zip),
        "new": zipfile.ZipFile(new_zip),
        "space": zipfile.ZipFile(space_zip),
        "space_ext": zipfile.ZipFile(space_ext_zip),
        "dungeon": zipfile.ZipFile(dungeon_zip),
        "skeleton": zipfile.ZipFile(skeleton_zip),
        "spells": zipfile.ZipFile(spells_zip),
    }

    missing: list[str] = []
    try:
        for entry in catalog:
            archive = archives[entry["zip"]]
            src = entry["path"]
            if src not in set(archive.namelist()):
                missing.append(f"{entry['zip']}:{src}")
                continue

            dest = LIB / "kenney" / entry["group"] / f"{entry['id']}.png"
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(src) as src_file, dest.open("wb") as dest_file:
                dest_file.write(src_file.read())
    finally:
        for archive in archives.values():
            archive.close()

    if missing:
        print(f"Warning: skipped {len(missing)} missing files")
        for line in missing[:10]:
            print(" ", line)
        catalog = [e for e in catalog if f"{e['zip']}:{e['path']}" not in missing]

    json_entries = []
    for entry in catalog:
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
        "All assets — CC0 1.0 Universal (public domain)\n\n"
        "Kenney.nl packs:\n"
        "- Platformer Pack Redux\n"
        "- Background Elements\n"
        "- New Platformer Pack\n"
        "- Space Shooter Redux\n"
        "- Space Shooter Extension\n"
        "- Tiny Dungeon\n"
        "  https://kenney.nl\n\n"
        "Other CC0 packs:\n"
        "- Skeleton & Ghost spritesheets — Balmer (Ars Notoria)\n"
        "- Pixel Art Spells — DevWizard\n",
        encoding="utf-8",
    )

    shutil.rmtree(TMP, ignore_errors=True)
    print(f"Imported {len(json_entries)} sprites into {LIB / 'kenney'}")


if __name__ == "__main__":
    extract_all()
