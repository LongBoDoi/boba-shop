"""Cut the painted cup holder down to the size the game actually draws it at.

    python3 tools/cut-cup-holder.py      # needs Pillow

`tools/sheets/cup-holder.png` is the holder lifted off the kitchen painting by the built-in
imagegen tool (the prompt is in `docs/cup-holder-art.md`). It comes back nearly two thousand
pixels wide, and the mat is a few hundred on a phone — a woven grid shrunk by that much is
sampled, not averaged, and the weave breaks into stripes that crawl as the cup moves over it.
So the sprite is reduced here, once, with a filter that looks at every pixel it is dropping.

The target is twice the mat's own size in `kitchen-warm.png` (`ROOM_BG_CUP_HOLDER`), which is as
large as the holder is ever drawn on a high-density phone. Two other things happen on the way:

* the extraction leaves a faint haze over its whole canvas — alpha of 1 to 8, invisible on its
  own but a visible pale rectangle once it is composited over the counter — so anything that
  faint is cleared before the sprite is trimmed to what is left;
* the trim is what squares the sprite up with the painted mat, so the game can draw it straight
  into the box it measured off the painting with no crop rectangle of its own.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'tools/sheets/cup-holder.png'
TARGET = ROOT / 'src/assets/kitchen/cup-holder.png'

#: The mat as `kitchen-warm.png` paints it, doubled. Keep this in step with ROOM_BG_CUP_HOLDER.
SIZE = (424 * 2, 127 * 2)
#: Alpha at or under this is the extraction's haze rather than the painting's own soft edge.
HAZE = 8


def main():
    image = Image.open(SOURCE).convert('RGBA')
    alpha = image.getchannel('A')
    image.putalpha(alpha.point(lambda value: 0 if value <= HAZE else value))
    box = image.getchannel('A').getbbox()
    if box is None:
        raise ValueError(f'{SOURCE.name} is empty once its haze is cleared')
    holder = image.crop(box).resize(SIZE, Image.LANCZOS)
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    holder.save(TARGET, optimize=True)
    print(f'{TARGET.relative_to(ROOT)}  {box[2] - box[0]}x{box[3] - box[1]} -> {SIZE[0]}x{SIZE[1]}')


if __name__ == '__main__':
    main()
