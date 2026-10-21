# Rectangular topping tray

The original attached design has been restored; see [current artwork](lidding-station.md).
This page records the earlier rectangular source image.

Built-in imagegen edited `src/assets/kitchen/kitchen-stations-front.png`.
The source panorama is retained in `src/assets/kitchen/kitchen-tray-front.png`.

The big topping tray has vertical, parallel left and right outer edges.
`src/art/toppingGeometry.ts` places all three rows between the same x coordinates,
so the nine bins also keep straight vertical sides and equal column widths.
The shared bin geometry supplies both drawing and touch targets.

Validation: `npm run typecheck`, `npm test`, `npm run build`; desktop Chrome at
390×844 and 932×430 checks every topping bin using alternating taps and drags.
[Game preview](topping-tray-front-preview.png).

Generated original:
`/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-de78e550-004d-4f02-9d59-12e5e97d25cb.png`.

Final prompt:

> Precise localized image edit. The only change is the EMPTY TOPPING BASIN immediately left of the ICE BOX. It currently has sloping trapezoidal side edges. REPLACE IT WITH A PERFECT RECTANGLE, viewed orthographically from the front. This is an explicit graphic-shape constraint, more important than realistic sink perspective.
> 
> The large metal tray must have perfectly VERTICAL outer left and right rims, like the adjacent ICE box: left edge x1128 from y333 ALL THE WAY DOWN to y476; right edge x1407 from y333 ALL THE WAY DOWN to y476. Its TOP WIDTH MUST EXACTLY EQUAL ITS BOTTOM WIDTH. Top and bottom are level horizontal lines. No taper whatsoever. Its inner opening also is a straight-sided rectangle x1140..1395 y345..464. Draw an empty brushed stainless-steel rectangle with a uniform metal frame around it, soft highlights and slight rounded corners only. Think of a frontal rectangular framed board laid over the old basin silhouette, not a trapezoidal pan. Eliminate all the old angled side-edge lines and triangular widening at the bottom. The visible top border, left border, right border and bottom border form a RECTANGLE, NOT A TRAPEZOID. Do not use perspective that makes the top narrower. Keep it EMPTY because nine ingredient bins are added by the game.
> 
> Edit the attached 2146x733 kitchen panorama in place. Keep every pixel outside the tray's x1125..1410 y330..478 neighborhood visually unchanged. Preserve the ice box, machine and straw box, plants, wall and window, signs, cup rack and empty wooden shelves, caddy, countertop perspective and horizontal edges, colors and watercolor style. No new objects, no labels, no extra panels, no canvas resizing. Return the full single panoramic background.

