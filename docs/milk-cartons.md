# Milk cartons

The milk choices use paperboard cartons inspired by the kitchen reference: pink with a cow for
fresh milk, green with oats for oat milk. Enlarged ingredient illustrations replace printed names;
there are no separate name plaques.

The active cartons are hand-painted sprites in `milk-cream-natural.png`, with folded paper,
screw caps, natural seams, visible top/side planes and warm directional light matching the room.
`equipmentArt.ts` supplies shared crops and proportional placement in a 72×154 frame with its painted foot at y150. Canvas prepares the
counter/hand textures once; `kitchenMilkCartonSvg` wraps the same artwork for the order panel.
The enlarged cow/oat insets also crop the painted packaging. See [current art and prompts](board-equipment.md).

The cartons stand on the left wooden board at x280/520, with painted feet at y876/893. Their
118×252 logical frames preserve the artwork's proportions. Cream occupies the right board.
Soft contact and cast shadows follow the packages' feet. Both follow the
background's scale in every orientation, and retain their counter dimensions when picked up.
Recipes and pour quantities are unchanged. See [visual orders](visual-orders.md).

Preview: [milk and cream on their boards](board-equipment-preview.png). Earlier [carton art](milk-cartons-front-art.md) remains a reference.
