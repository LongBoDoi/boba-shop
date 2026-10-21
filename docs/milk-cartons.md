# Milk cartons

The milk choices use paperboard cartons inspired by the kitchen reference: pink with a cow for
fresh milk, green with oats for oat milk. Enlarged ingredient illustrations replace printed names;
there are no separate name plaques.

`kitchenMilkCartonSvg` in `src/art/kitchenEquipment.ts` draws the folded gable, sealed ridge,
shaded side, white cap and illustrated front. `milkIngredientSvg` supplies the shared cow/oats.
The 72×154 art box has its painted foot at y150. `prepareEquipmentTextures` rasterises the art
once for the counter and carried tool. The order panel uses the same SVG carton and a larger
ingredient inset.

The cartons are 66×141 room pixels, with their painted feet at y548. They stand together between
the tea shelf and the smaller cream bottles, which sit slightly farther back. Both follow the
background's scale in every orientation, and retain their counter dimensions when picked up.
Recipes and pour quantities are unchanged. See [visual orders](visual-orders.md).

Preview: [milk and cream beside the visual order](visual-order-preview.png).
