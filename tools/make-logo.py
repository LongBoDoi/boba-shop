#!/usr/bin/env python3
"""
The shop's logo, cut out of its painting and sized into everything that shows it.

    python3 tools/make-logo.py        # needs Pillow
    node tools/make-web-icons.cjs     # then this, for the home-screen icons

Reads `tools/sheets/logo.png` — the drawn mark, a boba cup with a cat's face in the cream — and
writes every shape the game wears it in. The mark is generated, so change this script (or the
painting) and re-run it rather than hand-editing a PNG.

* **`src/assets/logo.png`** is the mark on the menu, with the painting's tan taken away so it
  stands on the shop's pink wall rather than in a tan box.
* **`assets/icon.png`** and the two `assets/android-icon-*.png` are what `make-web-icons.cjs`
  reads for `public/icons/`, which is the home-screen icon of the installed page.
* **the Android launcher icons** (`mipmap-*`) and **the iOS app icon** are the same picture at the
  sizes those projects ask for. Every one of them was the blue "A" Expo ships with until now.

Two numbers decide how big the mark is drawn, and they are not the same number, because a launcher
crops an icon to whatever shape the phone likes:

* `SQUARE` is for an icon that keeps its corners — the web icon, the legacy launcher icon, iOS.
* `SAFE` is for the adaptive and maskable ones, whose artwork has to sit inside a circle. It is
  smaller for the web/Android *foreground* layer, which is a full-size canvas, than for the
  `mipmap` foreground, which `mipmap-anydpi-v26/ic_launcher.xml` already insets by 16.7%.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools' / 'sheets' / 'logo.png'

#: The tan the mark is painted on, and the colour that stays behind it on an icon.
TAN = (237, 200, 181, 255)
#: How wide the mark is drawn across an icon that keeps its corners.
SQUARE = 0.86
#: ...across a layer a launcher may crop to a circle, and across the already-inset mipmap one.
SAFE = 0.66
MIPMAP_SAFE = 0.80

#: The Android launcher's five densities, in the sizes its `mipmap-*` folders hold.
DENSITIES = {'ldpi': 36, 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}


def cutout(im, tol=30, soft=72):
    """
    The painting less its tan, flood-filled from the border so that the tan *inside* the mark —
    the cup's own milk tea — survives. The edge is then feathered: a drawn outline meets the tan
    through a pixel or two of blend, and clearing those outright leaves a hard tan fringe that
    shows up the moment the mark stands on anything but tan.
    """
    im = im.convert('RGBA')
    W, H = im.size
    px = im.load()
    ref = px[2, 2]
    near = lambda c: max(abs(c[i] - ref[i]) for i in range(3))

    seen = bytearray(W * H)
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    for x, y in stack:
        seen[y * W + x] = 1
    while stack:
        x, y = stack.pop()
        c = px[x, y]
        if near(c) > tol:
            continue
        px[x, y] = (c[0], c[1], c[2], 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                seen[ny * W + nx] = 1
                stack.append((nx, ny))

    # Whatever is left touching the cleared tan and still half tan itself is that blend; it keeps
    # its colour and gives up as much of its alpha as it is close to the tan.
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if not c[3]:
                continue
            d = near(c)
            if d >= soft:
                continue
            if any(0 <= nx < W and 0 <= ny < H and not px[nx, ny][3]
                   for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                px[x, y] = (c[0], c[1], c[2], round(255 * max(0.0, (d - tol) / (soft - tol))))

    return im.crop(im.split()[3].getbbox())


def square(mark, size, part, background=None):
    """The mark centred on a square canvas, `part` of it across, over `background` or nothing."""
    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    scale = size * part / max(mark.size)
    fitted = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


def circle(im):
    """The legacy round launcher icon: the square one, cropped to the circle inside it."""
    size = im.width
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    out = im.copy()
    out.putalpha(mask.resize((size, size), Image.LANCZOS))
    return out


def write(im, *parts):
    path = ROOT.joinpath(*parts)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, optimize=True)
    print(f'  {path.relative_to(ROOT)}'.ljust(58) + f'{im.width}x{im.height}  '
          f'{path.stat().st_size / 1024:.0f} KB')


def main():
    mark = cutout(Image.open(SOURCE))
    print(f'{SOURCE.relative_to(ROOT)} cut to {mark.width}x{mark.height}')

    # The menu's mark. 640 is the longest side a phone draws it at — about 200 CSS px on a 390
    # wide screen, three times over on a three-times display — and nothing asks for more.
    scale = 640 / max(mark.size)
    write(mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS),
          'src', 'assets', 'logo.png')

    # What `make-web-icons.cjs` reads: the square icon, and the adaptive icon's two layers.
    write(square(mark, 1024, SQUARE, TAN), 'assets', 'icon.png')
    write(square(mark, 1024, SAFE), 'assets', 'android-icon-foreground.png')
    write(Image.new('RGBA', (1024, 1024), TAN), 'assets', 'android-icon-background.png')

    # The Android launcher. The adaptive icon's own XML insets both layers by 16.7%, so its
    # foreground is drawn larger here than the full-canvas one above and ends up the same size.
    for density, size in DENSITIES.items():
        folder = ('android', 'app', 'src', 'main', 'res', f'mipmap-{density}')
        legacy = square(mark, size, SQUARE, TAN)
        write(legacy, *folder, 'ic_launcher.png')
        write(circle(legacy), *folder, 'ic_launcher_round.png')
        write(square(mark, size, MIPMAP_SAFE), *folder, 'ic_launcher_foreground.png')
        write(Image.new('RGBA', (size, size), TAN), *folder, 'ic_launcher_background.png')

    # iOS wants one 1024 icon with no transparency in it at all.
    write(square(mark, 1024, SQUARE, TAN).convert('RGB'),
          'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png')


if __name__ == '__main__':
    main()
