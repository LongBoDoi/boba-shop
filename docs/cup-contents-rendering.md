# Ingredients behind the glass

The preparation cup uses the shared Canvas renderer on web, Android and iOS. The room background,
holder position, cup outline, ingredient quantities and game rules are unchanged by this pass.

- Liquid has deeper tank-inspired pigments and warm transmitted-light highlights. Cached brush
  washes and grain give each tea painted texture; soft swirls, glints and tiny bubbles move slowly
  inside the drink. Milk uses the softer milky palette, with additional mixing ribbons during pouring.
- Ice retains its stable layout and whole-outline containment. Broad translucent faces have cool side shading,
  clearer contours and bright wet edges instead of prominent fine cracks. Submerged facets take
  a restrained tea-colour wash and retain readable contrast even in milk. Their reflections
  remain behind the cup wall. The browser regression checks all six milk-tea palettes.
- All nine toppings retain their painted identities. Stable size/angle/position variation loosens
  the bed. Rear pieces are softer and more strongly tinted by liquid; front pieces remain readable.
  Wet tinting uses the sprite alpha rather than approximate silhouette shapes, avoiding halos.
- Syrup makes a small amber pool in an otherwise empty cup and dissolves during the first shallow pour.
- Cheese and brûlée retain their different painted folds and colours. The swirl sits in a thin
  foam bed at the tea’s actual surface, with short fading wisps beneath its near edge. The mound
  clears the side walls and stays behind the rolled front lip.

The rear floor is painted before the liquid. The near wall’s reflection covers the whole drink,
including the topping bed. `frontWall()` caches a foreground version of the glass: within the
existing inner-floor mask, a strip of wall above the back base arcs continues to the curved floor.
This prevents the far base ring appearing across the front of the pearls, without removing the
outer base, changing the cup silhouette, or adding a hard horizontal reflection cutoff.

`tools/check-cup-contents.cjs` checks 11,520 ice outlines, dry-to-wet continuity, topping clearance,
and cream seating. The optional `tools/check-cup-rendering.cjs` runs against Vite with Playwright:
it checks actual painted pixels for containment across 132 combinations, stronger ice occlusion
in milk, and syrup visibility/dissolution. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` to use local
installations if needed. Its paint timing is a desktop browser diagnostic, not a device benchmark.

Browser review also covered S/M/L at 390×844, 375×667, 932×430 and 1284×610, including pickup.
The build and regression suite pass. Capacitor assets are copied into both native projects;
Android/iOS binaries were not built or run on devices.

- [Drink comparisons](cup-ingredients-comparison.png)
- [Phone kitchen](cup-ingredients-390.png)
- [Small phone](cup-ingredients-375.png)
- [Landscape kitchen](cup-ingredients-932.png)
- [Desktop kitchen](cup-ingredients-1284.png)

## Lid and straw

The inside of the straw is part of the drink compositor, not the foreground finishing overlay.
It reaches y155, just above the curved floor. Rear ice and topping rows are drawn before it;
near pieces, cream and the cup wall follow it. The tube is clear in air and tea-tinted under the
surface, with enough definition to remain readable in milk. It enters at the middle of the liquid
oval, with a tight meniscus and a slight refractive shift, rather than at the far edge. Its painted end caps
keep their proportions while the straight shaft extends. The exposed straw begins at the lid
opening, y−35, and stays in the finishing overlay above the lid.

The lid’s rear sealing arc is painted behind the contents. Its dome reflection and front rim
are painted over them, preventing the back arc from cutting across a full cream swirl.
`CupView.setFinish` invalidates the drink texture when either finishing state changes, including
removal or replacement. The browser pixel check also verifies cream occlusion, stronger straw
occlusion in milk, and that the inserted tube does not reach below the floor.

Lid-only and lid-plus-straw states were checked for S/M/L in phone and landscape layouts.
See [finished-cup comparisons](cup-finished-comparison.png) and the
[finished cup in the kitchen](cup-finished-390.png).

## Painted tea and motion

`teaPainter.ts` matches the six tank colours with concentrated pigment and brighter transmitted
light. Deterministic brush washes and fine grain are baked once per palette. Soft strokes animate
inside the body; curved glints and small bubbles follow the surface oval. All layers remain
behind the ingredient and glass compositor, including the finished cup.

Ambient motion uses a separate nine-second clock and at most 24 idle texture uploads per second.
It freezes when the shop is paused, the kitchen leaves view, or reduced motion is requested.
Pouring retains its faster ripples and milk-mixing motion. The renderer test checks that ambient
frames differ and the loop joins without a jump, in addition to containment and finishing checks.
Browser checks covered S/M/L, completed cups, pause/resume, page changes and reduced motion.

- [All six tea palettes, with milk and finishing variants](cup-tea-palette.png)
- [Tea on the counter](cup-tea-390.png)
- [Completed drink](cup-tea-finished.png)

## Milk colour and straw depth adjustment

Milk now blends the concentrated tea pigment partway toward the creamy recipe colour, with a
small tint from the selected milk. The pixel regression checks that all six teas retain their
colour separation after milk is added. The straw uses a tea-tinted texture through the wet part;
cream still hides it and its tip still clears the floor. Front/rear ingredient grouping is applied
only when a straw is inserted, preserving the unsealed cup’s arrangement.

[Milk colours and submerged straws](cup-milk-straw-palette.png).

[Ice visibility across all six teas](cup-ice-contrast.png).
