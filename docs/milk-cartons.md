# Milk cartons

The milk choices use paperboard cartons inspired by the kitchen reference: pink with a cow for
fresh milk, green with oats for oat milk. Enlarged ingredient illustrations replace printed names;
there are no separate name plaques.

`kitchenMilkCartonSvg` in `src/art/kitchenEquipment.ts` draws the folded gable, sealed ridge,
shaded side, white cap and illustrated front. `milkIngredientSvg` supplies the shared cow/oats.
The 72×154 art box has its painted foot at y150. `prepareEquipmentTextures` rasterises the art
once for the counter and carried tool. The order panel uses the same SVG carton and a larger
ingredient inset.

The milk/cream row packs between the tea shelf and sugar jar. Minimum display scale keeps the
pictures recognizable in landscape; the painted bases stay on the sugar holder's y541 counter
line. Recipes and pour quantities are unchanged. See [visual orders](visual-orders.md).

Preview: [milk and cream beside the visual order](visual-order-preview.png).
