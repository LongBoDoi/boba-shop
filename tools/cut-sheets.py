"""
Cut the shop's painted asset sheets into the sprites the kitchen uses.

    python3 tools/cut-sheets.py          # needs Pillow

Reads tools/sheets/*.png and writes src/assets/kitchen/. The sprites are generated, so change this
script rather than the PNGs. Two things happen beyond plain cropping:

* the sheets' grey backdrop is flood-filled away from the border, so greys *inside* a sprite
  (steel pans, chrome taps, the counter) survive;
* the glass of a dispenser — and the body of the cup — is cleared out, leaving a window the game
  draws the tea through, with the painted ticks, highlights and cat decal still on top of it.

`jar.png`, `cup.png`, `cup-base.png` and the `pan-*.png` set are cut from a 1024px rendering of the
kitchen sheet that we no longer have a copy of; they are checked in, and this script leaves them
alone. Everything else here regenerates from tools/sheets/.
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / 'tools' / 'sheets'
OUT = ROOT / 'src' / 'assets' / 'kitchen'


def flood(im, seeds, belongs, alpha):
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


def strip_background(im, tol=26):
    W, H = im.size
    px = im.load()
    ref = px[2, 2]
    border = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    return flood(im, border, lambda c: all(abs(c[i] - ref[i]) <= tol for i in range(3)), 0)


def sheet(name):
    return strip_background(Image.open(SHEETS / f'{name}.png').convert('RGBA'))


def cut(src, box, out, trim=True):
    im = src.crop(box)
    if trim:
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
    im.save(OUT / out)
    return im


def repaint(src, target):
    """Recolour a piece to `target`, keeping its shading and its specular highlight."""
    im = src.copy()
    px = im.load()
    W, H = im.size
    luma = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    mine = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] > 40]
    base = sum(luma(px[x, y]) for x, y in mine) / len(mine)
    for x, y in mine:
        c = px[x, y]
        k = luma(c) / base
        r, g, b = (t * k for t in target)
        if k > 1:
            m = min(1.0, (k - 1) * 0.6)
            r, g, b = (v + (255 - v) * m for v in (r, g, b))
        px[x, y] = (min(255, int(r)), min(255, int(g)), min(255, int(b)), c[3])
    return im


def blank_card(card):
    """Wipe the printed note clean, keeping its torn edge and the coloured header band."""
    px = card.load()
    W, H = card.size
    paper = px[10, 120]
    green = px[34, 42]
    for y in range(24, 60):                      # the header: fill between its own ends
        ends = [x for x in range(W) if px[x, y][3] and px[x, y][1] > px[x, y][0] * 1.1]
        if ends:
            for x in range(ends[0], ends[-1] + 1):
                px[x, y] = green
    for y in range(62, 218):                     # the body: back to blank paper
        row = [x for x in range(W) if px[x, y][3] > 200]
        if len(row) < 20:
            continue
        for x in range(row[0] + 4, row[-1] - 3):
            px[x, y] = paper
    card.save(OUT / 'card-blank.png')


def lamp_sprite(raw, stripped, box, bg):
    """
    The lamp's light is painted straight onto the sheet's grey, so the usual background strip eats
    its faint lower half and leaves a hard line across what is left. The shade and its cord come
    from the stripped sheet as normal; everything below the shade is read back off the *raw* sheet
    instead, where how far a pixel has been lifted off the grey is how much light is there.
    """
    luma = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    lamp = stripped.crop(box)
    src = raw.crop(box).convert('RGB')
    px, sp = lamp.load(), src.load()
    W, H = lamp.size
    pink = [y for y in range(H) for x in range(W) if px[x, y][3] > 100 and px[x, y][2] > px[x, y][1] + 10 and px[x, y][0] > 180]
    rim = max(pink) if pink else int(H * 0.72)
    lift = 255 - bg[0]  # a fully lit pixel reaches white
    tail = 13           # the painted beam simply stops, so take it to nothing over the last rows
    for y in range(rim + 1, H):
        fade = min(1.0, (H - y) / tail)
        for x in range(W):
            c = sp[x, y]
            # Only the light itself is reread. The shade's own paint is left exactly as it was
            # cut — its bottom rim runs right through the brightest part of the bulb, where it is
            # a lit orange rather than dark, so it takes colour as well as brightness to tell the
            # two apart: light is pale, paint is not.
            if luma(c) < 185 or max(c) - min(c) > 105 or c[1] < c[2]:
                continue
            # How far the pixel has been lifted off the grey is how much light is there; undoing
            # that mix recovers the colour the artist painted, white-hot under the bulb and amber
            # further out, instead of flattening the whole beam to one tone.
            a = max(0.0, min(1.0, (c[0] - bg[0]) / lift))
            if a < 0.03:
                continue
            light = tuple(max(0, min(255, int(bg[i] + (c[i] - bg[i]) / a))) for i in range(3))
            px[x, y] = (*light, max(0, min(245, int(a * fade * 232))))
    return lamp


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ the kitchen sheet
    kitchen = sheet('kitchen')
    scoop = kitchen.crop((528, 377, 630, 441))                 # the empty scoop you carry
    sp = scoop.load()                                          # (the next scoop along pokes in)
    SW, SH = scoop.size
    for y in range(SH):
        for x in range(SW):
            c = sp[x, y]
            blue = c[3] and c[2] > c[0] * 1.15
            if blue and (c[2] > 110 or (x > SW * 0.55 and y > SH * 0.5)):
                sp[x, y] = (0, 0, 0, 0)
    scoop.crop(scoop.getbbox()).save(OUT / 'scoop.png')
    pearl = cut(kitchen, (465, 392, 502, 428), 'piece-pearl.png')  # one dark pearl
    cut(kitchen, (464, 434, 503, 472), 'piece-popping.png')    # one popping pearl
    cube = cut(kitchen, (452, 476, 487, 517), 'piece-cube.png')
    ice = cut(kitchen, (489, 479, 520, 514), 'piece-ice.png')  # one clear cube
    # two toppings have no piece of their own, so they borrow a shape and a colour
    repaint(cube, (73, 87, 63)).save(OUT / 'piece-grass.png')
    repaint(pearl, (138, 46, 46)).save(OUT / 'piece-redbean.png')
    cut(kitchen, (548, 224, 629, 368), 'card-order.png')       # the "Order" slip

    # ------------------------------------------------------------------ fittings and equipment
    raw = Image.open(SHEETS / 'equipment.png').convert('RGBA')
    kit = strip_background(raw.copy())
    # the wall tiles at the sprite's own size, so it is cut down to the brick size we want
    wall = kit.crop((14, 24, 190, 169))
    wall.resize((96, 79), Image.LANCZOS).save(OUT / 'wall.png')
    lamp = lamp_sprite(raw, kit, (322, 5, 434, 178), raw.convert('RGB').getpixel((2, 2)))
    lamp.save(OUT / 'lamp.png')
    # The shelf and the rail span the whole room, so they are cut into pieces: a slice of the
    # middle to stretch, and the ends at their own size. Stretching them whole fattened the
    # shelf's feet and squashed the rail's caps into ovals.
    shelf = kit.crop((440, 37, 634, 92))
    shelf.crop((60, 0, 130, 34)).save(OUT / 'shelf-plank.png')  # surface and front edge, evenly
    # …and those two apart, for the work top, which needs a deep surface and only one front edge
    shelf.crop((60, 0, 130, 17)).save(OUT / 'plank-top.png')
    shelf.crop((60, 17, 130, 34)).save(OUT / 'plank-face.png')
    shelf.crop((16, 33, 48, 55)).save(OUT / 'shelf-foot.png')
    cut(kit, (9, 187, 220, 291), 'counter-steel.png')
    cut(kit, (385, 180, 631, 292), 'cabinet.png')
    cut(kit, (222, 180, 375, 292), 'drawer.png')
    cut(kit, (17, 306, 116, 463), 'milk-whole.png')
    cut(kit, (237, 305, 334, 463), 'milk-oat.png')
    cut(kit, (125, 305, 223, 463), 'milk-condensed.png')
    cut(kit, (347, 298, 424, 465), 'syrup.png')
    cut(kit, (10, 471, 160, 620), 'foam-cheese.png')
    cut(kit, (168, 471, 318, 619), 'foam-brulee.png')
    cut(kit, (497, 469, 626, 623), 'straws.png')

    # ------------------------------------------------------------------ what dresses the room
    room = sheet('room')
    cut(room, (10, 220, 154, 435), 'plant.png')
    cut(room, (161, 239, 277, 407), 'poster.png')
    cut(room, (284, 266, 430, 431), 'chalkboard.png')
    cut(room, (430, 266, 496, 431), 'succulent.png')
    cut(room, (502, 210, 626, 435), 'cup-stack.png')
    cut(room, (475, 449, 629, 591), 'towel.png')
    cut(room, (15, 488, 166, 565), 'coaster.png')
    rail = room.crop((177, 491, 463, 544))
    rail.crop((0, 0, 36, 53)).save(OUT / 'rail-cap.png')
    rail.crop((60, 0, 72, 53)).save(OUT / 'rail-bar.png')
    rail.crop((88, 0, 144, 53)).save(OUT / 'rail-clip.png')

    blank_card(Image.open(OUT / 'card.png').convert('RGBA'))

    for f in sorted(OUT.iterdir()):
        print(f'{f.name:22s} {Image.open(f).size}')


if __name__ == '__main__':
    main()
