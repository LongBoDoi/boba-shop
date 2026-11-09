# Peach cat cafe counter

The current landscape plate is `cafe-peach-panorama-v8.png`; see [cookie box perspective match](counter-cookie-perspective.md) for the current perspective, pixel preservation and prompt. The earlier [local alignment repair](counter-alignment.md) remains historical. Original plates and generation history follow.

The current Counter screen follows the user's supplied peach cafe reference: muted cream/peach watercolor grain, olive plants, cat-ear lights and register, cat chairs, a covered cookie display, gingham serving mat and curved pastry case. All fixed objects are painted into each continuous room plate. The previous plates remain archived; no kitchen or title pixels are changed.

Assets generated with the built-in imagegen tool, copied unchanged:

- `src/assets/counter/cafe-peach-panorama-v1.png` (1942×809), source `exec-9003bbd4-ee08-47ae-a046-8e3d172779ef.png`.
- `src/assets/counter/cafe-peach-portrait-v1.png` (1024×1536), source `exec-5fc8b880-941e-405a-882a-594afb0d693a.png`.
- `src/assets/counter/cafe-peach-landscape-v1.png` (1536×1024), first style/layout plate used as the reference for both compositions, not imported by the game.

Generated sources are in `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`. The portrait intermediate is `exec-9bf86195-e066-4350-834b-9d0e4878940f.png`; the final inset edit gives the register and pastry case breathing room on mobile.

## Integration

`roomLayout.ts` fits the full image width without stretching props, keeps the tabletop near mid-screen, and extends only the plain bottom cabinet grain when needed. Portrait and landscape use separate painted compositions. Register text/hit area, handoff cup and customer foot line share that projection. The image remains static; existing articulated cats and hinged door stay live.

`foreground.ts` traces the new counter and raised prop silhouettes for rendering and hit testing. The old gold barrier crops are removed because this design has a clear central floor aisle. Door crops/panes in `doorGeometry.ts` are measured against the new entrances. The stationary garden and the hinged leaf continue using the exact same room source, preserving the existing arrival/departure choreography and service timer gate.

## Validation

Build/typecheck and the complete regression suite; browser checks for FIFO ordering, serving, navigation, pause, portrait/landscape framing and door/customer choreography. Capacitor receives the same built assets via `npx cap copy`; native shell/device testing is separate.

## Initial style plate

```text
Use case: stylized-concept. Asset type: final landscape background painting for a playable cozy cat bubble-tea shop, 1536x1024 landscape. Input images: the user's peach cat cafe reference is the PRIMARY style and subject reference; the existing brighter green cafe screenshot is only a functional layout reference. Redesign the existing cafe in the user's much softer muted peach/cream painterly storybook style, matching its warm brown hand drawn outlines, gentle watercolor grain, dusty olive foliage, honey wood reflections, cream cat furniture. Interior viewed from behind the service counter facing a CENTERED rear entrance. Symmetric spacious composition. A centered double glass entrance door, straight vertical rectangular leaves, simple single uninterrupted glass pane per leaf (no crossbars), thin wooden borders, two vertical handles at center, subtle paw decals. Soft garden and striped awning seen through glass. Door threshold approximately 49% image height. Keep the middle 30% of room clear of all furniture for a customer queue from door to counter. Cat-back chairs and small round tables tucked along both sides, sleeping cat decorations on high wall shelves, two cream cat-ear pendant lamps. Register at left foreground: blank cream customer-facing display integrated into a cat-ear monitor with stand, bronze service bell beside it. Small covered cat cookie box next to register. Right foreground a beautiful curved glass pastry case filled with cream cakes and fruit tarts, tucked to the right edge. One centered cream peach gingham serving mat with small paw print on a clean countertop, no other central signs. Counter rear edge is a straight horizontal line across image at approximately 61% height. Full foreground counter tabletop to 80% image height, then honey wooden cabinetry to bottom, broad plain wooden bottom band that can extend on tall screens. Keep register and pastry case entirely within side margins. No queue ropes, floor signs, standing customers, human characters, floating UI, text, lettering, menu text, logos or watermark. All props integrated into the single continuous painting with consistent perspective and shadows. No bright neon yellow, shiny 3D, sharp vector leaves, or excessive bloom. Visually match the user's soft peach cafe reference very closely.
```

