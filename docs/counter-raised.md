# Raised counter and mobile framing

The counter's back edge now sits near halfway down the order page. Both paintings retain the
central entrance, cat motifs, warm lighting and a clear queue. The portrait menu moves to the
right of the front customer; the register and drinks have inset margins.

Active files, copied unchanged from the built-in imagegen outputs:

- `src/assets/counter/cafe-cats-raised-portrait.png`, 982×1602.
  Source: `exec-0a65df4c-6fe6-4686-9661-6f38474976d5.png`.
- `src/assets/counter/cafe-cats-raised-landscape.png`, 1945×809.
  Source: `exec-75fee52f-f115-4c47-9c1a-f292174aadb0.png`.

Sources are in `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`.
Edit targets were `cafe-cats-portrait.png` and `cafe-cats-landscape.png`; they remain unchanged.

`roomLayout.ts` fits the entire image width and anchors its measured tabletop edge near half the
page height. On short screens it crops spare ceiling. On tall screens it keeps the image top
visible and extends the last plain cabinet band to the bottom, without stretching the room,
props, counter or cookie display. `Backdrop` draws that band starting at its original source
position, so the join does not repeat a differently lit strip. No side of the room is cropped.

The register, serving mat, customer scale, doorway and foreground occlusion polygons were
remeasured against the new paintings. Phaser and the HTML register/carry-out cup share the
same projection. Customer service remains FIFO, one at a time.

Checks: build/typecheck, complete regression suite, and `check-counter-screen.cjs` at 320×740,
375×667, 390×844, 430×932, 568×320, 932×430 and 768×1024. The browser check covers foreground
occlusion, full room width, table height, order taking, serving, queue advancement, swiping and
pause. Capacitor copies the same build into Android/iOS; native devices are not exercised.

## Portrait prompt (built-in imagegen)

```text
Use case: precise-object-edit. Edit this portrait mobile game cafe background. Raise the entire foreground service counter so the BACK EDGE of its tabletop is exactly HALFWAY DOWN the image, y=50% of image height (currently about 66%). Recompose the upper cafe to fit: keep the centered rear glass double entrance fully visible, shorter open queue aisle directly from door to counter. Keep warm yellow ivory wood hand-painted crisp detailed style, cat motifs only, same furniture and plants and three pendant lights. No people or UI. Counter register LEFT with blank touchscreen, menu stand move to RIGHT of center beside finished drinks so central customer and serving mat have clear view; bell beside mat, pens and receipt holders. All counter props must fit comfortably INSIDE image edges, at least 6% image width breathing room left and right; slightly smaller register and finished-drinks display. Keep centered serving mat. Lower half of image shows countertop at top of lower half, cookie display shelf with CAT cookies and cabinetry below it, extend realistic wooden cabinet doors to bottom. Keep vertical centerline through door and serving mat. Maintain same portrait aspect ratio as input, high resolution crisp outlines and original fine texture, no blur. Visible tabletop back edge precisely at 50% height. Preserve the room's natural perspective; no stretching or squashing.
```

## Landscape prompt (built-in imagegen)

```text
Use case: precise-object-edit. Edit this wide landscape mobile game cafe painting, keep exact wide aspect ratio. Move entire foreground counter table UP so the BACK EDGE of the tabletop lies at exactly y=50% image height, instead of current77%. This is a major layout change, compress the visible floor aisle and reduce rear-room furnishings coherently in perspective, NOT stretching. Rear centered double glass entrance fully visible with clear narrow aisle from it to center counter. Keep warm yellow ivory polished wood crisp hand painted detailed style and cats only. Keep register LEFT blank screen, pens/receipt holders, menu stand RIGHT with finished drinks, centered serving mat and bell beside it. At least6% width padding left and right around counter props. No people or interface. Lower half contains tabletop around y50-67%, cookie shelf with CAT cookies around67-82%, beautiful wood cabinet doors tobottom. Rear room doorway at y15-36%, ceiling/lights/plants above, balanced left/right seating at y25-42%. Counter backedge straight horizontal exactly halfway down. Preserve design and crisp fine texture of original, coherent perspective, no blur. The new counter is MUCH higher in frame, leaving generous space for its shelf and cabinets in bottom half.
```
