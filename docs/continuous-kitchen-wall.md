# Continuous kitchen wall

The later [cup station edit](counter-cup-station.md) removes the long shelf behind the cups while retaining this continuous wall. The asset below is preserved as its source.

The horizontal blurred band came from stitching an upper-wall crop to the original room with a stretched single-pixel row and a 64-unit fade. That stitching code has been removed. The kitchen now draws one continuous background at the existing 1920×1430 logical size. The tall two-tier rack, large tea tanks, station anchors and swipe navigation remain in place; station shortcuts remain removed.

The built-in imagegen tool edited the assembled room, targeting the exposed wall and its diagonal sunlight. Selected output: `src/assets/kitchen/kitchen-room-continuous-wall.png` (1453×1083). It is mapped to the existing logical room without changing interaction coordinates. The animated press head crops from this same image so its colors match the repaired backdrop. The original `kitchen-overhead.png` and previous generated sources remain untouched as design references; the active room is an edited raster, rather than an overlay on the original pixels.

[Desktop preview](overhead-kitchen-1284.png) · [Phone preview](overhead-kitchen-390.png) · [Small phone preview](overhead-kitchen-375.png)

## Prompt (built-in tool, edit mode)

```text
Use case: precise-object-edit. Edit target: supplied full kitchen background, 1920x1430. Repair ONLY the exposed cream wall above the cups, left of/above the lidding machine, to the right of the tall rack. There is an ugly blurry horizontal pasted band around y300..375 with vertical smudges and broken diagonal sunlight. Remove that band entirely and render this wall as ONE continuous smooth cream plaster wall with clean diagonal warm sunlight rays from upper right. The lighting must continue naturally all the way from the top down to the wooden cup shelf, without any horizontal transitions, stripes, rectangle patches, smudges, seams, blurry joins or extra objects.
PRESERVE EXACTLY the existing composition, canvas dimensions and every object. Preserve the tall empty two-tier wooden tea rack on the left, cup stacks and their wooden holder, cream and terracotta cup sealing/lidding machine, rolls, straw box, wooden boards, topping pans, ice, marble counter and counter front. Do not move, scale, redraw or redesign any of those. They are registered game sprites with fixed interaction coordinates. Do not add tea tanks or UI. Edit only the exposed wall pixels. Keep same illustration style and color palette. Return the complete image at its original proportions, with no crop and no framing changes.
```

Selected source: `/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-ad247b13-b207-4a53-96d7-bcb5ab709b38.png`.

## Verification

Typecheck, regression suite and production build pass. Desktop and phone previews show continuous diagonal sunlight through the former join. Browser checks at 390×844 and 932×430 cover swipe navigation, all nine topping pans, ice, dragging the cup into the machine, lidding, straws and a perfect serve. Production checks verify the single backdrop, absence of old wall-strip textures, large tank widths, restored cup and absence of station shortcuts.
