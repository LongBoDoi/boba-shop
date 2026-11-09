# Muted storefront foliage

Asset: [storefront-potted-foliage-v4.png](../src/assets/title/storefront-potted-foliage-v4.png).
Created with built-in imagegen, editing v3 with the landscape neighborhood as the color reference.
The fence shrubs supply the darker olive palette; yellow canopy highlights are excluded.
Leaf highlights and internal contrast are reduced. Only the plant texture is sampled at one
texel per 1.5 native scene units to match the softer painted scenery. Root anchors are measured
before sampling, preserving the existing pot openings and wind pivots.

Final prompt:

```text
Use case: lighting-weather / style-transfer. Image1 is the EDIT TARGET, the existing transparent 1536x1024 three-plant foliage atlas. Image2 is the STYLE AND COLOR AUTHORITY: specifically match the darker olive shrubs along the bottom fence, NOT the pale yellow flowers or sunlit canopy. Keep the EXACT canvas size, positions, plant sizes, all three silhouettes, stems and root endpoints from image1; each plant remains in its original one-third cell. Change only the painted color and edge treatment of these three plants: substantially DARKEN the leaves, removing pale cream/yellow highlights; use dusty medium olive green base around #8F944F, shadow #747B43, and restrained highlights #A5A45E. Foliage must feel shaded, subdued and integrated with the background hedge rather than newly lit bright yellow. Reduce internal light/shadow contrast and sharp vein boundaries. Match the reference hedge's gently soft, slightly diffuse painted edges and modest fine watercolor texture; soften each leaf boundary slightly, equivalent to roughly 1 native pixel at its final game size. No hard vector edges, no bright glossy lighting, no dark outlines, no coarse grain, no sharp faceted shading. Preserve all opaque leaf interiors and original short stem structure, with gently antialiased edges. TRUE transparent alpha background, no surrounding glow, haze, cast shadows, pots, scenery, text, or new objects. Do not blur or edit the reference background. Only output the updated three-plant atlas.
```
