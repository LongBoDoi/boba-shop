# Painted milk and cream packaging

The cream options use the original transparent, hand-painted atlas: [milk-cream-painted.png](../src/assets/kitchen/milk-cream-painted.png), 2087×753. It was generated with the built-in imagegen tool using the kitchen's background as the style reference. The original milk crops were replaced by [upright milk cartons](milk-cartons-front-art.md). PNGs are preserved as generated; crop bounds are rendering metadata.

`src/art/equipmentArt.ts` defines alpha bounds, front-illustration crops, and proportional placement in each native frame. Canvas draws those crops for the counter and carried item; the order panel uses the same painted packages and magnified printed details. `PRELOAD` includes the atlas so it is ready before play. Artwork stays wordless, retaining peach/cow, olive/oats, sage/cheese and caramel/swirl identities.

The current upright cartons use a 72×154 native frame, with their painted feet at y548 in the room. Cream cans retain the 64×150 frame, standing behind the cartons at y536. Painted proportions are preserved. There are no separate name tags.

Validation: production build and regression suite pass. The order-art check verifies atlas dimensions, crop bounds, proportional placement and preloading. Milk/cream taps and drags pass at 390×844 and 844×390, including equal dimensions on the counter and in hand. The 32px and 48px order icons were inspected. Native assets are copied from the same dist build; native binaries were not rebuilt.

[Equipment and order-icon preview](painted-equipment-preview.png)

## Generation prompt

Mode: built-in imagegen, transparent background.

Reference: `src/assets/kitchen/kitchen-sugar-counter.png` (style and lighting).

Use case: stylized-concept. Asset type: ONE transparent game equipment sprite atlas containing four isolated packaging sprites in a single evenly spaced horizontal row. Reference image is ONLY the art style and lighting reference: match its polished cozy hand-painted milk-tea kitchen, subtle watercolor/gouache texture, warm amber-brown linework, soft ivory highlights, convincing material shading, view slightly down onto the tops. Generate a landscape atlas, four equal-width columns, each object fully visible with generous transparent clearance and no overlapping. Objects from left to right: (1) a realistic folded paperboard whole-milk carton, dusty peach-pink and ivory, cream screw cap on sloping gable, visible folded ridge, subtle side panel and paper creases, large appealing COW HEAD illustration on front; (2) same paperboard carton family in muted olive/sage green and ivory with large golden OAT STALKS illustration; (3) a refillable whipping-cream dispenser/aerosol can, ivory body with sage green printed band, realistic curved cylindrical shading, rolled metal bottom seam, cream-white dispensing nozzle pointing slightly to right, large golden CHEESE WEDGE illustration on front; (4) same cream-can family, ivory body with warm caramel-gold printed band, large golden-brown SWIRLED WHIPPED CREAM with caramel streaks illustration on front. Keep every ingredient illustration prominent and readable at tiny game size. The cans are slimmer and slightly shorter than the cartons. All bases level, all objects viewed from the SAME slight elevated frontal angle. Natural upper-left warm daylight, softly painted bevels, dimensional cap threads and folds, organic subtle brushwork rather than a flat vector icon, high quality illustrated mobile cooking game assets. STRICT: actual transparent background; no kitchen, no counter, no floor plane, no cast floor shadows, no floating name plaques, no words, no text, no letters, no numbers, no logos, no watermark. Preserve strongly distinct peach cow / sage oats / sage cheese / caramel swirl identities. Do not add extra objects or whipped cream outside the cans. Supply all four upright objects in ONE row as a cohesive spritesheet.

