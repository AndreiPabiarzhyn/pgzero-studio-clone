"""Generate favicon.png and favicon.ico from PGZero Studio brand mark."""
from PIL import Image, ImageDraw


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 32.0
    radius = max(2, int(7 * s))

    bg = (74, 125, 224, 255)
    screen = (255, 255, 255, 255)
    play = (52, 199, 89, 255)
    dock = (255, 255, 255, 224)

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    bg_img = Image.new("RGBA", (size, size), bg)
    img = Image.composite(bg_img, img, mask)
    draw = ImageDraw.Draw(img)

    sx, sy = int(6 * s), int(7.5 * s)
    sw, sh = int(20 * s), int(14 * s)
    sr = max(1, int(3 * s))
    draw.rounded_rectangle((sx, sy, sx + sw, sy + sh), radius=sr, fill=screen)

    tri = [
        (int(14.2 * s), int(11.2 * s)),
        (int(14.2 * s), int(20.8 * s)),
        (int(21.0 * s), int(16.0 * s)),
    ]
    draw.polygon(tri, fill=play)

    dy = int(23.5 * s)
    dh = max(1, int(2.5 * s))
    dr = max(1, int(1.25 * s))
    draw.rounded_rectangle((sx, dy, sx + sw, dy + dh), radius=dr, fill=dock)

    dot_r = max(1, int(1.1 * s))
    cx, cy = int(23.5 * s), int(24.75 * s)
    draw.ellipse((cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r), fill=play)
    return img


if __name__ == "__main__":
    root = __import__("pathlib").Path(__file__).resolve().parents[1]
    draw_icon(256).save(root / "favicon.png", format="PNG")
    draw_icon(32).save(root / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Wrote favicon.png and favicon.ico")
