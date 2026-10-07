<#
Cut the cup and the drink out of the cup design, together.

    powershell -ExecutionPolicy Bypass -File tools/cut-cup-design.ps1

Writes src/assets/kitchen/cup.png, cup-base.png, drink-<tea>.png and drink-<tea>-top.png. Like the
rest of tools/, these are generated: change this script and re-run it rather than editing the PNGs.

The source, tools/sheets/cup-design.png, is the same cup drawn twice on a flat backdrop — once
empty and once full. That pairing is what makes this honest, and it replaces a long run of guessing:

* the glass comes off the empty one. Each pixel is solved back into what the plastic contributes,
    observed = backdrop * (1 - a) + colour * a
  for the smallest alpha that keeps `colour` in range, so the cup ends up genuinely see-through
  and a drink behind it shows through its walls;

* the drink comes from the difference between the two. Where the glass has alpha `a`, the full cup
  reads `colour*a + drink*(1-a)` and the empty one `colour*a + backdrop*(1-a)`, so
    drink = backdrop + (full - empty) / (1 - a)
  recovers the liquid itself — including what sits under the glass's own highlights. Nothing is
  invented and nothing is matched by eye;

* the well is not guessed either. The full cup shows exactly where liquid stands, so its silhouette
  *is* the well, and WELL in KitchenCup.tsx is traced from it.

The drink is written as two sprites because the cup's level moves: the body, cut to the shape of
the well for the game to reveal from the bottom up, and the oval surface on its own, which the game
stands on that reveal line. Revealing one sprite with the oval in it would slice the oval off flat
at every level but full.

Teas other than the one drawn are re-coloured: every pixel keeps its distance from the drawn
drink's body colour, in hue, saturation and lightness, and that distance is laid onto the new one.
#>

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcPath = Join-Path $root 'tools\sheets\cup-design.png'
$outDir = Join-Path $root 'src\assets\kitchen'

# The two cups on the sheet, and the backdrop they stand on.
$EMPTY_X = 9; $FULL_X = 129; $TOP_Y = 10
$CW = 113; $CH = 174
$BG_R = 178.0; $BG_G = 182.0; $BG_B = 185.0
# The cat printed on the glass: opaque ink, so it is taken as it is rather than solved.
$DECAL_X1 = 24; $DECAL_X2 = 89; $DECAL_Y1 = 76; $DECAL_Y2 = 132
$DECAL_INK = 110.0
$DECAL_SEEDS = @(@(50, 88), @(56, 88), @(62, 88))
# Where the drink stands in the full cup: the oval's apex, where it meets the glass, the foot, and
# a row clear of the cat to stand for the body.
#
# The surface is a whole ellipse, and the design draws all of it: the far rim lights up at y 39, the
# liquid meets the glass at 48, the near rim is the bright band at 49..51, and the tone settles back
# to plain body at 60. So the sprite runs 38..59 — ten rows above the line and twelve below.
#
# The lower half is cut to the ellipse rather than left square. That is what keeps it inside the
# glass: the game stretches this sprite to however wide the glass is *at the surface*, so a square
# lower half would be drawn at the width of the line all the way down, and once the cup is nearly
# empty and the surface sits in the foot — where the glass closes fast — it would hang out past the
# walls. An ellipse closes faster than the foot does, so it stays in.
$OVAL_T = 38; $SURFACE_Y = 48; $OVAL_B = 60; $WELL_B = 162; $BODY_Y = 66
# The surface sprite is cropped to the liquid's own span, not left the width of the cup. The game
# stretches it to however wide the glass is at the level it sits, so any empty margin either side
# would be stretched too — squashing the surface inwards and leaving the body and the glass's ticks
# showing in the gap.
$OVAL_X1 = 14; $OVAL_W = 85
$RISE = $SURFACE_Y - $OVAL_T
$OVAL_H = $OVAL_B - $OVAL_T
# WELL, traced from the full cup, as KitchenCup.tsx draws it.
$WELL_KNEE = 156.0
$WELL_TL = 14.0; $WELL_TR = 99.0
$WELL_KL = 22.0; $WELL_KR = 91.0
$WELL_BL = 37.0; $WELL_BR = 76.0

