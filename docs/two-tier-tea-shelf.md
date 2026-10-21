# Rendered two-tier tea shelf

Current version: [taller room with original-size tanks](tall-tea-shelf.md). The compact version below records the previous design.

The two tiers are rendered as one joined wooden rack: continuous side panels and backing, a single middle divider, and a bottom shelf. All six dispensers stand on it, three per tier. The separate wooden preparation board remains clear.

The built-in imagegen tool produced `src/assets/kitchen/kitchen-shelf-rendered.png` (1672×941). The game uses only its upper-left 690×280 rack region, through `src/art/teaShelfArt.ts`. This replaces the previous copied-plank overlay. The original `kitchen-overhead.png` remains the room plate, preserving all artwork outside the shelf region.

`ROOM_BG_TEA_SHELF` uses logical standing bases 164 and 300 and 110-unit tank widths. Both rows retain the painted tank proportions. The rack fits within the existing background height.

The bottom station shortcuts have been removed, including their UI state, styles and 52px layout reservation. The kitchen pans by swiping empty counter space; all draggable stations also retain their tap interactions. The extra vertical space now belongs to the kitchen canvas.

[Landscape preview](overhead-kitchen-1284.png) · [Phone shelf](two-tier-tea-shelf-390.png) · [Small phone shelf](two-tier-tea-shelf-375.png)

## Built-in imagegen prompt

```text
Use case: precise-object-edit. Edit target: the original warm top-down boba-kitchen background. Render ONLY the upper-left wooden tea shelving as ONE cohesive TWO-TIER rack, replacing the existing one-tier rack. The purpose is to fit three tea dispensers on each of two floors. Keep BOTH compartments completely EMPTY because gameplay adds the tanks later. Very important: this must be a SINGLE cabinet carcass with ONE continuous pair of tall outer side panels, ONE continuous back panel, ONE top cap, ONE thin middle divider shelf and ONE bottom shelf. No separate furniture units stacked together, no doubled posts, no extra legs or gaps between cabinets, no repeated top caps. Use properly joined shelf ends and natural coherent contact shadows. Match the existing honey-colored wood, grain, fine painted brown outlines, elevated top-down perspective, warm light and exact width of the original unit. The rack occupies x0..690 and y0..340 on the existing 1672x941 canvas; it can use the empty space below the original rack while staying above the separate rounded preparation board beginning at y350. Upper standing surface around y155..170; lower standing surface around y305..320. Both openings need clearance for squat tea tanks, with a visible front lip on each shelf. Preserve the original top cap and outer silhouette style. Keep the entire rest of this picture exactly in place and as unchanged as possible: two rounded wooden prep boards, cup stacks/rack, lidding machine, straw box, nine empty topping pans, ice bin, cream stone counter, foreground and sunlight. No tanks, no new items, no text or interface. Same canvas dimensions and framing. Return the full original kitchen with just the upper-left two-tier rack rendered naturally as one joined wooden structure.
```

Generated source: `/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-f3f8adcd-59d5-4574-a268-87d3fbff341d.png`.

## Validation

`npm run typecheck`, `npm test` and `npm run build` pass. Browser checks at 390×844,
375×667 and 932×430 verify all six tea taps, S/M/L cup pickup, milk, sugar, cream,
lidding, paused press cycles and straws. At 390×844 and 932×430, additional checks verify
removed shortcuts, swipe navigation to the ends of the kitchen, all nine topping bins by
alternating taps and drags, ice, cup insertion and a perfect serve.

The production preview checks the original background hash, the generated rack texture,
the absence of shortcuts and a restored cup. The original background SHA-256 remains
`337ef3b9e618cd8eed1686a9bf88f0283f7a2f28a57bf9520d47b3acdaaafdfe`.
