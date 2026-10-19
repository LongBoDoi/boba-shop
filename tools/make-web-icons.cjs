#!/usr/bin/env node
/**
 * The icons a phone needs to put the web build on its home screen, cut from the app's own.
 *
 *   node tools/make-web-icons.cjs
 *
 * Three come out, into `public/icons/`, and the build copies `public/` into `dist` as it is:
 *
 * - **192 and 512, square and transparent**, off `assets/icon.png`. Android reads the largest it
 *   is offered and iOS takes the `apple-touch-icon`; both are listed so neither has to downscale a
 *   megabyte of artwork on a phone.
 * - **512 maskable**, the Android adaptive icon flattened — `android-icon-foreground.png` over
 *   `android-icon-background.png`. "Maskable" means the launcher may crop it to whatever shape the
 *   phone likes, so the artwork has to sit inside a safe circle; the adaptive foreground already
 *   does, which is the whole reason it is drawn separately. Without one, Chrome puts the square
 *   icon on a white circle and the shop ends up in a dish.
 *
 * It is written against `zlib` and nothing else. Resizing is the one thing the toolchain here
 * cannot already do, and a build-time dependency for forty lines of arithmetic is a poor trade —
 * the same reasoning as `saveCode.ts` and its hand-rolled base64.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'icons');

// --------------------------------------------------------------------------- PNG, in and out

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Read a PNG into straight RGBA. Only what this repo's own art is: 8 bits, no interlace. */
function readPng(file) {
  const png = fs.readFileSync(file);
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${file}: not a PNG`);
  let at = 8;
  let header;
  const data = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0), height: body.readUInt32BE(4),
        depth: body[8], colour: body[9], interlace: body[12],
      };
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (!header) throw new Error(`${file}: no header`);
  if (header.depth !== 8 || header.interlace !== 0 || ![2, 6].includes(header.colour)) {
    throw new Error(`${file}: expected an 8-bit RGB or RGBA image, got depth ${header.depth} `
      + `colour type ${header.colour} interlace ${header.interlace}`);
  }

  const channels = header.colour === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = header.width * channels;
  const rgba = Buffer.alloc(header.width * header.height * 4);
  const line = Buffer.alloc(stride);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      switch (filter) {
        case 1: line[i] = (line[i] + a) & 0xff; break;
        case 2: line[i] = (line[i] + b) & 0xff; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: break;
      }
    }
    for (let x = 0; x < header.width; x++) {
      const to = (y * header.width + x) * 4;
      rgba[to] = line[x * channels];
      rgba[to + 1] = line[x * channels + 1];
      rgba[to + 2] = line[x * channels + 2];
      rgba[to + 3] = channels === 4 ? line[x * channels + 3] : 255;
    }
    previous.set(line);
  }
  return { width: header.width, height: header.height, rgba };
}

function writePng({ width, height, rgba }, file) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  fs.writeFileSync(file, Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

// --------------------------------------------------------------------------- the pictures

/**
 * Average every source pixel that falls under each new one. A phone icon is a tenth the size of
 * the artwork, and sampling that far down takes one pixel in a hundred and comes out as noise —
 * the same mistake the cup holder's weave made, see `docs/cup-holder-art.md`.
 *
 * Colour is weighted by alpha, so the transparent surround cannot bleed into the edges.
 */
function resize(image, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scaleX = image.width / size;
  const scaleY = image.height / size;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * scaleY));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * scaleX));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < image.height; sy++) {
        for (let sx = x0; sx < x1 && sx < image.width; sx++) {
          const at = (sy * image.width + sx) * 4;
          const alpha = image.rgba[at + 3] / 255;
          r += image.rgba[at] * alpha;
          g += image.rgba[at + 1] * alpha;
          b += image.rgba[at + 2] * alpha;
          a += image.rgba[at + 3];
          n++;
        }
      }
      const to = (y * size + x) * 4;
      const weight = a / 255 || 1;
      rgba[to] = Math.round(r / weight);
      rgba[to + 1] = Math.round(g / weight);
      rgba[to + 2] = Math.round(b / weight);
      rgba[to + 3] = Math.round(a / n);
    }
  }
  return { width: size, height: size, rgba };
}

/** Source over destination, the ordinary way one picture is laid over another. */
function over(top, bottom) {
  const rgba = Buffer.from(bottom.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = top.rgba[i + 3] / 255;
    if (alpha === 0) continue;
    for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(top.rgba[i + c] * alpha + rgba[i + c] * (1 - alpha));
    rgba[i + 3] = Math.round(255 * (alpha + (rgba[i + 3] / 255) * (1 - alpha)));
  }
  return { width: bottom.width, height: bottom.height, rgba };
}

const icon = readPng(path.join(ROOT, 'assets', 'icon.png'));
const foreground = readPng(path.join(ROOT, 'assets', 'android-icon-foreground.png'));
const background = readPng(path.join(ROOT, 'assets', 'android-icon-background.png'));

fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const size of [192, 512]) {
  const file = path.join(OUT, `icon-${size}.png`);
  writePng(resize(icon, size), file);
  made.push(file);
}
const maskable = path.join(OUT, 'icon-maskable-512.png');
writePng(resize(over(foreground, background), 512), maskable);
made.push(maskable);

for (const file of made) {
  const png = readPng(file);
  console.log(`  ${path.relative(ROOT, file).padEnd(34)} ${png.width}x${png.height}  `
    + `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
console.log(`${made.length} home-screen icons written.`);