$TEAS = @(
  @{ id = 'black'; color = '#B26337'; milky = '#CE8B5E' },
  @{ id = 'green'; color = '#91C23C'; milky = '#CCE3A3' },
  @{ id = 'thai'; color = '#FE7220'; milky = '#FFB081' },
  @{ id = 'oolong'; color = '#D48B40'; milky = '#E9C8A7' },
  @{ id = 'taro'; color = '#B8A0DB'; milky = '#E0D4F1' },
  @{ id = 'matcha'; color = '#72AD3B'; milky = '#C0DAA8' }
)

function To-Hsl([double]$r, [double]$g, [double]$b) {
  $r /= 255.0; $g /= 255.0; $b /= 255.0
  $mx = [math]::Max($r, [math]::Max($g, $b)); $mn = [math]::Min($r, [math]::Min($g, $b))
  $span = $mx - $mn
  $h = 0.0
  if ($span -ne 0) {
    if ($mx -eq $r) { $h = ((($g - $b) / $span) + $(if ($g -lt $b) { 6 } else { 0 })) / 6.0 }
    elseif ($mx -eq $g) { $h = ((($b - $r) / $span) + 2) / 6.0 }
    else { $h = ((($r - $g) / $span) + 4) / 6.0 }
  }
  $l = ($mx + $mn) / 2.0
  $s = if ($span -eq 0) { 0.0 } else { $span / (1 - [math]::Abs($mx + $mn - 1)) }
  return @($h, $s, $l)
}
function From-Hsl([double]$h, [double]$s, [double]$l) {
  $h = $h - [math]::Floor($h)
  $s = [math]::Max(0.0, [math]::Min(1.0, $s)); $l = [math]::Max(0.0, [math]::Min(1.0, $l))
  $c = (1 - [math]::Abs(2 * $l - 1)) * $s
  $x = $c * (1 - [math]::Abs((($h * 6) % 2) - 1))
  $m = $l - $c / 2
  switch ([int][math]::Floor($h * 6) % 6) {
    0 { $rr = $c; $gg = $x; $bb = 0 } 1 { $rr = $x; $gg = $c; $bb = 0 }
    2 { $rr = 0; $gg = $c; $bb = $x } 3 { $rr = 0; $gg = $x; $bb = $c }
    4 { $rr = $x; $gg = 0; $bb = $c } default { $rr = $c; $gg = 0; $bb = $x }
  }
  return @([int][math]::Round([math]::Max(0.0, [math]::Min(1.0, $rr + $m)) * 255),
           [int][math]::Round([math]::Max(0.0, [math]::Min(1.0, $gg + $m)) * 255),
           [int][math]::Round([math]::Max(0.0, [math]::Min(1.0, $bb + $m)) * 255))
}
function Well-L([double]$y) {
  if ($y -le $WELL_KNEE) { return $WELL_TL + ($WELL_KL - $WELL_TL) * (($y - $SURFACE_Y) / ($WELL_KNEE - $SURFACE_Y)) }
  return $WELL_KL + ($WELL_BL - $WELL_KL) * (($y - $WELL_KNEE) / ($WELL_B - $WELL_KNEE))
}
function Well-R([double]$y) {
  if ($y -le $WELL_KNEE) { return $WELL_TR + ($WELL_KR - $WELL_TR) * (($y - $SURFACE_Y) / ($WELL_KNEE - $SURFACE_Y)) }
  return $WELL_KR + ($WELL_BR - $WELL_KR) * (($y - $WELL_KNEE) / ($WELL_B - $WELL_KNEE))
}

$f = [System.Drawing.Bitmap]::FromFile($srcPath)
$sheet = New-Object System.Drawing.Bitmap $f
$f.Dispose()

# ---- the glass, solved off the empty cup -------------------------------------------------------
$count = $CW * $CH
$ga = New-Object 'double[]' $count
$gr = New-Object 'int[]' $count
$gg = New-Object 'int[]' $count
$gb = New-Object 'int[]' $count

