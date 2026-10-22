# Milk and cream realism pass

Superseded by the [front-facing dairy group](dairy-front-group.md); this page records its source artwork.

The current shared package sprite is [milk-cream-refined-v2.png](../src/assets/kitchen/milk-cream-refined-v2.png), a transparent 1536×1024 atlas. Cartons have taller paperboard proportions and a smaller side panel; cream cans have slender cylindrical bodies, brushed shoulders, crimped bases and practical plastic dispensing heads. The four ingredient pictures remain cow, oats, cheese and caramel custard, without names.

[In-game preview](dairy-trays-preview.png).

The milk frames are 116×248 logical units, centers x455/650, feet y886/896. Cream frames are 76×178, centers x1025/1195, feet y884/894. Artwork keeps its generated proportions inside each frame. This places the pairs farther onto the flat inserts, with tighter spacing and a modest depth stagger. The original serving tray artwork and all other stations are unchanged by this pass.

Contact shadows now use the actual painted silhouette width instead of the invisible frame padding. Their tight shaded core sits at the visible base; the softer cast shadow extends slightly lower-left with the room's upper-right light. Previously the contact core ended above the base and was hidden by the package. Object and shadow still leave and return together during a drag. Counter, carried items and order icons use the same new sprite crops in `equipmentArt.ts`.

Generated with the built-in imagegen tool using `kitchen-room-serving-trays.png` for kitchen style/camera/light and `milk-cream-natural.png` for ingredient identities. Selected output was copied unchanged from `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-38b6b50a-4015-4162-974d-d68c621922b2.png`. Alpha is preserved; no bitmap resizing or postprocessing is applied to the saved asset. Previous sources remain available.

## Exact generation prompt

```text
Use case: stylized-concept. Asset type: a transparent production sprite sheet of FOUR realistically proportioned dairy packages for a warm hand-painted boba kitchen game.
Image 1 is the KITCHEN style, camera, materials and upper-right light reference ONLY. Image 2 shows the FOUR ingredient identities ONLY; substantially improve their shape, camera and materials. Do not draw either scene.
Create one 1536x1024 transparent sheet in a regular TWO COLUMN by TWO ROW grid. One isolated package per quadrant, centered at x384 or x1152. Upper row packages fit y20..485, lower row y535..1000. Leave generous transparent gutters between all objects. Full objects visible, no clipping.
Upper left: a REALISTIC SLENDER ONE-LITRE milk carton in warm ivory with muted dusty-peach panels, small attached ivory screw cap on folded gable roof, a small handsome cow illustration printed on its front. Upper right: IDENTICAL carton geometry, warm ivory with muted sage-green panels, natural oat stalk illustration printed on its front. Each carton silhouette approximately 210px wide by 455px tall. Their bodies must have real straight folded paperboard, subtle vertical seam and slightly softened bottom corners, NOT squat chunky cubes or shiny toy blocks. Mostly plain ivory paper, tasteful sparse peach or sage color blocking, restrained printed ingredient illustration, not huge decorative wraparound blobs.
Lower left: a tall slim actual PRESSURIZED WHIPPED-CREAM AEROSOL CAN, warm ivory label with a small golden cheese wedge illustration. Lower right: identical aerosol-can geometry, warm ivory and muted caramel label, small caramel custard illustration. Each can approximately 155px wide by 450px tall. Narrow cylindrical metal body, understated brushed steel shoulder and crimped bottom ring. An actual short aerosol dispensing actuator on top: small ribbed collar, short practical ivory plastic lever with a small narrow outlet spout angled slightly left. NO soap pump, no long tube, no whipped-cream spiral, no tall decorative nozzle, no rounded hand-soap bottle.
Camera: all FOUR have upright straight vertical axes, almost frontal orientation with only a THIN right side panel visible (10 percent of carton width), modest elevated viewpoint showing the carton roof and oval can shoulder. Carton front bottom edges almost horizontal. No leaning, no isometric diagonal twist, no exaggerated foreshortening, no fisheye. All four share one coherent camera and scale; cans only slightly shorter than cartons.
Materials/light: sophisticated softly painted kitchen-game realism, delicate warm brown edges without thick dark outlines, matte lightly textured ivory paperboard, natural folds, subtle brushed metal with broad restrained highlights. Upper-right warm diffuse light, soft volume shading on the left, slight cool reflected light at the base. Match the room's quiet cream/wood/sage palette. No harsh shine, oversaturated orange, cartoon plastic or photographic realism. Ingredient pictures remain clear at small game sizes.
True alpha-transparent outside every package, no ground plane, NO cast shadows, no colored glow or halo, no background, no trays, no kitchen scene, no loose objects, no text, lettering, names, numbers, captions, brands or watermarks. Output only the four full isolated upright packages.
```

