# Whipped-cream dispensers

The cream choices are illustrated dispenser bottles with white nozzles, rounded metal bodies and
rolled bases. Cheese uses sage green with a cheese wedge; brûlée uses caramel gold with a toasted
cream spiral. They have no printed names or separate name tags.

`kitchenCreamCanSvg` in `src/art/kitchenEquipment.ts` defines the complete bottle. Its ingredient
picture comes from `ingredientMarkSvg`. `prepareEquipmentTextures` rasterises each once; the
counter and carried option use that same texture. `CREAM_CAN_ART` defines the 64×150 art box.
The counter object and shadow hide while held and return when it is put back.

The order panel uses the same bottle with an enlarged ingredient inset. Minimum display scale
keeps the counter art recognizable in landscape. Cream recipes and cream-in-cup rendering are
unchanged. See [visual orders](visual-orders.md).

Preview: [cream and milk equipment beside the visual order](visual-order-preview.png).
