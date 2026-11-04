# Cat motifs in the cafe

The active order-screen paintings replace every bear motif with a cat: the left cushion,
both wall-shelf ornaments, cash-drawer badge, cookie-jar tag, chocolate-chip basket label,
two shaped cookies and their basket label. The kitchen already uses cat motifs.
Original source paintings remain as historical assets; only the cat versions are loaded.

Generated with the built-in imagegen tool, editing each `cafe-centered-*.png` separately.
Outputs were copied unchanged, without resizing or filtering. Dimensions are unchanged,
so the centered projection, customer queue, register hit areas and serving mat keep their geometry.

- `src/assets/counter/cafe-cats-portrait.png`: 982×1602; source
  `exec-b7611692-2254-4e9f-b2d3-56257eaa4438.png`.
- `src/assets/counter/cafe-cats-landscape.png`: 1944×809; source
  `exec-c47ea1c7-4069-450e-bf68-714c56a60682.png`.

Generated source directory: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`.

## Portrait prompt

```text
Use case: precise-object-edit. Edit this existing cafe game background, replacing EVERY bear or teddy-bear motif with a cute CAT in the exact same location, size, material and art style. Inventory: the bear-face cushion on the left banquette; BOTH small bear ornaments on the two upper-right wall shelves; the bear-face emblem on the front of the cash-register drawer; the bear-face tag on the glass cookie jar in the lower shelving; the bear-face label on the chocolate-chip cookie basket; BOTH bear-shaped cookies in the right cookie basket (make them cat-head cookies); and that right basket's bear-face label. All become clearly feline with distinct pointed triangular ears, small cat nose and whiskers, while preserving their original cream/golden-brown colors, expression, shadows and painted texture. Leave chocolate-chip round cookies circular, preserve leaf motifs, paw motifs and all other objects. These are the ONLY edits. Keep ALL furniture positions, centered doorway, lamps, plants, queue posts, mats, menu, counter, register blank display, text, camera, cropping and proportions exactly unchanged. Preserve all Vietnamese words exactly, preserve original sharpness and rich hand-painted texture. No extra decorations, no new text, no people, no mirroring, no layout redesign. Portrait edit target, exact canvas size 982 x 1602 pixels; preserve this aspect ratio and framing.
```

## Landscape prompt

```text
Use case: precise-object-edit. Edit this existing cafe game background, replacing EVERY bear or teddy-bear motif with a cute CAT in the exact same location, size, material and art style. Inventory: the bear-face cushion on the left banquette; BOTH small bear ornaments on the two upper-right wall shelves; the bear-face emblem on the front of the cash-register drawer; the bear-face tag on the glass cookie jar in the lower shelving; the bear-face label on the chocolate-chip cookie basket; BOTH bear-shaped cookies in the right cookie basket (make them cat-head cookies); and that right basket's bear-face label. All become clearly feline with distinct pointed triangular ears, small cat nose and whiskers, while preserving their original cream/golden-brown colors, expression, shadows and painted texture. Leave chocolate-chip round cookies circular, preserve leaf motifs, paw motifs and all other objects. These are the ONLY edits. Keep ALL furniture positions, centered doorway, lamps, plants, queue posts, mats, menu, counter, register blank display, text, camera, cropping and proportions exactly unchanged. Preserve all Vietnamese words exactly, preserve original sharpness and rich hand-painted texture. No extra decorations, no new text, no people, no mirroring, no layout redesign. Landscape edit target, exact canvas size 1944 x 809 pixels; preserve this aspect ratio and framing.
```
