# Original wooden boards restored

Updated placement: [compact central boards](central-boards.md). Both boards still use the original artwork, now as independent clipped pieces. The following records the initial restoration before resizing.

Both boards and the lower counter render directly from the untouched 1672×941 first design, `kitchen-overhead.png`. A native texture frame starts at source y343, just above the boards. It is positioned using the original 1920×1080 coordinates plus the existing 350-unit upper-room extension. No new image generation, sharpening, or intermediate resampling is involved. The current upper room, tall rack and cup organizer remain in place.

The broad generated dairy-tray overlay is no longer loaded or rendered. Milk centers are x428/532 and cream centers x624/700, all with painted feet at y912, fitting closely together on the left board. Existing package artwork and directional contact shadows are retained.

The raised ice and sugar pans are separate, tightly cropped rounded sprites, avoiding marble rectangles over the wood. The old ice clearing patch is restricted to x0/y738, 258×178 in the 1452×1083 source space, below the boards.

Future background changes must preserve immutable originals and affect only the requested object's crop or mask. Do not reuse successively regenerated full backgrounds or broad strips.

[Desktop preview](raised-trays-preview.png) · [Phone preview](raised-trays-phone.png).

Validation: production build and regression suite; ice/sugar tap and drag checks on desktop and both phone orientations; package interaction checks. Production web assets copied into Android and iOS projects. Native binaries are not built here.
