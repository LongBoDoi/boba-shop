# Painted tea dispensers

`src/assets/kitchen/tea-dispensers.png` is a transparent 1536 × 1024 atlas generated with the built-in imagegen tool, using the supplied kitchen illustration as the style reference.

`TEA_DISPENSER_ART` measures each sprite's bounds, foot line, tap outlet and blank label. `TeaDispenserArt` displays these regions directly, preserving the generated PNG. The six tanks share their painted shape and lighting, with a separate liquid color for each existing tea. Vietnamese names and the active-tank outline remain native UI.

The shelf has fixed slots: black, green and oolong above; taro, matcha and Thai below. Ingredients retain their existing unlock days. Each tank is 198 background pixels wide; its feet meet the wooden shelf faces at y=308 or y=523, with its tap extending below the edge. Cup docking and the pouring stream use the measured tap outlet.

[Phone preview](tea-tanks-preview.png).

Validation: typecheck, existing regression tests and a production web build pass. Browser checks at 375 × 667, 390 × 844 and 768 × 1024 cover every unlocked tank in both rows, correct tea IDs after pouring, cup docking, and docking and pouring after horizontal panning. Early-day ingredients retain their fixed positions. No native simulator was run.

## Generation prompt

```text
Use case: stylized-concept.
Asset type: one transparent production sprite atlas for a mobile milk-tea kitchen game.
Input references: the user's illustrated warm beige boba kitchen is the STYLE and tank-design reference. The empty kitchen background is just supporting room palette.
Create exactly SIX isolated tea dispenser sprites in a regular THREE COLUMNS by TWO ROWS grid on a genuinely transparent background, all the same size, shape and front-facing camera angle. Canvas landscape 3:2, generous transparent gutters so none touch. Each tank fills its own equally sized grid cell and is fully visible including feet and long tap.
Match the user's reference tank design extremely closely: broad squat cylindrical transparent glass reservoir, softly rounded corners, low domed dark chocolate-brown lid with an elliptical recessed top and caramel brush highlights, dark brown shallow base ring with little outward supporting feet at both bottom corners, simple dark brown vertical lever spigot at the lower front center hanging below the feet. Body roughly as wide as tall; overall sprite including lid and tap approximately 0.88 times as wide as tall. Rich translucent tea inside, bright elliptical meniscus about a third of the way down, warm cream elongated glass reflections, tiny restrained glints at surface. Brown ink outlines, gentle painterly gouache shading, softly textured but smooth color areas, NOT vector-flat, NOT shiny 3D or photorealistic. Cozy warm honey/cream/chocolate palette.
Each tank has a small cream parchment label on the front glass, centered horizontally, about 35% body width by 24% body height, amber outline and a tiny decorative leaf at its top; the LOWER TWO THIRDS of this label must remain completely BLANK for in-app Vietnamese text. No letters anywhere.
Only liquid colors differ by cell. TOP ROW: left deep chestnut/reddish black tea; middle muted golden olive green/jasmine tea; right rich translucent golden amber oolong. BOTTOM ROW: left gentle muted lavender taro; middle deep olive matcha green; right bright warm amber-orange Thai tea. All six frames and label locations identical. No extra equipment, no shelves, no cups, no background scenery, no floor, no checkerboard, no drop shadows beyond the individual feet. Preserve real transparent space outside every silhouette. Keep hand-painted small details readable when sprites are displayed around 90 pixels wide, avoid dense fine-line textures.
```
