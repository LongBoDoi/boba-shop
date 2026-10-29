# Cat cup rack and straw box

The preparation room now uses the user's ivory cat-themed organizer designs: three clear nested
cup stacks with integrated S/M/L cat medallions, and a matching box of individually wrapped white
straws labeled “Ống hút”.

Only two cropped patches are loaded, from `src/assets/kitchen/cat-cup-rack.png` (422×303) and
`src/assets/kitchen/cat-straw-box.png` (124×260). Their room-pixel rectangles and feather margins
live in `KITCHEN_ORGANIZER_PATCHES`. The original room and original counter PNGs are unchanged.
Feathering affects only each crop's outer wall/marble margin. Artwork, lettering and outlines
inside the crops remain opaque and sharp. No regenerated full-room image is shipped.

Cup picking follows the new rack bounds x656..1024, y270..527, with stack tops 325/302/270
in the 1452×1083 room source. The straw target follows x1334..1440, y314..548.
These source measurements convert to shared logical room coordinates for every viewport.
The previous separate paper S/M/L labels are removed; the labels now belong to the painted rack.

## Artwork provenance and prompt

Created with the built-in imagegen tool, using the user's two reference designs and the existing
room as the edit target. Source output: `exec-7c7876e1-dcf3-40c1-a4f9-6435a6172acd.png`.
Native-resolution crops were extracted with macOS `sips`; no resizing or re-encoding of the
original kitchen backgrounds.

```text
Use case: precise-object-edit. Edit ONLY the cup organizer and straw holder in the LAST image (the 1452x1083 kitchen room). The two user reference images show the exact new designs. Preserve the kitchen room composition, perspective, scale, surrounding wall and marble, shelving, sealing machine, boards, pans, lighting and all other pixels. Output the same full room framing and aspect ratio.
Replace the existing wood cup rack at image pixels x685..1025, y310..518 with the cream ivory painted wooden rack from the first reference: three upright compartments holding nested inverted CLEAR plastic cups, S short left, M medium middle, L tall right; warm ivory rounded side walls and front with outlined cat-head medallions, brown S M L lettering in respective medallions, tiny paw and sparkle accents. The footprints and stack centers must remain the same (745,847,956). Make the front fascia slightly taller to accommodate the cat medallions, with bottom staying y518. Cups have crisp silver-gray outlines, transparent warm glass reflections and many distinct stacked rims. No floating tags.
Replace ONLY the existing small orange straw holder at far right x1338..1440, y388..551 with the second reference design at the SAME position and footprint: ivory cream square open box, subtle rounded edges, filled with pale individually wrapped clear/white drinking straws, cat-head outline medallion on front, brown Vietnamese text exactly "Ống hút" and paw print, small paw motifs on left side. Slightly elevated kitchen viewpoint, visible top and left face, believable contact shadow. Keep the straw bundle within y385..480 and box bottom y551. Do not change or overlap the sealing machine to its left.
Match the polished hand-painted cozy kitchen illustration style, crisp detailed edges and soft warm shading. Do not zoom, crop, move other objects, blur the background, add extra props, or redesign the room.
```

## Validation

Browser interaction checks cover 1284×800, 390×844, 375×667 and 932×430: each S/M/L stack
selects its matching size, and the new straw box adds a straw to a lidded drink.
The production build/typecheck and regression suite pass. Capacitor copies the same assets
to Android and iOS; native binaries and devices were not tested.

[Desktop](cat-organizers-rack-1284.png) · [Phone rack](cat-organizers-rack-390.png) ·
[Phone straw box](cat-organizers-straw-390.png) · [Landscape](cat-organizers-straw-932.png)

