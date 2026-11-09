# Animated cat customers

The counter uses articulated cats in the café palette. The source room paintings are unchanged.

## Direction and movement

`art/catAngles.ts` draws 24 directions at 15° intervals. Head, ears, muzzle, markings, glasses,
clothing and pocket are projected around rounded volumes; profiles are not horizontally squeezed
front images. `character.ts` retains the portrait illustration for cards and the regular book.
`CatFigure` caches the directional head/torso textures and eight articulated layers by customer
identity. A half turn takes about 500 ms, within a 650 ms turning beat. Paws shift their weight
through the turn; limbs, tail and held drink change their overlap with the body as it turns.

`catMotion.ts` coordinates alternating steps, lifted paws, opposing arms, breathing, head
follow-through, blinks, glances and resting poses. Walking side views also move paws along the
travel axis. A served drink follows the same rig's raised paw. Texture owners survive until the
visual departure finishes, then `Stage` releases them, including pending decodes.

`ArrivalWalk` reserves the door, approaches outside, pauses at the handle, opens the leaf, crosses
the threshold, then walks slowly up the aisle. `LeavingView` reacts, turns, follows the measured
floor waypoints in `walkway.ts`, waits for its door lease, reaches for the handle, opens the leaf,
crosses out and walks behind the exterior wall. Neither trip fades the customer. Queue guests
advance only in FIFO order; only the stationary front guest can be served.

Waypoints stay in the central aisle, between the side seating groups and clear of the chairs/displays.
`queueDepth` and original-painting foreground crops put cats behind the counter and the correct
side of the posts. Direction follows the departure path. Geometry uses the same source-coordinate
projection in portrait and landscape layouts.

## Door and scenery

`Doorway` has a FIFO lease shared by arrivals and departures. Only the left door leaf opens; the
right leaf stays painted in place. The moving sprite contains its wood frame, handle and paw decal.
Its glass is transparent, so no outdoor scenery can travel with it. A stationary garden texture
reconstructs only the pixels hidden by that leaf's details; the remaining visible view and the
entire right leaf retain their original coordinates. The left leaf is projected as one plane across
31 eased hinge frames. Narrow areas behind the wooden edges copy adjacent glass pixels directly,
preserving the painted scene's sharpness. The small area behind the removed paw uses a matching
painted garden patch, with only a two-pixel blend at its boundary. The two patch assets and their
generation prompts are recorded in `counter-door-garden.md`. There is no scenery or lighting swap
on opening.

Four cropped original-room strips hide exterior actors outside the aperture, on WebGL and Canvas.
This avoids Phaser 4's unsupported legacy GeometryMask path in WebGL. Interior actors switch to
floor depth only after crossing the threshold; exterior actors disappear only behind the wall.

## Service time and saves

New customers have `atCounter: false`. Outside waiting, entering the room and advancing in the
queue cannot consume order or preparation patience, cause timeouts, burn the overtime jar, or
increment lost/missed counts. `Stage` sends `CUSTOMER_AT_COUNTER` only once the front guest has
finished moving. The reducer verifies identity and FIFO position, then starts their greeting and
full order timer (or automatic order in relaxed mode/with the board). Taking a manual order starts
the separate preparation timer. Duplicate/stale arrivals cannot reset timers. Order, selection and
serving actions independently reject unarrived guests.

The presence flag survives saves. Older saves without the flag retain their already-arrived
behavior. Pause/opening screens/hidden documents freeze travel and rig clocks. Reduced motion
keeps idle poses still and suppresses limb/bob loops, while essential travel and blinking remain.

## Validation

`npm test` includes raw-reducer presence tests: long travel, waiting, arrival, duplicate callbacks,
automatic orders, invalid flags and save/restore. Existing headless recipe/rules tests explicitly
use `tools/sim/arrivals.cjs` to acknowledge immediate arrival; they do not test travel duration.

With Vite running, `tools/check-customer-animation.cjs` checks the complete entry/exit sequence,
progressive turn textures, live rig/drink handover, pause, opacity, physical arrival callback and
cleanup on portrait and landscape screens. `SCREENSHOT_DIR` captures intermediate poses.
`tools/check-counter-screen.cjs` covers service flow at seven viewport sizes. Run `npm run build`,
`npm test`, `git diff --check` and `npx cap copy` for the shared web/Android/iOS bundle. Capacitor
copy is not a native device animation or performance test.
