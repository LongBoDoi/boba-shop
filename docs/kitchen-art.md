# Warm kitchen artwork

The kitchen uses a cream, honey oak, caramel and olive palette based on the supplied illustration. The other screens keep their existing art direction.

The original backdrop is `src/assets/kitchen/kitchen-warm.png` (1536 × 1024), generated with the built-in imagegen tool. The active backdrop is `src/assets/kitchen/kitchen-warm-clear.png`, with the center holder removed. That painted holder is isolated on transparency in `src/assets/kitchen/cup-holder.png` and rendered beneath the cup at the size and counter height the painting gives it (`ROOM_BG_CUP_HOLDER`); see [cup-holder-art.md](cup-holder-art.md). Dispensers, bottles, ice and action icons are native SVG components in `src/components/art/KitchenEquipment.tsx`. Topping bins and the animated drink reuse the existing painted sprites.

All ingredient coordinates in `kitchenArt.ts` and `layoutKitchen` are measured against the backdrop. The equipment shares the backdrop's scroll view. The cup and preparation mat stay in screen coordinates. The room is panned by swiping it, which returns a docked cup to the mat; there are no shortcut buttons for walking to a station. Day unlocks still determine which ingredients can be used.

Bottle targets have a minimum width of 44 points. Cream jars sit on the back counter, spaced around the foreground cup so it cannot cover their touch targets on short phones.

Previews: [tea station](kitchen-preview.png), [topping station](kitchen-toppings-preview.png).

Validation: `npm run typecheck`, `npm run lint`, `npm test`, and a production Expo web export. Browser interaction checks cover 375 × 667, 390 × 844 and 768 × 1024, with early and fully unlocked kitchens: docking and pouring, returning the cup when changing stations, adding toppings/milk/sugar/foam/ice after panning, switching orders, serving and discarding. Native simulator checks were not run.

## Final generation prompt

```text
Use case: stylized-concept
Asset type: production game background plate for an interactive mobile boba kitchen.
Primary request: a beautifully hand-painted cozy milk tea kitchen in the art style of the FIRST reference image: warm buttery cream, honey oak, muted olive foliage, caramel brown hand inked outlines, watercolor/gouache textures and soft golden afternoon window light. The first reference is the wide warm neutral tea kitchen; later references with pink/blue are NOT the desired colors.
Composition: landscape 3:2, straight-on view, slight view down onto the counters. EXACT layout measured as percentages: top 5% blank cream wall. Left 43% contains a honey wooden shelving frame, inner empty cubbies from x2%-40%, y12%-31% and y35%-54%, one vertical divider ONLY at x42%, no dividers inside the cubbies. Shelves at y32% and y55%. These shelves MUST BE EMPTY, no tea dispensers or containers, because game objects go here. A little leafy potted plant sits on the upper left and trailing pothos at the upper right edge of this shelving unit. Middle x46%-68% has a small wooden floating shelf at y31% with stacked clear plastic cups and a tin of brown straws. Above it a small caramel hanging plaque saying exactly "GOOD TEA GOOD DAY" in cream handwritten letters. Below this, a small empty wooden ledge at y58%, x46%-69%, no bottles because interactive bottles go here. Right upper x75%-95%, y10%-32% has a simple wooden framed illustration of a boba drink and hand lettered words "Milk Tea makes everything better" with a heart. Right x73%-98%, y43%-65% has ONE EMPTY stainless steel recessed rectangular topping tray surround, no internal divisions or food, which the game will fill. Background wall is pale peach cream plaster with soft diagonal window light on right. Back countertop runs at y67%, polished warm cream marble. Foreground cream marble preparation counter from y73%-96%, with a single subtly woven rectangular bamboo cup mat at center x39%-61%, y83%-93%, small leaf motif. Lower foreground edge is warm oak. Bottom left a little trailing plant and stack of clear cups. Keep the center counter clear, no cups standing on the mat. Fill the frame edge-to-edge. No people, no pink furniture, no blue, no UI buttons, no photorealism. Charming hand-painted casual cooking game, refined soft detailed brushwork, rounded brown outlines, natural material textures, calm warm pastel palette.
```
