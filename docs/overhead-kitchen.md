# Overhead kitchen artwork

The kitchen now uses an elevated top-down view based on the user's reference: honey-wood shelves and boards, a cream stone worktop, open ingredient pans, and one compact yellow cup mat. The ice station occupies the left counter; the lidding machine and straw box occupy the upper right.

Active assets in `src/assets/kitchen/`:

- `kitchen-room-aligned-trays.png`: active room, including [ice and sugar trays with aligned edges](background-trays.md), the tall rack, continuous wall and cup organizer, drawn as one background.
- `kitchen-room-counter-cups.png`: earlier room with the [cup organizer resting directly on the counter](counter-cup-station.md), retained as the source for the integrated trays edit.
- `kitchen-room-continuous-wall.png`: earlier [wall repair](continuous-kitchen-wall.md) before removal of the shelf behind the cups.
- `kitchen-overhead.png`: original, unchanged 1672×941 design reference.
- `kitchen-room-tall.png`: earlier taller imagegen source for the joined rack.
- `tea-dispensers-overhead.png`: six transparent tea dispensers.
- `milk-cream-natural.png`: active [milk cartons on the left board and cream cans on the right](board-equipment.md), with paper folds, metal reflections and functional dispensing heads.
- `counter-props-overhead.png`: cloth mat and earlier milk, cream and sugar artwork retained as references.
- `topping-pans-overhead.png`: nine ingredient pans plus an empty pan.

Generated with the built-in imagegen tool. Atlas crops preserve transparency and are shared between the kitchen and order illustrations. The original side-view assets remain available for reference.

The room is now taller and the two-tier rack holds all six tanks at the first version’s apparent size. The preparation board below stays clear. See [tall tea shelf](tall-tea-shelf.md).

Swipe empty counter space to pan between stations; the bottom station shortcuts have been removed. One [shared cup mat](single-cup-mat.md) stays in view on the foreground marble. Cups return to the same mat after lidding. Cup-stack badges identify S/M/L. Touch targets and the machine press crop use the new artwork's coordinates.

## Prompt set

### 1. overheadBackgroundPrompt

```text
Use case: stylized-concept. Asset type: complete background plate for a playable boba kitchen, 16:9 landscape, logical coordinates 1920x1080. The attached image is the PRIMARY STYLE, CAMERA AND MATERIAL REFERENCE. Redesign the kitchen from this ELEVATED TOP-DOWN viewpoint: the viewer looks down across a large cream stone counter, seeing broad top surfaces and deep square ingredient bins, just like the reference. Warm softly painted honey wood, peach light, pale cream stone, fine brown outlines, subtle watercolor brushwork. One coherent perspective throughout. This is a working background, not a UI mockup.
Composition:
- Broad counter fills the view down to its front edge at y1030, with a thin wooden apron below. Back wall is only a shallow strip, no window, posters or hanging plants. Soft diagonal sunlight as in the reference.
- Upper LEFT: open honey-wood shelving x60..750 y0..330, with a wide EMPTY lower ledge at y310. Leave shelf EMPTY; game will place three tea dispensers on it.
- Middle LEFT: large rounded wooden board x60..760 y420..625, EMPTY; game places another three tea dispensers here.
- Middle CENTER: second broad rounded wooden board x800..1390 y425..635, EMPTY; game adds milk cartons, cream and sugar here.
- Upper CENTER/RIGHT: low long open shelf x790..1380 y90..300. On it, exactly three neat stacks of clear cups, small/medium/large left to right, with a shallow wooden rack at x900..1270 y130..300. No lettering. Clear cup mouths and tops visible from the elevated viewpoint.
- RIGHT MIDDLE: a single inset stainless topping station at x1440..1885 y440..790, with exactly NINE EMPTY square metal pans arranged as three columns by three rows. Broad open tops seen from above like the reference. Evenly spaced shared rims, consistent perspective, back row slightly narrower than front row. Absolutely no toppings inside; game paints them.
- LOWER LEFT: a recessed rectangular ice bin x45..380 y765..1000 filled with clear chunky ice, with a little metal scoop resting inside. Its open top is dominant, same elevated view as the reference.
- UPPER RIGHT, above the topping station: a compact cream and warm terracotta cup-lidding press at x1450..1710 y80..390, with two rolls on top and an EMPTY central loading bay. We see its top AND the inside of its cup platform from above. Leave the bay empty; the live cup will be drawn later. A short rectangular straw box with thick pink/tan straws is at x1750..1875 y220..390, to the right of the machine. Match the same high camera angle, not eye-level front art.
- FOREGROUND: keep x430..1410 y780..1020 mostly empty for the active cup. A single small yellow polka-dot cloth napkin, seen from above like the reference, is placed at x1080..1350 y845..1010. Leave the area x620..990 y835..1020 empty because the main preparation mat is drawn dynamically.
Constraints: use the reference's broad work surfaces and high viewpoint, avoid a frontal wall panorama. No people, no text, no labels, no UI, no bottles/cartons/tea tanks already on the empty boards, no filled topping pans, no cup permanently inside the machine. Refined cozy hand-painted game art, fully finished, crisp usable silhouettes. Output only ONE continuous 16:9 kitchen background.
```

