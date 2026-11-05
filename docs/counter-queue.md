# Single-file cafe queue

The [raised counter revision](counter-raised.md) now supplies the active backgrounds.
The queue behavior below remains in use.

The active paintings add a central glass main entrance and a clear aisle to the order mat.
Original paintings are retained. Built-in imagegen edited each original independently;
the generated files were copied unchanged into the project.

- Portrait: `src/assets/counter/cafe-entrance-portrait.png`, 941×1671.
  Source: `exec-6e0d5131-5851-4ae3-9b04-5c188769f4ff.png`.
- Landscape: `src/assets/counter/cafe-entrance-landscape.png`, 1942×809.
  Source: `exec-1293733e-177d-49b5-93f0-fff573ceb8fb.png`.

Source directory: `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`.

`roomLayout.ts` measures the entrance and counter service position in painting coordinates. `queuePosition`
places feet on one straight perspective line. `Stage` maintains customer views by id so the
same guest walks forward when their rank changes, including the overflow line. Rear figures
draw first; only the front figure has an order bubble and accepts taps. New guests walk from
the doorway. Resize lays out the current line without replaying arrivals.

The front guest stands at the counter, with the logical foot line at y=950
in portrait and y=520 in landscape. Figure widths are 260/170 source pixels respectively;
scale recedes to 0.26/0.52 at the doorway (the landscape aisle is shorter). The counter and menu stand overlap the lower body.
`Backdrop` clips a copy of the original painting into `foreground.ts` silhouettes once per
orientation and draws it above the figures, preserving the source pixels. Hit testing uses
those same silhouettes so a tap on the table or menu cannot select an occluded customer.
Order bubbles sit beside the closer customer's face; feedback is clamped against its actual
screen anchor. The raised-counter revision updates both paintings and their silhouettes together.

`queueSlots` / `frontSlot` order stable storage slots by monotonically increasing customer id.
TAKE_ORDER, SELECT_SLOT, ASK_AGAIN and serving reject anyone behind the head. The register and
kitchen ticket follow the same rule. Waiting slot deadlines pause; the overflow line keeps its
existing line-wait/bench rules. Relaxed mode and the order board auto-order only at the front.
Previously taken orders in old saves stay intact, but cannot be served ahead of earlier arrivals.
Saved rear selections are cleared, and the next tick selects the front ordered customer.

Checks: `npm test` includes `tools/check-customer-queue.cjs` (FIFO, guards, deadlines, restore,
service/timeout advancement, auto orders and perspective). Optional `tools/check-counter-screen.cjs`
exercises actual pointer taps, waiting customers, register handover, queue advancement, swipe,
pause and layouts at five phone/tablet sizes. Android/iOS consume the same bundled build.

## Portrait edit prompt

```text
Use case: precise-object-edit. Edit target: the attached portrait cafe game background. Add a main entrance door at the exact rear center, with its center at x=470 in the 941px wide composition. A beautiful tall honey-wood framed glass double door from approximately y=145 to y=465, with brass handles and sunlit greenery outside. Replace only the central window / central seating and table area as needed to create a genuinely walkable continuous straight central aisle from the door threshold down to the existing GỌI MÓN floor mat. Relocate the seating to left and right sides of the aisle; no furniture across the center. Keep a clear center floor strip x=370..570 between y=465 and y=808, narrowing in perspective toward the entrance. Preserve the foreground cash register, menu, bell, drinks, entire counter and cabinets, existing floor mat, side sign and all Vietnamese text exactly at their current positions. Keep portrait aspect ratio 941:1672, camera, warm golden lighting, crisp painted outlines, rich textures, plants and cozy hand-painted illustration style. No people, no UI overlays. The main door and central walkable aisle are the only redesign; preserve sharpness and detail everywhere else.
```

## Landscape edit prompt

```text
Use case: precise-object-edit. Edit target: the attached wide cafe game background. Add a main entrance door in the exact rear center x=971 of the 1942px wide composition. A tall honey-wood framed glass double door approximately x=850..1090, y=58..345, with brass handles and sunlit greenery outside. Replace central rear window and central banquette portion with the door; the banquette must end on either side of the entrance. Keep a continuous open straight floor aisle from the door threshold to the center of the existing GỌI MÓN floor mat at x=940 y=520. No furniture blocking that central path. Preserve all other furniture, existing queue rails, floor mat, foreground cash register blank screen, menu, bell, drinks, counter, cookie cabinetry, Vietnamese text and their positions exactly. Preserve panoramic aspect ratio 1942:809, original camera, warm golden light, crisp illustrated outlines and detailed painterly textures. No people, no UI overlays. Change only central doorway / banquette and floor access; preserve sharpness elsewhere.
```
