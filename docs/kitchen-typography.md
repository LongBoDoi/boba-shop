# Kitchen lettering

Ingredient name tags and printed names have been replaced by matching pictures on the equipment
and in the order panel. See [visual orders](visual-orders.md).
Sugar uses an unlabeled golden-syrup tray painted into the background below the ice tray.

Functional lettering retains an 11 CSS pixel minimum: the cup-size badge, sugar percentage,
ice scoop count, hints and the HTML UI. The cup-size badge compensates for docking scale.
Its compact card is 14 CSS pixels high, with 6px total horizontal padding; scaling preserves
that size on high-density screens rather than using the texture's raw pixel dimensions.
Ingredient names remain in accessible labels. Decorative wall art stays in the background painting.
The cup station has small warm-paper S/M/L plaques centered beneath the painted stacks on the
wooden front. Their anchors come from `ROOM_BG_CUP_STATION.labels`, independently of touch-target
minimums. They scale with the room, retaining an 11 CSS pixel minimum for the letters; measured
glyph bounds center the lettering vertically. A fine border, tiny fasteners and a tight contact
shadow match the organizer's warm palette. These plaques share the room atlas.
The ice box likewise uses its original background artwork and lettering, without an added tag or graphic.
