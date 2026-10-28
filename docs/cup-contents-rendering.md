# Ingredients behind the glass

The preparation cup uses the shared Canvas renderer on web, Android and iOS. The room background,
holder position, cup outline, ingredient quantities and game rules are unchanged by this pass.

- Liquid has a continuous, softer body gradient and a restrained elliptical meniscus. Milk uses
  the tea’s milky palette, with temporary translucent mixing ribbons while a pour settles.
- Ice retains its stable layout and whole-outline containment. Broad translucent faces replace
  the prominent fine crack texture. Submerged facets absorb tea colour and lose contrast with
  depth, more strongly in milk. Their reflections remain behind the cup wall.
- All nine toppings retain their painted identities. Stable size/angle/position variation loosens
  the bed. Rear pieces are softer and more strongly tinted by liquid; front pieces remain readable.
  Wet tinting uses the sprite alpha rather than approximate silhouette shapes, avoiding halos.
- Syrup makes a small amber pool in an otherwise empty cup and dissolves during the first shallow pour.
- Cheese and brûlée retain their different painted folds and colours. The swirl sits in a thin
  foam bed at the tea’s actual surface, with short fading wisps beneath its near edge. The mound
  clears the side walls and stays behind the rolled front lip.

The rear floor is painted before the liquid. The near wall’s reflection covers the whole drink,
including the topping bed. `frontWall()` caches a foreground version of the glass: within the
existing inner-floor mask, a strip of wall above the back base arcs continues to the curved floor.
This prevents the far base ring appearing across the front of the pearls, without removing the
outer base, changing the cup silhouette, or adding a hard horizontal reflection cutoff.

`tools/check-cup-contents.cjs` checks 11,520 ice outlines, dry-to-wet continuity, topping clearance,
and cream seating. The optional `tools/check-cup-rendering.cjs` runs against Vite with Playwright:
it checks actual painted pixels for containment across 132 combinations, stronger ice occlusion
in milk, and syrup visibility/dissolution. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` to use local
installations if needed. Its paint timing is a desktop browser diagnostic, not a device benchmark.

Browser review also covered S/M/L at 390×844, 375×667, 932×430 and 1284×610, including pickup.
The build and regression suite pass. Capacitor assets are copied into both native projects;
Android/iOS binaries were not built or run on devices.

- [Drink comparisons](cup-ingredients-comparison.png)
- [Phone kitchen](cup-ingredients-390.png)
- [Small phone](cup-ingredients-375.png)
- [Landscape kitchen](cup-ingredients-932.png)
- [Desktop kitchen](cup-ingredients-1284.png)