for ($j = 0; $j -lt $CH; $j++) {
  for ($i = 0; $i -lt $CW; $i++) {
    $p = $sheet.GetPixel(($EMPTY_X + $i), ($TOP_Y + $j))
    $idx = $j * $CW + $i
    $a = 0.0
    foreach ($pair in @(@([double]$p.R, $BG_R), @([double]$p.G, $BG_G), @([double]$p.B, $BG_B))) {
      $v = $pair[0]; $b = $pair[1]
      if ($v -gt $b) { $e = if ($b -lt 254.5) { ($v - $b) / (255.0 - $b) } else { 0.0 } }
      else { $e = if ($b -gt 0.5) { ($b - $v) / $b } else { 0.0 } }
      if ($e -gt $a) { $a = $e }
    }
    if ($a -gt 1.0) { $a = 1.0 }
    $ga[$idx] = $a
    if ($a -gt 0.004) {
      $cr = [int][math]::Round(($p.R - $BG_R * (1.0 - $a)) / $a)
      $cg = [int][math]::Round(($p.G - $BG_G * (1.0 - $a)) / $a)
      $cb = [int][math]::Round(($p.B - $BG_B * (1.0 - $a)) / $a)
      if ($cr -lt 0) { $cr = 0 }; if ($cr -gt 255) { $cr = 255 }
      if ($cg -lt 0) { $cg = 0 }; if ($cg -gt 255) { $cg = 255 }
      if ($cb -lt 0) { $cb = 0 }; if ($cb -gt 255) { $cb = 255 }
      $gr[$idx] = $cr; $gg[$idx] = $cg; $gb[$idx] = $cb
    }
  }
}

# the cat is ink on the glass, not glass: take it as drawn and leave it opaque
$isDecal = [bool[]]::new($count)
for ($j = $DECAL_Y1; $j -le $DECAL_Y2; $j++) {
  for ($i = $DECAL_X1; $i -le $DECAL_X2; $i++) {
    $p = $sheet.GetPixel(($EMPTY_X + $i), ($TOP_Y + $j))
    $lum = 0.299 * $p.R + 0.587 * $p.G + 0.114 * $p.B
    if ($lum -lt $DECAL_INK) { $isDecal[$j * $CW + $i] = $true }
  }
}
$fill = New-Object 'System.Collections.Generic.Stack[int]'
foreach ($seed in $DECAL_SEEDS) { $fill.Push($seed[1] * $CW + $seed[0]) }
while ($fill.Count -gt 0) {
  $q = $fill.Pop()
  if ($isDecal[$q]) { continue }
  $qi = $q % $CW; $qj = [int][math]::Floor($q / $CW)
  if ($qi -lt $DECAL_X1 -or $qi -gt $DECAL_X2 -or $qj -lt $DECAL_Y1 -or $qj -gt $DECAL_Y2) { continue }
  $isDecal[$q] = $true
  $fill.Push($q + 1); $fill.Push($q - 1); $fill.Push($q + $CW); $fill.Push($q - $CW)
}

# the backdrop is whatever the border reaches
$outside = [bool[]]::new($count)
$stack = New-Object 'System.Collections.Generic.Stack[int]'
for ($i = 0; $i -lt $CW; $i++) { $stack.Push($i); $stack.Push(($CH - 1) * $CW + $i) }
for ($j = 0; $j -lt $CH; $j++) { $stack.Push($j * $CW); $stack.Push($j * $CW + $CW - 1) }
while ($stack.Count -gt 0) {
  $q = $stack.Pop()
  if ($outside[$q] -or $ga[$q] -ge 0.06) { continue }
  $outside[$q] = $true
  $qi = $q % $CW; $qj = [int][math]::Floor($q / $CW)
  if ($qi + 1 -lt $CW) { $stack.Push($q + 1) }
  if ($qi - 1 -ge 0) { $stack.Push($q - 1) }
  if ($qj + 1 -lt $CH) { $stack.Push($q + $CW) }
  if ($qj - 1 -ge 0) { $stack.Push($q - $CW) }
}