## Landscape recompose

```text
Use case: precise-object-edit. Edit the provided peach cat cafe painting into an ULTRAWIDE PANORAMIC game background, aspect ratio 2.4:1, 1944 pixels wide by 810 pixels tall. This is the landscape phone version of the SAME interior, preserve the watercolor grain, dusty olive plants, peach cream palette and hand painted cat details. Major camera recomposition, not a stretch: fit a wider interior and raise the counter BACK EDGE to exactly HALF image height (y405). Rear glass entrance centered at x972, two simple glass leaves with no crossbars, threshold at y310, door top y100. Keep rear room seating tucked to sides of the central aisle. Counter top y405-595, lower wood cabinets y615 to bottom. Left cat ear register fully visible with a BLANK cream rectangular inset display area for live game labels, small cookie display beside it, bell. Right glass pastry case, one centered gingham serving mat with paw at x972,y540, same existing decorative objects. Leave central aisle x810-1134 clear. Two cat-ear pendant lamps, sleeping shelf cats, tables and chairs at sides. All register and pastry case props entirely visible with at least6% side inset around register. Crop furniture behind pastry case naturally. Flat straight counter edge. No floor barriers, UI, standing customers, text, lettering. Preserve soft peach reference art quality. MUST output a very wide horizontal 2.4:1 composition, not a 3:2 image.
```

## Portrait recompose

```text
Use case: stylized-concept. Create the PORTRAIT mobile version of this exact peach cat cafe painting. Vertical aspect ratio 2:3, 1024x1536. SAME watercolor storybook cafe, cream peach palette, dusty olive foliage, warm soft brown outlines and fine painted texture. Camera from barista behind counter looking through a clear central aisle toward centered rear double glass entrance. Recompose for portrait, do NOT crop off the foreground props. Rear door centered x512, top aroundy230 and threshold aroundy620, two matching simple uninterrupted single glass pane leaves with wooden trim and two handles, NO mullions/crossbars. Outdoor garden and pale striped awning through glass. Both leaves centered precisely on the image centerline. Two cream cat-ear pendant lamps higher at sides. Cat-back chairs, small tables and sleeping cat ornaments along left/right walls, center30% completely clear. Foreground counter BACK EDGE precisely y940 (61% image height), clean honey wood tabletop fromy940 to1190, warm wood cabinet doors fromy1220 to1536, bottom150px plain vertical wood cabinet grain. Left foreground cat-ear register with inset BLANK cream rectangular screen suitable for game labels, stand firmly on tabletop, entirely within left margin; smaller clear covered cat cookie display behind bell on its right. Right foreground curved clear glass pastry case with fruit tarts and roll cakes, fully visible and proportional, narrower to fit portrait. Register and pastry case each confined to outer third, leave center open for customer and serving cup. Centered peach cream gingham mat with paw atx512,y1100 on countertop. All objects integrated with shadows in the continuous painting. Keep warm cafe reference style closely, no vector graphics, no neon green, no shiny 3D. No text, lettering, watermark, queue barriers, standing customers or human figures.
```

## Portrait foreground inset

```text
Use case: precise-object-edit. Edit ONLY foreground countertop props in this portrait cafe painting. Preserve the entire upper cafe, all room surfaces, door, counter back edge at y1120, cabinets, lighting, palette and grain EXACTLY. Reduce the cat-ear register and its stand and move them inward so its whole silhouette fits between x60 and x295, with the cream blank inset screen around x85-265,y950-1040. Register base rests on tabletop y1198. Keep small bronze bell nearx335,y1190. Move cookie display beside register aroundx340,y1050-1165, slightly smaller. Reduce right glass pastry case and move it inward so the complete silhouette is visible between x735 and x985, top aroundy970 and base aroundy1220; leave40px margin to image right. Contents still delicate cream fruit cupcakes and roll cakes. Both register and pastry case must be entirely inside canvas and no parts cut off, all bottoms correctly grounded on wooden table. Center gingham mat unchanged. Original hand painted soft peach textures, coherent shadows. No other changes, no new objects or text. Same1024x1536 portrait framing.
```

