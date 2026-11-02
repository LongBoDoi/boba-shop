# Lid stack

The machine has been replaced with nested clear cat-ear dome lids. Tap the stack to dispatch
`LID_CUP` immediately: the drink stays on its holder, with no loading movement or timed cycle.
Dropping a cup onto the stack also lids it. Swiping across the stack pans without applying a lid.
An empty cup cannot be lidded, paused games cannot finish drinks, and a lid is applied only once.
The straw and serving requirements are unchanged.

Old saves containing a cup in the machine are validated first, then restored unfinished on the
holder. The simulator now models lidding as one tap, with zero machine wait. Historical timing
baselines remain unchanged.

## Artwork

The active stack is now painted directly into `kitchen-unified.png`; see [unified kitchen](unified-kitchen.md).
The separate patch below is retained only as historical source artwork and is not loaded.

`src/assets/kitchen/cat-lid-stack.png` is a 306×328 crop at (1036, 248) of the generated room.
Only this local patch is composited over the original room, with six-pixel edge feathering.
The original background file is unchanged. The hit target follows the visible stack at
(1110, 322), size 200×210 in the original 1452×1083 room coordinates.

Generated with the built-in imagegen tool from `kitchen-room-counter-cups.png`:
`/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-2dd8e5d5-7c3b-4086-9eab-efb4d257d7d1.png`.

Prompt:

> Use case: precise-object-edit. Edit target: attached kitchen room painting. Replace ONLY the peach and cream lidding/sealing machine at the right (approximately x1080..1330 y267..560 in this 1452x1083 image) with a neat stack of 6 nested clear plastic dome cup lids with subtle cat-ear corners, circular sealing rims and a small straw hole on top. Stack rests directly on the same countertop, base near y542, centered x1205, width about185 pixels, height about155 pixels. Clear translucent warm ivory plastic with crisp taupe contours, white highlights and visible nested rims, hand-painted illustration matching existing cup stacks. Small realistic contact shadow. Remove ALL parts of the machine, rolls, bay and its shadow, reconstruct the warm wall and countertop behind it. Preserve absolutely everything else in the image including original framing, dimensions, shelving, cups, boards, bins, straw holder, wall light and sharpness. No text, labels, new tray, machine or extra objects.

Validation: build/typecheck and regression suite; browser clicks at 390×844 and 932×430 for
S/M/L, empty cups, duplicate taps, swipe cancellation and adding a straw. Simulator smoke checks
for days 1, 7 and 30 confirm zero machine wait. Web assets copied into Android and iOS; native
device execution is not covered.

The sections below record the retired machine design.

## Previous side-view restoration

The game uses the original attached design directly:
`src/assets/kitchen/kitchen-lidding-machine.png` (2146×733).
The original window, wall, topping tray, ice box, machine and straw box are restored.
The topping grid, ice target, machine bay, cup scale and press crop use that painting's measurements.

The retained original PNG and its initial generated source have the same SHA-256:
`0678054c11547f763a5514ca1f479fbf9c71f7d9a2e3e96a17173556687f47b9`.
Restoration selects that file byte for byte.

Prepare the drink, then drag the cup into the machine's bay to the right of the ice box.
Tapping the machine carries the cup into the same bay. Once the cup arrives, a 1.1-second
press cycle lids it and returns it to the mat. Tap or drag a straw from the box beside the
machine before serving. Pulling out the cup cancels the cycle; pausing suspends it.

The reducer enforces LOAD_LIDDER → LID_CUP → ADD_STRAW. Saves retain machine placement
and finishing progress. Resizing restores the cup inside the machine. Ingredients cannot
be added while it is in the machine or after lidding.

Validation for the restoration: `npm run typecheck`, `npm test`, `npm run build`.
Desktop Chrome at 390×844 and 932×430 verifies the exact image hash loaded by the browser,
all nine topping targets, ice, cup insertion, lid, straw and perfect serving.
[Restored game preview](original-design-restored-preview.png) · [Cup inside machine](lidding-machine-preview.png)

Original artwork source:
`/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-21ca575b-0a02-473b-93b8-f1c85862e411.png`.
The later artwork variants remain as reference files and are not the active background.