$cup = New-Object System.Drawing.Bitmap($CW, $CH)
$base = New-Object System.Drawing.Bitmap($CW, $CH)
$clear = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
$cream = [System.Drawing.Color]::FromArgb(255, 255, 250, 244)
$rowL = [int[]]::new($CH); $rowR = [int[]]::new($CH)
for ($j = 0; $j -lt $CH; $j++) {
  $rowL[$j] = -1; $rowR[$j] = -1
  for ($i = 0; $i -lt $CW; $i++) {
    $idx = $j * $CW + $i
    # The cat is printed on the *front* of the cup, so it is cut out of the glass and written as
    # its own sprite for the game to lay over everything. Left in the glass it would sit behind the
    # drink, which pours straight over it.
    if ($isDecal[$idx]) {
      $cup.SetPixel($i, $j, $clear)
      if ($rowL[$j] -lt 0) { $rowL[$j] = $i }
      $rowR[$j] = $i
      continue
    }
    $a = $ga[$idx]
    if ($outside[$idx]) { $a = 0.0 }
    $av = [int][math]::Round($a * 255)
    if ($av -le 2) { $cup.SetPixel($i, $j, $clear); continue }
    $cup.SetPixel($i, $j, [System.Drawing.Color]::FromArgb($av, $gr[$idx], $gg[$idx], $gb[$idx]))
    if ($av -gt 25) { if ($rowL[$j] -lt 0) { $rowL[$j] = $i }; $rowR[$j] = $i }
  }
}
for ($j = 0; $j -lt $CH; $j++) {
  for ($i = 0; $i -lt $CW; $i++) {
    if ($rowL[$j] -ge 0 -and $i -ge ($rowL[$j] + 1) -and $i -le ($rowR[$j] - 1)) { $base.SetPixel($i, $j, $cream) }
    else { $base.SetPixel($i, $j, $clear) }
  }
}
$ms = New-Object System.IO.MemoryStream
$cup.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'cup.png'), $ms.ToArray())
$ms.Dispose(); $cup.Dispose()
$ms = New-Object System.IO.MemoryStream
$base.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'cup-base.png'), $ms.ToArray())
$ms.Dispose(); $base.Dispose()

# The cup's dark linework, kept as its own sprite for the game to lay over the drink. The drink
# runs down to the foot of the glass, which means it crosses the outline round the base; with the
# outline only underneath it the drink covers some of it and not the rest, which is what showed up
# as stray marks down there. Drawn over the top instead, the edge stays whole whatever the drink does.
$edge = New-Object System.Drawing.Bitmap($CW, $CH)
for ($j = 0; $j -lt $CH; $j++) {
  for ($i = 0; $i -lt $CW; $i++) {
    $idx = $j * $CW + $i
    $lum = 0.299 * $gr[$idx] + 0.587 * $gg[$idx] + 0.114 * $gb[$idx]
    if ($outside[$idx] -or $isDecal[$idx] -or $ga[$idx] -lt 0.5 -or $lum -gt 120) {
      $edge.SetPixel($i, $j, $clear); continue
    }
    $edge.SetPixel($i, $j, [System.Drawing.Color]::FromArgb([int][math]::Round($ga[$idx] * 255), $gr[$idx], $gg[$idx], $gb[$idx]))
  }
}
$ms = New-Object System.IO.MemoryStream
$edge.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'cup-edge.png'), $ms.ToArray())
$ms.Dispose(); $edge.Dispose()

$decal = New-Object System.Drawing.Bitmap($CW, $CH)
for ($j = 0; $j -lt $CH; $j++) {
  for ($i = 0; $i -lt $CW; $i++) {
    $idx = $j * $CW + $i
    if (-not $isDecal[$idx]) { $decal.SetPixel($i, $j, $clear); continue }
    $p = $sheet.GetPixel(($EMPTY_X + $i), ($TOP_Y + $j))
    $decal.SetPixel($i, $j, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
  }
}
$ms = New-Object System.IO.MemoryStream
$decal.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'cup-decal.png'), $ms.ToArray())
$ms.Dispose(); $decal.Dispose()
Write-Output "wrote cup.png, cup-base.png and cup-decal.png (${CW}x${CH})"

