# Painted cup material

The playable cup and order-panel cups now use `src/assets/kitchen/cup-painted-v2.png`
(1024×1536 RGBA). The original cat-ear lid, straw and holder stay in their existing atlas.
The kitchen background is unchanged.

The artwork was generated with the built-in image-generation tool using the original
`cup-reference-painted.png` as a design reference. The output was copied without modifying
its pixels from:

`/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-d095bfc5-fb00-47ed-bcdc-382532612b6e.png`

`cupMaterialArt.ts` registers the painted rim and foot to the existing cup geometry. Both
Canvas and SVG use that registration. The whole rim uses a single scale from source y138–373
to cup y2–32; splitting it at its center distorts the ellipse. Its front-wall and near-lip masks
share the registered ellipse center at y17.5. `cupPainter.ts` separates soft transmitted tones from
painted highlights in a cached front-wall texture. This preserves the paint's variation without
whitening the tea. The rear inner wall uses the same transmission response inside the mouth,
feathered into the rolled edge, so it does not retain an opaque gray cast against the warmer
front. Highlights and shadow detail remain painted rather than being erased uniformly.
The rear floor is drawn behind contents; the front reflection continues
along the taper, so rear base arcs cannot appear over the drink. The previous erased-mouth
texture and procedural reflection ribbons have been removed.

Validation: build and regression suite, 132 browser rendering cases (including containment,
ice visibility, milk color and straw depth), plus S/M/L in portrait and landscape with lids
and straws. Capacitor assets copied to Android and iOS; no native-device run.

## Exact generation prompt

```text
Use case: stylized-concept. Asset type: high resolution transparent RGBA game sprite, a single EMPTY CLEAR PLASTIC BOBA CUP.
Reference image: the supplied image is a design reference. Repaint ONLY the CUP as a new standalone sprite; do not include its holder, lid, straw or any other objects.
Maintain the same tall tapered proportions and slightly elevated viewpoint of the reference cup: wide elliptical rolled opening, straight tapered walls, narrower rounded elliptical foot. Cup width to height approximately 0.637; bottom diameter 60% of the top diameter. The opening ellipse height is 26% of its width. Show the complete cup upright and centered with transparent padding all around.
Style: polished warm hand-painted kitchen game illustration, crisp warm gray-brown contours, natural layered brush texture in the clear PET plastic, semi-realistic material, elegant and dimensional rather than a flat vector. Strong readable silhouette at small size.
Redesign its ENTIRE material: convincingly rolled thick rim with a shaded inner lip, fine molded ridges on the rim and foot, subtle layered warm gray reflected tones, irregular tapered luminous highlights following the round wall, finer reflected streaks, soft warm edge refraction, and delicate variation in plastic thickness. The highlights should have painted transitions and texture, NOT hard rectangular white bars. Light from upper right, weaker bounce at left. No huge solid white stripe. No scratches or dirt, no condensation droplets, no labels or printed marks.
IMPORTANT transparency: both background AND the central area of the empty transparent plastic cup must have genuine alpha transparency, through which a game background or tea can be visible. Sparse translucent shading inside with opaque outlines and some bright small speculars. No white solid fill, no baked checkerboard, no black backdrop, no floor shadow. Preserve fine painted detail; no blurred edges, no minimal thin wire outline. Only one cup, no text, no other props.
```
