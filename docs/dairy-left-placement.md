# Dairy tray beside the ice station

Superseded by [restoring the original wooden boards](restored-original-boards.md). The generated steel-tray overlay below is no longer rendered. Milk and cream now stand together on the original left board; their shadow rendering remains unchanged.

The milk and cream tray now occupies the open left counter below the tea shelf, to the right of the ice bin. This leaves the cup organizer and central preparation area clear. The four front-facing packages remain closely spaced in the same order and at the same sizes.

[In-game preview](dairy-trays-preview.png).

Logical centers: milk x452/556, cream x648/724. All painted feet use y932. The tray floor in source-image coordinates contains every footprint inside x292..594, with feet near y706. Cream retains the longer directional silhouette shadow. Its projection is anchored separately to each column's actual painted lower rim, rather than a flat canvas baseline that placed the shadow below the curved sides. The contact stroke follows that same measured curve. Profiles are read once per source texture and cached; no pixel reads occur per frame. Milk's existing directional cast shadows remain. Object and shadow still hide and restore together during a carry.

[Cream shadow close-up](cream-shadow-closeup.png). Browser pixel checks cover both cans at widths 20, 28, 40 and 64px, sampling contact at five points along each base; all shadows join within 0.75px. They also verify that shadow compositing preserves adjacent atlas frames.

The selected [kitchen-room-dairy-left.png](../src/assets/kitchen/kitchen-room-dairy-left.png) is a 1452×1083 background, generated with the built-in imagegen tool in edit mode and copied unchanged from `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-af94fbcd-d8b3-4b55-b3fc-0254003587eb.png`. The renderer uses only the crop at x0/y540, width1084/height260, with a 24px transition over bare marble. The remaining sharp original room and the aligned ice/sugar patch retain their existing sources. Front-facing package artwork remains `milk-cream-front-v3.png`; order icons and carried objects reuse it.

## Exact imagegen prompts

Initial relocation target: `kitchen-room-dairy-together.png`.

```text
Use case: precise-object-edit. Edit this full 1452x1083 painted kitchen background. MOVE ONLY the single empty stainless serving tray currently under the cup organizer. Move the entire tray and its subtle contact shadow to the open LEFT countertop, BELOW the tall wooden tea rack and immediately to the RIGHT of the ice bin. Its NEW outer bounds should be approximately x275..610, y680..790 on this image. Retain its current width, depth, flat ivory nonslip insert and very low stainless rim. It is the SAME compact tray, in a new position. Its new front edge must be near y790, not y730. This leaves comfortable bare counter between the rack's lower edge and the tray and frees the area under the clear cup stacks.
Completely remove the tray from its OLD location around x650..980,y625..735. Fill its old footprint and shadow with seamless original warm ivory marble and diagonal sunlight. There must be exactly ONE serving tray in the entire middle counter area. Keep it EMPTY: the game supplies four upright milk and cream packages.
Preserve all other objects and their exact positions, scale and fine details: tall wooden shelving, cup stacks and holder, sealing machine and empty loading bay, straw box, nine empty topping pans, ice and scoop, wall and sunlight, stone counter edge, original full image framing and dimensions. Same coherent elevated kitchen viewpoint, upper-right warm lighting, refined painted realism. No other edits, no bottles, cartons, cream cans, text, labels, UI, new decorations or extra trays.
```

Position refinement target: preceding generated output `exec-d3c66c8c-2f7e-4b64-8d04-9d6c4085b8aa.png` in the same generated-images directory. Final placement uses the measured coordinates above, rather than assuming the requested coordinates were reproduced exactly.

```text
Precise localized edit: move ONLY the single empty serving tray STRAIGHT UP by 82 pixels. Do not move it sideways or change its size. On this 1452x1083 image it currently occupies x265..610,y760..888. Its NEW outer bounds must be x265..610,y678..806. The tray must sit ABOVE the midpoint of the ice bin, with its lower edge around y805. Remove the old lower tray footprint and its shadow, restoring matching bare marble. Preserve the thin steel rim, flat ivory insert, original viewpoint and subtle contact shadow. Keep every other object and pixel as unchanged as possible, including ice, tall rack, cups, machine, topping bins, wall, sunlight and counter. ONE tray only. No packages, bottles, extra trays, text or UI. Same full opaque original canvas.
```