# ---- the drink, taken straight off the full cup ------------------------------------------------
# Not recovered from behind the glass. Solving the liquid out of the full cup and then compositing
# it back under our own glass goes through two lots of error and comes out blotchy and off-colour.
# The full cup already shows exactly what a full cup should look like, so that is what is used: the
# game draws the empty cup, then lays this over the part that is full. The cat is left out of it,
# because the cup underneath has its own and it would otherwise be re-coloured along with the tea.
$drinkR = New-Object 'double[]' $count
$drinkG = New-Object 'double[]' $count
$drinkB = New-Object 'double[]' $count
$isLiquid = [bool[]]::new($count)
for ($j = 0; $j -lt $CH; $j++) {
  for ($i = 0; $i -lt $CW; $i++) {
    $idx = $j * $CW + $i
    $p = $sheet.GetPixel(($FULL_X + $i), ($TOP_Y + $j))
    $drinkR[$idx] = $p.R; $drinkG[$idx] = $p.G; $drinkB[$idx] = $p.B
    # the tea is warm and the glass is not, which separates them even under the glass's highlights
    if (($p.R - $p.B) -gt 14) { $isLiquid[$idx] = $true }
  }
}
# Fill what the test leaves hollow — the cat, the moulded ticks, a specular or two — by flooding in
# from the border: anything the outside cannot reach is surrounded by tea, so it is tea behind.
$notLiquid = [bool[]]::new($count)
$flood = New-Object 'System.Collections.Generic.Stack[int]'
for ($i = 0; $i -lt $CW; $i++) { $flood.Push($i); $flood.Push(($CH - 1) * $CW + $i) }
for ($j = 0; $j -lt $CH; $j++) { $flood.Push($j * $CW); $flood.Push($j * $CW + $CW - 1) }
while ($flood.Count -gt 0) {
  $q = $flood.Pop()
  if ($notLiquid[$q] -or $isLiquid[$q]) { continue }
  $notLiquid[$q] = $true
  $qi = $q % $CW; $qj = [int][math]::Floor($q / $CW)
  if ($qi + 1 -lt $CW) { $flood.Push($q + 1) }
  if ($qi - 1 -ge 0) { $flood.Push($q - 1) }
  if ($qj + 1 -lt $CH) { $flood.Push($q + $CW) }
  if ($qj - 1 -ge 0) { $flood.Push($q - $CW) }
}
for ($q = 0; $q -lt $count; $q++) { if (-not $notLiquid[$q]) { $isLiquid[$q] = $true } }

# report what the design actually holds, so the constants in KitchenCup.tsx can be checked
foreach ($probe in @($SURFACE_Y, 100, 150, 158, 162, 165)) {
  $l = -1; $r = -1
  for ($i = 0; $i -lt $CW; $i++) { if ($isLiquid[$probe * $CW + $i]) { if ($l -lt 0) { $l = $i }; $r = $i } }
  Write-Output ("  liquid at y={0,3}: {1}..{2}" -f $probe, $l, $r)
}

# the body colour of the drawn drink, read below the surface and above the cat
$buckets = @{}
for ($j = 64; $j -le 74; $j++) {
  $wl = [int](Well-L ([double]$j)) + 3; $wr = [int](Well-R ([double]$j)) - 3
  for ($i = $wl; $i -le $wr; $i++) {
    $idx = $j * $CW + $i
    $key = "{0}_{1}_{2}" -f [int]($drinkR[$idx] / 6), [int]($drinkG[$idx] / 6), [int]($drinkB[$idx] / 6)
    if (-not $buckets.ContainsKey($key)) { $buckets[$key] = @(0, 0.0, 0.0, 0.0) }
    $e = $buckets[$key]
    $buckets[$key] = @(($e[0] + 1), ($e[1] + $drinkR[$idx]), ($e[2] + $drinkG[$idx]), ($e[3] + $drinkB[$idx]))
  }
}
$best = $null; $bestN = -1
foreach ($k in $buckets.Keys) { if ($buckets[$k][0] -gt $bestN) { $bestN = $buckets[$k][0]; $best = $buckets[$k] } }
$srcHsl = To-Hsl ($best[1] / $best[0]) ($best[2] / $best[0]) ($best[3] / $best[0])
Write-Output ("drawn drink body #{0:X2}{1:X2}{2:X2}" -f [int]($best[1] / $best[0]), [int]($best[2] / $best[0]), [int]($best[3] / $best[0]))

