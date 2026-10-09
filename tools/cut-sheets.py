"""
Cut the shop's painted asset sheets into the sprites the kitchen uses.

    python3 tools/cut-sheets.py          # needs Pillow

Reads tools/sheets/*.png and writes src/assets/kitchen/. The sprites are generated, so change this
script rather than the PNGs. Two things happen beyond plain cropping:

* the sheets' grey backdrop is flood-filled away from the border, so greys *inside* a sprite
  (steel pans, chrome taps, the counter) survive;
* the glass of a dispenser — and the body of the cup — is cleared out, leaving a window the game
  draws the tea through, with the painted ticks, highlights and cat decal still on top of it;
* the props at the right of the work top are cut out of `reference.png` — the mockup — rather
  than the pack, because only the design has them arranged (see `clear_room`).

`pan-ice.png` came from a 1024px rendering of the kitchen sheet that we no longer have a copy of.
Those crops are kept in `tools/sheets/pans/` as the source art — four of the seven are recolours
that exist nowhere else — and are finished here: every one of them was cut too tight, losing the
cap of the scoop standing in it and the foot of its tray, which this sheet still has. Only the ice
pan is written now; the toppings have `tools/sheets/toppings.png` to themselves.

Two other scripts cut the things the game used to draw for itself, and neither output is touched
here:

* `tools/cut-tea-jars.ps1` writes `jar-<tea>.png` — a whole dispenser per tea, glass and tea
  together, off tools/sheets/kitchen.png;
* `tools/cut-cup-design.ps1` writes `cup.png`, `cup-base.png` and `drink-<tea>.png` off
  tools/sheets/cup-design.png, which is the same cup drawn twice, empty and full;

One more runs *after* this script rather than beside it: `tools/cut-tea-front.ps1` lifts the tea
window's vines and potted plant back out of the `tea-room.png` written below, so the dispensers
can stand behind them. Re-cut the window and that one has to be re-run.

The game used to draw its liquids itself and they never matched the design, so nothing is drawn
now — they are simply the design.

Everything else here regenerates from tools/sheets/.
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / 'tools' / 'sheets'
OUT = ROOT / 'src' / 'assets' / 'kitchen'

luma = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


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


def clear_room(im, tol=11):
    """
    Take the shop away from behind something cut out of the *mockup* rather than a sheet.

    The sheets are drawn on flat grey, which `strip_background` can match to one colour. The
    mockup paints its wall and table as gradients, so the room is followed pixel to pixel
    instead — each step compares with where it came from. Every prop in the mockup is drawn
    with a dark outline, so anything merely pale is room as well, and that second test is what
    clears the grout lines and the cast shadows the gradient alone leaves stranded.
    """
    px = im.load()
    W, H = im.size
    seen = bytearray(W * H)
    q = deque()

    def push(x, y, ref):
        if not seen[y * W + x]:
            seen[y * W + x] = 1
            q.append((x, y, ref))

    # Seeded from three sides only: the props run off the right of the mockup.
    for y in range(H):
        push(0, y, px[0, y][:3])
    for x in range(W):
        push(x, 0, px[x, 0][:3])
        push(x, H - 1, px[x, H - 1][:3])

    room = []
    while q:
        x, y, ref = q.popleft()
        c = px[x, y]
        near = max(abs(c[i] - ref[i]) for i in range(3)) <= tol
        pale = luma(c) > 150 and max(c[:3]) - min(c[:3]) < 60
        if not (near or pale):
            continue
        room.append((x, y))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                push(nx, ny, c[:3])
    for x, y in room:
        c = px[x, y]
        px[x, y] = (c[0], c[1], c[2], 0)

    # the crumbs a cut through antialiasing leaves behind
    for _ in range(2):
        loose = [
            (x, y)
            for y in range(H)
            for x in range(W)
            if px[x, y][3]
            and sum(
                1
                for dx in (-1, 0, 1)
                for dy in (-1, 0, 1)
                if 0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3]
            )
            <= 3
        ]
        for x, y in loose:
            px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    return im.crop((bb[0], bb[1], W, bb[3])) if bb else im


def lift_window(plate, floor=30):
    """
    A painting on a black backdrop, cut out with an alpha channel and trimmed to itself.

    Anything darker than `floor` is backdrop — the window's own darkest paint, the shadowed wood
    along its foot, is several times that — and the edge is softened by a pixel so the rounded
    corners do not come out as stairs.
    """
    from PIL import ImageFilter

    W, H = plate.size
    px = plate.load()
    mask = Image.new('L', (W, H), 0)
    mp = mask.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if max(c) > floor:
                mp[x, y] = 255
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    out = plate.convert('RGBA')
    out.putalpha(mask)
    return out.crop(out.getbbox())


def unclip(pan, whole):
    """
    Put back what a pan's crop cut off. The crops in `tools/sheets/pans` all stop short at the
    same two places — across the cap of the scoop and through the foot of the tray — and both
    are the same steel and the same red in every one of them, so one pan off the sheet fills in
    for all seven. The sheet is the smaller drawing of the two, so it is scaled up to meet the
    crop rather than the other way round: it is only ever seen in those few rows.
    """
    def widest(im):
        best = (0, 0, 0, 0)
        for y in range(im.height):
            xs = [x for x in range(im.width) if im.getpixel((x, y))[3] > 40]
            if xs and xs[-1] - xs[0] > best[0]:
                best = (xs[-1] - xs[0], y, xs[0], xs[-1])
        return best

    span, py, px0, px1 = widest(pan)
    fspan, fy, fx0, fx1 = widest(whole)
    k = span / fspan
    fill = whole.resize((round(whole.width * k), round(whole.height * k)), Image.LANCZOS)
    # line the two up on that row — the front edge of the tray, which both of them have whole
    dx = round((px0 + px1) / 2 - ((fx0 + fx1) / 2) * k)
    dy = py - round(fy * k)
    ox, oy = max(0, -dx), max(0, -dy)
    out = Image.new('RGBA', (max(pan.width + ox, fill.width + dx + ox), max(pan.height + oy, fill.height + dy + oy)))
    out.alpha_composite(fill, (ox + dx, oy + dy))
    out.alpha_composite(pan, (ox, oy))
    # the whole pan's own extent, and the row the two were lined up on, in the new image
    return out, (ox + dx, oy + dy, fill.width, fill.height), (oy + py, ox + round((px0 + px1) / 2))


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


def islands(im, floor=24, least=400):
    """
    Every separate sprite on a sheet painted on transparency, as its own island of pixels.

    A box will not do for these: the heaps in the top row of the topping sheet and the scoop
    handles in the middle one lean into their neighbours' boxes without ever touching them, so a
    crop would bring a slice of the next sprite along with it. Each island is lifted by its own
    pixels instead, and anything smaller than `least` is a stray speck.

    They come back in reading order — down the sheet in bands, then left to right.
    """
    W, H = im.size
    alpha = im.getchannel('A').tobytes()
    mask = bytearray(1 if alpha[i] > floor else 0 for i in range(W * H))
    seen = bytearray(W * H)
    src = im.load()
    found = []
    for start in range(W * H):
        if not mask[start] or seen[start]:
            continue
        q = deque([start])
        seen[start] = 1
        pts = []
        x0 = y0 = 1 << 30
        x1 = y1 = -1
        while q:
            p = q.popleft()
            pts.append(p)
            x, y = p % W, p // W
            x0, x1 = min(x0, x), max(x1, x)
            y0, y1 = min(y0, y), max(y1, y)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        n = ny * W + nx
                        if mask[n] and not seen[n]:
                            seen[n] = 1
                            q.append(n)
        if len(pts) >= least:
            found.append((x0, y0, x1, y1, pts))
    # Bands first, then left to right inside a band: a sprite that hangs a little lower than its
    # neighbour is still on the same row, so a row is everything that starts before the lowest
    # foot in it rather than everything at the same height.
    found.sort(key=lambda c: c[1])
    rows, floor_y = [], -1
    for c in found:
        if rows and c[1] <= floor_y:
            rows[-1].append(c)
            floor_y = max(floor_y, c[3])
        else:
            rows.append([c])
            floor_y = c[3]
    out = []
    for row in rows:
        for x0, y0, x1, y1, pts in sorted(row, key=lambda c: c[0]):
            cut = Image.new('RGBA', (x1 - x0 + 1, y1 - y0 + 1))
            dst = cut.load()
            for p in pts:
                x, y = p % W, p // W
                dst[x - x0, y - y0] = src[x, y]
            out.append(cut)
    return out


def bins(toppings, wide=256):
    """
    The six topping bins, whole — steel tray, what is in it and the scoop standing in it, one
    sprite each, off `tools/sheets/topping-bins.png`. The room's own plate paints six empty bins
    into the topping tray and these are laid over them, so a bin the day has not reached yet is
    simply the painted one showing through.

    They are not cut as islands: the six abut on the sheet, and each one's scoop leans over the
    bin beside it without touching it. The grid is measured instead — the columns part cleanly
    across the trays' lower bodies, the rows across the gap between the two scoop rows.

    All six are then brought to **one box**. They are the same bin drawn six times, so any
    difference in their boxes is noise in the drawing; each is padded until the tray's own rim
    starts at the same fraction down the sprite (the deepest scoop on the sheet sets it), and then
    they are all resized together. That leaves a single aspect and a single `BIN_HEAD` for the
    station to place them by, instead of six of each.

    The **empty** bin comes on a sheet of its own, `topping-bin-empty.png`, and is drawn a good
    deal shallower than the full ones — 1.95 wide to tall against 1.38. It is brought into the
    same box as the rest rather than keeping its own shape, which stretches it about two fifths
    taller. That is deliberate: a row in which the empty bins are shallower than the ones beside
    them reads as two different trays, and a steel box this size has no perspective cue strong
    enough for the stretch to show.
    """
    sheet = Image.open(SHEETS / 'topping-bins.png').convert('RGBA')
    COLS = [(31, 525), (526, 1010), (1011, 1508)]
    ROWS = [(77, 508), (512, 936)]
    cells = []
    for y0, y1 in ROWS:
        for x0, x1 in COLS:
            cell = sheet.crop((x0, y0, x1 + 1, y1 + 1))
            px = cell.getchannel('A').load()
            w, h = cell.size
            # the tray's own top: the first row the sprite is wide on, since the scoop alone is thin
            rim = next(y for y in range(h) if sum(1 for x in range(w) if px[x, y] > 24) > w * 0.5)
            cells.append((cell, rim))
    assert len(cells) == len(toppings), f'topping bins cut into {len(cells)} cells'
    head = max(rim / cell.height for cell, rim in cells)
    boxed = []
    for cell, rim in cells:
        body = cell.height - rim
        pad = round(body * head / (1 - head))
        box = Image.new('RGBA', (cell.width, pad + body))
        box.alpha_composite(cell, (0, pad - rim))
        boxed.append(box)
    # the box is taken off the full bins alone, then the empty one is brought into it
    tall = round(wide * max(b.height for b in boxed) / max(b.width for b in boxed))
    bare = Image.open(SHEETS / 'topping-bin-empty.png').convert('RGBA')
    bare = bare.crop(bare.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    pad = round(bare.height * head / (1 - head))
    box = Image.new('RGBA', (bare.width, pad + bare.height))
    box.alpha_composite(bare, (0, pad))
    boxed.append(box)
    for name, box in zip([*toppings, 'empty'], boxed):
        box.resize((wide, tall), Image.LANCZOS).save(OUT / f'bin-{name}.png', optimize=True)
    print(f'  bins: {wide}x{tall}, ART.bin = {wide}/{tall}, BIN_HEAD = {head:.4f}')


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
    cut(kitchen, (489, 479, 520, 514), 'piece-ice.png')        # one clear cube
    cut(kitchen, (548, 224, 629, 368), 'card-order.png')       # the "Order" slip
    # The ice pan, finished off with the one pan the sheet still draws whole. Only this one is
    # written now that the toppings have a sheet of their own, but the box is still measured
    # across all of `tools/sheets/pans` — four of those crops are recolours that exist nowhere
    # else, so they are kept as source art even though nothing is cut from them any more.
    whole = kitchen.crop((10, 374, 153, 520))
    pans = {}
    for pan in sorted((SHEETS / 'pans').iterdir()):
        pans[pan.name] = unclip(Image.open(pan).convert('RGBA'), whole)
    # the box is taken off the whole pan rather than off what each crop happens to hold, so a
    # speck left over at the edge of one of them cannot pad every sprite out
    left = max(x - fx for _, (fx, _, _, _), (_, x) in pans.values())
    right = max(fx + fw - x for _, (fx, _, fw, _), (_, x) in pans.values())
    up = max(y - fy for _, (_, fy, _, _), (y, _) in pans.values())
    down = max(fy + fh - y for _, (_, fy, _, fh), (y, _) in pans.values())
    for name, (im, _, (y, x)) in pans.items():
        if name != 'ice.png':
            continue
        box = Image.new('RGBA', (left + right, up + down))
        box.alpha_composite(im, (left - x, up - y))
        box.save(OUT / f'pan-{name}')

    # ------------------------------------------------------------------ the toppings
    # Three rows of six, painted on transparency: the heap that sits in a bin, the scoopful you
    # carry, and one piece of it for the pile in the cup. The columns are the toppings in this
    # order, which is the sheet's own, not the game's list order.
    # The sheet draws them all at about 250px. The scoop is carried at nearly that size and keeps
    # it; a piece is a dozen pixels across in the cup, so it is cut down rather than shipping ten
    # times the pixels it is drawn with. The sheet's top row — the topping as a loose heap — is no
    # longer used: a bin is a sprite of its own now, off `topping-bins.png` below.
    TOPPINGS = ['pearls', 'popping', 'pudding', 'pandan', 'lychee', 'grass']
    ROWS = [(None, 0), ('scoop', 0), ('piece', 96)]
    sprites = islands(Image.open(SHEETS / 'toppings.png').convert('RGBA'))
    assert len(sprites) == len(ROWS) * len(TOPPINGS), f'topping sheet cut into {len(sprites)} sprites'
    for i, sprite in enumerate(sprites):
        row, most = ROWS[i // len(TOPPINGS)]
        if row is None:
            continue
        if most and max(sprite.size) > most:
            k = most / max(sprite.size)
            sprite = sprite.resize((round(sprite.width * k), round(sprite.height * k)), Image.LANCZOS)
        sprite.save(OUT / f'{row}-{TOPPINGS[i % len(TOPPINGS)]}.png', optimize=True)

    bins(TOPPINGS)

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
    # …and its surface alone, for the work top, which shows nothing but surface: the topping
    # counter stands in front of it and hides its front edge completely
    shelf.crop((60, 0, 130, 17)).save(OUT / 'plank-top.png')
    shelf.crop((16, 33, 48, 55)).save(OUT / 'shelf-foot.png')
    cut(kit, (9, 187, 220, 291), 'counter-steel.png')
    # The run along the floor is a single unit at each end with a double in the middle, and
    # what is used of each is its front alone: the steel top a unit ships with would stand
    # under the counter's own front as a second ledge.
    drawer = cut(kit, (222, 180, 375, 292), 'drawer.png')
    drawer.crop((0, 40, drawer.width, drawer.height)).save(OUT / 'drawer-front.png')
    cabinet = cut(kit, (385, 180, 631, 292), 'cabinet.png')
    cabinet.crop((0, 40, cabinet.width, cabinet.height)).save(OUT / 'cabinet-front.png')
    cut(kit, (17, 306, 116, 463), 'milk-whole.png')
    cut(kit, (237, 305, 334, 463), 'milk-oat.png')
    cut(kit, (125, 305, 223, 463), 'milk-condensed.png')
    cut(kit, (347, 298, 424, 465), 'syrup.png')
    cut(kit, (10, 471, 160, 620), 'foam-cheese.png')
    cut(kit, (168, 471, 318, 619), 'foam-brulee.png')

    # ------------------------------------------------------------------ what dresses the room
    room = sheet('room')
    cut(room, (10, 220, 154, 435), 'plant.png')
    cut(room, (161, 239, 277, 407), 'poster.png')
    cut(room, (502, 210, 626, 435), 'cup-stack.png')
    cut(room, (475, 449, 629, 591), 'towel.png')
    cut(room, (15, 488, 166, 565), 'coaster.png')
    rail = room.crop((177, 491, 463, 544))
    rail.crop((0, 0, 36, 53)).save(OUT / 'rail-cap.png')
    rail.crop((60, 0, 72, 53)).save(OUT / 'rail-bar.png')
    rail.crop((88, 0, 144, 53)).save(OUT / 'rail-clip.png')

    # ------------------------------------------------------------------ straight off the design
    # The three things at the right of the work top are cut out of the mockup itself, not the
    # pack. The pack's straw tin is a different one — rainbow straws, a cat printed on it — and
    # the pack has no arrangement: in the design the tin stands in front, the chalkboard beside
    # it and the plant tucks in behind them both. Cutting the group whole is the only way to
    # keep that, and the board runs off the right of the mockup, so the sprite does too.
    ref = Image.open(SHEETS / 'reference.png').convert('RGBA')
    clear_room(ref.crop((618, 663, 864, 932))).save(OUT / 'table-props.png')

    # The topping counter is the pack's own stainless counter, sliced across. Its ends are
    # drawn in perspective and this one runs off both sides of the room, so a column out of its
    # middle is what gets stretched: the raised back it has behind the pans, the deck they are
    # sunk into, and the front edge it turns down at. Rebuilding that counter out of the mockup
    # never read right — the mockup's own pans fill the width, so most of it is never on show.
    steel = Image.open(OUT / 'counter-steel.png').convert('RGBA')
    steel.crop((90, 0, 122, 23)).save(OUT / 'bar-splash.png')
    steel.crop((90, 23, 122, 77)).save(OUT / 'bar-deck.png')
    steel.crop((90, 77, 122, 104)).save(OUT / 'bar-front.png')

    # ------------------------------------------------------------------ the room itself
    # The prep room is not built out of fittings any more: it is one painted plate, and
    # everything the player touches stands on a surface that plate already draws. It goes
    # through whole — only re-encoded — so the lines measured off it in `ROOM`
    # (src/components/art/kitchenArt.ts) stay true to the pixel.
    plate = Image.open(SHEETS / 'room-bg.png').convert('RGB')
    plate.save(OUT / 'room-bg.png', optimize=True)

    # ------------------------------------------------------------------ the tea window
    # The pouring window is painted whole — frame, sign board and all — on a black backdrop.
    # Lifting it off that backdrop is the whole job: its corners are rounded and its vines hang
    # out past them, so the black has to become transparent rather than be cropped around.
    lift_window(Image.open(SHEETS / 'tea-room.png').convert('RGB')).save(OUT / 'tea-room.png', optimize=True)

    blank_card(Image.open(OUT / 'card.png').convert('RGBA'))

    for f in sorted(OUT.iterdir()):
        print(f'{f.name:22s} {Image.open(f).size}')


if __name__ == '__main__':
    main()
