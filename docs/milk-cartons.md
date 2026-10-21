# Milk cartons

The milk choices use paperboard cartons inspired by the kitchen reference: pink with a cow for
fresh milk, green with oats for oat milk. Enlarged ingredient illustrations replace printed names;
there are no separate name plaques.

The cartons are hand-painted sprites in `milk-cartons-frontal-v2.png`, with almost frontal
illustrated panels, straight upright walls, horizontal bases, a thin right edge, folded paper texture and soft daylight.
`equipmentArt.ts` supplies shared crops and proportional placement in a 72×154 frame with its painted foot at y150. Canvas prepares the
counter/hand textures once; `kitchenMilkCartonSvg` wraps the same artwork for the order panel.
The enlarged cow/oat insets also crop the painted packaging. See [art and prompt](milk-cartons-front-art.md).

The cartons are 66×141 room pixels, with their painted feet at y548. They stand together between
the tea shelf and the smaller cream bottles, which sit slightly farther back. Both follow the
background's scale in every orientation, and retain their counter dimensions when picked up.
Recipes and pour quantities are unchanged. See [visual orders](visual-orders.md).

Preview: [painted packages and order icons](painted-equipment-preview.png).
