# Landscape counter alignment

Historical frontal version; superseded by the user-requested [inward-facing register](counter-inward-register.md).

Current landscape asset: `src/assets/counter/cafe-peach-panorama-v2.png` (1942×809).

The register's screen, ears, body, neck and foot previously had inconsistent centerlines. Its replacement faces forward with a centered support and horizontal screen edges. The bronze bell's finial, dome and foot were also aligned. The register's live text/hit rectangle and foreground silhouette follow the new screen and outline. No portrait layout or game logic changes.

The rear door center is x971, matching half the canvas width; the pendant pair averages approximately x970 and the serving mat is centered at approximately x971. Those elements do not need recentering. Tables, wall shelves and the pastry display retain their natural perspective and intentionally different contents.

## Source and preservation

Built-in imagegen local edit source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-55e5da3f-ea4a-4078-baea-f19d17ddbc09.png`, using `cafe-peach-panorama-v1.png` as edit target.

Only the generated register/bell regions were composited back onto v1 with Canvas 2D at original resolution; the generated full painting is not substituted. Register region x110,y357,w298,h290 has a 9px feather; bell x381,y548,w96,h98 has a 6px feather. The edit output is sampled to the original 1942×809 dimensions before compositing. A pixel comparison verified 1,479,206 protected pixels remain identical to decoded v1; 90,603 pixels changed inside the two local regions. The shipped result is one complete background, with no separate prop overlays or runtime compositing.

## Final prompt (built-in imagegen)

```text
Use case: precise-object-edit. Edit this exact ultrawide peach watercolor cafe background. ONLY fix the cat-ear cash register and small bronze bell at lower LEFT. The register currently has subtly skewed screen/body and its neck/base lean off-center. Make this SAME register face straight toward viewer, individually bilaterally symmetrical about its OWN vertical centerline x258. Cat ears equally tall and equally spaced; matching body edges, rounded screen centered on body, screen horizontal top/bottom, supporting neck centered below screen, matching feet/stand centered below body. Its lower stand remains a perspectival solid object on tabletop with a soft grounded shadow; do not flatten its depth. Keep same outer bounds approximately x122-395,y377-630. Blank cream screen approximately x148-365,y427-515. Center support and base atx258. Same cat paw below screen. Small bronze bell beside it at x428,y559-634: align finial, dome and elliptical foot on one vertical centerline x428 and make matching left/right curves, grounded contact shadow. Preserve the entire rest of the painting EXACTLY pixel-for-pixel: door, garden, lamps, foliage, cookies, pastry case, gingham mat, cabinet seams, counter edges, all colors, original subtle watercolor grain and level of sharpness. Do not shift, rescale, crop or regenerate any other object. Keep exact 1942x809 ultrawide aspect ratio and framing. No text or UI. This is a small local alignment repair, not a new composition.
```

Validation: strict typecheck/build, complete regression suite, and live Counter interaction checks at 568×320 and 932×430. Capacitor copies the same web assets to Android and iOS; no device build is claimed.

