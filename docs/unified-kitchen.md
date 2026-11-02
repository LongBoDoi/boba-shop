# Unified kitchen painting

The stationary kitchen now renders as one image: `src/assets/kitchen/kitchen-unified.png`
(1453×1083), scaled directly to the existing 1920×1430 logical room. It contains all six tea
tanks, the cup rack, lid stack, straw box, two dairy boards and their cartons/cans, ice and
sugar trays, and all nine filled topping bins. Lighting, perspective, counter texture and
contact shadows were repainted together. There are no rectangular room patches or separate
station sprites layered over the painting.

Invisible hit targets still control each station. Transient touch highlights provide feedback;
the player's cup and its contents, holder, pour stream and carried tools remain dynamic.
Stationary milk/cream supplies remain painted in place while a temporary tool is carried.
One tap on the lids still seals the drink immediately. All menu items remain available from day one.

The original backgrounds and patch assets remain untouched as references. Old room patches
are removed from preloading; the superseded room atlas and projected shadow/pan renderer are removed.
The ingredient sprites still serve order illustrations, carried tools and cup contents.

## Source and prompt

Built-in imagegen edit of an exported 1920×1430 view of the actual assembled room (without UI
or the player's cup), using its equipment positions and identifying symbols as a reference.
Generated source:
`/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-c709ccea-a8e8-4e81-b2a1-521e1d99e84b.png`.
The result is copied byte-for-byte into the repository; no subsequent resampling or patching.

```text
Use case: precise-object-edit / cohesive game background repaint.
Edit target: supplied 1920x1430 kitchen scene, exported from the actual game.
Rework the ENTIRE image as one seamless, beautifully hand-painted warm cream-and-honey kitchen illustration. This must be a single coherent environment, not pasted assets or patches. Repair all rectangular patch seams, inconsistent counter reflections, detached contact shadows and perspective inconsistencies. Maintain crisp fine illustrated edges, rich tea translucency, wood grain, delicate marble texture. Preserve the original image's aspect ratio and composition exactly; all interactive equipment centers and bounding boxes must remain at their present locations because the game hit targets use those positions.
Include exactly these existing objects, retaining each design/color and identifying pictogram: six glass tea tanks on left wooden shelves, 3 columns by 2 rows, dark rounded lids, brass taps, same 6 tea colors and symbols; cream cat-themed S/M/L rack with three increasingly tall stacks of clear cups; nested transparent cat-ear dome lids on the counter immediately right of cup rack, blending naturally into countertop with soft contact shadow; cream cat straw box of wrapped white straws at far right with text "Ống hút"; two small wooden boards at center holding two front-facing red/cow and green/oat milk cartons on left board, two small gold/cheese and orange/caramel cream aerosol cans on right board; ice pan with scoop at left foreground and amber sugar syrup pan with spoon below; stainless 3x3 topping station right foreground containing (row1) dark brown pearls, orange popping pearls, translucent white lychee pearls, (row2) yellow pudding cubes, black jelly cubes, green pandan jelly cubes, (row3) red beans, clear aloe cubes, cream-white pearls. All nine bins must fill tray completely and stay aligned.
Keep the lower middle countertop clear for the player's movable cup, without adding a cup or mat. Keep all equipment usable silhouettes, scale, centers, tank tap ends, tray grid, cup rack labels and carton symbols in place. Do not add a lidding machine, captions, UI, floating tags, plants or new decorations. Improve natural integration across the WHOLE room, a unified slightly top-down viewpoint, warm light from upper right, consistent soft shadows down-left, no blur and no oversaturated yellow wash. All stationary equipment is painted directly into this one background.
```

## Validation

`npm run build`, `npm test`, and `npx cap copy` for Android/iOS. Native device execution is
not included. `tools/check-kitchen-background.cjs` is an optional browser regression check:
start Vite and set `PLAYWRIGHT_MODULE` / `CHROME_PATH` for a local Playwright/Chrome installation.
It clicks all three cup sizes and all 23 stations in 390×844 and 932×430 viewports, verifies
the resulting drink changes, and asserts that the stationary room renders exactly one image.
`SCREENSHOT_DIR` optionally saves previews. The existing lidding browser fixture also verifies
immediate lidding, empty cups, repeated taps, swipe cancellation and adding a straw.
