# Raised ice and sugar trays

The existing ice/sugar artwork is translated upward by 160 source-image pixels, keeping its size, straight aligned rims and vertical arrangement. The ice tray's top is level with the topping station. Ice and sugar touch areas move by the same amount; their dimensions and eight-unit logical gap remain unchanged.

[Desktop preview](raised-trays-preview.png) · [Phone preview](raised-trays-phone.png).

`KITCHEN_ROOM_TRAY_RAISE` in `kitchenRoomArt.ts` controls both the rendered position and `ROOM_BG_ICE_MACHINE.y`. Each pan now has its own rounded rim crop: ice x30/y740, 201×139; sugar x30/y884, 201×140. Their destinations start at y580 and y724 respectively. Logical ice y is approximately 767.735 and sugar y957.735. No rectangle of marble covers the restored wooden boards. The original rims, contents, scoop and ladle are reused unchanged.

The old ice footprint is removed using a local marble crop from [kitchen-room-clear-ice.png](../src/assets/kitchen/kitchen-room-clear-ice.png), 1452×1083. It was edited with the built-in imagegen tool and copied unchanged from `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-42acf95c-ae5a-47ff-8132-410c212d9d8c.png`. Only x0/y738, 258×178 pixels are consumed, with a 2px upper transition and 16px right/bottom margins. This patch cannot cover the boards. The boards and lower counter now use the untouched first design; see [restoration](restored-original-boards.md).

Typecheck/build and the regression suite pass. Browser checks at 1284×810, 390×844 and 932×430 verify tapping and dragging ice/sugar from their raised locations into the cup. Web assets are copied to both native projects; native binaries are not built here.

## Exact built-in imagegen edit prompt

Target: `kitchen-room-dairy-left.png`.

```text
Use case: precise-object-edit. Edit target: this 1452x1083 warm painted boba kitchen background. Remove ONLY the ice bin and its scoop in the lower-left corner, around x15..240,y735..890. Remove its metal rim, ice, scoop and ground shadow completely. Fill the entire vacated footprint with a seamless continuation of the SAME ivory stone countertop, matching the existing broad warm diagonal sunlight, gentle marble color and fine painted surface. Leave it completely empty. Do not move the ice bin elsewhere; the game will reuse its original artwork separately at a higher position.
Preserve every other object and pixel as closely as possible: the single empty dairy serving tray at x265..610,y628..750, wooden tea rack, three cup stacks and organizer, sealing machine and empty bay, straw box, nine empty topping pans, counter front edge, wall and all sunlight. Do not redraw, soften, move or redesign any of them. Only edit the old ice-bin footprint and its shadow. No replacement objects, trays, holes, outlines, text, lettering, UI or decorations. Same original dimensions, full opaque canvas and framing.
```

