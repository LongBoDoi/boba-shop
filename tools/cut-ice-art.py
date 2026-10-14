"""Package generated ice art for the game, preserving its original alpha.

Run: python3 tools/cut-ice-art.py. Requires Pillow, like the other sprite cutters.
Only crops transparent margins, scales, and pads; source paintings remain intact.
"""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
ASSETS = [
    ('ice-cube-v2.png', 'piece-ice-v2.png', (96, 96)),
    ('ice-scoop.png', 'scoop-ice.png', (256, 296)),
    ('ice-cube-clear.png', 'piece-ice-clear.png', (96, 96)),
]


def main():
    for source, target, size in ASSETS:
        image = Image.open(ROOT / 'tools/sheets' / source).convert('RGBA')
        alpha = image.getchannel('A')
        if alpha.getextrema() != (0, 255):
            raise ValueError(f'{source} must have a transparent background and visible art')
        bounds = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
        sprite = ImageOps.contain(image.crop(bounds), (size[0] - 4, size[1] - 4), Image.Resampling.LANCZOS)
        framed = Image.new('RGBA', size)
        framed.alpha_composite(sprite, ((size[0] - sprite.width) // 2, (size[1] - sprite.height) // 2))
        framed.save(ROOT / 'src/assets/kitchen' / target, optimize=True)
        print(f'{target}: {size[0]}x{size[1]}, original alpha preserved')


if __name__ == '__main__':
    main()
