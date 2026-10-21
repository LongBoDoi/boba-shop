# Ice box facing the player

The original attached design has been restored; see [current artwork](lidding-station.md).

Built-in imagegen edited `src/assets/kitchen/kitchen-lidding-machine-front.png`.
This source image is retained in `src/assets/kitchen/kitchen-stations-front.png`.
It is one continuous 2146×733 panorama.

The ice box has a rectangular level front, symmetrical edges and a shallow top opening
that keeps the ice and scoop visible. Its existing interaction bounds still fit the artwork.
Earlier source images are retained.

Validation: `npm run typecheck`, `npm test`, `npm run build`; desktop Chrome at 390×844
and 932×430 verifies tapping the box for one scoop and dragging ice into the cup for a second.
[Game preview](ice-box-front-preview.png).

Generated original:
`/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-79c58481-6363-4622-968d-7a811320df3e.png`.

Final prompt:

> Use case: precise-object-edit. Edit target: attached panoramic watercolor boba kitchen background, 2146x733. Change ONLY the ice box in the small rectangle x1412..1689 y300..478 (between the empty topping basin and lidding machine). Turn this ice box to face the player almost straight on, matching the frontal lidding machine and straw box. Make its broad cream enamel front a level horizontal rectangle with parallel upright edges, left and right corners the same height, symmetrical rim and minimal visible side faces. Keep a shallow visible top opening from the slightly elevated viewpoint, enough to clearly see the blue-white ice cubes and metal scoop, but reduce the steep overhead view and taper. Keep its same footprint, size, center, height and position on the counter. Preserve the hand-lettered ICE on its front with the little leaf and ice-cube motifs. Preserve its warm hand-painted watercolor shading, brown outlines and metal-lined interior. Keep the ice and scoop clearly readable as an interactive game station.
Everything else must remain exactly as in the input: complete two-pane window and flat peach wall, the frontal lidding machine with its empty cup bay, straw box, all plants and signs, the empty wooden tea shelf, S M L cup stacks, utensil caddy, empty topping basin, all horizontal countertop and wood edges. Do not move, rotate, resize or redraw any other equipment. No new objects, no text changes elsewhere, no cups inside machine, no collage. Keep original ultra-wide canvas dimensions and framing. Output the full edited kitchen panorama.

