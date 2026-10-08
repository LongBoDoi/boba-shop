<#
Lift the tea window's greenery back off its own plate, so the dispensers can stand behind it.

    powershell -ExecutionPolicy Bypass -File tools/cut-tea-front.ps1

Writes src/assets/kitchen/tea-front-left.png and tea-front-right.png. Like the rest of tools/,
these are generated: change this script and re-run it rather than editing the PNGs.

The window is one painting (see cut-sheets.py), and the jars are laid over it. That is right for
the shelf they stand on, and wrong at the two ends of it: the vines down either side and the potted
plant on the right hang *in front* of the shelves, so a jar swiped out to an end climbed over the
leaves instead of disappearing behind them.

So the leaves are cut out of the plate a second time and drawn again over the jars. Nothing is
redrawn or repainted — these are the window's own pixels, lifted out of the window's own output, so
they land back exactly where they came from and over the rest of the plate they are invisible.

Two things are picked out:

* the foliage, by colour. Every leaf on the plate is green in a way nothing else is — the tiles,
  the wood, the card and the pot are all warm, with red ahead of green — so `Green` is a plain
  comparison of the channels, and it holds from the brightest highlight on a leaf down to its
  darkest fold. The dark outline drawn round a leaf is *not* green, so it is taken in a second
  pass: dark, and touching something already green;

* the pot, by hand. It is terracotta, which is the shelf's own colour, so no test separates the
  two — `POT` is its silhouette, traced off the plate.

It is PowerShell rather than a few more lines in cut-sheets.py because this machine has no Python,
and the pixel work is in C# because PowerShell is far too slow over a million and a half of them.
#>

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcPath = Join-Path $root 'src\assets\kitchen\tea-room.png'
$outDir = Join-Path $root 'src\assets\kitchen'

# The window's middle, which decides whether a leaf belongs to the left sprite or the right one.
# There is a clear half of the plate between the two — no leaf is anywhere near it — so the split
# never cuts through anything.
$SPLIT = 578

# The potted plant's pot, traced off the plate: the rim, then the body tapering in to its foot.
# Only its left side is ever seen against a jar — the shelf stops well short of the frame — so that
# edge follows the paint and the right one is given room.
$POT = @(
  @(1050, 546), @(1124, 546), @(1124, 592), @(1118, 636),
  @(1062, 636), @(1058, 615), @(1055, 600), @(1052, 586), @(1050, 570)
)

Add-Type -TypeDefinition @'
using System;

public static class Foliage {
  /// A leaf, by its channels alone, on two counts. Green has to be level with red, which rules out
  /// every warm thing on the plate — tile, grout, wood, card, terracotta all keep red well ahead —
  /// and it has to be well clear of blue, which rules out the pale highlight painted along the top
  /// of each of them, where all three channels run high together. A leaf's own highlights are the
  /// one bright thing with hardly any blue in them.
  static bool Green(byte r, byte g, byte b) {
    return g + 8 >= r && g > b * 1.6 + 20;
  }

