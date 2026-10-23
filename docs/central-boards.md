# Compact central milk and cream boards

Both boards now use the [matching elevated-view artwork](dairy-overhead.md) shared with the four packages. The independent transparent sprites render at logical x440/y800, 420×144.5, and x882/y800, 366×144.1, preserving their native proportions. A 22-unit gap separates them; both clear the raised ice/sugar station on the left and toppings on the right.

Milk stands on the left board at x565/710; cream stands on the right at x996/1116. Each pair's feet use y884/890, a small depth stagger. Both package types now use elevated-view artwork and directional shadows anchored to their painted lower silhouettes, with enough wooden surface ahead of each foot for the shadow. Selection targets follow the packages.

The built-in imagegen tool supplied [kitchen-counter-clear-boards.png](../src/assets/kitchen/kitchen-counter-clear-boards.png), copied without alteration from `/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/exec-cc2ca757-2ea2-4394-a041-f3e13cc34bca.png`. Only a shaped mask over the old board footprints and shadow margins is rendered, ending at x1228/y590 in the original 1672×941 grid. A short transition blends into bare marble below the old reflections. All outside artwork continues to use existing textures. Original PNGs are unchanged.

[Desktop preview](central-boards-1284.png) · [Portrait preview](central-boards-390.png) · [Landscape preview](central-boards-932.png).

Validation: production build, regression suite, and taps/drags for all four packages at 1284×810, 390×844 and 932×430. Production assets copied to both native projects; no native binary build.

## Built-in edit prompt

```text
Use case: precise-object-edit. Edit target: attached original 1672x941 warm illustrated boba kitchen. Remove ONLY the two large empty pale wooden rectangular boards on the counter (left x25..663 y349..540, right x662..1219 y349..540), including their rounded wood edges, thick front edges and their local cast shadows. Fill those two vacated board footprints with continuous matching ivory marble countertop and the same warm directional sunlight; make it look like bare counter was always there. Preserve original countertop color, subtle fine stone texture and sunbeams. Keep all other artwork EXACTLY as reference: wooden tea rack, clear cup stacks and holder, sealing machine, pink straw holder, metal 3x3 topping tray, ice tray/scoop at lower left, counter front, canvas dimensions and framing. No new objects, boards, containers, packages, text or decoration. Do not soften or redraw other artwork. Output same 1672x941 full image. This is only a local removal source; the game will consume strictly masked pixels where the old two boards stood, keeping all outside pixels from the untouched original.
```