### 2. overheadClearPrompt

```text
Precise localized edit of this kitchen background: remove ONLY the single yellow polka-dot cloth napkin in the lower middle/right foreground. Replace the cloth and its shadow with a seamless continuation of the same cream stone counter and soft sunlight. Keep every other element, all equipment, nine empty topping bins, ice, shelving, cup rack, both wooden boards, perspective, counter edges, lighting, canvas size and framing exactly unchanged. The game will draw two movable cloth work mats at runtime, so the whole lower central worktop must be empty. Return the same full 16:9 background.
```

### 3. overheadIcePrompt

```text
Use case: precise-object-edit. Edit target: this illustrated top-down boba kitchen background. Change only the ice bin at the lower-left. Make the ice bin smaller, retaining its exact proportions and painted ice/scoop design, and move it upward so it sits directly below the left wooden preparation board. On this 1672x941 image its new bounding box should be approximately x30..280, y545..735. Remove its old large footprint and fill the vacated area with seamless matching cream marble countertop. Keep the entire foreground below y740 clear for gameplay mats. Keep every other pixel and object unchanged: wooden shelves, cup stacks, machine, straw holder, two wooden boards, 9-pan tray, warm sunlight, camera angle, resolution and art style.
```

### 4. overheadTeaPrompt

```text
Use case: stylized-concept. Asset type: transparent game sprite atlas. Reference image is STYLE AND CAMERA reference: warm hand-painted boba kitchen seen from an ELEVATED TOP-DOWN angle, about 55 degrees above the counter. Make SIX squat tea dispensers at this same high angle, showing a broad oval dark lid and the tea's top surface as well as the short front glass wall. They stand upright, with small brass taps at the lower FRONT center and a blank pale rectangular label on their front. Consistent cream/wood/brass bases, dark brown lids, warm fine brown outlines, soft watercolor highlights. No long shadows, no table, no background.
Exact regular atlas: 1536x1024 canvas divided into 3 equal columns and 2 equal rows, each cell 512x512. ONE dispenser centered in EACH cell, entire silhouette within local x65..447 y45..465, bottom contact at y450, tap tip at y465. Plenty of truly transparent gutter around each sprite, no overlap.
Top row left to right: amber-brown black tea; bright leaf-green jasmine tea; vivid orange Thai tea.
Bottom row left to right: warm golden oolong; lavender taro; deep green matcha.
The tea colors must remain distinct and appetizing. All six identical geometry and elevated viewpoint, only liquid color changes. Front label BLANK, no text, no icons; game draws emblems later. This is a sprite sheet, not a scene. Real transparent background and alpha edges, no checkerboard baked in.
```

### 5. overheadPropsPrompt