  static double Luma(byte r, byte g, byte b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /// The mask, one byte a pixel, over the whole plate.
  public static byte[] Mask(byte[] px, int stride, int w, int h, int outline, double dark) {
    byte[] m = new byte[w * h];
    for (int y = 0; y < h; y++) {
      int o = y * stride;
      for (int x = 0; x < w; x++) {
        int i = o + x * 4;                       // BGRA
        if (px[i + 3] > 8 && Green(px[i + 2], px[i + 1], px[i])) m[y * w + x] = 255;
      }
    }

    // The ink round a leaf is brown rather than green, so it is grown into instead: a dark pixel
    // beside something already taken is that leaf's own outline. Bounded by `dark`, which the
    // tiles and the wood are nowhere near, so the growth stops at the leaf rather than running on
    // into the room.
    for (int pass = 0; pass < outline; pass++) {
      byte[] next = (byte[])m.Clone();
      for (int y = 1; y < h - 1; y++) {
        for (int x = 1; x < w - 1; x++) {
          if (m[y * w + x] != 0) continue;
          int i = y * stride + x * 4;
          if (px[i + 3] <= 8 || Luma(px[i + 2], px[i + 1], px[i]) >= dark) continue;
          bool touches = false;
          for (int dy = -1; dy <= 1 && !touches; dy++)
            for (int dx = -1; dx <= 1; dx++)
              if (m[(y + dy) * w + x + dx] != 0) { touches = true; break; }
          if (touches) next[y * w + x] = 255;
        }
      }
      m = next;
    }
    return m;
  }

  /// Close the pinholes. The white glint painted on a leaf has no colour left in it to test, so a
  /// few of them come out as holes you would see a jar through. Anything the room cannot be
  /// reached from is inside a leaf, and anything small enough to be a glint rather than a gap
  /// between two of them is filled.
  public static byte[] Fill(byte[] m, int w, int h, int biggest) {
    bool[] room = new bool[w * h];
    int[] q = new int[w * h];
    int head = 0, tail = 0;
    for (int x = 0; x < w; x++) {
      if (m[x] == 0 && !room[x]) { room[x] = true; q[tail++] = x; }
      int k = (h - 1) * w + x;
      if (m[k] == 0 && !room[k]) { room[k] = true; q[tail++] = k; }
    }
    for (int y = 0; y < h; y++) {
      int l = y * w, r = y * w + w - 1;
      if (m[l] == 0 && !room[l]) { room[l] = true; q[tail++] = l; }
      if (m[r] == 0 && !room[r]) { room[r] = true; q[tail++] = r; }
    }
    while (head < tail) {
      int p = q[head++], x = p % w, y = p / w;
      if (x > 0 && m[p - 1] == 0 && !room[p - 1]) { room[p - 1] = true; q[tail++] = p - 1; }
      if (x < w - 1 && m[p + 1] == 0 && !room[p + 1]) { room[p + 1] = true; q[tail++] = p + 1; }
      if (y > 0 && m[p - w] == 0 && !room[p - w]) { room[p - w] = true; q[tail++] = p - w; }
      if (y < h - 1 && m[p + w] == 0 && !room[p + w]) { room[p + w] = true; q[tail++] = p + w; }
    }

    bool[] seen = new bool[w * h];
    for (int p = 0; p < w * h; p++) {
      if (m[p] != 0 || room[p] || seen[p]) continue;
      head = 0; tail = 0;
      q[tail++] = p; seen[p] = true;
      while (head < tail) {
        int c = q[head++], x = c % w, y = c / w;
        if (x > 0 && m[c - 1] == 0 && !seen[c - 1]) { seen[c - 1] = true; q[tail++] = c - 1; }
        if (x < w - 1 && m[c + 1] == 0 && !seen[c + 1]) { seen[c + 1] = true; q[tail++] = c + 1; }
        if (y > 0 && m[c - w] == 0 && !seen[c - w]) { seen[c - w] = true; q[tail++] = c - w; }
        if (y < h - 1 && m[c + w] == 0 && !seen[c + w]) { seen[c + w] = true; q[tail++] = c + w; }
      }
      if (tail <= biggest) for (int i = 0; i < tail; i++) m[q[i]] = 255;
    }
    return m;
  }

  /// The mask grown by `pad`, which is how far outside a leaf its own colour is still worth
  /// keeping. A cleared pixel keeps its colour so the renderer has something to filter towards and
  /// the edge does not bleed, but only just outside the edge: further out than that it is the rest
  /// of the window — tiles, grout, wood — and carrying all that detail in a part of the sprite
  /// nobody will ever see costs more than the whole of the rest of it put together.
  public static byte[] Pad(byte[] m, int w, int h, int pad) {
    byte[] a = new byte[w * h];
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++) {
        byte best = 0;
        for (int d = -pad; d <= pad; d++) {
          int xx = x + d;
          if (xx >= 0 && xx < w && m[y * w + xx] > best) best = m[y * w + xx];
        }
        a[y * w + x] = best;
      }
    byte[] o = new byte[w * h];
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++) {
        byte best = 0;
        for (int d = -pad; d <= pad; d++) {
          int yy = y + d;
          if (yy >= 0 && yy < h && a[yy * w + x] > best) best = a[yy * w + x];
        }
        o[y * w + x] = best;
      }
    return o;
  }

  /// Soften the mask's edge by a pixel, the way the window itself was lifted off its backdrop: a
  /// cut straight down the middle of a pixel reads as stairs against whatever is behind it.
  public static byte[] Feather(byte[] m, int w, int h) {
    byte[] o = new byte[w * h];
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        int sum = 0, n = 0;
        for (int dy = -1; dy <= 1; dy++) {
          int yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (int dx = -1; dx <= 1; dx++) {
            int xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            int k = (dx == 0 ? 2 : 1) * (dy == 0 ? 2 : 1);
            sum += m[yy * w + xx] * k;
            n += k;
          }
        }
        o[y * w + x] = (byte)(sum / n);
      }
    }
    return o;
  }
}
'@

