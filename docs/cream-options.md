# Whipped-cream dispensers

The cream choices are illustrated dispenser bottles with white nozzles, rounded metal bodies and
rolled bases. Cheese uses sage green with a cheese wedge; brûlée uses caramel gold with a toasted
cream spiral. They have no printed names or separate name tags.

`kitchenCreamCanSvg` in `src/art/kitchenEquipment.ts` defines the complete bottle. Its ingredient
picture comes from `ingredientMarkSvg`. `prepareEquipmentTextures` rasterises each once; the
counter and carried option use that same texture. `CREAM_CAN_ART` defines the 64×150 art box.
The counter object and shadow hide while held and return when it is put back.

The order panel uses the same bottle with an enlarged ingredient inset. Counter cans measure
50×117 room pixels, smaller than the milk cartons, with their bases at y536 behind the cartons'
y548 line. Both scale with the background in landscape and retain their size when picked up.
Cream recipes and cream-in-cup rendering are
unchanged. See [visual orders](visual-orders.md).

Preview: [cream and milk equipment beside the visual order](visual-order-preview.png).
