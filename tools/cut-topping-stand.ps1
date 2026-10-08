<#
Lift the topping stand off the checkerboard it was handed over on.

    powershell -ExecutionPolicy Bypass -File tools/cut-topping-stand.ps1

Reads tools/sheets/topping-stand.png and writes src/assets/kitchen/topping-stand.png. Like the
rest of tools/, that PNG is generated: change this script and re-run it rather than editing it.

The stand arrived as a flattened screenshot rather than a file with an alpha channel, so what
should be nothing around it is a painted grey checkerboard — and, below the plinth, a faint
watermark drawn across that checkerboard. Both go the same way: the board is pure grey and every
part of the stand is wood, which is orange through and through, so `Bare` is a plain look at how
far a pixel's channels are apart. It is flooded from the border rather than applied everywhere, so
that nothing inside the stand can be mistaken for the outside of it.

The cut is then padded and feathered the way the tea window's greenery is (see cut-tea-front.ps1):
a pixel just outside the edge keeps its colour so the renderer has something to filter towards,
everything further out is cleared to nothing so the PNG packs down, and the edge itself is softened
by a pixel so it does not read as stairs against the room behind it.

Last, it is halved. A screenshot is lossy, and what compression leaves behind is a fine grain over
every flat part of the wood that no PNG can pack — cut at its own size it weighs more than the rest
of the kitchen put together, for detail no phone can show. `$WIDE` is twice the widest the stand is
ever drawn, which is as much as is worth keeping and smooths the grain away besides.

It is PowerShell rather than a few more lines in cut-sheets.py because this machine has no Python,
and the pixel work is in C# because PowerShell is far too slow over a million and a half of them.
#>

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$srcPath = Join-Path $root 'tools\sheets\topping-stand.png'
$outPath = Join-Path $root 'src\assets\kitchen\topping-stand.png'

# How wide the sprite is kept. The stand is about a third of a 940px room, and the busiest screen
# this runs on draws that room about 1.1x life size at two device pixels to one of its own, so
# nothing ever asks for more than ~760 across.
$WIDE = 760

Add-Type -TypeDefinition @'
using System;

public static class Stand {
  /// The checkerboard, by its channels alone. It is drawn in two greys, and a grey is a pixel
  /// whose channels are all but equal; every part of the stand is wood, which keeps red well
  /// ahead of blue even in its deepest shadow and its brightest glare. The source is a lossy
  /// screenshot, so the board is noisy and the slack is generous — it can afford to be, with
  /// nothing on the stand anywhere near neutral.
  static bool Bare(byte r, byte g, byte b) {
    int hi = Math.Max(r, Math.Max(g, b));
    int lo = Math.Min(r, Math.Min(g, b));
    return hi - lo <= 26 && hi >= 140;
  }

  /// What is *around* the stand: the board, flooded in from the border. Reached this way rather
  /// than tested everywhere, so that a grey glint somewhere in the middle of the stand could never
  /// punch a hole through it.
  public static byte[] Mask(byte[] px, int stride, int w, int h) {
    bool[] bare = new bool[w * h];
    for (int y = 0; y < h; y++) {
      int o = y * stride;
      for (int x = 0; x < w; x++) {
        int i = o + x * 4;                       // BGRA
        bare[y * w + x] = Bare(px[i + 2], px[i + 1], px[i]);
      }
    }

    bool[] outside = new bool[w * h];
    int[] q = new int[w * h];
    int head = 0, tail = 0;
    for (int x = 0; x < w; x++) {
      int t = x, b = (h - 1) * w + x;
      if (bare[t] && !outside[t]) { outside[t] = true; q[tail++] = t; }
      if (bare[b] && !outside[b]) { outside[b] = true; q[tail++] = b; }
    }
    for (int y = 0; y < h; y++) {
      int l = y * w, r = y * w + w - 1;
      if (bare[l] && !outside[l]) { outside[l] = true; q[tail++] = l; }
      if (bare[r] && !outside[r]) { outside[r] = true; q[tail++] = r; }
    }
    while (head < tail) {
      int p = q[head++], x = p % w, y = p / w;
      if (x > 0 && bare[p - 1] && !outside[p - 1]) { outside[p - 1] = true; q[tail++] = p - 1; }
      if (x < w - 1 && bare[p + 1] && !outside[p + 1]) { outside[p + 1] = true; q[tail++] = p + 1; }
      if (y > 0 && bare[p - w] && !outside[p - w]) { outside[p - w] = true; q[tail++] = p - w; }
      if (y < h - 1 && bare[p + w] && !outside[p + w]) { outside[p + w] = true; q[tail++] = p + w; }
    }

    byte[] m = new byte[w * h];
    for (int p = 0; p < w * h; p++) m[p] = outside[p] ? (byte)0 : (byte)255;
    return m;
  }

  /// The mask grown by `pad`: how far outside the stand its own colour is still worth keeping,
  /// so the edge has something to filter towards instead of bleeding the board back in.
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

  /// Soften the edge by a pixel. A cut straight down the middle of one reads as stairs.
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
$plate.Dispose()

$solid = [Stand]::Mask($px, $stride, $W, $H)
# Wide enough that halving the sprite afterwards cannot reach past it and pull the cleared pixels
# back into the edge.
$keep = [Stand]::Pad($solid, $W, $H, 6)
$mask = [Stand]::Feather($solid, $W, $H)

# The box the stand actually occupies, so the sprite is the stand rather than the screenshot.
$x0 = $W; $y0 = $H; $x1 = -1; $y1 = -1
for ($y = 0; $y -lt $H; $y++) {
  $o = $y * $W
  for ($x = 0; $x -lt $W; $x++) {
    if ($mask[$o + $x] -gt 0) {
      if ($x -lt $x0) { $x0 = $x }
      if ($x -gt $x1) { $x1 = $x }
      if ($y -lt $y0) { $y0 = $y }
      if ($y -gt $y1) { $y1 = $y }
    }
  }
}
$cw = $x1 - $x0 + 1
$ch = $y1 - $y0 + 1

$out = New-Object System.Drawing.Bitmap($cw, $ch, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$obox = New-Object System.Drawing.Rectangle(0, 0, $cw, $ch)
$od = $out.LockBits($obox, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$opx = New-Object byte[] ($od.Stride * $ch)
for ($y = 0; $y -lt $ch; $y++) {
  $so = ($y + $y0) * $stride
  $mo = ($y + $y0) * $W + $x0
  $oo = $y * $od.Stride
  for ($x = 0; $x -lt $cw; $x++) {
    $a = $mask[$mo + $x]
    $i = $oo + $x * 4
    # Colour only where it is the stand or just outside it; everywhere else is left at zero, which
    # is what lets the PNG pack down to a fraction of its weight.
    if ($keep[$mo + $x] -gt 0) {
      $s = $so + ($x + $x0) * 4
      $opx[$i] = $px[$s]; $opx[$i + 1] = $px[$s + 1]; $opx[$i + 2] = $px[$s + 2]
    }
    $opx[$i + 3] = $a
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($opx, 0, $od.Scan0, $opx.Length)
$out.UnlockBits($od)

$fw = [Math]::Min($cw, $WIDE)
$fh = [int][Math]::Round($ch * $fw / $cw)
$small = New-Object System.Drawing.Bitmap($fw, $fh, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($small)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($out, (New-Object System.Drawing.Rectangle(0, 0, $fw, $fh)))
$g.Dispose()
$out.Dispose()

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outPath) | Out-Null
$small.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$small.Dispose()

Write-Host "topping-stand $fw x $fh (cut $cw x $ch at $x0, $y0) - $((Get-Item $outPath).Length) bytes"
