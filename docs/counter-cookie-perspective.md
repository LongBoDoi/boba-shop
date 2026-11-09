# Register follows the cookie box perspective

Current landscape plate: `src/assets/counter/cafe-peach-panorama-v8.png` (1942×809). The screen, monitor case, support and base now use one consistent direction, matched to the front and small visible right side of the cookie box beside them.

Built-in imagegen source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-f64d6030-9df7-40bd-9b5f-3e5066419560.png`, with v7 as the edit target. Only the register region x96,y365,w276,h288 is composited into v7 with a7px interior feather at original resolution. A decoded-pixel check confirms 1,492,714 pixels outside the region remain identical. The reference cookie box and the rest of the room stay intact.

## Prompt — built-in imagegen

```text
Use case: precise-object-edit. Edit ONLY the full cat-ear register at the lower-left of this exact cafe image. The user says its different parts look inconsistently horizontal and diagonal, and asks to draw the whole register in the SAME perspective as the cookie box immediately beside it. Use that cookie box as the exact visual reference for orientation: its front face is nearly straight-on with level horizontal top/bottom edges, upright side edges, and one small visible RIGHT side face showing depth. Redraw the COMPLETE REGISTER as one coherent object with those same perspective cues. The monitor's screen and outer front frame are level and upright like the cookie box's front panel; the case shows a modest right side face. Its support column follows that direction and joins naturally. The foot/base has horizontal front and rear edges parallel to the cookie box's base/front edge, with matching modest right-side depth. No part of the monitor, support, or base tilts in a different direction from the others. Keep the cat-ear silhouette and paw emblem, large blank cream screen, similar size and position. Keep the front face readable for the game's live label. Match the cookie display's outline thickness, corner rounding, peach watercolor grain, brown shading and contact shadow. The assembled register should sit firmly on the same counter plane as the cookie box. Preserve every other part of the picture exactly: cookie box, bell, counter, mat, pastry case, room, furniture, plants, door and cabinets. No movement or change to the cookie box used as reference, no text/UI, same1942x809 framing.
```

The web build is copied to Android and iOS through Capacitor. Native device testing was not done.

