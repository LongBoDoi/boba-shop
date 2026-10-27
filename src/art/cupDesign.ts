import { el, svgDoc, uid } from './svg';

/** Reference design, in the live cup's 113×174 coordinates. One drawing for Canvas and SVG. */
type Shape = { d: string; fill?: string; stroke?: string; width?: number; evenOdd?: boolean };
type Gradient = { points: [number, number, number, number]; stops: [number, string][] };
type Artwork = { gradients: Record<string, Gradient>; shapes: Shape[] };
const ellipse = (x: number, y: number, rx: number, ry: number) =>
  `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${rx*2} 0a${rx} ${ry} 0 1 0 ${-rx*2} 0`;

export function cupShellArt(): Artwork {
  return {
    gradients: {
      plastic: { points: [8, 0, 104, 0], stops: [[0,'#aaa39a38'],[.16,'#fffefa21'],[.3,'#ffffff50'],[.47,'#e6dfd515'],[.73,'#ffffff08'],[.9,'#fffefa50'],[1,'#867f7738']] },
      rim: { points: [0, 3, 0, 31], stops: [[0,'#fffefba6'],[.42,'#c2bbb340'],[.66,'#ffffffb3'],[1,'#a29a9259']] },
      edge: { points: [10, 20, 102, 170], stops: [[0,'#80786ed9'],[.35,'#93897dbf'],[.7,'#81786dcc'],[1,'#786f65d9']] },
    },
    shapes: [
      {d:'M10.6 20L21.5 157.5C22 164.4 38 170 56.5 170C75 170 91 164.4 91.5 157.5L102.4 20Z',fill:'@plastic'},
      // One defined contour; the clear interior and bright inner glint preserve plastic depth.
      {d:'M10.6 20L21.5 157.5C22 164.4 38 170 56.5 170C75 170 91 164.4 91.5 157.5L102.4 20',stroke:'@edge',width:1.25},
      {d:'M13.2 26L24 156C25 162 39 167 56.5 167C74 167 88 162 89 156L100 26',stroke:'#fffefbbf',width:1.1},
      {d:'M18 28Q23 30 28 31L37 158Q33 159 30 156Z',fill:'#ffffff8c'},
      {d:'M21 37L28 132',stroke:'#ffffff99',width:1.5},
      {d:'M87 29L81 156L85 154L96 27Z',fill:'#ffffffa6'},
      {d:'M78 53Q83 42 85 52L79 134Q78 141 76 138Z',fill:'#ffffff70'},
      {d:'M15 32L24 144',stroke:'#8b81762b',width:1.8},
      {d:ellipse(56.5,157.5,33.7,9.7),fill:'#eee8df0d',stroke:'#c4baada6',width:.8},
      {d:'M25 159C31 169 82 169 88 159',stroke:'#fffefbd9',width:1},
      // Rolled lip: a broad shallow oval, with the near rim covering the contents.
      {d:ellipse(56.5,16,52,13.7)+ellipse(56.5,16,48.7,10.4),evenOdd:true,fill:'@rim'},
      {d:ellipse(56.5,16,52,13.7),stroke:'@edge',width:1.15},
      {d:ellipse(56.5,16,48.7,10.4),fill:'#ffffff05',stroke:'#9a8f828c',width:.75},
      {d:'M6.5 15C6.5 0 106.5 0 106.5 15',stroke:'#fffefbd9',width:1.15},
      {d:'M5 16C5 34.3 108 34.3 108 16',stroke:'#fffefbe6',width:1.2},
      {d:'M9 18C17 31 97 31 104 18',stroke:'#b0a8a140',width:.7},
    ],
  };
}

export function lidArt(): Artwork {
  return {
    gradients: {
      dome: {points:[18,-22,92,23],stops:[[0,'#fdfbf7a6'],[.25,'#ffffff33'],[.6,'#e2dbd21a'],[1,'#92898140']]},
      ear: {points:[0,-28,0,3],stops:[[0,'#fffefbc9'],[.5,'#d1cac147'],[1,'#938a8047']]},
    },
    shapes: [
      {d:'M7 16C9-7 28-22 56.5-22C85-22 104-7 106 16C103 34 10 34 7 16Z',fill:'@dome',stroke:'#8d8276b3',width:1},
      {d:'M13-2C13-14 16-30 21-32C25-33 38-20 41-15C29-12 20-8 13-2Z',fill:'@ear',stroke:'#8d8276bf',width:1},
      {d:'M17-6C18-16 19-26 22-28Q30-23 35-16',stroke:'#fffefbdb',width:1.5},
      {d:'M20-9Q21-18 23-23L31-16Z',fill:'#aaa19b38',stroke:'#968c8359',width:.6},
      {d:'M100-2C100-14 97-30 92-32C88-33 75-20 72-15C84-12 93-8 100-2Z',fill:'@ear',stroke:'#8d8276bf',width:1},
      {d:'M96-6C95-16 94-26 91-28Q83-23 78-16',stroke:'#fffefbdb',width:1.5},
      {d:'M93-9Q92-18 90-23L82-16Z',fill:'#aaa19b38',stroke:'#968c8359',width:.6},
      {d:'M17 11Q21-2 32-9',stroke:'#ffffffd9',width:3.4},
      {d:'M20 14L22 9M83-9L87-4',stroke:'#fffefbe6',width:2},
      {d:'M94 6Q97 10 98 14',stroke:'#ffffffb3',width:1.8},
      {d:ellipse(56.5,16,52,13.7),fill:'#f4ede512',stroke:'#8d8276b3',width:1},
      {d:ellipse(56.5,14,49.8,11.7),stroke:'#fffefbc9',width:1.25},
      {d:'M5 18C8 35 105 35 108 18L108 21C104 38 8 38 5 21Z',fill:'#e6dfd533',stroke:'#a1988e66',width:.65},
      {d:'M8 21C18 35 95 35 105 21',stroke:'#ffffffe6',width:1.2},
      {d:ellipse(56.5,-21,9,3.2),fill:'#fffdf8b3',stroke:'#837a72',width:.8},
      {d:ellipse(56.5,-21.3,5.4,1.5),fill:'#7e756d4d',stroke:'#a39a91',width:.6},
    ],
  };
}

