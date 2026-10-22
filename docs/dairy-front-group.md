# Front-facing dairy group

The later [left-counter placement](dairy-left-placement.md) moves this group below the tea shelf
and aligns the restored cream silhouette shadows to their curved painted bases. The front-facing artwork
and close spacing below remain in use; the following records the previous tray position.

Milk, oat milk, cheese cream and caramel cream now stand side by side on one small tray below the cup organizer. The cartons face straight forward with horizontal bases, and all four share a single baseline. The painted silhouettes have roughly 7–10 source-pixel gaps. The former left station area is clear marble.

[In-game preview](dairy-trays-preview.png).

Current assets, copied unchanged from the built-in imagegen tool:

- [milk-cream-front-v3.png](../src/assets/kitchen/milk-cream-front-v3.png), transparent 1536×1024 sheet. Source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-12eab758-7965-4045-88e8-13c909540618.png`.
- [kitchen-room-dairy-together.png](../src/assets/kitchen/kitchen-room-dairy-together.png), 1452×1083 background source. Selected source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-0c69c47d-3fe9-45b1-a507-db35314b6e14.png`. Only the existing local board-area crop is composited into the original sharp room; the ice/sugar patch remains separate and unchanged.

Logical container centers: milk x940/1044, cream x1136/1212. All painted feet use y886. Milk frames are 104×222; cream frames remain 76×178. Shared tray floor limits x670..961 in background-source pixels clear every package footprint. Counter, carried objects and order icons use the same front-facing source crops.

Shadows project each actual package silhouette toward the lower left, anchored to its foot. A faint cast shadow fades with distance, with a soft penumbra and a separate tight rectangular carton contact or elliptical can contact. The shadow uses standard Canvas shadow blur, and clips source-in compositing to its own atlas frame. Every shadow leaves the tray with its container. Expanded touch targets select the nearest dairy container so the compact spacing works on short landscape screens too.

## Built-in imagegen prompts

Front-facing sprite edit; target: `milk-cream-refined-v2.png`:

```text
Use case: precise-object-edit. Edit target: this transparent four-package milk and cream sprite sheet. Change ONLY the viewing direction. Rotate BOTH milk cartons to face STRAIGHT TOWARD THE VIEWER: a symmetrical flat rectangular FRONT PANEL, horizontal lower front edge, parallel upright vertical sides. The right side panel must be either invisible or at most a tiny 3 percent strip. The current prominent right-side panel and diagonal front bottom edge must disappear. Their folded gable roofs still show gently from above, with roof ridge horizontal and the ivory cap attached. Rotate the cream cans' small dispensing spouts toward the viewer as well: centered compact plastic actuator, short outlet pointing slightly toward viewer-left, elliptical shoulder matching the gently elevated kitchen camera. All four packages share the SAME almost head-on direction with absolutely no diagonal isometric twist or leaning.
Preserve the tall slim proportions, the peach/ivory cow carton and sage/ivory oat carton, cheese and caramel aerosol cans, existing printed illustrations, label colors, matte paper and brushed metal material, upper-right light and delicate painted kitchen style. Do not add lettering or redesign the artwork. Same 1536x1024 two-column two-row sprite sheet. Upper row feet near y500, lower row feet near y980, whole silhouettes visible and well separated. Keep REAL alpha transparency outside every object, no backdrop, shadows, halo, glow, scene, trays, extra objects, text or watermark. Four upright front-facing isolated packages only.
```

Single-tray edit; target: `kitchen-room-serving-trays.png`:

```text
Use case: precise-object-edit. Edit target: this complete 1452x1083 kitchen background.
Remove BOTH empty serving trays in the middle of the countertop and their shadows. Restore seamless matching ivory marble in their vacated footprints. Replace them with exactly ONE SMALL LOW-PROFILE serving tray centered BELOW the clear cup organizer, to the LEFT of the topping bins. The new SINGLE tray outer bounding box should be approximately x620..950, y620..710 on this canvas. This is a compact flat tray sized for FOUR ingredient packages standing right next to each other, milk on the left and cream on the right. The packages will be drawn by the game: KEEP THE TRAY COMPLETELY EMPTY. There must be NO SECOND tray, board, mat or box in this part of the counter.
Keep the same thin softly brushed stainless rim and flat ivory nonslip insert as the existing trays, with a very low rolled edge, no deep walls, no box appearance. Use the countertop's elevated viewpoint, warm upper-right lighting and a subtle grounded shadow. Leave all the old left tray area as clear seamless marble.
Preserve every other object exactly, including the tall empty wooden rack, cup stacks/organizer, sealing machine and loading bay, straw box, nine empty topping pans, ice bin and scoop, sunlit wall, counter front, canvas dimensions, original framing, fine detail and hand-painted style. Do not move or redesign those. No bottles or cartons or cans painted into the background, no names, letters, UI, extra objects or decorations. Return the entire original-size opaque image.
```

Tray position refinement; target: the preceding generated output `exec-3247d5f1-aad7-4fdf-b09a-c8584377480e.png` in the same generated-images directory:

```text
Precise-object-edit. Change ONLY the position of the single empty steel serving tray in this kitchen background. Move it STRAIGHT DOWN by exactly 48 pixels on this 1452x1083 image. Its current bounds are approximately x650..980,y565..675; its NEW bounds must be x650..980,y613..723. Keep its width, depth, thin rim, ivory insert and viewpoint EXACTLY unchanged. Remove its old footprint and shadow and restore seamless original marble there. Do not move it sideways. It must remain ONE tray only. Preserve every other pixel/object, cups, rack, machine, toppings, ice, wall, counter edge, all lighting and original full canvas. No new objects or text. The final image must show the tray clearly lower on the counter, with a larger vertical gap between the bottom of the cup organizer and the tray.
```

