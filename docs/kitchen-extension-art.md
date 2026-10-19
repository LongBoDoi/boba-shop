# Extended kitchen artwork

`src/assets/kitchen/kitchen-warm-extended.png` is the active 1933 × 814 painted room, created with the built-in imagegen tool using `kitchen-warm-clear.png` as the edit target. The original backgrounds remain available.

The wider room adds a complete wooden S/M/L cup station on the left and a cream enamel ice box, clear cubes and metal scoop beside the topping station on the right. Both are painted into the background, so their lighting, shadows and materials move together. The cup rack is scenery; cup sizes do not change recipes or scoring. The ice box has an accessible touch target and a subtle pickup highlight, and uses the existing draggable ice scoop and one/two-scoop rules.

All anchors were measured against the delivered image, including both tea shelves, the topping basin, the bottle ledge and the foreground counter. `ROOM_BG_EXTRAS` keeps bottle and foam placement beside the room geometry. `ROOM_BG_CUP_STATION` describes the cup rack for accessibility. The preparation cup and mat remain fixed while the room pans.

Previews: [cup station](kitchen-extended-cups-preview.png), [ice station](kitchen-extended-ice-preview.png).

Validation: TypeScript, the existing test suite and a production web build pass. Browser interaction checks cover 375 × 667 (day 1), 390 × 844, 768 × 1024, 844 × 390 and 1180 × 820 (day 9): the complete cup rack is reachable, the preparation cup stays on screen and fixed during panning, the ice box is reachable with a touch target above 44 points, and dragging a scoop into the cup updates the saved ice count. Audio is muted for isolated kitchen checks; an earlier run with audio enabled emitted browser play/pause interruption errors. Native simulators were not run.

## Generation prompt

```text
Use case: precise-object-edit.
Asset type: production background plate for a horizontally pannable mobile boba cooking game.
Edit target: the supplied 1536 by 1024 warm kitchen background. Extend the room horizontally into a panoramic canvas, target 2432 by 1024, same camera angle, same scale of furnishings and same vertical counter heights. Add about 384 pixels of room on the LEFT and 512 pixels on the RIGHT. Keep the existing central kitchen, empty two-tier wooden tea shelving, small bottle ledge, cups-and-straw shelf, signs and single empty stainless topping basin. Existing center should occupy x384 to1920 of the new image, without shrinking or vertically moving any of it. Preserve the shelf foot lines y308 and523, basin y454 to640, rear marble counter front edge y696 to736, foreground marble counter y736 to950, wooden foreground edge y950 to1024. Empty tea shelving is vital, game dispensers go there. Empty undivided topping basin is vital, interactive topping sprites go there. No bottles, food or tea dispensers.
LEFT extension: a complete beautiful wooden three-compartment cup station on the BACK marble counter, around x40 to350 and y480 to695, with three neat stacks of transparent disposable plastic cups small, medium and large, little cream plaques reading exactly S, M, L and olive leaf motifs. Do not clip any cups. Continue the cream wall, counter and oak cabinets seamlessly. Keep the lower foreground counter clear; remove the old cropped cup stack protruding at the original image's lower-left edge so it is not duplicated.
RIGHT extension: a substantial open rectangular cream enamel insulated ICE BOX on the back counter, around x1970 to2385 and y475 to695. Slight view down into its shiny steel inset opening, filled with many angular transparent ice cubes, white cool blue glints, a metal scoop resting diagonally inside with handle rising toward the upper right. Front face has tiny caramel ice-cube line motifs and the exact text ICE. Entire box and scoop in frame. A sunlit window and trailing green pothos at far right, like the user's cozy café reference.
Materials: warm hand-painted gouache/watercolor, delicate caramel outlines, buttery cream plaster, honey oak, cream marble, soft golden diagonal afternoon window rays, olive foliage. Preserve original painting's style and warmth precisely. Clear foreground preparation counter for an interactive movable cup; no mats or standing cups on foreground counter, no people, no UI, no extra topping basin, no divider in tea shelves. Deliver the full extended background edge to edge.
```
