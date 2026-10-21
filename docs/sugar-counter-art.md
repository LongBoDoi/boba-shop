# Sugar counter artwork

The current jar uses the user's attached artwork directly, including its original painted
cream “Sugar” plaque, hand lettering and diamond decorations. No label is drawn over it.
The supplied PNG is preserved in `tools/sheets/sugar-jar.png` and packaged by the script below.

Created with the built-in imagegen tool using the user's supplied kitchen design as the jar reference, and `kitchen-warm-extended.png` as the room edit target.

| File | Purpose |
| --- | --- |
| `src/assets/kitchen/kitchen-sugar-counter.png` | Active wider room, 2086×754 pixels, projected into a 2253×814 logical room |
| `tools/sheets/sugar-jar.png` | Transparent generated jar with a plain wooden front; baked-in name plaque removed |
| `src/assets/kitchen/sugar-jar.png` | Shipped transparent 282×364 cutout, twice its 141×182 room size |
| `tools/prepare-sugar-art.py` | Repeatable trim and downsample; preserves source alpha |
| `docs/sugar-counter-preview.png` | Browser preview at 390×844 |
| `tools/sheets/sugar-scoop.png` | Generated painted wooden scoop carrying sugar crystals |
| `src/assets/kitchen/sugar-scoop.png` | Transparent 400×242 carried scoop, preloaded with other kitchen artwork |
| `docs/sugar-scoop-preview.png` | Carried scoop preview at phone size |

The jar stands on the rear marble counter immediately left of the painted utensil caddy, with milk and cream to its left and toppings to its right. Its label is overlaid with “Đường” using the same cream plaque, border and Baloo lettering as the other equipment names. Milk bottles and cream tubs stand on the same counter plane as the jar; bottle shadows meet their painted feet rather than the transparent bottom padding. The floating sweetness plaque and added dots are removed. The existing sweetness steps, saved values and spoon carry behavior are unchanged.

The wider plate has no bottle ledge. All shelf, cup-rack, topping-tray, ice-box and counter anchors were remeasured against the delivered plate. These measurements live in `kitchenArt.ts` and `toppingGeometry.ts`, and the rack's measured stack tops now live with its other geometry.

Repackage the jar and scoop with `python3 tools/prepare-sugar-art.py` (Pillow required).

Validation: typecheck, regression suite, production build, and browser tap/drag checks at 1400×900, 390×844 and 375×667. The browser checks verify the carried texture is the sugar spoon and that both a tap and a drag increase sweetness. Native app shells were not built.

The baked-in English plaque is removed from the source sprite, including its cream panel,
decorations and border. The shared Vietnamese plaque is the only name tag on the jar.

## Generation prompts

### Brighter glass reflections

Edited with built-in imagegen, retaining clear alpha between stronger white reflection bands.
The earlier labelled jar is only a lighting reference; the current wooden front stays unlabelled
so the centred Vietnamese tag is rendered by the shared plaque helper.

```text
undefined
```

### Painted sugar scoop

Created with the built-in imagegen tool, referencing the jar for its wood and painting style.
The scoop keeps its native aspect ratio and uses the existing carry, tip and sweetness behavior.

```text
Use case: stylized-concept. Asset type: production transparent PNG carried-tool sprite for a cozy boba cooking game. Reference image: the supplied sugar jar establishes the EXACT honey-oak watercolor/gouache painting style and material of its little wooden spoon. Create ONE isolated wooden SUGAR SCOOP filled with white sugar, no jar. A shallow oval wooden spoon bowl at LOWER LEFT, handle rising diagonally to UPPER RIGHT, viewed slightly from above, approximately 100:64 overall silhouette proportions. Give it a rich honey oak wooden bowl with visible warm wood grain, a subtly curved lip, soft amber/brown shaded underside, thin caramel edge, a smooth gently tapered handle with rounded end and a delicate golden highlight. Bowl is generously loaded with a small appetizing heap of irregular sparkling white sugar crystals, a handful of tiny softly faceted sugar chunks similar to those in the reference jar, with warm ivory shadows and bright white edges. The sugar must be instantly readable on a 70px-wide phone sprite; clear rounded silhouette with a generous spoon bowl occupying the left half of the sprite, substantial handle occupying right half. White sugar should read as sugar crystals, not whipped cream, ice cubes, foam, rice, or a solid white blob. Same refined warm hand-painted watercolor detail, soft texture and delicate caramel outlines as jar, not flat vector, not photorealistic. Entire spoon and handle visible, no clipping. Center it tightly on a landscape transparent canvas with about 3% transparent padding. TRUE transparent alpha outside the spoon, no drop shadow, no floating grains, no aura, no haze, no checkerboard drawn into pixels, no ground plane, no words, no hands, no people, no extra objects. Produce the finished game sprite, not a mockup.
```

### Clear glass (current source)

The glass above the sugar has real alpha transparency, with only faint reflections retained.
The Vietnamese plaque is centred on the holder's flat front, below its raised rail.

