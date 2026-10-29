# Cup organizer on the counter

The current ivory cat-themed rack and straw box supersede the wooden organizer and separate
plaques described below. See [cat organizers](cat-organizers.md) for assets, anchors and checks.

Removed the long open-backed wooden shelf/bench behind the cup stacks. The compact three-stack wooden cup organizer remains, now resting directly on the marble counter with a contact shadow. The clean sunlit wall, tall tea rack, machine, straw box, boards, pans and ice keep their existing designs.

Built-in imagegen, edit mode. Saved asset: `src/assets/kitchen/kitchen-room-counter-cups.png` (1452×1083), selected source `exec-4767d549-40e4-42ba-936d-c24c4b50d63f.png`. The earlier backgrounds remain available as references. `kitchenRoomArt.ts` loads the new complete background without wall strips. `ROOM_BG_CUP_STATION` now spans logical y410..680, with stack tops 484/453/410 for S/M/L, aligning selection and badges with the lower organizer.

[Desktop preview](overhead-kitchen-1284.png) · [Phone preview](overhead-kitchen-390.png) · [Small phone preview](overhead-kitchen-375.png)

## Prompt

```text
Use case: precise-object-edit. Edit target: supplied warm top-down illustrated kitchen background, 1453x1083.
Remove ONLY the long open-backed wooden shelf/bench behind and beneath the cup station: the horizontal wooden plank running from the tall left rack toward the sealing machine (roughly x600..1090 y358..405), its bottom ledge and vertical legs/supports (down to y505). Remove the whole long shelf structure, including the exposed wooden stretches to the left and right of the compact cup organizer. Fill its footprint with a seamless continuation of the existing cream wall and cream marble countertop, matching the continuous diagonal sunlight. No blurry patches or horizontal pasted seams.
KEEP the compact wooden CUP ORGANIZER holding the three clear cup stacks (small, medium, large from left to right), currently approximately x687..1026 y368..486. It is distinct from the long shelf being removed. Set this complete cup organizer and its three cup stacks directly onto the marble countertop, lowering the whole organizer with cups by approximately 40 pixels without changing their size or horizontal position: its wooden bottom should rest around y526, with cups' tops around y378,354,318 respectively. Add subtle tight contact shadow beneath its base and natural perspective so the cup organizer has weight and sits on the same counter plane as the nearby cream/terracotta sealing machine. Keep a clear gap before the preparation board below (starts y569). The cup organizer must be freestanding, no shelf or riser behind it. Keep its compact wooden front lip, side dividers, three clear stacks and same illustration design.
Preserve ALL other elements exactly: tall EMPTY two-tier tea rack on left, cream/terracotta sealing machine and rolls, straw box, both wooden preparation boards, nine empty topping pans, ice bin and scoop, marble foreground, counter edge, viewpoint, overall composition and dimensions. Keep wall sunlight clean and continuous. No tea tanks, added objects, text or UI. Return the complete same-proportion background; do not crop, reframe or redesign the kitchen.
```

## Verification

The S/M/L plaques now use measured centers on the wooden front, rather than the stack touch
targets. Smaller warm-paper cards have a fine edge, tiny fasteners and subtle contact shadows;
the letters are centered using their glyph bounds. Browser checks at 1284×800, 390×844, 375×667
and 932×430 confirm their alignment and S/M/L selection. Typecheck and production build pass.
The current regression run passes gameplay checks but fails the existing native-shell fingerprint
check in `check-updates.cjs`; this label change does not modify native files.

For the earlier organizer artwork edit, typecheck, regression suite and production build passed. Browser checks selected S, M and L cups from the moved stacks at 1284×800, 390×844, 375×667 and 932×430. Desktop and phone previews confirmed that the long shelf was absent and the compact organizer sat on the counter. Production checks verified the new background and cup lidding/straw interactions.