/** A straight, hollow PET tube. Upper end fits within the cup's 70-unit finishing headroom. */
export function strawArt(): Artwork {
  return {
    gradients: {
      straw: {points:[52,0,61,0],stops:[[0,'#8d857d80'],[.16,'#fdfbf6bf'],[.36,'#ffffff85'],[.55,'#ddd5cc33'],[.8,'#fdfbf699'],[1,'#8c847b8c']]},
    },
    shapes: [
      {d:'M52-65L52 130C52 133 61 133 61 130L61-65Z',fill:'@straw',stroke:'#817971b3',width:.65},
      {d:'M54-62L54 128',stroke:'#ffffffbf',width:.9},
      {d:'M59-61L59 129',stroke:'#b9b1a959',width:.65},
      {d:ellipse(56.5,130,4.5,1.7),stroke:'#fffdf4b3',width:.8},
      {d:ellipse(56.5,-65,4.5,1.8),fill:'#f9f6ef',stroke:'#817971',width:.65},
      {d:ellipse(56.5,-65,2.9,.9),fill:'#8b837b80',stroke:'#bdb4aa',width:.35},
    ],
  };
}

export function artworkMarkup(art: Artwork): string {
  const ids = Object.fromEntries(Object.keys(art.gradients).map(key => [key,uid(`cup-${key}`)]));
  const paint = (value?: string) => value?.startsWith('@') ? `url(#${ids[value.slice(1)]})` : value;
  const defs = Object.entries(art.gradients).map(([key,g]) => el('linearGradient', {
    id:ids[key],gradientUnits:'userSpaceOnUse',x1:g.points[0],y1:g.points[1],x2:g.points[2],y2:g.points[3],
  },g.stops.map(([offset,color]) => el('stop',{offset,'stop-color':color})).join(''))).join('');
  return `<defs>${defs}</defs><g stroke-linecap="round" stroke-linejoin="round">` + art.shapes.map(s =>
    el('path',{d:s.d,fill:paint(s.fill) ?? 'none',stroke:paint(s.stroke),'stroke-width':s.width,'fill-rule':s.evenOdd?'evenodd':undefined})).join('') + '</g>';
}

export function paintArtwork(c: CanvasRenderingContext2D, art: Artwork) {
  c.save();
  const gradients: Record<string, CanvasGradient> = {};
  for (const [key,g] of Object.entries(art.gradients)) {
    const gradient = c.createLinearGradient(...g.points);
    g.stops.forEach(([at,color]) => gradient.addColorStop(at,color));
    gradients[key] = gradient;
  }
  const paint = (value: string) => value.startsWith('@') ? gradients[value.slice(1)] : value;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const shape of art.shapes) {
    const path = new Path2D(shape.d);
    if (shape.fill) { c.fillStyle = paint(shape.fill); c.fill(path, shape.evenOdd ? 'evenodd' : 'nonzero'); }
    if (shape.stroke) { c.strokeStyle = paint(shape.stroke); c.lineWidth = shape.width ?? 1; c.stroke(path); }
  }
  c.restore();
}

export function cupShellSvg(width = 678, height = 1044) {
  return svgDoc(width,height,artworkMarkup(cupShellArt()),'0 0 113 174');
}

/** Separate silicone counter holder. Its recessed seat is centered at (80,32). */
export function cupHolderSvg() {
  const art: Artwork = {
    gradients: {
      edge: {points:[0,17,0,59],stops:[[0,'#b6afa9'],[.5,'#96918d'],[1,'#797571']]},
      top: {points:[30,12,105,52],stops:[[0,'#d7d1cb'],[.4,'#bbb5af'],[1,'#a29c97']]},
      seat: {points:[0,19,0,47],stops:[[0,'#89847e'],[.35,'#b1aaa3'],[1,'#d0c9c1']]},
    },
    shapes: [
      {d:ellipse(81,49,67,12),fill:'#5e50411a'},
      {d:ellipse(83,49,60,9),fill:'#5e504114'},
      {d:'M39 25C22 8 5 16 4 29C3 38 9 43 17 40C28 35 34 42 43 48C60 61 110 62 131 50C144 43 149 25 141 16C137 11 132 15 132 24C131 39 65 47 46 32Z',fill:'@edge',stroke:'#756f69',width:1.1},
      {d:'M39 22C21 7 5 15 5 27C5 35 10 37 17 34C29 29 37 39 47 44C68 55 111 55 130 44C140 38 144 24 139 17C136 15 135 20 135 25C133 43 64 46 44 29Z',fill:'@top'},
      {d:ellipse(80,32,47,16),fill:'@seat',stroke:'#8f8982',width:.85},
      {d:'M34 33C38 49 123 52 127 32',stroke:'#e5dfd7b3',width:1.2},
      {d:'M9 24Q16 14 28 21M48 47Q83 62 120 48M139 21Q142 33 135 39',stroke:'#eee9e2a6',width:2},
      {d:'M13 22L16 20',stroke:'#fffaf1b3',width:2.5},
    ],
  };
  return svgDoc(960,384,artworkMarkup(art),'0 0 160 64');
}
