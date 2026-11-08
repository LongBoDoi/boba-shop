import { cropSprite, spriteCanvas, type ArtBox } from './titleSprite';
import { storefrontSkyArt } from './storefrontSky';

/** Native architectural silhouettes; no vertical slicing or stretching of the storefront. */
function cut(source: HTMLImageElement,box: ArtBox,path: string) {
  const image = spriteCanvas(box.w,box.h),g = image.getContext('2d')!;
  g.translate(-box.x,-box.y);g.clip(new Path2D(path));g.drawImage(source,0,0,1672,941);
  return {image,box};
}
export function portraitArt(backdrop: HTMLImageElement,courtyard?: HTMLImageElement,upper?: HTMLImageElement,easelClear?: HTMLImageElement) {
  let fittedUpper: HTMLCanvasElement | null = null;
  if (upper) {
    fittedUpper = cropSprite(upper,{x: 0,y: 0,w: 1536,h: 1024});
    const ug = fittedUpper.getContext('2d')!;
    ug.clearRect(0,836,1536,70);
    // The roof's lower cornice must end at the same posts as the fascia below it.
    for (const [fromX,toX,width] of [[140,148,22],[170,170,1196],[1374,1366,22]]) {
      ug.drawImage(upper,fromX,836,width,70,toX,836,width,70);
    }
  }
  const facade = cut(backdrop,{x: 266,y: 45,w: 1223,h: 785},
    'M278 62 H586 V49 H1020 V59 H1383 V148 L1421 149 Q1485 198 1485 242 '
    +'V271 Q1485 290 1440 290 H1367 V827 H288 V290 Q268 290 268 272 V236 '
    +'Q271 214 312 164 L322 151 H278 Z');
  const facadeClean = cropSprite(facade.image,{x: 0,y: 0,w: facade.box.w,h: facade.box.h});
  const g = facadeClean.getContext('2d')!;
  // Fit the fascia to the posts. Keep its middle painting intact and move only the rounded end caps.
  g.clearRect(0,0,facade.box.w,148-facade.box.y);
  for (const [fromX,toX,width] of [[278,320,14],[334,334,1019],[1369,1353,14]]) {
    g.drawImage(facade.image,fromX-facade.box.x,0,width,103,toX-facade.box.x,0,width,103);
  }
  // The original awning is offset to the right. Restore the wall behind it before centering it.
  g.clearRect(0,148-facade.box.y,facade.box.w,146);
  g.drawImage(backdrop,288,295,1079,1,288-facade.box.x,148-facade.box.y,1079,146);
  const awning = cut(backdrop,{x: 265,y: 147,w: 1224,h: 148},
    'M322 148 H1421 Q1485 198 1485 242 V295 H268 V236 Q271 214 312 164 Z');
  // Follow the existing painted scallop outline instead of cutting an approximate wave into it.
  const ag = awning.image.getContext('2d')!,pixels = ag.getImageData(0,0,awning.image.width,awning.image.height);
  for (let x = 0;x < pixels.width;x++) {
    let edge = 294;
    for (let y = 278;y <= 293;y++) {
      const i = ((y-awning.box.y)*pixels.width+x)*4;
      if (pixels.data[i+3] && pixels.data[i] < 180 && pixels.data[i+1] < 120 && pixels.data[i+2] < 95) {
        edge = y+2;break;
      }
    }
    for (let y = edge+1;y < 295;y++) pixels.data[((y-awning.box.y)*pixels.width+x)*4+3] = 0;
  }
  ag.putImageData(pixels,0,0);
  if (easelClear) {
    // Restore only the pixels previously hidden by the easel; retain the rest of the native cafe.
    g.save();g.translate(-facade.box.x,-facade.box.y);
    g.clip(new Path2D('M235 545 H426 L450 751 L460 870 H202 L222 677 Z'));
    g.drawImage(easelClear,0,0,1672,941);g.restore();
  }
  // The relocated round sign originally hides the lower corner. Reuse the symmetric door corner.
  g.save();g.translate(-facade.box.x,-facade.box.y);g.translate(2445,0);g.scale(-1,1);
  g.drawImage(backdrop,1105,735,90,89,1105,735,90,89);g.restore();
  g.drawImage(backdrop,1340,650,27,84,1340-facade.box.x,735-facade.box.y,27,89);
  // The original crop included a strip of adjacent wall outside the actual left wooden post.
  g.clearRect(0,294-facade.box.y,320-facade.box.x,facade.box.h);
  if (easelClear) {
    // Use one continuous painted post, rather than changing wood color at the easel patch boundary.
    g.save();g.translate(-facade.box.x,-facade.box.y);g.beginPath();g.rect(320,294,35,533);g.clip();
    g.drawImage(easelClear,0,0,1672,941);g.restore();
  }
  const bench = spriteCanvas(312,257),bg = bench.getContext('2d')!;
  const stone = bg.createLinearGradient(18,0,312,0);
  stone.addColorStop(0,'#EDBF96');stone.addColorStop(.13,'#F8DABA');stone.addColorStop(1,'#F5D2AE');
  bg.fillStyle = stone;bg.fillRect(17,24,295,233);
  bg.fillStyle = '#E1A878';bg.fillRect(17,24,8,233);
  bg.fillStyle = '#FFF1D9';bg.strokeStyle = '#CB915E';bg.lineWidth = 2.5;
  bg.beginPath();bg.roundRect(2,3,320,21,5);bg.fill();bg.stroke();
  bg.fillStyle = '#FFF9E9';bg.fillRect(8,6,304,3);
  bg.fillStyle = '#DCAC7F';bg.fillRect(21,25,291,5);
  bg.strokeStyle = '#D2A177';bg.lineWidth = 2.5;
  bg.beginPath();bg.moveTo(18,28);bg.lineTo(18,255);bg.lineTo(312,255);bg.stroke();
  return {
    facade,facadeClean: {...facade,image: facadeClean},awning,upper: fittedUpper,sky: storefrontSkyArt(),
    windowLeft: cut(backdrop,{x: 0,y: 320,w: 72,h: 353},
      'M0 320 H24 V622 H62 Q69 624 69 633 V658 Q69 668 60 668 H0 Z'),
    windowRight: cut(backdrop,{x: 1572,y: 178,w: 100,h: 405},
      'M1672 179 C1609 182 1575 232 1574 295 V580 H1672 Z'),
    bench: {image: bench,box: {x: 1360,y: 575,w: 312,h: 257}},
    easel: cut(backdrop,{x: 203,y: 546,w: 257,h: 324},
      'M240 550 Q238 547 252 548 L412 548 Q421 548 422 560 L445 751 '
      +'L455 848 Q460 864 447 865 L432 864 L425 828 H250 L244 849 '
      +'Q241 858 230 855 L209 855 Q204 855 207 840 L225 681 Z'),
    mat: cut(backdrop,{x: 977,y: 821,w: 215,h: 46},
      'M982 840 C1002 820 1161 819 1185 840 C1212 869 969 873 982 840 Z'),
    bracket: cut(backdrop,{x: 137,y: 188,w: 109,h: 73},
      'M233 190 Q242 190 243 199 V251 Q243 258 234 258 H219 V222 '
      +'L151 216 Q137 215 140 202 Q141 194 152 196 L219 209 V198 Q219 190 227 190 Z'),
    tree: cut(backdrop,{x: 0,y: 0,w: 260,h: 386},
      'M39 0 H59 L42 77 L163 11 Q172 9 167 18 L40 96 L28 136 '
      +'L94 105 L116 79 Q125 73 121 84 L105 112 L153 94 L195 28 Q205 18 202 32 '
      +'L178 87 L245 54 Q253 51 248 61 L190 99 L247 82 Q257 80 251 89 '
      +'L172 119 L150 155 L129 180 L92 235 L73 270 L38 314 L20 335 L0 385 '
      +'V281 L19 247 L37 190 L19 227 L0 243 V202 L15 154 Z'),
    wall: courtyard ? cropSprite(courtyard,{x: 0,y: 0,w: 1024,h: 840}) : null,
    paving: courtyard ? cropSprite(courtyard,{x: 0,y: 868,w: 1024,h: 668}) : null,
  };
}
