# Liquid sugar tray

The sugar tray is now painted into the active room background alongside the ice tray, with straight
aligned edges. Its separate sprite is no longer rendered or preloaded. Both station bounds share
the same x, width and height; sugar starts eight logical pixels below ice. The silver ladle still
appears while carrying sugar. See [integrated trays](background-trays.md) for the current asset,
generation prompt and verification. The notes below record the earlier separate-asset design.

Sugar now uses a shallow stainless-steel tray of pale golden syrup, directly below the ice bin on the left of the counter. Its scrolling station bounds follow the artwork. The former jar is no longer rendered. A silver syrup ladle replaces the sugar-cube spoon both while carrying sugar and in recipe pictures; sweetness amounts and tap/drag controls stay the same.

Assets: `src/assets/kitchen/liquid-sugar-tray.png` (572×382) and `liquid-sugar-ladle.png` (400×260). Built-in imagegen used the active `kitchen-overhead.png` as the perspective, material and lighting reference. Transparent output was cropped to its visible alpha bounds and downsampled, preserving alpha. Original generated files:

- `/Users/dev/.codex/generated_images/01a1532e-5640-7403-b2c6-c038fa921c95/exec-181498d5-f9be-49a9-9fd8-e163871a488d.png`
- `/Users/dev/.codex/generated_images/01a1532e-5640-7403-b2c6-c038fa921c95/exec-af59e7c1-3d2e-4e5f-bdb4-2b464e74d943.png`

Tray prompt: Single isolated rectangular stainless-steel food-service tray filled with clear pale golden liquid sugar syrup and a small silver ladle resting inside. Match the reference ice bin's elevated perspective, polished metal rim, warm peach reflections, realistic depth and soft painted rendering. Broad opening, front slightly wider than back. Transparent background; no cubes, jar or text.

Ladle prompt: Single isolated stainless-steel ladle containing translucent pale golden syrup, bowl lower left and handle upper right, overhead oblique perspective, warm painted kitchen style, bright metal reflections and smooth glossy liquid. Transparent background; no granules, cubes or text.

The foreground mats reserve space to the right of the syrup tray so they cannot cover it at the room's leftmost pan. Verified visually in Chrome at 390×844, 375×667 and 932×430, including tapping the tray to increase sweetness at each size. Typecheck, regression suite and production build pass. [Phone preview](liquid-sugar-tray-preview.png).

Alignment revision source: `/Users/dev/.codex/generated_images/01a1532e-5640-7403-b2c6-c038fa921c95/exec-46b17100-73d5-4ca3-80fd-b51418ed27fc.png`. Prompt: edit the exact ice tray crop, preserve its outer silhouette, corner locations, thin metal rim and overhead perspective; replace ice with smooth pale golden syrup and the scoop with a ladle; transparent exterior. The full generated canvas is retained when downsampling so its corners preserve the reference registration.