Write-Host "reading $srcPath"
$plate = [System.Drawing.Bitmap]::FromFile($srcPath)
$W = $plate.Width; $H = $plate.Height
$box = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$data = $plate.LockBits($box, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$px = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $px, 0, $px.Length)
$plate.UnlockBits($data)

$mask = [Foliage]::Mask($px, $stride, $W, $H, 2, 95.0)
$mask = [Foliage]::Fill($mask, $W, $H, 400)

# The pot goes in as a shape rather than by colour. It is drawn into its own bitmap and read back,
# so GDI+ antialiases its edge for us.
$shape = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($shape)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$pts = $POT | ForEach-Object { New-Object System.Drawing.PointF([float]$_[0], [float]$_[1]) }
$g.FillPolygon([System.Drawing.Brushes]::White, [System.Drawing.PointF[]]$pts)
$g.Dispose()
$sd = $shape.LockBits($box, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$spx = New-Object byte[] ($sd.Stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($sd.Scan0, $spx, 0, $spx.Length)
$shape.UnlockBits($sd)
$shape.Dispose()

$mask = [Foliage]::Feather($mask, $W, $H)
for ($y = 0; $y -lt $H; $y++) {
  $so = $y * $sd.Stride
  $mo = $y * $W
  for ($x = 0; $x -lt $W; $x++) {
    $a = $spx[$so + $x * 4 + 3]
    if ($a -gt $mask[$mo + $x]) { $mask[$mo + $x] = $a }
  }
}

$keep = [Foliage]::Pad($mask, $W, $H, 2)

# Each side is written at its own size rather than as a second full-plate sprite: all but a strip
# down either edge of this mask is empty, and the window's plate is big.
foreach ($side in @('left', 'right')) {
  $x0 = if ($side -eq 'left') { 0 } else { $SPLIT }
  $x1 = if ($side -eq 'left') { $SPLIT } else { $W }

  $minX = $x1; $maxX = $x0 - 1; $minY = $H; $maxY = -1
  for ($y = 0; $y -lt $H; $y++) {
    $mo = $y * $W
    for ($x = $x0; $x -lt $x1; $x++) {
      if ($mask[$mo + $x] -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt $minX) { throw "nothing found on the $side" }

  $sw = $maxX - $minX + 1; $sh = $maxY - $minY + 1
  $out = New-Object System.Drawing.Bitmap($sw, $sh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $ob = New-Object System.Drawing.Rectangle(0, 0, $sw, $sh)
  $od = $out.LockBits($ob, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $obuf = New-Object byte[] ($od.Stride * $sh)
  for ($y = 0; $y -lt $sh; $y++) {
    $src = ($y + $minY) * $stride
    $mo = ($y + $minY) * $W
    $dst = $y * $od.Stride
    for ($x = 0; $x -lt $sw; $x++) {
      $i = $src + ($x + $minX) * 4
      $a = [Math]::Min($mask[$mo + $x + $minX], $px[$i + 3])
      $j = $dst + $x * 4
      if ($keep[$mo + $x + $minX] -gt 0) {
        $obuf[$j] = $px[$i]; $obuf[$j + 1] = $px[$i + 1]; $obuf[$j + 2] = $px[$i + 2]
      }
      $obuf[$j + 3] = $a
    }
  }
  [System.Runtime.InteropServices.Marshal]::Copy($obuf, 0, $od.Scan0, $obuf.Length)
  $out.UnlockBits($od)
  $out.Save((Join-Path $outDir "tea-front-$side.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  Write-Host ("tea-front-{0,-5} {1,4} x {2,4} at ({3}, {4})" -f $side, $sw, $sh, $minX, $minY)
}

$plate.Dispose()
