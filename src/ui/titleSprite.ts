/** Transparent sprite preparation only; the backdrop is a complete image, never a contour patch. */
export interface ArtBox { x: number; y: number; w: number; h: number }
export function spriteCanvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c;
}
export function cropSprite(source: CanvasImageSource, box: ArtBox) {
  const c = spriteCanvas(box.w, box.h);
  c.getContext('2d')!.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
  return c;
}

/** Keep the connected painted subject and its soft edge, excluding transparent-generation debris. */
export function cleanSprite(image: HTMLCanvasElement) {
  const g = image.getContext('2d')!, data = g.getImageData(0, 0, image.width, image.height);
  const {width: w, height: h} = image, count = w*h;
  const valid = new Uint8Array(count), seen = new Uint8Array(count), queue = new Int32Array(count);
  let best: number[] = [];
  for (let i = 0; i < count; i++) {
    const p = i*4, r = data.data[p], green = data.data[p+1], b = data.data[p+2];
    const debris = r > 150 && (green < .4*r || b < .2*r);
    if (debris || data.data[p+3] < 3) data.data[p+3] = 0;
    valid[i] = Number(data.data[p+3] > 48);
  }
  for (let seed = 0; seed < count; seed++) {
    if (!valid[seed] || seen[seed]) continue;
    let head = 0, end = 1; queue[0] = seed; seen[seed] = 1;
    while (head < end) {
      const i = queue[head++], x = i%w, y = Math.floor(i/w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x+dx, yy = y+dy, n = yy*w+xx;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h || seen[n] || !valid[n]) continue;
        seen[n] = 1; queue[end++] = n;
      }
    }
    if (end > best.length) best = Array.from(queue.subarray(0, end));
  }
  const keep = new Uint8Array(count);
  for (const i of best) {
    const x = i%w, y = Math.floor(i/w);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x+dx, yy = y+dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) keep[yy*w+xx] = 1;
    }
  }
  for (let i = 0; i < count; i++) if (!keep[i]) data.data[i*4+3] = 0;
  g.putImageData(data, 0, 0); return image;
}

export function alphaBounds(image: HTMLCanvasElement, threshold = 24): ArtBox {
  const {width: w, height: h} = image, pixels = image.getContext('2d')!.getImageData(0, 0, w, h).data;
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixels[(y*w+x)*4+3] > threshold) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < left ? {x: 0, y: 0, w, h} : {x: left, y: top, w: right-left+1, h: bottom-top+1};
}

export function padFoliage(image: HTMLCanvasElement, box: ArtBox) {
  const left = box.x === 0 ? 40 : 0, top = box.y === 0 ? 40 : 0, right = box.x+box.w === 1672 ? 40 : 0;
  if (!left && !top && !right) return {image, box};
  const c = spriteCanvas(image.width+left+right, image.height+top), g = c.getContext('2d')!;
  g.drawImage(image, left, top);
  if (top) g.drawImage(image, 0, 0, image.width, 1, left, 0, image.width, top);
  if (left) g.drawImage(image, 0, 0, 1, image.height, 0, top, left, image.height);
  if (right) g.drawImage(image, image.width-1, 0, 1, image.height, left+image.width, top, right, image.height);
  if (left && top) g.drawImage(image, 0, 0, 1, 1, 0, 0, left, top);
  return {image: c, box: {x: box.x-left, y: box.y-top, w: c.width, h: c.height}};
}
