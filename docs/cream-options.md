# Whipped-cream dispensers

The cream choices are illustrated dispenser bottles with white nozzles, rounded metal bodies and
rolled bases. Cheese uses sage green with a cheese wedge; brûlée uses caramel gold with a toasted
cream spiral. They have no printed names or separate name tags.

The cans are hand-painted sprites in `milk-cream-painted.png`, with curved metal shading, rolled
seams, ribbed collars, dimensional nozzles and warm highlights. `equipmentArt.ts` supplies shared
crops for the package and its ingredient illustration. Canvas prepares counter/hand textures
once; `kitchenCreamCanSvg` wraps the same painted can for orders. The native frame is 64×150.
See [art and prompt](equipment-painted-art.md).
The counter object and shadow hide while held and return when it is put back.

The order panel uses the same bottle with an enlarged ingredient inset. Counter cans measure
50×117 room pixels, smaller than the milk cartons, with their bases at y536 behind the cartons'
y548 line. Both scale with the background in landscape and retain their size when picked up.
Cream recipes and cream-in-cup rendering are
unchanged. See [visual orders](visual-orders.md).

Preview: [painted packages and order icons](painted-equipment-preview.png).
