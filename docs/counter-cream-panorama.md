# Cream counter panorama

The counter uses a light ivory and honey wood painting with extended seating, shelves, plants and
pastries. Landscape is a 2172×724 room; portrait keeps its tall composition and adds 20% horizontal
width so both layouts can be panned. `counter/roomLayout.ts` measures the cash register, central mat,
door and queue against the paintings. The Phaser camera pans the painting, guests and independently
drawn cats together. The HTML register and finished cup follow `uiState.counterPan`. Horizontal
drags pan the room; tabs and service actions move between Quầy and Pha chế. Cat taps trigger a short
hop, a heart and the existing meow sound, with a brief repeat guard. Idle breathing and swaying stop
when reduced motion is requested.
The door hinge and glass coordinates were remeasured for the wider painting. Its garden opening is
reconstructed from nearby pixels of the current artwork, keeping old peach door patches out of the
new cream room.

Assets produced with the built-in image generation tool and saved in the workspace:

- `src/assets/counter/cafe-cream-panorama-v1.png`: final palette edit of a new wide counter room.
- `src/assets/counter/cafe-cream-portrait-v1.png`: palette and cat-removal edit of the existing
  portrait room.
- `src/assets/counter/cafe-cats-atlas-v1.png`: transparent six-cat atlas; the game crops four
  complete silhouettes and places them independently.

Final prompts: “Wide horizontal cat cafe counter panorama matching the user's pale ivory, vanilla,
honey wood and peach reference; centered glass door, cat-ear pendant lights and chairs, jars,
greenery, seating, pastry case, register, bell, tissue box and gingham mat; extend both sides with
coherent details, no baked cats.” “Keep all panorama geometry; lighten only its palette to airy
ivory, desaturated blush and natural sage.” “Keep all portrait room geometry and objects, lighten to
the same palette and remove baked cats, filling the shelves naturally.” “Create a 3×2 sheet of
complete small calico cats with soft brown linework on a genuinely transparent background; remove
all background and shadow.”

Validation: `npm run build`, `npm test`, `tools/check-counter-screen.cjs` and the local browser pan
check at 390×844 and 932×430. Preview screenshots are `docs/counter-cream-390.png` and
`docs/counter-cream-932.png`; the corresponding `-left` and `-right` files show both ends.
`docs/counter-cream-door-open.png` shows the remeasured door mid-animation.