```text
Use case: precise-object-edit. Edit target: supplied transparent sugar jar game sprite. Change ONLY the empty GLASS area above and between the sugar cubes and the lid to genuinely transparent alpha. The upper inside of the glass currently has opaque white/frosted painted fill: REMOVE that fill so a game background placed behind this PNG is plainly visible through the empty glass. It must be clear transparent glass, NOT frosted glass, NOT white milk, NOT an opaque white or beige rectangle. Keep only delicate thin glass edge highlights, amber glass rims and subtle translucent reflections (very low opacity), making most empty upper interior pixels alpha zero or at most 15 percent opacity. Keep the wooden spoon, sugar cubes, wooden lid, knob, entire plain wooden holder and wood texture opaque and exactly unchanged in design, proportions, position, color, scale. Preserve transparent pixels outside the object; no shadow, halo or backdrop. Do not add a name tag or any lettering: holder front stays plain wood. Preserve canvas and silhouette. Output a genuinely transparent PNG with the wall behind able to show through the upper jar.
```

### Remove the baked-in plaque (current source)

```text
undefined
```

### Jar extraction

```text
Use case: background-extraction. Asset type: production transparent PNG game sprite. Edit target: the supplied original warm boba kitchen DESIGN. Extract ONLY the exact sugar jar and its wooden square holder at source x974 to1115, y373 to555. Preserve that exact design, NOT a reinterpretation: cylindrical transparent amber-rimmed GLASS jar, flat oval honey-brown wooden lid with round amber knob, irregular little white sugar cubes heaped in bottom HALF only, thin wooden teaspoon leaning up towards the upper RIGHT inside the glass, square honey oak wooden holder with the raised side rails and front cream rectangular plaque with original caramel lettering Sugar and tiny diamond decorations. Match the original proportions 141 wide by182 tall and original warm fine watercolor brush texture. The source is a straight-on view with slight view down on lid. Preserve entire wooden base and small contact shadow. Remove all surrounding bottles, countertop, room, utensils and other objects; genuinely transparent background including glass above the sugar, glass should keep delicate rim highlights and warmth without a solid opaque white fill. Keep original silhouette and visual details exactly. Tight crop, minimal 2px transparent gutter, same 141:182 overall object aspect ratio. No redesign, no circles or dots on label, no new decorative elements, no thick vector outlines. The sugar jar must match the original supplied design precisely.
```

### Wider room

```text
Use case: precise-object-edit. Asset type: panoramic background plate for the existing interactive boba kitchen game. Image1 is the EDIT TARGET, existing empty kitchen background 1933x814. Image2 is a DESIGN REFERENCE only showing the target rear counter arrangement. Produce a wider 2253x814 panorama (add exactly320px horizontally in the MIDDLE, after the left tea shelving, not at edges). Keep original scale, original height, original straight-on camera and watercolor texture, every original vertical counter height. Preserve Image1 LEFT section x0..900 including cup rack, EMPTY two-tier tea shelving, foliage pixel-identically at same coordinates. Preserve Image1 RIGHT section starting with steel topping basin x1200 and ice box x1526 and window, shifting it exactly320px RIGHT with no scaling; final steel basin x1520..1858,y351..524, ice box x1846..2248,y308..524. Match Image1 whole foreground counter and wood bottom y752..814, rear marble counter front edge y553..585. This is only a center extension; never change the foreground counter heights or shelf heights.
Center replacement zone x900..1520: REMOVE completely the old small lower wooden bottle ledge at y390..434; this must be a plain cream wall above rear marble countertop. At x1370..1495 y374..550 paint the exact upright cream rectangular utensil/cup caddy seen just RIGHT of the sugar in Image2: black thick straws upright in left half and a short stack of clear plastic cups leaning in right half, little caramel heart on cream caddy front. Caddy stands on rear marble countertop. At x1225..1367,y373..555 leave clear blank wall/table space for the sugar jar which is an INTERACTIVE SEPARATE SPRITE. Do not paint the sugar jar itself. At x930..1215 y375..539 leave blank wall/table for interactive milk bottles and foam tubs. Keep existing floating shelf of stacked cups and brown straws above center at y270..286 but position it x1005..1362 so the sugar sprite space is exactly below its right end, as Image2. Keep GOOD TEA GOOD DAY plaque above. Preserve the framed milk tea poster on the right, moving with right part of room. Keep original lighting, sunbeams, plants, pale buttery plaster, honey oak. No jars, milk bottles, sugar jar, food, extra shelves, mats, people, UI. Steel topping basin must be EMPTY, tea shelves EMPTY. Make the room wider to leave enough physical space between existing left tea shelves, milk/foam, separately added sugar jar, painted utensil caddy and topping basin. Deliver complete panorama edge to edge.
```

### Extraction cleanup (final jar)

```text
Use case: background-extraction. Edit target: this sugar jar sprite. Remove ONLY the brown blurry glow/halo/drop-shadow surrounding the jar. Every pixel OUTSIDE the solid silhouette of the wooden holder, glass jar, lid and round knob must be COMPLETELY transparent alpha zero, clean crisp antialiased edges. There must be NO cast shadow, NO haze, NO brown glow, NO beige backdrop, NO outline beyond the existing painted object's contours. This is a clean cutout sprite to overlay on the game room. Preserve the jar and holder themselves EXACTLY: same original wooden lid, round knob, glass with transparent upper inside, half-filled white sugar cubes, spoon pointing up-right, wood holder and cream plaque with Sugar text and two diamonds. No redesign. Fit the object tightly to the image edges with just 2px fully transparent margin, 141:182 portrait proportions. The transparent glass must let the real game's cream wall show through. Most important: strictly zero alpha outside the object's edge, especially all around the knob, side walls, bottom and the 4 corners.
```
