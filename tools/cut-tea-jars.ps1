<#
Cut the dispensers out of the design sheet, one per tea.

    powershell -ExecutionPolicy Bypass -File tools/cut-tea-jars.ps1

Writes src/assets/kitchen/jar-<tea>.png. Like the rest of tools/, these are generated: change this
script and re-run it rather than editing the PNGs.

The game used to draw a dispenser as `jar.png` with tea painted behind it in code — a shape with a
gradient, a highlight and a surface of our own invention. It never matched: the sheet's tea sits
under an oval surface, holds one tone the whole way down, and runs to the foot of the glass behind
the tap. Every one of those had to be guessed at and re-measured, and the glass had to be unpicked
to let the tea show through its walls.

So the tea is not drawn any more. The sheet already has dispensers painted full, and one of them
is simply the sprite. tools/sheets/kitchen.png has three — hong tra, tra lai and tra Thai — and the
other three teas are the same sprite with the tea re-coloured: every liquid pixel keeps its
distance from its own tea's body colour, in hue, saturation and lightness, and that distance is
laid onto the new one. The painted shading survives untouched because it is never recomputed, only
moved; the glass, the lid, the tap and the measuring ticks are not liquid and are left alone.

Hong tra and tra Thai are cut from their own dispensers rather than re-coloured, so they are the
sheet exactly. Re-colouring is checked against them: running the green one through it reproduces
them closely, which is what says the method is sound.
#>

param([switch]$Check)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sheetPath = Join-Path $root 'tools\sheets\kitchen.png'
$outDir = Join-Path $root 'src\assets\kitchen'

# The sheet's flat backdrop, and the dispensers standing on it.
$BG_R = 179.0; $BG_G = 181.0; $BG_B = 185.0
$JAR_W = 116; $JAR_H = 205; $JAR_Y = 8
# The dispensers stand shoulder to shoulder with no gap to split them on, so each is taken from the
# middle of its own tea: the liquid's centre is at x 196, 320 and 440.
$SOURCES = @{ black = 138; green = 262; thai = 382 }
# Tea is the only strongly coloured thing inside the glass, and the glass starts below the lid: at
# the jar's middle the wood runs to y 48 and the tea begins at 64. Reaching into the lid is what
# put a coloured fringe along it. The hue test is the real guard — the source dispenser's tea is
# green, so wood and the tap's pink heart cannot be mistaken for it however the band is drawn.
$GLASS_T = 44; $GLASS_B = 182
$MIN_CHROMA = 30
$TEA_HUE_MIN = 0.15; $TEA_HUE_MAX = 0.35

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

$f = [System.Drawing.Bitmap]::FromFile($sheetPath)
$sheet = New-Object System.Drawing.Bitmap $f
$f.Dispose()

# Cut one dispenser off the backdrop, and note which of its pixels are tea.
function Cut-Jar([int]$ox) {
  $count = $JAR_W * $JAR_H
  $argb = New-Object 'int[]' ($count * 4)
  $isTea = [bool[]]::new($count)
  for ($j = 0; $j -lt $JAR_H; $j++) {
    for ($i = 0; $i -lt $JAR_W; $i++) {
      $p = $sheet.GetPixel(($ox + $i), ($JAR_Y + $j))
      $idx = $j * $JAR_W + $i
      $argb[$idx * 4] = $p.R; $argb[$idx * 4 + 1] = $p.G; $argb[$idx * 4 + 2] = $p.B
      $off = [math]::Abs($p.R - $BG_R) + [math]::Abs($p.G - $BG_G) + [math]::Abs($p.B - $BG_B)
      $argb[$idx * 4 + 3] = if ($off -gt 26) { 255 } else { 0 }
      if ($j -ge $GLASS_T -and $j -le $GLASS_B) {
        $mx = [math]::Max($p.R, [math]::Max($p.G, $p.B)); $mn = [math]::Min($p.R, [math]::Min($p.G, $p.B))
        if (($mx - $mn) -ge $MIN_CHROMA) {
          $hsl = To-Hsl $p.R $p.G $p.B
          if ($hsl[0] -ge $TEA_HUE_MIN -and $hsl[0] -le $TEA_HUE_MAX) { $isTea[$idx] = $true }
        }
      }
    }
  }
  # the backdrop is whatever the border reaches; anything enclosed is the jar
  $outside = [bool[]]::new($count)
  $stack = New-Object 'System.Collections.Generic.Stack[int]'
  for ($i = 0; $i -lt $JAR_W; $i++) { $stack.Push($i); $stack.Push(($JAR_H - 1) * $JAR_W + $i) }
  for ($j = 0; $j -lt $JAR_H; $j++) { $stack.Push($j * $JAR_W); $stack.Push($j * $JAR_W + $JAR_W - 1) }
  while ($stack.Count -gt 0) {
    $q = $stack.Pop()
    if ($outside[$q] -or $argb[$q * 4 + 3] -ne 0) { continue }
    $outside[$q] = $true
    $qi = $q % $JAR_W; $qj = [int][math]::Floor($q / $JAR_W)
    if ($qi + 1 -lt $JAR_W) { $stack.Push($q + 1) }
    if ($qi - 1 -ge 0) { $stack.Push($q - 1) }
    if ($qj + 1 -lt $JAR_H) { $stack.Push($q + $JAR_W) }
    if ($qj - 1 -ge 0) { $stack.Push($q - $JAR_W) }
  }
  for ($q = 0; $q -lt $count; $q++) { if (-not $outside[$q]) { $argb[$q * 4 + 3] = 255 } }
  return @{ argb = $argb; isTea = $isTea }
}

