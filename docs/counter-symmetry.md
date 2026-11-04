# Centered order screen

The [cat motif revision](counter-cats.md) is now active, retaining this centered geometry.

The active backgrounds align the main door, center lamp, queue mat and serving mat with the
image's vertical centerline. Queue posts form balanced pairs. Each orientation keeps its own
painting; the earlier entrance assets remain available as source artwork.

`counterRoomPlacement` uses one shared `width / 2` for the doorway, customer queue and handoff
cup. Cover cropping stays centered, so the line remains vertical at every depth and screen size.
The register's hit area and the mat's serving height were remeasured against the new paintings.

## Assets and provenance

Created with the built-in imagegen tool, using the corresponding `cafe-entrance-*.png` as edit
targets. Generated images were copied without resizing or filtering.

- `src/assets/counter/cafe-centered-portrait.png`: 982×1602.
  Source: `exec-8d4bf7c4-5b79-4b0f-abbd-ec04b2baee3f.png`.
- `src/assets/counter/cafe-centered-landscape.png`: 1944×809.
  Source: `exec-1e542f91-9065-4b5c-8b00-8a928da4589c.png`.

Source directory: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`.
The portrait output also centers the menu board and bell, balancing the register and drink tray.

## Portrait prompt

```text
Use case: precise-object-edit. Edit target: this portrait cafe game background. Correct its left-right balance around a single vertical center axis at exactly 50% of image width. Keep the same portrait canvas, framing, warm palette, sharp outlines and textures. Precisely center the main double door (its middle seam), middle hanging lamp, open queue aisle, GỌI MÓN floor mat and small leaf serving mat on the foreground counter on that same vertical axis. Match the left and right brass queue posts as symmetrical pairs at equal distances from that axis with identical perspective and height for each pair. The two side lamps should have equal spacing around the middle lamp. Make the floor perspective lead to the centered door. Keep the central door threshold at the existing height and keep both mats at their existing heights and sizes; just correct their horizontal position. Preserve the register and its blank cream screen at lower left, menu board, bell, tray of drinks, furniture, plants, text, cabinet facade, and all other details in place. Keep the foreground useful and naturally balanced: do not duplicate or mirror the register, signs, text or drinks. Do not add items. Preserve the existing image's crispness; change only the alignment of the central door/lights/mats/queue posts, maintaining coherent lighting. No people. Output 941 by 1671 if possible.
```

## Landscape prompt

```text
Use case: precise-object-edit. Edit target: this landscape cafe game background. Correct its left-right balance around the vertical centerline at exactly 50% of the canvas width. Keep the centered double door and central hanging lamp in place. Shift the GỌI MÓN floor mat so its center aligns exactly below the middle seam of the door; center the small leaf serving mat on the foreground counter on the same axis. Arrange the four brass queue posts in symmetrical pairs at equal distances to the left and right of that axis, with matching depth and height for each pair. The left posts currently sit farther from the center than the right posts; correct this. Keep the central aisle straight and the floor perspective centered. Keep both mats and queue posts at their current vertical levels and sizes. Preserve the existing wide 1942:809 aspect ratio, camera, crisp detailed handpainted textures, warm golden light and all other objects. Especially preserve register with blank cream screen at lower left, menu board, bell, drinks, text, plants, cookie shelves and seating in their original places. No mirroring of text, no duplicated register or props, no extra people. This is a subtle alignment correction of central mats and queue rails only; keep all other artwork sharp and unchanged.
```

## Checks

`check-customer-queue.cjs` verifies the shared axis at all queue depths. The optional
`check-counter-screen.cjs` exercises ordering, serving, advancement, swiping, and register
alignment at five phone/tablet sizes. Production build and assets are shared by web, Android
and iOS; native devices are not tested by the browser checks.
