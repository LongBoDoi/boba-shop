# Level register base

The current image adds the [level body correction](counter-level-body.md) over this base.

Active landscape asset: `src/assets/counter/cafe-peach-panorama-v6.png` (1942×809). The register keeps its subtle right facing body from v5. Its foot now has a horizontal bottom front edge, parallel to the counter's straight edge and the other tabletop props. The shallow right side and contact shadow retain depth.

Built-in imagegen source: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-ed4a23b4-6ff3-4fb5-a502-c08bb6ef2628.png`. Edit target was v5. Only x105,y565,w276,h90 was composited back over v5 at original resolution with a 7px interior feather. A decoded-pixel check verified 1,546,966 protected pixels outside that region remain identical to v5. The bell and cookie box fall outside the edit region. The shipped art is one integrated painting.

## Final prompt — built-in imagegen

```text
Use case: precise-object-edit. Edit only the rectangular FOOT/BASE and its immediate contact shadow of the cat-ear cash register in the lower left of this exact cafe image. The register's front-facing screen, ears, body, paw mark, slight right-facing direction and vertical support should stay exactly as drawn. The problem: the base's LOWEST FRONT OUTLINE slopes a few pixels downward toward the right, while the countertop front edge and the cookie-box base are level. Repaint the foot so its bottom front outline runs precisely horizontally from approximately x130 to x354 at y638, parallel to the table edge at y662. Its top/front upper border should also be horizontal, around y613-616. The base is still a shallow solid perspectival foot: modest side/depth edges recede toward the back, with a short right side, not a flat stripe. Reconnect the support naturally to the top of the corrected foot, and adjust only the tiny grounded contact shadow directly beneath it. Use original soft peach watercolor grain and brown hand-drawn contours. Do not alter the monitor body or screen and do not change the bronze bell x390-470, cookie box x470-670, table edge, mat, room or any other part of the image. Exact 1942x809 framing. No text or UI. This is a tiny local straightening of the base bottom edge, not a reorientation of the whole register.
```

Validation: build/typecheck, complete regression suite and landscape browser check; Capacitor web asset copy to Android/iOS. Native devices not tested.