# The colour to draw each oval row from, as a span: the design's own liquid on that row. Rows where
# the far rim is too pale for the test to call it liquid borrow the row below, so the arc is never
# short of colour. Sampling is clamped to this span, which spreads the rim's own highlight along the
# arc instead of running off the end of it.
$ovalL = [int[]]::new($OVAL_H)
$ovalR = [int[]]::new($OVAL_H)
for ($j = 0; $j -lt $OVAL_H; $j++) {
  $ly = $OVAL_T + $j
  $lo = -1; $hi = -1
  for ($i = 0; $i -lt $CW; $i++) { if ($isLiquid[$ly * $CW + $i]) { if ($lo -lt 0) { $lo = $i }; $hi = $i } }
  $ovalL[$j] = $lo; $ovalR[$j] = $hi
}
for ($j = $OVAL_H - 2; $j -ge 0; $j--) {
  if ($ovalL[$j] -ge 0) { continue }
  $ovalL[$j] = $ovalL[$j + 1]; $ovalR[$j] = $ovalR[$j + 1]
}

# Where the body's one clean row runs, so every row of the body can be drawn from it.
$BODY_L = -1; $BODY_R = -1
for ($i = 0; $i -lt $CW; $i++) {
  if (-not $isLiquid[$BODY_Y * $CW + $i]) { continue }
  if ($BODY_L -lt 0) { $BODY_L = $i }
  $BODY_R = $i
}

