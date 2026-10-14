"""Extract the seven upright containers from the generated 3x3 sheet, preserving alpha.

Run from any directory: python3 tools/cut-topping-boxes.py
Requires Pillow, as does cut-sheets.py. This only crops/pads/scales the source artwork.
"""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools/sheets/topping-shelf-boxes.png'
OUTPUT = ROOT / 'src/assets/kitchen'
NAMES = ['pearls', 'popping', 'pudding', 'pandan', 'lychee', 'grass', 'empty']
SIZE = (256, 264)


def main():
    sheet = Image.open(SOURCE).convert('RGBA')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(NAMES):
        col, row = i % 3, i // 3
        cell = sheet.crop((
            round(col * sheet.width / 3), round(row * sheet.height / 3),
            round((col + 1) * sheet.width / 3), round((row + 1) * sheet.height / 3),
        ))
        # Ignore nearly invisible generation noise in the gutters when measuring the box.
        # Keep the original alpha inside the crop, including the glass and antialiased edges.
        bounds = cell.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if bounds is None:
            raise ValueError(f'Missing container: {name}')
        sprite = ImageOps.contain(cell.crop(bounds), SIZE, Image.Resampling.LANCZOS)
        framed = Image.new('RGBA', SIZE)
        framed.alpha_composite(sprite, ((SIZE[0] - sprite.width) // 2, SIZE[1] - sprite.height))
        framed.save(OUTPUT / f'topping-box-{name}.png', optimize=True)
    print(f'Extracted {len(NAMES)} shelf containers at {SIZE[0]}x{SIZE[1]}, with alpha preserved.')


if __name__ == '__main__':
    main()
