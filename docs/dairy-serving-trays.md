# Flat milk and cream serving trays

The current [front-facing dairy group](dairy-front-group.md) uses one shared tray with all four
containers close together. The following records the previous two-tray artwork and prompts.

The two thick boards are replaced by slim brushed-steel serving trays with pale nonslip inserts. Their low rims leave the containers visibly standing on a flat surface. Milk remains on the left and cream on the right, with slight depth staggering and the existing directional/contact shadows.

Selected image: [kitchen-room-serving-trays.png](../src/assets/kitchen/kitchen-room-serving-trays.png), 1452×1083, copied unchanged from the built-in imagegen output `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-96e4ae0e-8228-49ef-879e-217d86dacdc5.png`.

The renderer keeps `kitchen-room-counter-cups.png` as the base and uses only the new board-area crop at x0/y540, 1084×235 source pixels. Its 24-pixel edge transition lies on bare marble, outside the old boards and new trays. The tray interiors retain full opacity and detail; the rack, cups, machine, toppings, foreground and existing ice/sugar patch keep their original sources. The new crop is baked once, not each frame.

Measured tray floors in source pixels: milk x280..565, cream x690..975, feet below y620 and above y690. The later [package realism pass](equipment-realism-v2.md) uses logical centers milk x455/650 and cream x1025/1195, feet y886/896 and y884/894 respectively. Frame sizes are 116×248 and 76×178 logical units. Counter, order and carried graphics share `milk-cream-refined-v2.png`, with contact shadows aligned to the visible bases.

[In-game preview](dairy-trays-preview.png). Build, full regression suite and phone/landscape browser checks cover the layout. Web assets are copied into both native projects; native binaries are not built here.

## Built-in imagegen edit prompts

Target for the first edit: `kitchen-room-counter-cups.png`.

```text
Use case: precise-object-edit.
Edit target: supplied full 1452x1083 kitchen background.
Replace ONLY the TWO massive honey-wood cutting boards across the middle counter with TWO LOW-PROFILE cafe serving trays. REMOVE the full old boards and their shadows, continuing the original ivory marble seamlessly. The left tray will support milk cartons, the right tray cream aerosol cans. The game draws those packages separately: leave BOTH TRAYS EMPTY.
These MUST be thin flat serving trays resting directly on the counter, not boxes, bins, deep caddies or risers. A thin softly reflective warm brushed stainless steel base with a pale warm ivory nonslip insert, a tiny rolled edge only 2 or 3 pixels high. Broad FLAT usable top surface at the same depth as the countertop, no deep interior walls, no tall front rim. Subtle grounded soft contact shadows cast lower-left by upper-right light. Natural practical cafe equipment, softly painted warm realism matching the adjacent topping pans, crisp refined details. Simple smooth insert, no dense stripe patterns.
Exact desired positions on this image:
LEFT MILK TRAY outer bounds x165..450, y625..710. The milk carton feet will rest approximately at (242,664) and (378,676). Leave a few pixels of space in front of their feet and generous space to their sides.
RIGHT CREAM TRAY outer bounds x710..960, y625..707. Cream can feet will rest at (764,661) and (900,673).
The trays follow the SAME elevated countertop perspective and upper-right sunlight as the existing room. Two distinct compact trays, not a single long board. The former cutting board footprints outside these trays become bare continuous marble.
Preserve EXACTLY every other object and its positions, scale, resolution, camera, framing and style: tall wooden rack, clear cup stacks and their organizer, sealing machine and rolls, empty cup loading bay, straw holder, nine EMPTY steel topping pans, ice bin/scoop, stone counter edge, wall and diagonal sunlight. Do not redraw or soften those details. Do not paint cartons, cans, bottles, ingredients or utensils on the new trays. No letters, names, labels, UI, people, extra decorations or new furniture. Full opaque original canvas, same dimensions and original proportions.
```

Refinement target: the first generated output, `exec-e4b285e4-db19-4263-abb6-60c9cd920859.png` in the same generated-images directory. The final measured placement above supersedes coordinates requested in the prompt.

```text
Precise-object-edit of this full kitchen background. The two new steel serving trays are STILL much too large. SHRINK ONLY EACH OF THE TWO SERVING TRAYS to 60 percent of its current width and 55 percent of its current depth. Keep their centers fixed. Left tray must occupy x170..455 and y625..710, right tray x710..965 and y625..707, on this 1452x1083 image. These are small trays for exactly TWO packages each, not enormous work boards. The old left tray reaches x80..560 and the old right x600..1040; remove these wide old footprints completely and replace them with seamless bare original marble around the compact replacements. Both should have slim rolled steel edges only 2px high and flat ivory nonslip inserts, no depth, no boxes, no thick front walls. Their front edges stay around y710, so they must move slightly down as they shrink. Keep them EMPTY. Preserve every other kitchen object and original canvas, layout, perspective, artwork detail and warm sunlight exactly unchanged. Do not add cartons, bottles, cans, labels, utensils, letters or any extra objects. Full opaque background.
```

