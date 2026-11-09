# Register direction corrected to user reference

Historical v4 angle; superseded by [subtle tabletop perspective](counter-subtle-register.md).

Active landscape: `src/assets/counter/cafe-peach-panorama-v4.png` (1942×809). The previous v3 yaw was opposite the user's intended reference. This version reverses the register perspective: upper/lower housing edges descend toward image right, right housing thickness is visible, and support/base follow the same direction. Screen lettering and hit rectangle use the corresponding reversed matrix. Portrait is unchanged.

Built-in imagegen source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-c48a994b-2c63-44e2-aaf4-54cd5971f62c.png`. Inputs: the user's attached cafe reference and current v3 painting. Only the register region x110,y354,w298,h308 is composited into v3 at original resolution with a7px interior feather. The same protected-region pixel check as v3 verifies the rest of the background remains identical; no runtime prop overlays.

## Final prompt — built-in imagegen

```text
Use case: precise-object-edit. Input 1 is the user's cafe REFERENCE, input2 is the current ultrawide game background EDIT TARGET. Fix ONLY the lower-left cat-ear register in image2. The previous register was turned the WRONG WAY. Reverse its yaw direction, matching the register silhouette and base orientation in the user's image1. The register should lean/face toward image RIGHT as in image1: its housing's top and bottom edges slope DOWN toward the RIGHT, not upward as in current image2. The LEFT top corner is HIGHER than RIGHT top corner. Its RIGHT side has visible housing thickness, NOT the thick left side currently shown. Foot front edge and support must follow this same opposite three-quarter direction. Match the reference's stable supported slant and base, no floating monitor. Keep cat ears and paw emblem; retain a blank inset cream screen on the broad visible housing face so live game labels remain legible. No drawn text. Keep bounds approximatelyx118-398,y365-650 and same scale/position on the table. Soft peach cream watercolor grain, brown outlines and natural contact shadow as original. Preserve ALL other pixels from image2: bell, cookies, counter, mat, pastry case, chairs, door, garden, lamps, plants and cabinets. Do not mirror the room. Same1942x809 aspect ratio. The critical correction is opposite horizontal perspective: screen top line descends toward RIGHT and right housing edge is visible, matching user reference.
```

Validation: build/typecheck, full regression suite, landscape Counter interaction checks at568×320 and932×430, Capacitor asset copy for Android/iOS. Native hardware not tested.

