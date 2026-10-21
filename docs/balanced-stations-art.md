# Balanced topping tray and ice box

The original attached design has been restored. See [current artwork](lidding-station.md).

Previous variant: `src/assets/kitchen/kitchen-balanced-stations.png`. This variant is retained as a reference.

The topping tray has a shorter top and longer bottom. Its straight side edges slope
outward equally, and the nine ingredient bins follow the same centered taper.
`src/art/toppingGeometry.ts` projects the bin grid from a 204-unit back edge to a
244-unit front edge, centered at x1266. Drawing and touch targets share these bounds.
The regression check pins the shorter-top relationship and equal left/right widening.

The ice box's opening and metal rim are centered over its front face, with matching
left/right side lengths, angles and rim thickness. Ice and scoop contents remain asymmetric.

Validation: `npm run typecheck`, `npm test`, `npm run build`.
Desktop Chrome checks at 390×844 and 932×430 exercise every topping bin with alternating
taps and drags, plus two ice scoops by tap and drag. The shapes are also inspected visually.
[Combined game preview](balanced-stations-preview.png).

Generated with built-in imagegen, editing `src/assets/kitchen/kitchen-tray-front.png`.
Saved project asset: `src/assets/kitchen/kitchen-balanced-stations.png`.
Generated original:
`/Users/dev/.codex/generated_images/01a15c9c-f289-7ce3-a30a-cb3b878f91c5/exec-20a569b5-c910-4570-ad8c-8bdcede8ce3a.png`.

Final prompt:

> Use case: precise-object-edit. Edit the attached continuous panoramic watercolor boba kitchen in place, same 2146x733 framing. Change ONLY the EMPTY TOPPING TRAY and the ICE BOX, the two neighboring counter stations at x1125..1690 y297..478.
> 
> 1. TOPPING TRAY (left, currently empty stainless steel basin): make its TOP EDGE CLEARLY SHORTER than its BOTTOM EDGE. The outer silhouette must be a centered, bilaterally symmetric trapezoid that widens downward: top-left (1148,333), top-right (1388,333), bottom-right (1408,476), bottom-left (1128,476). Top width 240, bottom width 280. Both side edges are single STRAIGHT lines with equal outward slopes (left goes 20 pixels left toward bottom, right goes 20 pixels right toward bottom). Do not invert this taper. Level horizontal top and bottom, slight rounded corners only. Uniform stainless rim. Inner empty basin follows the same balanced taper: back left (1160,345), back right (1376,345), front left (1140,464), front right (1396,464). Preserve the warm brushed metal reflections. Leave the entire basin empty because the game draws nine ingredient bins over it. No painted dividers, ingredients or tools in this tray.
> 
> 2. ICE BOX (right, marked ICE): correct its OUTER GEOMETRY to be BILATERALLY SYMMETRIC about its vertical center x1550.5. Left and right outer side edges must have exactly the same length, height and angle, mirroring each other. Front face is a centered level cream rectangle, left x1412, right x1689, base y478. Both vertical sides are parallel and upright; neither side flares more than the other. Its rectangular top opening and metal rim are also centered and symmetric with equal thickness on left/right, same corner heights, same shallow visible depth. No skew, no angled side panel visible on one side, no lopsided rim. Keep the clear ice cubes and metal scoop, which can remain naturally asymmetric inside. Keep the ICE lettering centered and leaf/ice motifs on either side. Match the frontal lidding machine and straw box.
> 
> Preserve EVERYTHING ELSE exactly: frontal lidding machine with empty cup bay, straw box, single fully framed window, flat wall, plants, signs, utensil caddy, empty tea shelves, cup stacks, all countertop horizontal edges, lighting, warm watercolor texture, brown outlines. Do not move or resize the two stations or canvas. No new objects, no extra text or UI, no collage. Return the full single edited kitchen panorama.

