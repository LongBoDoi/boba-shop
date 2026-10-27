# Clear cat cup

The supplied reference is implemented as shared vector artwork in `src/art/cupDesign.ts`:
a tall clear tapered cup, rolled open rim, transparent cat-ear dome, and
straight hollow clear straw. The front cat decal and pink straw are replaced on the playable
cup and the small order/customer illustrations. The gray curled silicone holder is a separate
counter object replacing the yellow mat, rather than an extra rim attached to the cup.
It stays on the counter while the cup is carried. The clear cup bottom has one outer contour
and a restrained inner ring. Cup and lid contours use defined warm-gray strokes and narrow white inner highlights.
The wide translucent edge transitions have been removed for a clearer, bolder silhouette.
The rim fill and its contours are separate to avoid doubled dark lines.
Kitchen background images are unchanged.

The same paths and gradients render to SVG for small icons and to Canvas for finishing tools.
The playable shell loads at 678×1044, then uses the existing 113×174 interior geometry, keeping
tea, ice, toppings and cream inside the same well. The rim is an annulus with a transparent
opening. The straw aligns with the central lid hole; 70 units of independent finishing headroom
keep its open tip visible. Its submerged section is translucent.

Validation: TypeScript/build and the complete regression suite pass, including 11,520 ice
containment cases. Desktop and portrait browser previews cover empty, filled, cream/lid, and
finished states. Capacitor web assets are copied to Android and iOS; native binaries are not built.

- [Cup stages](cat-cup-stages.png)
- [Kitchen](cat-cup-kitchen.png)
- [Phone, finished cup](cat-cup-phone.png)

- [Empty cup on the separate holder](curled-holder-empty.png)
- [Holder stays behind when the cup is carried](curled-holder-carry.png)
