# Whipped-cream dispensers

The cream choices are illustrated dispenser bottles with white nozzles, rounded metal bodies and
rolled bases. Cheese uses warm yellow with a cheese wedge; brûlée uses caramel gold with a toasted
cream spiral. They have no printed names or separate name tags.

The active cans are hand-painted sprites in `milk-cream-natural.png`, with brushed metal shading,
rolled seams, ribbed collars and realistic rigid plastic dispensing valves, triggers and short
outlet spouts. Their warm highlights match the kitchen. `equipmentArt.ts` supplies shared
crops for the package and its ingredient illustration. Canvas prepares counter/hand textures
once; `kitchenCreamCanSvg` wraps the same painted can for orders. The native frame is 64×150.
See [current art and prompts](board-equipment.md).
The counter object and shadow hide while held and return when it is put back.

The order panel uses the same bottle with an enlarged ingredient inset. Their 76×178 logical
frames sit on the right wooden board at x990/1200, with painted feet at y873/889; the actual
silhouettes remain smaller than the milk cartons on the left board. Contact shadows ground them
in the wood. Both scale with the background in landscape and retain their size when picked up.
Cream recipes and cream-in-cup rendering are
unchanged. See [visual orders](visual-orders.md).

Preview: [milk and cream on their boards](board-equipment-preview.png). Earlier [cream art](equipment-painted-art.md) remains a reference.
