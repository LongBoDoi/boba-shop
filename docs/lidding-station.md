# Lidding machine

Current kitchen: [overhead redesign](overhead-kitchen.md). The new plate keeps the same
insertion, press, straw and serving rules, with remeasured machine coordinates. Lidded cups
return to the right finishing mat. The restoration below records the previous side-view version.

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
