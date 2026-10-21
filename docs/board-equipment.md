# Milk and cream on the boards

Milk cartons stand on the left board at logical x280/520, feet y876/893. Smaller cream cans
stand on the right board at x990/1200, feet y873/889. Slight depth staggering avoids an
artificial straight shelf line. Smooth cast shadows extend toward the lower left of the room's
upper-right light, with tighter contact shading under each package.

The new transparent 1536×1024 atlas is `src/assets/kitchen/milk-cream-natural.png`.
Built-in imagegen used the active room as camera/lighting reference and the old counter-props
atlas as the package identity reference. A second edit replaced decorative cream-shaped tops
with rigid plastic dispensing valves, triggers and short outlet spouts. Folded paper, screw caps,
brushed metal and pictorial cow/oat/cheese/caramel labels preserve the warm illustrated style.
Selected source: `C:/Users/manhl/.codex/generated_images/01a14ab1-c188-7150-89b0-4fd9a03a5998/exec-c651575a-e79d-42dc-a6ad-acfefff583a7.png`.
The PNG is copied directly, preserving its alpha; source and ingredient-detail crops live in
`equipmentArt.ts`. Counter, hand and order pictures all reuse this atlas.

Gameplay is unchanged. The carried object and its shadow leave the board together and return
together. Touch targets follow the new positions. Browser checks at 1284×800, 390×844,
375×667 and 932×430 verify tapping and dragging every milk and cream choice, correct ingredients,
and object/shadow restoration. Typecheck, production build, board-foot geometry and other gameplay
regressions pass. The existing native-shell fingerprint mismatch in `check-updates.cjs` remains.

[Board preview](board-equipment-preview.png).

## Generation prompt

```text
Use case: stylized-concept. Asset type: transparent 2x2 sprite atlas of four isolated boba kitchen ingredient packages. Image 1 is the kitchen CAMERA, LIGHTING AND STYLE reference ONLY. Image 2 is the existing package IDENTITIES reference ONLY; redesign its four packages with more realistic materials and proportions. Do NOT redraw the kitchen.
Output a 1536x1024 transparent RGBA image, exactly four separated objects in four quadrants, with generous transparent gutters and no extra objects. Upper left: fresh dairy milk carton, muted peach-pink and ivory paperboard, screw cap, a simple recognizable cow illustration printed on the front. Upper right: oat milk carton, muted sage green and ivory paperboard, screw cap, natural oat stalk illustration. Lower left: cheese cream dispenser can, creamy ivory label with a cheese wedge illustration, brushed stainless steel shoulder/base, ribbed collar and a realistic ivory dispensing nozzle. Lower right: caramel creme brulee dispenser can, warm caramel-gold and ivory label with a toasted custard swirl illustration, brushed stainless steel shoulder/base, ribbed collar and matching realistic ivory nozzle. All packages upright, complete and uncut. Each quadrant is 768x512: center each object horizontally at x384 or1152; object tops around y35 or547, feet around y477 or989. Cartons about230px wide and440px tall; dispensers about190px wide and430px tall. No objects touch quadrant borders.
Camera: consistent elevated three-quarter overhead view matching the kitchen, visible folded carton tops and elliptical metal shoulders, fronts mostly facing viewer with a modest right side visible. Refined warm hand-painted game realism: precise creased paper, subtle carton seams, softly rounded metal reflections, functional nozzles, warm rim highlights from upper right, soft form shading down left. Natural actual kitchen packaging, less toy-like, no thick cartoon contours, no shiny plastic cartons, no photorealistic photographic style. Clear readable cow/oat/cheese/caramel symbols at thumbnail size. No lettering, brands, UI, characters or watermarks. TRUE transparent background around every object, no checkerboard painted into art, no backdrop, no floor, no ground shadow; the game supplies contact shadows.
```

## Dispensing-head refinement

```text
Use case: precise-object-edit. Edit this transparent 1536x1024 four-package atlas. Change ONLY the dispensing heads on the two metal cans in the lower left and lower right. They currently resemble swirls of whipped cream. Replace each with an actual rigid ivory PLASTIC WHIPPED-CREAM AEROSOL DISPENSING VALVE: a short ribbed screw collar on the metal shoulder, a small angular horizontal trigger/lever and a short narrow outlet spout angled slightly left, with a tiny visible nozzle opening. No cream extruding, no cream swirl on top, no soft organic nozzle, no tall decorative curl. Both cans have the same practical dispensing-head design, with subtle molded plastic seams and realistic shadows. Keep the can bodies, yellow cheese illustration, amber caramel custard illustration, brushed metal shoulders, both milk cartons, folded paper, caps and cow/oats illustrations exactly unchanged. Preserve the four objects' locations, complete silhouettes, their separation, warm elevated three-quarter viewpoint, upper-right light, soft painted realism and TRUE transparent alpha. Full same-sized transparent atlas, no background, no floor, no cast shadow, no text, no extra objects, no cropping.
```