function Save-Drink([string]$toHex, [string]$name) {
  $v = [Convert]::ToInt32($toHex.Substring(1), 16)
  $dst = To-Hsl ((($v -shr 16) -band 255)) ((($v -shr 8) -band 255)) (($v -band 255))

  $body = New-Object System.Drawing.Bitmap($CW, $CH)
  for ($j = 0; $j -lt $CH; $j++) {
    # What the glass holds on this row: the design's own liquid footprint, nothing more. It ends in
    # a soft arc at y 162 and the glass's bright base is drawn below it — carrying the drink down
    # into that base only turned into a dark wedge hanging off the bottom of the pour. Taken as a
    # span rather than pixel by pixel, so the glass's moulded ticks don't punch holes through it.
    $rowFrom = -1; $rowTo = -1
    if ($j -ge $SURFACE_Y -and $j -le $WELL_B) {
      for ($i = 0; $i -lt $CW; $i++) {
        if (-not $isLiquid[$j * $CW + $i]) { continue }
        if ($rowFrom -lt 0) { $rowFrom = $i }
        $rowTo = $i
      }
    }
    if ($rowFrom -lt 0) {
      for ($i = 0; $i -lt $CW; $i++) { $body.SetPixel($i, $j, $clear) }
      continue
    }
    for ($i = 0; $i -lt $CW; $i++) {
      if ($i -lt $rowFrom -or $i -gt $rowTo) { $body.SetPixel($i, $j, $clear); continue }
      # Every row is drawn from the one clean row, stretched across whatever the glass holds here.
      # The design's body is one tone from y 61 to 84, so nothing is lost by it — and it matters at
      # the other end: taken row for row, the sprite's lowest rows carry the base's own bright rim
      # and dark band, which only read as a base when seen through a full cup. Revealed on their
      # own as a shallow pour they read as stacked discs with ledges between them.
      $t = ($i - $rowFrom) / [math]::Max(1.0, [double]($rowTo - $rowFrom))
      $src = $BODY_Y * $CW + $BODY_L + [int][math]::Round($t * ($BODY_R - $BODY_L))
      $here = To-Hsl $drinkR[$src] $drinkG[$src] $drinkB[$src]
      $out = From-Hsl ($dst[0] + ($here[0] - $srcHsl[0])) ($dst[1] + ($here[1] - $srcHsl[1])) ($dst[2] + ($here[2] - $srcHsl[2]))
      $body.SetPixel($i, $j, [System.Drawing.Color]::FromArgb(255, $out[0], $out[1], $out[2]))
    }
  }
  $m1 = New-Object System.IO.MemoryStream
  $body.Save($m1, [System.Drawing.Imaging.ImageFormat]::Png)
  [System.IO.File]::WriteAllBytes((Join-Path $outDir "drink-$name.png"), $m1.ToArray())
  $m1.Dispose(); $body.Dispose()

  # The surface, as the ellipse it is. The shape is drawn rather than masked off the design: the far
  # rim is painted nearly the colour of the glass, so no test tells the two apart cleanly and the arc
  # comes out lopsided.
  #
  # The colour is the design's, but read *along* the arc rather than straight across. Down the middle
  # the ellipse is at its deepest and the design's rows map to it one for one; out at the sides it is
  # shallow, so the same rows are squeezed into fewer. Copied row for row instead, the near rim's
  # bright band runs across the surface as a flat stripe with the arc carrying on past it — which is
  # what made the surface read as a disc inside a disc. Followed around, the band wraps the front
  # edge the way it does in the design.
  $top = New-Object System.Drawing.Bitmap($OVAL_W, $OVAL_H)
  $cx = ($OVAL_W - 1) / 2.0
  $DROP = $OVAL_B - $SURFACE_Y
  for ($i = 0; $i -lt $OVAL_W; $i++) {
    $u = ($i - $cx) / $cx
    $arc = [math]::Sqrt([math]::Max(0.0, 1.0 - $u * $u))
    $hUp = $RISE * $arc
    $hDn = $DROP * $arc
    for ($j = 0; $j -lt $OVAL_H; $j++) {
      $dy = ($OVAL_T + $j) - $SURFACE_Y
      $span = if ($dy -lt 0) { $hUp } else { $hDn }
      if ($span -lt 0.5) { $top.SetPixel($i, $j, $clear); continue }
      $fr = [math]::Abs($dy) / $span
      if ($fr -gt 1.0) { $top.SetPixel($i, $j, $clear); continue }
      if ($dy -lt 0) {
        # the far half ends on the liquid's own silhouette, so it is only feathered
        $ly = $SURFACE_Y - [int][math]::Round($fr * $RISE)
        $a = [math]::Min(1.0, (1.0 - $fr) * $span / 1.2)
      } else {
        # the near half fades out as it closes, melting into the body sprite behind it rather than
        # ending on a rim of its own
        $ly = $SURFACE_Y + [int][math]::Round($fr * $DROP)
        $a = [math]::Min(1.0, (1.0 - $fr) * 2.5)
      }
      $jj = $ly - $OVAL_T
      $sx = $OVAL_X1 + $i
      if ($sx -lt $ovalL[$jj]) { $sx = $ovalL[$jj] }
      if ($sx -gt $ovalR[$jj]) { $sx = $ovalR[$jj] }
      $idx = $ly * $CW + $sx
      $here = To-Hsl $drinkR[$idx] $drinkG[$idx] $drinkB[$idx]
      $out = From-Hsl ($dst[0] + ($here[0] - $srcHsl[0])) ($dst[1] + ($here[1] - $srcHsl[1])) ($dst[2] + ($here[2] - $srcHsl[2]))
      $top.SetPixel($i, $j, [System.Drawing.Color]::FromArgb([int][math]::Round($a * 255), $out[0], $out[1], $out[2]))
    }
  }
  $m2 = New-Object System.IO.MemoryStream
  $top.Save($m2, [System.Drawing.Imaging.ImageFormat]::Png)
  [System.IO.File]::WriteAllBytes((Join-Path $outDir "drink-$name-top.png"), $m2.ToArray())
  $m2.Dispose(); $top.Dispose()
}

foreach ($tea in $TEAS) {
  Save-Drink $tea.color $tea.id
  Save-Drink $tea.milky ("{0}-milky" -f $tea.id)
}
$sheet.Dispose()
Write-Output "wrote drink-<tea>.png (${CW}x${CH}) and drink-<tea>-top.png (${OVAL_W}x${OVAL_H}) for 6 teas"
