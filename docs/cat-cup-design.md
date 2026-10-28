# Painted reference cup and tabletop holder

The cup, cat-ear dome, straw and gray curled holder use `src/assets/kitchen/cup-reference-painted.png`,
a transparent painted atlas derived from the supplied reference with the built-in image-generation tool.
`referenceCupArt.ts` owns all crops. The previous vector approximation is removed.

The holder is a separate counter object. Its top plane is opened toward the kitchen camera and
its front wall shortened with a smooth projection of the original pixels. The recessed seat anchor
is projected by the same function, so S/M/L cups align with the seat after resizing.
The entire holder silhouette casts a soft down-left shadow, with padded texture bounds preventing clipping.
A close oval shadow follows the cup's base inside the recess and disappears when the cup is lifted.
The holder's painted near lip is composited over the resting cup along the measured projected
seat ellipse. The cup settles three logical units into that recess; the near-lip layer is hidden
as soon as the cup is lifted or docked elsewhere. This keeps the glass bottom from sitting visibly
in front of the silicone rim.

The clear cup uses its painted proportions (113×154 display) and a 113×174 contents space with a
narrower floor. Its lower glass mask is confined to the inner well, preserving continuous side contours.
No background artwork is regenerated or blurred.

Validation: build and complete regression suite pass, including ice/topping containment. Browser checks
cover S/M/L at 390×844, 932×430 and 1284×810; dragging leaves the holder in place and hides the cup contact
shadow. Android/iOS web assets are copied from the same build; native binaries are not rebuilt.

- [Phone](cup-holder-seat-390.png)
- [Landscape](cup-holder-seat-932.png)
- [Desktop](cup-holder-seat-1284.png)
- [Cup lifted from holder](cup-holder-seat-carry.png)
