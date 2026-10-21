# Integrated ice and sugar trays

The active room is `src/assets/kitchen/kitchen-room-aligned-trays.png` (1452×1083), edited with
the built-in imagegen tool. Ice and golden liquid sugar are part of this single opaque background.
Their straight outer edges form one column with a narrow marble gap, and the foreground mats
leave the trays clear. The earlier room and transparent sugar-tray assets remain as references.

`KitchenScene` draws only a temporary touch highlight over each painted tray. The separate
`SUGAR_TRAY` render and preload are removed. `ROOM_BG_ICE_MACHINE` now measures x40, y979,
260×182 in logical room units. Sugar shares its x, width and height and starts eight units below
its bottom. Touch and drag still carry an ice scoop or syrup ladle; quantities and scoring are
unchanged. The cup tags from the preceding change remain in the room atlas.

Source inputs: `kitchen-room-counter-cups.png` as the edit target and `liquid-sugar-tray.png` as
the syrup/ladle reference. The first edit inserted the syrup beneath the ice and matched warm
metal reflections, contact shadows and elevated viewpoint. Two targeted refinements straightened
the outer rims. Selected generated source:
`C:/Users/manhl/.codex/generated_images/01a14ab1-c188-7150-89b0-4fd9a03a5998/exec-1f27a695-3f36-46ab-baf4-aa041d9436e2.png`.
The generated PNG is copied directly into the project; no runtime compositing is used for either tray.

Final refinement prompt (built-in edit mode):

```text
Precise-object-edit of supplied complete kitchen image, preserve full 1452x1083 composition. Change ONLY the outer metal rims of the two trays in the lower left. Make these TWO IDENTICAL VERTICAL RECTANGLES, stacked, their left and right vertical sides perfectly collinear. Their exact outer boxes are ice (30,742)-(230,878) and syrup (30,886)-(230,1022). Shift the sugar tray's lower-left corner right to match the ice tray's lower-left corner: it currently protrudes left and must not. NO diagonal/slanted outer side edges. Same width at top and bottom. Ice and sugar must have the SAME outline and rim shape, with the sugar outline being the ice outline translated straight down 144px with zero sideways shift. Keep all tray contents, warm metal reflections, and the rest of the picture unchanged. Do not touch or redesign any other object, countertop, rack, cup, board, pan, machine, straw, wall or lighting. No text, cropping or extra objects. Full opaque background.
```

Typecheck and production build pass. Browser checks at 1284×800, 390×844, 375×667 and 932×430
verify matching station edges and gap, no separately loaded/rendered sugar tray, and both tapping
and dragging sugar and ice into a cup. No browser errors were observed. Gameplay, saves, art and
layout regression checks pass; the existing native-shell fingerprint mismatch still fails in
`tools/check-updates.cjs`. No native files changed. [Phone preview](background-trays-phone.png).
