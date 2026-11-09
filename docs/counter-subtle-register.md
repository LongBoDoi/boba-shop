# Register matched to tabletop perspective

Historical v5 base; see the [level base correction](counter-level-base.md).

Active landscape image: `src/assets/counter/cafe-peach-panorama-v5.png`, 1942×809. Reduces the exaggerated v4 yaw/sideways lean while retaining the requested rightward direction. Screen edges descend only slightly toward the right, body and support stand almost upright, a small right housing edge remains visible, and the base shares the cookie box's gentle depth direction. Live screen lettering and hit rectangle are remeasured; foreground outline follows the new silhouette. Portrait remains unchanged.

Built-in imagegen source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-4a4a3b2d-dbc4-4111-8039-1676f0b49fa2.png`, using v4 as edit target. Only region x96,y354,w285,h308 is composited into v4 with a7px interior feather at original resolution. The rectangle ends before the bell. Pixels outside the edit are checked against decoded v4; the shipped background remains a single complete painting with no runtime prop overlay.

## Final prompt — built-in imagegen

```text
Use case: precise-object-edit. Edit ONLY the lower-left cat-ear register in this exact cafe painting. It is currently rotated/tilted much too strongly. Reduce the angle by about TWO THIRDS so it shares the gentle perspective of the cookie display and counter. Keep its current RIGHT-facing direction but VERY SUBTLE: broad nearly frontal face, screen upper edge descends to right by only 3-5 pixels over 180px width (1-2 degrees, not current 8 degrees); screen side edges nearly upright, no sideways lean. Small glimpse of right housing thickness only. Its neck must be stable and vertical in the room, with coherent central attachment. Foot firmly flat on table, front edge almost horizontal like the cookie box front, receding side edges aligned to the cookie box's depth direction. Match the counter's existing vanishing point. No leaning/twisted silhouette or exaggerated three-quarter view. Both ears almost level, right one only slightly lower. Same dimensions and position approximatelyx120-390,y370-645. Retain cream blank screen, cat ears, paw emblem, warm peach watercolor grain and soft contact shadow. The result should look like a natural object in this exact cafe, not an image rotated on a flat plane. Preserve EVERY other object and background pixel: bell, cookies, mat, pastry case, doors, lamps, furniture, cabinets, original lighting, colors and sharpness. Same1942x809 image framing. No text, UI, extra objects or style changes.
```

Validation: build/typecheck, full regression suite, Counter interaction browser checks at568×320 and932×430, Capacitor asset copy to Android/iOS. No native hardware tests.

