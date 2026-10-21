# One shared cup mat

The kitchen now draws one compact mat for both preparation and finished drinks. The separate
finishing image, layout bounds and cup home have been removed. Fresh cups, cups returned from
tea taps and cups ejected from the lidding machine all stand at the same center, including after
restoring a save or resizing the window.

The existing polka-dot cloth artwork is reused without added preparation/finishing lettering.
Its preferred size is 250×155.5 logical units, with a y1155 tabletop anchor. `kitchenHolderFor`
preserves the painted aspect ratio, centers it in the visible clear foreground and keeps space
before the counter front and beside the sugar tray. On short screens its width retains clearance
around an L cup. The cup's actual painted foot (`CUP_FOOT`) rests at the mat center. An empty
mat keeps the small “Chọn ly” hint, which disappears once a cup is present.

Build and typecheck pass. Geometry checks cover S/M/L, tabletop clearance and the cup's foot
position. Browser checks at 1284×800, 390×844, 375×667 and 932×430 cover one visible mat, dragging
all three sizes onto it, lidding and straws returning to it, finished-save restoration, resizing
and discarding back to an empty mat. The existing native-shell fingerprint mismatch still fails
in `check-updates.cjs`; other regression checks pass.

[Desktop preview](single-cup-mat-desktop.png) · [Phone preview](single-cup-mat-phone.png).
