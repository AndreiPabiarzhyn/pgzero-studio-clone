"""Generate favicon.png and favicon.ico from PGZero flat brand mark."""
from PIL import Image, ImageDraw


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = size / 32.0
    radius = max(2, int(6 * s))

    bg = (30, 58, 95, 255)
    stroke = (61, 90, 128, 255)
    actor = (52, 199, 89, 255)
    badge = (251, 191, 36, 255)
    ink = (30, 58, 95, 255)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    bg_img = Image.new("RGBA", (size, size), bg)
    img = Image.composite(bg_img, img, mask)
    draw = ImageDraw.Draw(img)

    inset = int(2.5 * s)
    draw.rounded_rectangle(
        (inset, inset, size - inset - 1, size - inset - 1),
        radius=max(1, int(5 * s)),
        outline=stroke,
        width=max(1, int(1.25 * s)),
    )

    cx, cy, r = int(13.5 * s), int(17.5 * s), int(8.25 * s)
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=actor)

    def eye(ex, ey, er, px, py, pr):
        er = max(1, int(er * s))
        pr = max(1, int(pr * s))
        draw.ellipse((int(ex * s) - er, int(ey * s) - er, int(ex * s) + er, int(ey * s) + er), fill=(255, 255, 255, 255))
        draw.ellipse((int(px * s) - pr, int(py * s) - pr, int(px * s) + pr, int(py * s) + pr), fill=ink)

    eye(10.8, 15.4, 1.7, 11.1, 15.7, 0.85)
    eye(16.2, 15.8, 1.45, 16.4, 16.0, 0.72)

    bx0, by0 = int(20 * s), int(6.5 * s)
    bx1, by1 = int(29 * s), int(15.5 * s)
    draw.rounded_rectangle((bx0, by0, bx1, by1), radius=max(1, int(2 * s)), fill=badge)
    draw.polygon(
        [
            (int(22.3 * s), int(9.2 * s)),
            (int(22.3 * s), int(14.3 * s)),
            (int(26.4 * s), int(11.75 * s)),
        ],
        fill=ink,
    )
    return img


if __name__ == "__main__":
    root = __import__("pathlib").Path(__file__).resolve().parents[1]
    png = draw_icon(256)
    png.save(root / "favicon.png", format="PNG")
    ico = draw_icon(32)
    ico.save(root / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote favicon.png and favicon.ico")
