# Topping station artwork

Generated with the built-in imagegen tool, with a transparent background.
The source sheet is `tools/sheets/topping-shelf-boxes.png`.
Run `python3 tools/cut-topping-boxes.py` to extract the seven container sprites into
`src/assets/kitchen/topping-box-*.png`. Cropping preserves the generated alpha;
the containers are padded to a shared 256×264 box with their feet aligned.

The upper shelf slots are pearls, popping pearls and pudding. The lower slots are
pandan, lychee and grass jelly. An empty container fills each not-yet-unlocked slot.
Existing carried scoopfuls and individual toppings inside the cup are reused.

## Generation prompt

Use case: stylized-concept. Asset type: one production sprite sheet for a cozy illustrated mobile boba tea shop game. Create a SINGLE transparent PNG sprite sheet with seven SEPARATE upright countertop topping storage containers arranged in a strict 3-column by 3-row grid (last row contains just one empty container at left, remaining two cells blank transparent). All seven containers have IDENTICAL front-facing shapes, scale, dimensions and viewpoint. Each is a square upright clear-glass box about as wide as tall, with a subtle shallow perspective top, a closed flat brushed stainless-steel silver lid with a small dark recessed handle centered on front of lid, thin silver frame and base, rounded small corners, softly shaded transparent glass sides and restrained white glass glints. The viewer looks almost straight at the FRONT vertical window, very slightly down onto the lid. This is NOT a shallow open tray, NOT a jar or drink tank, NO scoop inside or outside, NO wooden shelf or background, no sign, no text. The top quarter of the glass window is empty clear glass; the bottom three quarters show a densely filled pile of glossy round boba/jelly spheres with beautiful small highlights and rich saturation. Cells in reading order: top row dark chocolate brown tapioca pearls; bright cherry red popping pearls; golden yellow pudding balls. Middle row vivid lime green pandan jelly balls; creamy ivory white lychee jelly balls; very dark blue-black grass jelly balls. Bottom left one IDENTICAL container completely empty, clear glass window genuinely see-through. Keep generous TRANSPARENT gutters between cells: none touches another, no shadows or objects span gutters. Keep all entire silhouettes including lid and bottom visible, no cropping. Match polished hand-painted 2D casual cooking-game artwork: warm colors, delicate dark brown outlines, soft luminous airbrush shading, shiny spheres, brushed metal lid. Container front must be prominent and vertical like a square glass pantry box on a kitchen shelf. A real alpha background, not a checkerboard painted in. Canvas landscape or square fitting the 3x3 grid; uniform margins. No extra accessories, lettering, numbers, logos, dishes or people.
