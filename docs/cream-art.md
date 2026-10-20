# Painted cup cream

Generated with the built-in image generation tool using the `imagegen` skill. The original
transparent PNG is preserved at `src/assets/kitchen/cup-cream-painted.png` (1402 × 1122).
No background was added and its alpha channel is preserved.

The active sprite is `src/assets/kitchen/cup-cream-contrast.png`, edited with the built-in image
generation tool to improve visibility against the ivory cup and pale yellow kitchen. It preserves
the shape and transparent framing, with warm caramel fold shadows and a fine brown silhouette
contour. The original lighter sprite stays available as the source.

`src/kitchen/creamPainter.ts` crops the transparent padding while drawing, preserves the upright
folds, and projects the lower contact area onto the tea's oval. The two flavour finishes are:

- **Cheese cream:** ivory folds, pale cream layer and softly white mixing plumes.
- **Brûlée cream:** a golden custard palette preserving the painted luminance, with torched caramel
  patches and deterministic sugar flecks along exposed folds. The settled layer and mixing plumes
  use a matching golden colour. `finishBrulee` applies the finish while the image is cached.

Both reuse the source silhouette, preserving perspective, contact geometry and glass depth. The artwork is loaded with the other
kitchen assets and cached during loading. It is composited behind the near glass and cup lip.

The contact edge is composited per drink colour in `settleCreamContact`: it removes the dark
cut-out contour only at the wet foot, absorbs some tea colour, and feathers through a narrow,
slightly uneven meniscus. `creamDensity` computes five curved mixing plumes (22–36 cup-art
units deep) as soft concentration fields, with brighter cores, faint branching threads and wider
diffusion clouds near their tips. This replaces the earlier sharp ribbon silhouettes. The shared
field is baked during loading; `meltingArt` colours and caches it per flavour and drink. Plumes
start behind a continuous settled cream layer, about 7 cup-art units deep, following the surface
oval with a diffuse uneven lower edge. Gentle side lighting, underside shading and sparse shaded
microbubbles give the layer volume. Layer and plumes are clipped to the liquid silhouette,
so empty cups and shallow
fills cannot show hanging trails outside the drink. It does not change the tea fill or alter the
painted folds above the edge. These colour variants are cached. `creamSurface` lifts the mound and contact layer progressively with fill, by 8 cup-art units at
full, keeping most of the mound above the near lip. The curved lower edge still touches the tea;
the mixing layer stays clipped to the actual liquid. The texture reserves 40 units of headroom
so the peak can rise above the mouth without lowering the tea.

The preview is `docs/cream-preview.png`. Inspect at actual cup size as well as enlarged: the folds
must read clearly without becoming a smooth tube or a stack of flat tiers.

Exact generation prompt:

> Use case: stylized-concept. Asset type: a single transparent PNG game sprite, whipped cream ONLY, no cup. Primary request: premium hand-painted whipped cream piped with a star nozzle, for the cozy golden illustrated bubble-tea kitchen game in the conversation. Make it appetizing and soft, with a distinct elegant swirl, 2.5 overlapping turns and a delicate gently hooked peak. Cream should have clearly visible fine longitudinal star-nozzle grooves which flow continuously around the spiral, soft organic unevenness, luminous warm ivory highlights and delicate warm beige occlusion shadows, no dark outlines, no hard bands. Camera: slightly above and in front, looking down 14 degrees so the upper ridged surfaces are visible; horizontal bottom footprint ellipse with depth-to-width ratio about 0.235, same perspective as a boba cup's tea surface. Silhouette: broad soft settled bottom, medium height (total height about 0.6 of the base width), tapering elegantly, no separate flat plate or pedestal. Lighting from upper left. Style: painterly polished 2D food illustration, subtle brush texture, warm creamy white, NOT plastic, NOT smooth featureless 3D tubing, NOT a poop icon, NOT a simple stack of smooth rings. Entire isolated swirl centred with generous transparent margins; base fully visible, no cast shadow outside the cream, no checkerboard baked in, no background, no text, no toppings, no utensil, no cup. Strong readable fluted folds at a final display size of only 60px wide. Generate the sprite itself, not a mockup or sheet.

Contrast edit prompt (input: `src/assets/kitchen/cup-cream-painted.png`):

> Use case: precise-object-edit. Edit this transparent whipped-cream game sprite ONLY to improve readability against an ivory-white cup and warm pale yellow kitchen. Preserve its exact silhouette, curl, piped folds, composition, placement, camera angle, proportions and transparent background. Change only its colour values, edge definition and shading. Keep luminous ivory highlights, but deepen the main midtones to warm biscuit cream and the fold recesses to soft toasted caramel/taupe. Add a thin, soft, darker warm-brown contour following the silhouette and fine darker definition in the nozzle grooves so this cream is clearly visible at 60 pixels wide on an off-white background. Edge should feel hand-painted, NOT a hard black cartoon stroke or a dark halo. Concentrate shadow on the right and underside of the folds, retain a fresh white creamy appearance on lit planes. Stronger local contrast and readable curled peak. Do not turn the whole object brown or yellow. No chocolate, sprinkles, extra decoration, cup, background, cast shadow, text or other objects. Preserve actual alpha transparency and exact framing; do not crop or reposition the cream.

## Painted rim alignment

The foreground split is traced from `cup.png`, not from the tea oval. The actual near lip crosses
the centre around y29–31 in the 113 × 174 cup sprite. The earlier split crossed at y35.5 and missed
that lip, leaving cream in front of it. `CUP_NEAR_GLASS` and `CUP_NEAR_LIP_BAND` in
`cupGeometry.ts` now select the real near arc. The front lip is composited after cream regardless
of fill; the far arc stays behind the cream. Tea level and cream position are unchanged.
