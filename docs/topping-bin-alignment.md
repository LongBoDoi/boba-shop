# Topping bin alignment

`toppingGeometry.ts` now follows the pan rims in the active `kitchen-room-aligned-trays.png`
background. The previous bounds shifted the bins down and right, and divided their depth into
equal thirds. The painted compartments deepen toward the foreground. The corrected plane starts
at x1436..1834, y427 and ends at x1461..1894, y725, before the existing 350-unit wall offset.
Its row boundaries are y427, 516, 616 and 725. Both column dividers stay straight throughout.

The shared geometry positions filled bins, empty bins and their touch targets through
`layoutKitchen`; the room painting and topping artwork are unchanged. The existing horizontal-band
projection and small rim overlap remain in place to avoid seams on phones.

The geometry check verifies projected row rims against measurements in the 1452×1083 background,
as well as straight columns, projective corners and band coverage. Build and typecheck pass.
Browser validation covers the centers of all nine painted compartments and dragging from the
three front bins at 1284×800, 390×844, 375×667 and 932×430. The existing native-shell fingerprint
check still fails in `check-updates.cjs`; other regression checks pass.

[Tray detail](topping-bin-fit.png).
