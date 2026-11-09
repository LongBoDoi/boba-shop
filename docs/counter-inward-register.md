# Inward-facing landscape register

Historical v3 direction, superseded by the [reference-matched right register](counter-right-register.md).

Active image: `src/assets/counter/cafe-peach-panorama-v3.png`, 1942×809. Replaces the frontal v2 register with a gentle inward-facing three-quarter view toward the center of the counter (image right). Visible left housing thickness, ears, blank screen, paw, neck, perspectival base and contact shadow share the new orientation.

The blank screen's live label/hit rectangle is remeasured in `roomLayout.ts`; its matrix follows the screen's sloping plane in `CounterPage.tsx`. The register foreground contour follows the new ears/body. Portrait rendering is unchanged.

Generated with the built-in imagegen tool using v2 as edit target. Source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-6f2f6b44-9470-4c89-a53c-f0550d4a8e1c.png`. Only register region x110,y354,w298,h308 is composited onto v2, with a 7px interior feather, using Canvas2D at original resolution. No runtime prop overlay. Pixel comparison confirms 1,480,502 pixels outside the edit remain identical to decoded v2. The bell and rest of the room retain the previous pixels.

## Final prompt — built-in imagegen

```text
Use case: precise-object-edit. Edit ONLY the cat-ear cash register at lower LEFT of this exact peach watercolor cafe background. The user rejects the perfectly frontal register. Rotate the complete register about its upright vertical axis roughly 20 degrees so the SCREEN FACES DIAGONALLY INWARD TOWARD THE CENTER OF THE COUNTER, to image RIGHT. Show a subtle visible LEFT SIDE thickness of the monitor housing and stand; front screen faces slightly RIGHT. This must be a real coherent three-quarter perspective drawing, not a flat tilted rectangle. Its screen, cat ears, housing, paw emblem, neck, solid rectangular foot and contact shadow must all share this inward-facing orientation. Keep vertical edges upright, gentle converging horizontal edges, clearly supported stable base; no crooked joints. Keep register approximately same size, centered near x258, inside bounds x118-398,y365-640. Cream blank touchscreen remains legible, broad enough for game labels. Paint in original soft peach cream colors, warm brown hand drawn contours and exact fine watercolor grain. Natural subtle table shadow follows the rotated base. Keep the bronze bell, cookies, centered gingham mat, pastry case, all room furniture, door, lights, foliage, cabinetry, counter edges and lighting EXACTLY unchanged. Do not mirror the whole room or move objects. Same exact1942x809 ultrawide framing. No text, UI, new objects, blur or sharpening.
```

Validation: strict typecheck/build, full regression suite, Counter service/navigation browser checks at568×320 and932×430, and Capacitor asset copy to Android/iOS. Native devices not exercised.

