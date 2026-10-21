# Visual ingredient orders

The kitchen has no ingredient name tags or printed ingredient names. Recipes are pictures that
match the actual ingredients and equipment:

- Tea icons crop the same dispenser atlas as the kitchen, with matching pictorial emblems:
  brown tea leaves, jasmine flower, star anise, rolled oolong leaves, taro and matcha.
- Topping icons crop the actual scoop artwork, retaining the pearls, beans, cubes, colors and
  translucent highlights used at the tray. Small 3×3 diagrams locate similar pale toppings.
- Milk cartons and cream dispensers share SVG drawings between the order panel, counter and
  carried tool. Enlarged cow, oat, cheese and caramel insets clarify their differences on phones.
- Sugar uses the painted spoon with a percentage badge. Ice uses the painted cubes with ×1/×2
  scoop badges. Cup sizes use a glass illustration with clear brown contours, a cool glass tint
  and the game's cat decal, plus S/M/L. This keeps the empty glass visible on the pale panel.

Tea icons also carry a 3×2 shelf diagram. The diagrams indicate the station's position in the
full shelf/tray; their mapping comes from the same slot arrays as the kitchen layout.

`src/art/ingredientIcon.ts` builds the order pictures. `src/art/ingredientMarks.ts` supplies shared
emblems, and `src/art/kitchenEquipment.ts` supplies milk/cream packages. Station emblems and
packages are rasterised once by `prepareEquipmentTextures`; no per-frame image work is added.

`OrderBubble` uses the space formerly occupied by captions for larger pictures. Full Vietnamese
names and completion states remain in accessible labels. Toppings check off individually as they
are added. Scoring and recipes are unchanged. On a short landscape screen, the waiting portraits
sit in the header so all requested ingredients remain visible.

Validation: `check-order-art.cjs` checks distinct variants, atlas crops and shelf/tray maps. Chrome
checks cover eight-ingredient orders with zero and three waiting orders at 375×667, 390×844,
844×390, 932×430, 1180×820 and 1284×610, including unclipped pictures, accessible names and individual
topping checks. Milk and cream tap/drag interactions are checked in portrait and landscape.

Preview: [visual order and matching equipment](visual-order-preview.png).