```text
Use case: stylized-concept. Asset type: transparent sprite atlas for the referenced warm watercolor boba kitchen. Match its ELEVATED TOP-DOWN camera, about 55 degrees above the counter: each upright package must visibly show its top and shortened front, with consistent perspective. Warm cream, honey wood, pastel peach, fine brown outlines, hand-painted highlights.
Exact regular atlas: 1536x1024, three columns and two rows, cell 512x512. One isolated object per cell, centered, silhouette inside local x55..457 y45..465, base around y450. True transparent background/gutters, no overlap or tabletop, no text.
Top row:
1 left: milk carton, pale cream and blush peach panels, prominent cute cow face printed on its FRONT, visible folded top and round cap. Clearly milk.
2 center: oat milk carton, cream and warm muted green panels, prominent oat stems printed on FRONT, visible folded top and cap.
3 right: compact cream dispenser can with piped nozzle, soft cream and buttery yellow label, prominent small cheese wedge picture on FRONT, visible circular top.
Bottom row:
1 left: compact cream dispenser can with piped nozzle, peach/caramel label, prominent caramel spiral or flan picture on FRONT, visible circular top.
2 center: round glass sugar jar with honey-wood knob lid seen from above, white sugar visible, small cube motif on front, no scoop and no text.
3 right: a SINGLE flat yellow polka-dot cloth preparation napkin, rectangle with slightly scalloped stitched edges, same elevated top-down perspective as the cloth in the reference. Fits local x45..467 y110..440, broad top surface, gentle edge/contact shadow. No cup.
All objects in the same viewpoint and style. No people, no lettering, no captions, no extra objects. Genuine transparent alpha, no checkerboard baked into the image.
```

### 6. overheadPansPrompt

```text
Use case: stylized-concept. Asset type: transparent sprite atlas of small stainless-steel topping pans, matching the reference's ELEVATED TOP-DOWN cooking counter. Show broad almost-square open tops with visible front inner wall, like the reference's 3x3 empty topping bins. Softly rounded steel rims, warm reflections, watercolor texture, fine brown outlines. Food is visible from above, natural small pieces. No scoops or handles sticking out.
Exact atlas: 1536x1536 canvas, THREE equal columns and FOUR equal rows, each cell 512x384. One pan per occupied cell, centered in local x40..472 y35..350. Back rim slightly narrower than front rim, consistent subtle perspective; pans approximately 432 wide by 310 tall. Transparent gutters. Identical pan geometry for every ingredient.
Row1 left to right: glossy dark brown black tapioca pearls; bright orange popping boba pearls; creamy translucent lychee jelly pearls.
Row2: golden yellow egg pudding chunks; glossy almost-black grass jelly cubes; muted bright green pandan jelly cubes.
Row3: burgundy red beans; clear translucent aloe cubes; translucent white crystal boba pearls.
Row4: ONLY center cell has one EMPTY clean stainless pan with same geometry. Row4 left and right cells are completely transparent.
Fill each occupied food pan generously, clearly distinct ingredients. No text, no numbers, no labels, no background or table, no painted grid between pans. True transparent alpha, no checkerboard baked in.
```


## Validation and previews

`npm run typecheck`, `npm test`, and `npm run build` pass. Chrome browser checks at 390×844,
375×667 and 932×430 verify cup selection in all three sizes, held tea pours, milk, sugar,
cream, machine insertion, paused press cycles, finishing-mat return and straws. Checks at
390×844 and 932×430 also cover all nine topping bins (alternating taps and drags), ice,
cup dragging into the machine and a perfect serve. Native app shells were not built.

[Landscape preview](overhead-kitchen-1284.png) · [Phone preview](overhead-kitchen-390.png) ·
[Small phone preview](overhead-kitchen-375.png)

Selected generated sources (built-in imagegen; copied without raster postprocessing):

- Room: `exec-27fcbe83-669c-4071-be58-522dca844a89.png`
- Tea: `exec-a8fd2ded-6069-490d-92f8-06993f91d528.png`
- Props: `exec-cc3a1a6c-3863-45f1-ac8d-07d8af573ddf.png`
- Pans: `exec-71e0b3e6-4ebc-4a22-8b2d-81bef5bce505.png`

Original generation directory: `/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/`.
