# Garden behind the opening door

The left leaf alone swings open. Its wood frame, handle and paw decal are isolated from the room
painting in `Doorway.ts`; the glass is transparent. The room painting supplies the fixed outside
view. Only the pixels originally covered by left-leaf wood, handle or paw are reconstructed.

The wood uses adjacent glass pixels without averaging. The tiny paw area uses these two painted
donors, scaled to the native source crop before import. At runtime, only an elliptical paw mask
reads the donor; the rest of each room and the closed right leaf retain their original pixels.

- Landscape: `src/assets/counter/door-garden-patch-landscape-v1.png` (276 × 265), based on the
  x833–1108, y125–389 crop of `cafe-peach-panorama-v8.png`.
- Portrait: `src/assets/counter/door-garden-patch-portrait-v1.png` (372 × 403), based on the
  x326–697, y330–732 crop of `cafe-peach-portrait-v1.png`.

Both were edited with built-in imagegen on the exact source crop and then downscaled with `sips`.
The prompts used were:

> Precise restoration edit of this exact illustrated cafe door crop. Keep exactly the same framing,
> two doors, right door, wood, handles, awning, trees, fence, patio, colors, light, brushwork and
> sharpness. ONLY remove the orange paw-print decal in the LEFT glass pane (near x=69,y=110 in the
> 276x265 reference) and repaint the outdoor garden naturally behind it. Continue the existing tree
> foliage, pale sky and garden contours seamlessly across that small missing area. No new objects,
> no repeated tiles, no copied awning stripes in the middle, no smoothing or blur. Output same
> near-square aspect ratio as reference, painterly but sharply textured.

> Precise restoration edit of this exact portrait-oriented illustrated cafe double-door crop.
> Preserve original framing and every existing detail: door frames, handles, right paw print,
> awning, trees, fence, floor, cat decoration at lower left, chair at lower right, color, texture,
> sharpness. ONLY remove the orange paw-print decal in the LEFT glass pane (near x=98,y=180 in the
> 372x403 reference) and paint a natural continuation of the outdoor tree foliage and pale garden
> scene behind that small area. No duplicated floor or awning lines in the middle, no blurry patch,
> no new objects. Keep same almost-square portrait aspect ratio.
