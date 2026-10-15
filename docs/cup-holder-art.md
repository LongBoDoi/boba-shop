# Painted cup holder extraction

The holder under the cup is painted into the kitchen background, and the background pans behind a
cup that stays put — so the holder is lifted out of the painting and drawn over it instead.

| file | what it is |
| --- | --- |
| `src/assets/kitchen/kitchen-warm.png` | the original painting, holder and all; kept as source art and as the reference for how the holder should look |
| `src/assets/kitchen/kitchen-warm-clear.png` | the background the game draws, with the holder removed |
| `tools/sheets/cup-holder.png` | the holder as imagegen handed it back, 1945×808 |
| `src/assets/kitchen/cup-holder.png` | what the game draws, cut by `tools/cut-cup-holder.py` |

## Size and position come from the painting, not from the cup

`ROOM_BG_CUP_HOLDER` in [kitchenArt.ts](../src/components/art/kitchenArt.ts) is the holder's box in
`kitchen-warm.png`'s own pixels — `{ x: 553, y: 782, width: 424, height: 127 }` — measured off the
painting by scanning for its caramel outline. `kitchenHolderFor` projects it with the same
`fitBackground` scale as every other painted surface, so the holder is the size the design draws it
whatever the phone is shaped like.

Only its **left edge** is the screen's rather than the painting's: the wall pans and the cup
standing on the holder does not, so the holder is centred under the cup. The painting puts it
within a few pixels of centre anyway, so an unpanned room looks exactly like the design.

It was first sized off the cup instead (`cupW * 1.5`), which came out at less than half the
painted mat.

## The cup rests in the middle of it

`layoutKitchen` puts the cup's home at the holder's centre rather than on a line down the counter.
It stands on `CUP_FOOT` (`src/components/cupGeometry.ts`) — the middle of its painted base ring,
158 of the sprite's 174 units — not on the bottom of its sprite box, which is the *front* of that
ring. Resting a cup on a surface by its box leaves it sitting forward of whatever it is on by half
a ring.

## Why the sprite is cut down

The extraction comes back nearly two thousand pixels wide for a mat that is a couple of hundred on
a phone. A woven grid reduced by that much is point-sampled rather than averaged, and the weave
breaks into stripes. `tools/cut-cup-holder.py` reduces it once, with a filter that looks at every
pixel it drops, to twice the painted mat's own size — as large as it is ever drawn on a
high-density phone. It also clears the faint haze the extraction leaves over its whole canvas
(alpha 1–8, invisible alone but a pale rectangle once composited) and trims to what is left, so the
game can draw the sprite straight into the measured box with no crop rectangle of its own.

```bash
python3 tools/cut-cup-holder.py   # needs Pillow
```

## Extraction prompt

```text
Use case: background-extraction. Edit target: the supplied kitchen background. Extract ONLY the single rectangular woven bamboo cup holder/mat in the middle of the foreground table, around source pixels x553–980, y779–911. Output the original painted holder as an isolated transparent PNG, tightly framed with minimal transparent padding, with its complete caramel-brown beveled outline, warm cream fine woven grid texture and two-leaf motif precisely preserved. Preserve the exact original wide shallow trapezoidal perspective, proportions and brushwork, about 3.3 times wider than tall. The entire area outside the holder must be truly transparent, including the table visible around the sloping sides. Do not include any marble table, room, cups, plants or other objects. Do not redesign or invent a different holder. Keep the original leaf emblem. Transparent background.
```

## Background edit prompt

```text
Use case: precise-object-edit. Edit target: the supplied 1536x1024 kitchen background. Remove ONLY the single rectangular bamboo cup mat/holder from the middle of the foreground tabletop (source pixels approximately x550–982, y778–912), including the mat's outline and contact shadow. Seamlessly restore the warm cream marble tabletop with matching watercolor mottling and lighting in that small region. Preserve the entire rest of the original image exactly: same 1536x1024 dimensions, camera, shelves and positions, plants, cups, signs and lettering, steel tray, wooden edges and counter lines. The result should look exactly like the source kitchen with a completely clear empty foreground marble countertop where the mat was. No new objects, no changed crop, no composition shifts. Opaque image.
```
