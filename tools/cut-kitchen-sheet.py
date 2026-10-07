"""
Cut the shop's painted asset sheet into the sprites the kitchen uses.

    cp <the sheet> tools/kitchen-sheet.png
    python3 tools/cut-kitchen-sheet.py      # needs Pillow

Everything in src/assets/kitchen/ came out of this script, so change the script rather than the
PNGs. Three things happen beyond plain cropping:

* the sheet's grey backdrop is flood-filled away from the border, so greys *inside* a sprite
  (steel pans, chrome taps) survive;
* the glass of the dispenser — and the body of the cup — is cleared out, leaving a window the game
  draws the tea through, with the painted ticks, highlights and cat decal still on top of it;
* pans we were given no art for (grass jelly, red bean, ice) are repainted from the pans we were,
  keeping the original shading and leaving the red-handled scoop alone.

The crop boxes below are for the 1024×1024 sheet; a new sheet means new boxes.
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'tools' / 'kitchen-sheet.png'
OUT = ROOT / 'src' / 'assets' / 'kitchen'

luma = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
sat = lambda c: max(c[0], c[1], c[2]) - min(c[0], c[1], c[2])


def flood(im, seeds, belongs, alpha):
    """Spread out from `seeds` over everything `belongs` accepts, setting it to `alpha`."""
    px = im.load()
    W, H = im.size
    seen = bytearray(W * H)
    q = deque()
    for x, y in seeds:
        if not seen[y * W + x]:
            seen[y * W + x] = 1
            q.append((x, y))
    while q:
        x, y = q.popleft()
        c = px[x, y]
        if c[3] and not belongs(c):
            continue
        px[x, y] = (c[0], c[1], c[2], alpha)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                seen[ny * W + nx] = 1
                q.append((nx, ny))
    return im


def border_seeds(size):
    W, H = size
    return [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]


def strip_background(im, tol=26):
    px = im.load()
    ref = px[2, 2]
    return flood(im, border_seeds(im.size), lambda c: all(abs(c[i] - ref[i]) <= tol for i in range(3)), 0)


def clear_window(im, xs, ys, tol, alpha):
    """Open up the glass: flood the enclosed interior out to `alpha`, keeping the painted detail."""
    W, H = im.size
    px = im.load()
    seeds = [(int(W * fx), int(H * fy)) for fx in xs for fy in ys]
    ref = px[seeds[0][0], seeds[0][1]]
    return flood(im, seeds, lambda c: all(abs(c[i] - ref[i]) <= tol for i in range(3)), alpha)


def is_scoop(c, fx, fy):
    """The red-handled scoop keeps its own colour whatever the pan is filled with."""
    if c[0] > 135 and c[0] > c[1] * 1.6 and c[0] > c[2] * 1.45 and c[2] >= c[1] * 0.9:
        return True  # the handle, anywhere in the pan
    if 0.4 <= fx <= 0.94 and 0.1 <= fy <= 0.58:
        return sat(c) < 26 and 120 < luma(c) < 242  # the chrome bowl, in its corner
    return False


def repaint(src, shape, target):
    """Recolour what is *in* a pan, keeping its shading and its specular highlights."""
    im = src.copy()
    px = im.load()
    W, H = im.size
    x0, y0, x1, y1 = int(W * 0.1), int(H * 0.15), int(W * 0.9), int(H * 0.92)
    content = lambda c: sat(c) > 30 or (shape == 'cube' and sat(c) < 26 and luma(c) > 238)
    mine = [
        (x, y)
        for y in range(y0, y1)
        for x in range(x0, x1)
        if px[x, y][3] and content(px[x, y]) and not is_scoop(px[x, y], x / W, y / H)
    ]
    base = sum(luma(px[x, y]) for x, y in mine) / len(mine)
    for x, y in mine:
        c = px[x, y]
        k = luma(c) / base
        r, g, b = (t * k for t in target)
        if k > 1:  # keep the highlight a highlight
            m = min(1.0, (k - 1) * 0.55)
            r, g, b = (v + (255 - v) * m for v in (r, g, b))
        px[x, y] = (min(255, int(r)), min(255, int(g)), min(255, int(b)), c[3])
    return im


def key_out(im, plate):
    """Lift an icon off the button plate it was painted on."""
    im = flood(im, border_seeds(im.size), plate, 0)
    return im.crop(im.getbbox())


def main():
    if not SHEET.exists():
        raise SystemExit(f'put the asset sheet at {SHEET} first')
    sheet = strip_background(Image.open(SHEET).convert('RGBA'))
    OUT.mkdir(parents=True, exist_ok=True)

    jar = sheet.crop((22, 18, 213, 339))
    clear_window(jar, (0.3, 0.5, 0.7), (0.36, 0.5, 0.64, 0.78), 26, 0).save(OUT / 'jar.png')

    cup = clear_window(sheet.crop((17, 382, 150, 581)), (0.3, 0.5, 0.7), (0.2, 0.4, 0.62, 0.84), 46, 72)
    cup.save(OUT / 'cup.png')
    # a flat silhouette to stand the drink on, so the cup still reads over a busy shelf
    base = Image.new('RGBA', cup.size, (0, 0, 0, 0))
    bp, cp = base.load(), cup.load()
    for y in range(cup.size[1]):
        for x in range(cup.size[0]):
            if cp[x, y][3]:
                bp[x, y] = (255, 250, 244, 255)
    base.save(OUT / 'cup-base.png')

    pearl = sheet.crop((17, 600, 245, 832))
    cube = sheet.crop((484, 598, 712, 832))
    pearl.save(OUT / 'pan-pearls.png')
    sheet.crop((248, 600, 477, 832)).save(OUT / 'pan-popping.png')
    repaint(cube, 'cube', (238, 232, 214)).save(OUT / 'pan-lychee.png')
    repaint(cube, 'cube', (240, 196, 72)).save(OUT / 'pan-pudding.png')
    repaint(cube, 'cube', (58, 72, 52)).save(OUT / 'pan-grass.png')
    repaint(pearl, 'pearl', (146, 52, 52)).save(OUT / 'pan-redbean.png')
    repaint(cube, 'cube', (216, 240, 252)).save(OUT / 'pan-ice.png')

    sheet.crop((737, 359, 867, 588)).save(OUT / 'card.png')

    cream = lambda c: c[0] > 195 and c[1] > 180 and c[2] > 150
    pink = lambda c: (c[0] > 230 and 45 < c[1] < 110 and 140 < c[2] < 205) or (c[0] > 190 and c[1] < 75 and 95 < c[2] < 165)
    key_out(sheet.crop((28, 876, 120, 956)), cream).save(OUT / 'icon-trash.png')
    key_out(sheet.crop((298, 874, 390, 960)), pink).save(OUT / 'icon-cup.png')

    for f in sorted(OUT.iterdir()):
        print(f'{f.name:20s} {Image.open(f).size}')


if __name__ == '__main__':
    main()
