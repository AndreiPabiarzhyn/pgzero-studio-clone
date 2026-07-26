"""Generate favicon.png and favicon.ico from PGZero brand colors."""
from PIL import Image, ImageDraw


def lerp(a, b, t):
    return int(a + (b - a) * t)


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(2, size // 5)
    top = (91, 141, 239)
    bottom = (52, 199, 89)

    for y in range(size):
        t = y / max(size - 1, 1)
        color = (
            lerp(top[0], bottom[0], t),
            lerp(top[1], bottom[1], t),
            lerp(top[2], bottom[2], t),
            255,
        )
        draw.line([(0, y), (size, y)], fill=color)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    img.putalpha(mask)

    draw = ImageDraw.Draw(img)
    pad = size * 0.18
    x0, y0 = pad, pad * 1.1
    x1, y1 = size - pad * 1.35, size - pad
    bar_w = (x1 - x0) * 0.34
    draw.rectangle((x0, y0, x0 + bar_w, y1), fill=(255, 255, 255, 255))
    draw.polygon(
        [
            (x0 + bar_w * 0.95, y0),
            (x1, (y0 + y1) / 2),
            (x0 + bar_w * 0.95, y1),
        ],
        fill=(255, 255, 255, 255),
    )
    dot_r = max(1, size // 16)
    draw.ellipse(
        (x1 - dot_r * 0.2, y0 - dot_r * 0.1, x1 + dot_r * 1.8, y0 + dot_r * 1.7),
        fill=(255, 255, 255, 230),
    )
    return img


if __name__ == "__main__":
    root = __import__("pathlib").Path(__file__).resolve().parents[1]
    png = draw_icon(256)
    png.save(root / "favicon.png", format="PNG")
    ico = draw_icon(32)
    ico.save(root / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote favicon.png and favicon.ico")
