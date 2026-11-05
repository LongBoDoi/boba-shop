# Animated cat customers

The counter uses an articulated version of the same cats shown in the title, order cards and
regular book. No new raster art or background repainting is involved.

- `art/character.ts` exposes isolated shadow, tail, legs, torso, arms and head layers. Portraits
  still compose the full illustration; heads and shirts also have rear views for departures.
- `counter/CatFigure.ts` rasterizes layers once at the device density and moves their pivots each
  frame. Only a mood or blink changes the head texture. All layers remain owned by the customer's
  identity in `TextureBank`; there are no frame-by-frame SVG builds or texture uploads.
- `counter/catMotion.ts` coordinates opposing steps and arm swings, body weight transfer and
  head follow-through. Idle cats breathe, glance around, rest a paw and swish their tails on
  different schedules. Impatient cats swish more briskly. Taking an order triggers a brief nod.
- `Stage` couples the walking state to actual arrival/queue-advance tweens. Idle motion uses
  visual time, separately from the reducer's 150ms clock. `CounterScene` freezes both travel and
  rig clocks on pause, opening screens and hidden documents. Offscreen idle rigs skip frame work.
- `LeavingView` receives the existing rig on sale/timeout, preserving its pose. It reacts for
  400ms, turns away, walks beside the queue toward the doorway over 2500ms, and fades only at the
  door. A served drink rides the raised paw. Visual departures survive the shorter reducer event;
  `Stage.sweep` retains their texture owners until the visual finishes. The last departure can
  finish behind the results card. Resize, reset and shutdown destroy rigs and pending callbacks
  check their lifetime before touching objects.
- `queueDepth` inverts the queue's perspective spacing to give departing figures their floor
  depth. Two cropped barrier overlays in `Backdrop` repeat original painting pixels at the posts'
  floor depths, so guests can pass first in front of and then behind the gold posts and ropes.
  The source background files are unchanged.
- `prefers-reduced-motion` keeps idle joints still and removes limb/bob loops during travel;
  essential position changes and blinking remain.

Validation:

```sh
npm run build
npm test
# With Vite running, and PLAYWRIGHT_MODULE / CHROME_PATH set if necessary:
node tools/check-customer-animation.cjs
node tools/check-counter-screen.cjs
npx cap copy
```

The animation browser check covers alternate paw phases, idle variation, pause during waiting
and departure, live rig handover, the held cup's attachment, rear-view exit art, departure lifetime,
texture release, stable idle texture counts and reduced-motion preferences. The counter check
covers the existing service flow at seven portrait/landscape screen sizes. Capacitor copy updates
both platforms' web assets; it does not constitute a native-device animation/performance test.
