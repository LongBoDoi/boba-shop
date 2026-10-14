# Ice station artwork

Generated with the built-in imagegen tool with transparent backgrounds.
Sources: `tools/sheets/ice-cube-v2.png` and `tools/sheets/ice-scoop.png`.
Run `python3 tools/cut-ice-art.py` to crop, scale, and pad the original alpha into
`src/assets/kitchen/piece-ice-v2.png` (96×96) and `src/assets/kitchen/scoop-ice.png` (256×296).

The blue cube is used by ingredient icons and the compact station plaque.
The loaded scoop is one complete painting, with ice contained behind its near rim.
The machine uses only its original background painting, with no drawer overlay or scoop count.
The plaque sizes to its icon and text with 5 pixels of horizontal padding in panorama coordinates.
The machine retains its full touch area.

The cup uses a separate clear, neutral ice sprite. Source: `tools/sheets/ice-cube-clear.png`;
output: `src/assets/kitchen/piece-ice-clear.png` (96×96), packaged by the same cutter.
`CupIce` places it in varied sizes and angles and follows the live liquid surface.
The runtime drawing adds frosted front/top/side faces and uses the source as a light texture.
One scoop shows three cubes; two show twelve, including loosely spaced submerged pieces.
Chunky 27–36-unit bodies keep ice distinct from toppings. Four exposed pieces spread across
the surface with different immersion depths and tilts;
their crowns can rise into the clear space beneath the lip without enlarging the liquid well.
Second-scoop positions, tilts and depths are sampled from the cup ID with spacing checks against
the actual glass-fitted positions. Each new cup varies; adding ice and pouring preserve its layout.
Animated silhouette cutouts keep the foreground plastic painting from fading exposed dry ice;
the cutouts stop at the near-side waterline, preserving the submerged glass treatment.
Every cube uses the same front-arc liquid clip and its complement, with softened
tea-tinted submerged faces. The tea's rear arc stays behind the exposed ice; contact strokes
follow its shared front arc, preventing inconsistent
liquid levels on different cubes. Projected cube depth changes placement rather than the clip.

## Cube prompt

Use case: stylized-concept. Asset type: one production ingredient sprite for a cozy painted mobile boba-shop cooking game. Create a SINGLE isolated ice cube on a truly transparent alpha background. Chunky rounded cube in three-quarter perspective, visible top, front and right facets, pale aqua-blue translucent ice with darker cyan edges, softly shaded blue facets, crisp small white glints on the upper-left, a faint internal frost streak, delicate blue-gray outline. Clearly reads as cold ICE rather than a gemstone or beige jelly. Polished hand-painted 2D casual cooking-game style, soft luminous shading with clean silhouette and restrained detail readable at 14-22px. Entire cube visible with small transparent margins; no ground shadow, puddle, multiple cubes, scoop, container, letters, numbers, logo or checkerboard. Square canvas, cube fills about 80%.

## Clear cup-ice prompt

Use case: stylized-concept. Asset type: one ingredient sprite for ICE INSIDE a clear cup of iced tea, for a polished hand-painted 2D casual cooking game. Create one isolated realistic clear ice cube on genuinely transparent alpha, filling 80% of a square canvas. Three-quarter view, visible subtly rounded top/front/right faces; a slightly irregular rounded cube with softened wet melting corners, near-colourless transparent gray-white ice, very faint cool-blue edges, subtle internal cloudy center and one fine trapped-air streak. True optical transparency through most of its center, restrained narrow white edge reflections and a small wet glint on one upper corner. Believable smooth frozen water, quiet neutral reflections. Clear silhouette legible when composited OVER brown tea and creamy milk tea at about 16-22px. The drink behind the cube must remain visible through its alpha; the cube must NOT be an opaque white or blue block. No vivid cyan, sapphire blue, faceted gemstone planes, jagged crystals, glitter, starbursts, glowing outlines, frost texture everywhere, droplets outside the silhouette, puddle, shadow outside the cube, scoop, cup, background, letters, logos, or checkerboard painted into the image. A single coherent softly painted game sprite, not a photograph.

## Clear cup-ice refinement

The initial clear cube was refined with the built-in imagegen tool to remove fine frost noise.
The source above is the final refined painting; packaging preserves its alpha.

Use case: precise-object-edit. Edit target: this isolated clear ice-cube sprite. Simplify and clean its material for a mobile cooking game so it reads as REAL clear ice at 16-22px. Keep the same single rounded melted cube, three-quarter viewpoint, near-colourless neutral gray-white palette and transparent silhouette. Remove ALL fine scratch lines, granular frost, tiny white speckles, jagged edges, crystalline facets, noisy texture and detached pixels outside the cube. Broad smooth translucent faces, a small soft cloudy core, softened wet rounded corners, only two or three restrained narrow white rim reflections and one small wet corner highlight. Quiet, clean, softly painted transparent frozen water, not a gemstone or frosted snow cube. Most of the interior must have genuine partial alpha allowing brown tea to show through. Clear clean rounded silhouette with no white halo, no external shadow, no star glints, no blue saturation, no background, no text. A single production-ready ingredient sprite, not a photo; readable rounded volume at thumbnail scale.

## Scoop prompt

Reference/edit target: `src/assets/kitchen/scoop-pearls.png`.

Use case: precise-object-edit. Asset type: one production draggable ice-scoop sprite for a cozy painted mobile boba-shop cooking game. Input image: edit target and reference for polished painted materials and viewpoint. Rework this into a dedicated ice-filled scoop: replace ALL brown tapioca pearls with five chunky rounded translucent pale aqua-blue ice cubes with cyan shaded facets and crisp restrained white glints. Arrange cubes naturally nested INSIDE the shallow oval metal bowl, partly occluding each other, with the lower cubes behind the near raised metal rim. Rework the scoop bowl to clean brushed silver-blue stainless steel, softly shaded with clear near rim and dark inner-wall depth. Keep the scoop's diagonal lower-left bowl / upper-right handle composition and overall full silhouette, with a short glossy rose-pink grip at the upper-right tip. One coherent hand-painted 2D sprite; make ice and scoop belong together, not a collage. Match casual cooking-game artwork, delicate outlines and soft luminous shading readable at roughly 70px tall. Truly transparent alpha background; whole tool including handle visible with transparent margins. No pearls, extra objects, detached cubes, falling ice, ground shadow, lettering, logos or painted checkerboard.
