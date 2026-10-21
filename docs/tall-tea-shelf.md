# Tall room and original-size tea tanks

The room is extended upward by 350 logical units, from 1920×1080 to 1920×1430. The joined tea rack has tall openings and standing bases at 310 and 610. Three tanks stand on each tier.

The first top-down design used 180-unit tanks. The taller room compensates their rendered width by `1430 / 1080`, so fitting the room never shrinks the tanks below that original apparent size. In a 390×541 kitchen canvas, each tank is 90.2 CSS pixels wide, matching the first version; the previous compact shelf used 55.1px tanks. `roomGeometry.ts` records that reference and compensation, and the order-art regression checks it across phone and landscape sizes.

Built-in imagegen produced `src/assets/kitchen/kitchen-room-tall.png` (1518×1036) for the taller rack. The assembled room subsequently received a [continuous wall repair](continuous-kitchen-wall.md), replacing the split wall layers with a single background in `kitchenRoomArt.ts`. The tall rack, equipment designs and anchors remain in place. The press head crops from that same repaired background.

The camera fit centers the active working band, including the upper tank crowns and foreground mats. Landscape order columns can use up to half the width to keep that tall band visible. Swiping pans the kitchen; station shortcuts remain removed.

[Room preview](overhead-kitchen-1284.png) · [Phone shelf](two-tier-tea-shelf-390.png) · [Small phone shelf](two-tier-tea-shelf-375.png)

## Built-in imagegen prompt

```text
Use case: precise-object-edit / upward outpainting. Edit target: the original warm elevated top-down boba kitchen. EXTEND THE CANVAS UPWARD by 200 pixels, keeping the original picture's full width and all its existing bottom/right equipment at their original size. Requested new canvas 1672x1141, with the original 1672x941 picture occupying y200..1141. Fill the added upper area with the same warm cream wall and sunlight. Do NOT shrink the original kitchen to fit the old height. The user needs a physically taller room for LARGE tea tanks.
Redesign ONLY the upper-left tea rack as ONE tall, joined, two-tier wooden shelving unit spanning x0..690, y0..530 in the taller canvas. It has continuous outer side panels and backing, ONE top cap, ONE thin middle shelf, ONE bottom shelf, neatly joined corners; no two independent shelves stacked together. Same honey wood grain and hand-painted brown outlines as the original. Keep BOTH rack openings completely EMPTY because the game draws three large tea tanks per tier. The upper shelf's standing surface/front lip is around y265..280 and the lower shelf's around y490..510. The openings MUST be tall enough for tea tanks roughly 190 pixels wide and 215 pixels tall each; do not make short cubbies. A generous tall upper opening and at least 210 pixels of clear vertical space in the lower opening. The tall rack must stand above the left preparation board, which begins at y550 after the upward extension. Preserve the elevated viewpoint and broad top surfaces.
All original artwork outside this rack must keep its original design, proportions and positions shifted down by exactly 200 pixels: cups and their rack, both rounded wooden preparation boards, cream/terracotta lidding machine with rolls, straw box, 3x3 empty topping pans, small ice bin and scoop, marble foreground, counter edge. New top wall above the cups/machine is empty, with matching soft sunlight; no new objects or furniture. Keep the entire old foreground clear. No tea tanks, cups in machine, lettering, labels or UI. Return ONE full kitchen background on the taller canvas. It must visibly have extra height and tall two-tier tea shelving, not a compressed version of the old composition.
```

Selected generated source: `/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-3945919f-061d-4260-af70-f5c8983c8d9a.png`.

## Verification

Typecheck, the regression suite and the production build pass. Chrome browser checks at 390×844,
375×667 and 932×430 verify original apparent tank size, visibility and held pours for all six teas,
S/M/L cups, milk, cream, sugar, machine insertion, paused press cycles and straws. Additional checks
at 390×844 and 932×430 cover swiping to both ends, all nine topping pans by taps and drags, ice,
dragging the cup into the machine and a perfect serve. Production checks load the new artwork and
restored cup and confirm that no station shortcuts are present. Native app shells were not built.

