# Level register body

Historical v7 body; the current complete register follows the [cookie box perspective](counter-cookie-perspective.md).

Active landscape image: `src/assets/counter/cafe-peach-panorama-v7.png`, 1942×809. The register front body and blank screen have level top/bottom edges and upright side edges, matching the horizontal counter edge and the corrected v6 foot. A small visible right housing side gives depth. The live register text uses an untransformed screen rectangle. Portrait is unchanged.

Built-in imagegen source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-f29a006e-0baf-474c-9350-681db117b16e.png`, editing v6. Only x102,y363,w269,h208 was composited into v6 with a7px interior feather at native resolution. A decoded-pixel comparison verified 1,516,076 pixels outside this body region remain identical. The v6 foot, bell and other background details are preserved. No runtime prop overlay.

## Final prompt — built-in imagegen

```text
Use case: precise-object-edit. Fix ONLY the cat-ear cash register's UPPER BODY at lower left of this exact cafe painting: front housing, screen frame, blank screen, ears and paw emblem. The user says this BODY still looks crooked. Make the large front face sit upright and level in the room: its TOP and BOTTOM front edges must be horizontal, parallel to the straight cafe counter edge at y662; the left and right edges must both be vertical. The cream screen inset must also have horizontal top/bottom edges and vertical side edges, with balanced padding in the housing. Both ears aligned naturally above the level housing. Keep only a small visible RIGHT side thickness of the body for gentle depth. Do not turn the entire body dramatically and do not show a left side thickness. Keep the original body location/size, roughly x113-362 y375-570. Match exactly the soft peach watercolor texture, brown outlines, and original lighting. The support and FOOT/BASE BELOW y565 are already fixed with a straight level bottom edge: preserve their geometry and placement; make a clean connection from body to support. Keep the bronze bell, cookies, mat, pastry case, room, counter edge, cabinets and all other pixels unchanged. No text, UI, new objects, blur, or crop. Same 1942x809 frame.
```

Validation: typecheck/build, complete regression suite, landscape Counter browser check, Capacitor asset copy to Android/iOS. Native hardware not tested.

