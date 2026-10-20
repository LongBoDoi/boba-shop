"""Package the imagegen sugar jar and carried scoop for the game.

Run with python3 tools/prepare-sugar-art.py (Pillow required).
Keep the generated source and its alpha; only trim empty padding and downsample for shipping.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools/sheets/sugar-jar.png'
TARGET = ROOT / 'src/assets/kitchen/sugar-jar.png'
SCOOP_SOURCE = ROOT / 'tools/sheets/sugar-scoop.png'
SCOOP_TARGET = ROOT / 'src/assets/kitchen/sugar-scoop.png'


def main():
    image = Image.open(SOURCE).convert('RGBA')
    bounds = image.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('The sugar jar cutout is empty')
    image.crop(bounds).resize((282, 364), Image.Resampling.LANCZOS).save(TARGET, optimize=True)
    print(f'{TARGET.relative_to(ROOT)}: 282×364 with source transparency')
    scoop = Image.open(SCOOP_SOURCE).convert('RGBA')
    bounds = scoop.getchannel('A').getbbox()
    if bounds is None:
        raise ValueError('The sugar scoop cutout is empty')
    scoop = scoop.crop(bounds)
    height = round(400 * scoop.height / scoop.width)
    scoop.resize((400, height), Image.Resampling.LANCZOS).save(SCOOP_TARGET, optimize=True)
    print(f'{SCOOP_TARGET.relative_to(ROOT)}: 400×{height} with source transparency')


if __name__ == '__main__':
    main()
