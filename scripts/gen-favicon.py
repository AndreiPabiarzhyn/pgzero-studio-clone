"""Generate favicon.png and favicon.ico from simplified PG brand mark."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT_CANDIDATES = (
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
)


def load_font(size):
    for path in FONT_CANDIDATES:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 32.0
    radius = max(2, int(7 * s))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    bg_top = (20, 40, 72, 255)
    bg_bottom = (6, 14, 28, 255)
    bg_img = Image.new("RGBA", (size, size), bg_bottom)
    draw_bg = ImageDraw.Draw(bg_img)
    draw_bg.rectangle((0, 0, size, size // 2), fill=bg_top)
    img = Image.composite(bg_img, img, mask)
    draw = ImageDraw.Draw(img)

    spark_r = max(1, int(2.2 * s))
    cx, cy = int(8 * s), int(7.5 * s)
    glow_r = max(2, int(4 * s))
    draw.ellipse(
        (cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r),
        fill=(255, 154, 60, 64),
    )
    draw.ellipse(
        (cx - spark_r, cy - spark_r, cx + spark_r, cy + spark_r),
        fill=(255, 154, 60, 255),
    )

    arc_w = max(1, int(1.6 * s))
    draw.arc(
        (
            int(16 * s),
            int(14 * s),
            int(28 * s),
            int(26 * s),
        ),
        start=300,
        end=30,
        fill=(94, 184, 255, 255),
        width=arc_w,
    )

    font = load_font(max(8, int(13.5 * s)))
    text = "PG"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1] + int(1.5 * s)
    draw.text((tx, ty), text, fill=(238, 244, 255, 255), font=font)
    return img


if __name__ == "__main__":
    draw_icon(256).save(ROOT / "favicon.png", format="PNG")
    draw_icon(32).save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote favicon.png and favicon.ico")
