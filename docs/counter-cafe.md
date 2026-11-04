# Cafe order screen

The counter now uses one cohesive painted cafe background per orientation, with the warm
palette, queue aisle, windows, lamps, seating, register and cookie shelves from the user's
reference. All signage is Vietnamese. The original kitchen painting is unchanged.

## Artwork

- `src/assets/counter/cafe-portrait.png`: 941×1672, copied from built-in image-generation output
  `exec-82595073-cc23-4e8a-a1bc-b95280e912c1.png`.
- `src/assets/counter/cafe-landscape.png`: 1942×809, copied from built-in image-generation output
  `exec-7c3ec3fc-83c4-4ed5-897f-2bd185cb424b.png`.

Both source outputs are under
`/Users/dev/.codex/generated_images/01a13e8f-a6f5-7171-9278-add319e78a23/`.
They were copied without changing their pixels. The portrait uses the user's reference;
the landscape uses the generated portrait as its reference.

## Integration

`counter/roomLayout.ts` holds image dimensions and measured queue/register locations without
importing assets. Phaser and Preact share the same cover projection. `counter/Backdrop.ts`
draws the room once, replacing the old SVG wall, clouds and separate counter surfaces.
The new room includes its decoration regardless of purchased gear; gear's gameplay effects remain.

Customers retain their faces, accessories, moods, patience bubbles and order interactions.
Their standing variant adds legs, shoes and floor shadows, with their feet aligned to the queue
mat. Taps are limited to the customer/bubble region so decorative surfaces do not take orders.
The register is a keyboard-accessible shortcut: `Nhận đơn` takes the next requesting customer;
when all orders are taken, `Pha chế` opens the kitchen. Its touch target is at least 44px tall,
and it stops accepting touches while the page slides, while paused, or under the opening sign.
All displayed counts come from the existing game state. The HUD uses the warm palette on both pages.

## Verification

`npm run build`, `npm test`, `git diff --check`, and `npx cap copy`.
Native assets are copied for Android/iOS; native-device execution is not part of this check.

The optional `tools/check-counter-screen.cjs` browser check needs Vite running and Playwright.
It checks 375×667, 390×844, 568×320, 932×430 and 768×1024: two/three customers, actual pointer
taps, the register, selecting an ordered customer, swipe cancellation, pause, no hidden register
touch interception and no page errors. `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `BASE_URL` and
`SCREENSHOT_DIR` can select local browser tooling and capture previews.

## Portrait generation prompt

```text
Use case: stylized-concept. Create a polished portrait 9:16 hand-painted background for the order/customer screen of a cozy bubble tea shop game, closely matching the provided reference's art, furnishings, warm honey-yellow and cream palette, composition and perspective. This is a functional game background, with NO PEOPLE, no characters.
Recreate the sunny cafe: tall wood-framed glass doors left, large rear picture window with leafy sunlit trees, three cream pendant lamps, exposed ceiling beams, trailing pothos in upper corners, caramel upholstered banquette, wooden bentwood chairs and small round cafe tables with little flower vases, cream tiled reflective floor, potted greenery, small rear shelves and bubble-tea poster.
A clear central queue aisle leads towards the player between brass stanchions and soft cream ropes, with a woven order mat in the aisle. Leave the central band around 40–62% of image height open enough for three game customers to stand there.
Foreground: a richly detailed cream marble service counter across the bottom, with honey wood cabinets and open cubbies holding glass cookie jar and baskets of packaged cookies, a plant on the right. The front occluding counter edge starts at approximately 62% of the image height. Arrange the cash register and receipt printer on the left, a small standing illustrated menu board in the center, brass service bell, leaf-embroidered serving mat, and a wooden finished-drink tray holding three colorful boba display cups on the right, mostly below this 62% height line. Nothing floating; cohesive contact shadows and perspective. Keep the cash register's cream screen BLANK, with only a tiny leaf emblem at its top: real game UI will be placed on it. No painted buttons.
Vietnamese signage only: aisle mat says 'GỌI MÓN'; A-frame queue sign says 'Mời bạn gọi món' with a small right arrow; menu header 'THỰC ĐƠN' with four small drink illustrations and decorative dotted separators but NO tiny menu text; drinks tray says 'TRÀ ĐÃ PHA'; cafe poster says 'Trà sữa'. Cookie basket labels use only small leaf/bear symbols. Do not include English.
Crisp illustration with rich painted texture, warm white reflections, dimensional furniture, gentle sunlight and shadows, excellent small-screen legibility. Render the entire room and counter as ONE seamless cohesive painting. No UI overlay, borders, split screens, watermarks. Full bleed rectangular image, no transparency.
```

## Landscape generation prompt

```text
Use case: stylized-concept. Create a WIDE LANDSCAPE 2.4:1 version of the supplied cozy bubble tea cafe game background. This is the same room, furnishing, warm honey-gold and cream hand-painted illustration style, now composed for a landscape phone/tablet screen. Full bleed, no borders, no people, no characters, no UI overlays.
Sunny wood-framed windows and leafy trees outside, cream pendant lamps, exposed wood beams, trailing pothos, caramel banquette with wooden cafe chairs and round tables, flowers, brass queue stanchions on a tiled floor. Keep an open central queue aisle at the middle of the painting for three live game customers. Include an A-frame Vietnamese 'Mời bạn gọi món' sign on the LEFT and woven 'GỌI MÓN' mat centered.
A foreground marble cashier counter stretches across the bottom THIRD, at y=67% as the front customer occlusion line. All foreground counter furnishings mostly stay below that line, leaving the middle unobstructed. Place the cream cash register at lower left with its BLANK cream display and tiny leaf emblem, receipt printer and stationery; illustrated menu board slightly right of center with 'THỰC ĐƠN' and drink pictures with dotted rows but no small print; brass bell; serving mat; wooden tray of three colorful boba drinks to the right labeled 'TRÀ ĐÃ PHA'. Honey wood counter facade and lower open cookie cubbies visible along bottom with cookie jar, baskets of packaged cookies and greenery. Compose these furnishings low and compact so the room and queue remain visible.
The register display must be a plain cream panel, no buttons or text: live game controls will be placed there. Vietnamese signs only, no English. Poster says 'Trà sữa'. Rich crisp painted texture, consistent warm sunlight, realistic contact shadows, no blurry areas. Preserve the reference room's inviting atmosphere and decorative details. Extra wide horizontal panorama, width about 2.4 times height.
```