# The body colour of a cut jar's tea: the commonest tone it holds.
function Body-Of($cut) {
  $buckets = @{}
  for ($q = 0; $q -lt ($JAR_W * $JAR_H); $q++) {
    if (-not $cut.isTea[$q]) { continue }
    $key = "{0}_{1}_{2}" -f [int]($cut.argb[$q * 4] / 8), [int]($cut.argb[$q * 4 + 1] / 8), [int]($cut.argb[$q * 4 + 2] / 8)
    if (-not $buckets.ContainsKey($key)) { $buckets[$key] = @(0, 0.0, 0.0, 0.0) }
    $e = $buckets[$key]
    $buckets[$key] = @(($e[0] + 1), ($e[1] + $cut.argb[$q * 4]), ($e[2] + $cut.argb[$q * 4 + 1]), ($e[3] + $cut.argb[$q * 4 + 2]))
  }
  $best = $null; $bestN = -1
  foreach ($k in $buckets.Keys) { if ($buckets[$k][0] -gt $bestN) { $bestN = $buckets[$k][0]; $best = $buckets[$k] } }
  return @(($best[1] / $best[0]), ($best[2] / $best[0]), ($best[3] / $best[0]))
}

function Save-Jar($cut, [double[]]$fromBody, [string]$toHex, [string]$name) {
  $bmp = New-Object System.Drawing.Bitmap($JAR_W, $JAR_H)
  $recolour = $null -ne $fromBody
  if ($recolour) {
    $src = To-Hsl $fromBody[0] $fromBody[1] $fromBody[2]
    $v = [Convert]::ToInt32($toHex.Substring(1), 16)
    $dst = To-Hsl ((($v -shr 16) -band 255)) ((($v -shr 8) -band 255)) (($v -band 255))
  }
  for ($j = 0; $j -lt $JAR_H; $j++) {
    for ($i = 0; $i -lt $JAR_W; $i++) {
      $q = $j * $JAR_W + $i
      $r = $cut.argb[$q * 4]; $g = $cut.argb[$q * 4 + 1]; $b = $cut.argb[$q * 4 + 2]; $a = $cut.argb[$q * 4 + 3]
      if ($recolour -and $cut.isTea[$q]) {
        $here = To-Hsl $r $g $b
        $rgb = From-Hsl ($dst[0] + ($here[0] - $src[0])) ($dst[1] + ($here[1] - $src[1])) ($dst[2] + ($here[2] - $src[2]))
        $r = $rgb[0]; $g = $rgb[1]; $b = $rgb[2]
      }
      $bmp.SetPixel($i, $j, [System.Drawing.Color]::FromArgb($a, $r, $g, $b))
    }
  }
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  [System.IO.File]::WriteAllBytes((Join-Path $outDir "jar-$name.png"), $ms.ToArray())
  $ms.Dispose(); $bmp.Dispose()
}

$cuts = @{}
foreach ($id in $SOURCES.Keys) { $cuts[$id] = Cut-Jar $SOURCES[$id] }
$greenCut = $cuts['green']
$greenBody = Body-Of $greenCut
Write-Output ("green dispenser body #{0:X2}{1:X2}{2:X2}" -f [int]$greenBody[0], [int]$greenBody[1], [int]$greenBody[2])

# the three the sheet paints, straight off it
foreach ($id in @('black', 'green', 'thai')) { Save-Jar $cuts[$id] $null '' $id }
# the three it does not, re-coloured from the green one
$DERIVED = @{ oolong = '#D48B40'; taro = '#B8A0DB'; matcha = '#72AD3B' }
foreach ($id in $DERIVED.Keys) { Save-Jar $greenCut $greenBody $DERIVED[$id] $id }
# -Check also aims the re-colouring at the two teas the sheet paints itself, so the two can be put
# side by side: if the re-coloured ones match the cut ones, the derived teas can be trusted too.
if ($Check) {
  Save-Jar $greenCut $greenBody '#B26337' 'check-black'
  Save-Jar $greenCut $greenBody '#FE7220' 'check-thai'
}

$sheet.Dispose()
Write-Output "wrote jar-<tea>.png at ${JAR_W}x${JAR_H} for black, green, thai, oolong, taro, matcha (+2 checks)"
