/** A complete backdrop plus independent transparent subjects; there are no silhouette patches. */
import { ArtBox, alphaBounds, cleanSprite, cropSprite, padFoliage, spriteCanvas } from './titleSprite';
import { prepareCats } from './storefrontCats';
import { portraitArt } from './storefrontPortrait';

export type {ArtBox} from './titleSprite';
export interface StorefrontSources {
  backdrop?: HTMLImageElement; foliage?: HTMLImageElement; cats?: HTMLImageElement;
  foreground?: HTMLImageElement; armSheet?: HTMLImageElement;
  courtyard?: HTMLImageElement;
  upper?: HTMLImageElement;
  garden?: HTMLImageElement;
  rightLeaves?: HTMLImageElement;
  cornerTrees?: HTMLImageElement;
  easelClear?: HTMLImageElement;
}
export interface StorefrontLayer {
  id: string; image: HTMLCanvasElement; box: ArtBox; pivot: {x: number;y: number};
  amplitude: number; frequency: number; phase: number;
}
export interface ForegroundLayer {id: string; image: HTMLCanvasElement; box: ArtBox}
export const SIGN_ANCHOR = {x: 166,y: 212};

function signArt(original: HTMLImageElement) {
  const box = {x: 99,y: 207,w: 180,h: 238}, image = spriteCanvas(box.w,box.h), g = image.getContext('2d')!;
  g.translate(-box.x,-box.y);
  const oval = new Path2D(); oval.ellipse(187,340,77,90,-.17,0,Math.PI*2);
  g.fillStyle = '#FFF0D9'; g.fill(oval);
  const inner = new Path2D(); inner.ellipse(187,340,74,87,-.17,0,Math.PI*2);
  g.save(); g.clip(inner); g.drawImage(original,0,0,1672,941); g.restore();
  g.strokeStyle = '#976039'; g.lineWidth = 3.2; g.stroke(oval);
  // These closed links overlap each other and the sign. The very top is the rotation pivot.
  g.strokeStyle = '#85502D'; g.lineWidth = 2.8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(166,212); g.lineTo(166,218); g.stroke();
  for (const y of [222,235,247]) {
    g.beginPath(); g.ellipse(166,y,3.6,7,0,0,Math.PI*2); g.stroke();
  }
  return {id: 'sign',image,box,pivot: SIGN_ANCHOR,amplitude: .045,frequency: 1.9,phase: .2};
}

/** Keep complete painted silhouettes, including pot rims; cup/right pot retain their native overlap. */
function foregroundArt(_backdrop: HTMLImageElement, source: HTMLImageElement): ForegroundLayer[] {
  const specs = [
    {id: 'pot-left',from: {x: 29,y: 690,w: 151,h: 188},center: 109,bottom: 866,height: 166},
    {id: 'pot-shelf',from: {x: 837,y: 369,w: 70,h: 62},center: 888,bottom: 417,height: 34},
    {id: 'paw-stand',from: {x: 1173,y: 730,w: 240,h: 145},center: 1356,bottom: 865,height: 130},
    {id: 'cup',from: {x: 1403,y: 467,w: 269,h: 418},center: 1549.5,bottom: 879,height: 402},
  ];
  return specs.map(spec => {
    const image = cleanSprite(cropSprite(source,spec.from)),bounds = alphaBounds(image,32);
    const cropped = cropSprite(image,bounds),scale = spec.height/bounds.h;
    return {id: spec.id,image: cropped,box: {x: spec.center-bounds.w*scale/2,
      y: spec.bottom-spec.height,w: bounds.w*scale,h: spec.height}};
  });
}

/** Original landscape occluders, without the portrait prop regrouping. */
function landscapeForegrounds(backdrop: HTMLImageElement,source: HTMLImageElement): ForegroundLayer[] {
  const paths = [
    {id: 'pot-left',box: {x: 42,y: 714,w: 134,h: 152},path: 'M44 714 H174 L164 851 Q163 864 110 864 Q58 865 56 850 Z'},
    {id: 'pot-front',box: {x: 1374,y: 775,w: 83,h: 86},path: 'M1376 783 Q1389 791 1416 792 Q1441 792 1455 783 L1448 846 Q1447 857 1415 858 Q1385 858 1383 848 Z'},
    {id: 'pot-right',box: {x: 1588,y: 748,w: 84,h: 111},path: 'M1589 755 Q1604 767 1634 767 Q1660 767 1671 757 L1663 846 Q1661 856 1627 857 Q1598 856 1596 847 Z'},
    {id: 'paw-stand',box: {x: 1254,y: 735,w: 134,h: 130},path: 'M1318 737 C1284 739 1256 772 1256 800 Q1255 826 1271 843 L1268 849 Q1267 857 1280 857 L1327 859 Q1332 865 1346 863 L1365 859 Q1371 858 1371 848 C1397 819 1389 774 1358 750 Q1339 735 1318 737 Z'},
    {id: 'cup',box: {x: 1427,y: 479,w: 190,h: 400},path: 'M1546 480 Q1556 478 1568 484 Q1574 487 1573 492 L1558 594 Q1557 601 1553 602 Q1538 604 1527 600 L1541 489 Q1541 482 1546 480 Z M1529 583 C1481 583 1454 591 1446 623 C1433 626 1430 630 1429 638 L1428 647 Q1428 653 1439 656 L1459 858 Q1459 869 1480 874 Q1518 881 1554 874 Q1575 870 1577 856 L1604 656 Q1615 654 1615 647 L1614 637 Q1613 627 1601 625 C1597 605 1583 591 1559 586 L1556 599 Q1540 603 1528 600 Z'},
  ];
  const props = paths.map(({id,box,path}) => {
    const image = spriteCanvas(box.w,box.h),g = image.getContext('2d')!;
    g.translate(-box.x,-box.y);g.clip(new Path2D(path));g.drawImage(backdrop,0,0,1672,941);
    return {id,image,box};
  });
  return [...props,...foregroundArt(backdrop,source).filter(p => p.id === 'pot-shelf')];
}

export function storefrontArt(original: HTMLImageElement, sources: Required<Omit<StorefrontSources,'courtyard'|'upper'|'garden'|'rightLeaves'|'cornerTrees'|'easelClear'>> & Pick<StorefrontSources,'courtyard'|'upper'|'garden'|'rightLeaves'|'cornerTrees'|'easelClear'>) {
  let rightLeaves: {image: HTMLCanvasElement;box: ArtBox} | null = null;
  if (sources.rightLeaves) {
    const raw = cleanSprite(cropSprite(sources.rightLeaves,{x: 0,y: 0,w: sources.rightLeaves.width,h: sources.rightLeaves.height}));
    const bounds = alphaBounds(raw,32),scale = 270/bounds.h;
    rightLeaves = {image: cropSprite(raw,bounds),box: {x: 1630-(raw.width/2-bounds.x)*scale,y: 755-270,w: bounds.w*scale,h: 270}};
  }
  const cornerTrees = sources.cornerTrees ? [0,1].map(i => cropSprite(sources.cornerTrees!,
    {x: sources.cornerTrees!.width/2*i,y: 0,w: sources.cornerTrees!.width/2,h: sources.cornerTrees!.height})) : null;
  const garden = sources.garden ? cropSprite(sources.garden,{x: 0,y: 0,w: sources.garden.width,h: sources.garden.height}) : null;
  const gardenBounds = garden ? alphaBounds(garden,64) : null;
  const gardenBase = gardenBounds && garden ? (gardenBounds.y+gardenBounds.h)/garden.height : 1;
  const groups = [
    {id: 'canopy',box: {x: 0,y: 0,w: 486,h: 269},pivot: {x: 122,y: 213},amplitude: .026,frequency: 1.8,phase: 0},
    {id: 'plant-left',box: {x: 0,y: 446,w: 224,h: 275},pivot: {x: 115,y: 710},amplitude: .038,frequency: 2.05,phase: .8},
    {id: 'plant-shelf',box: {x: 849,y: 340,w: 79,h: 66},pivot: {x: 884,y: 403},amplitude: .065,frequency: 2.3,phase: 1.7},
    {id: 'plant-front',box: {x: 1295,y: 627,w: 203,h: 171},pivot: {x: 1400,y: 788},amplitude: .04,frequency: 1.85,phase: 2.1},
    {id: 'plant-right',box: {x: 1490,y: 474,w: 182,h: 289},pivot: {x: 1630,y: 755},amplitude: .032,frequency: 2.15,phase: 2.9},
  ];
  const foliage = groups.map(group => {
    const crop = cropSprite(sources.foliage,group.box);
    return {...group,...padFoliage(crop,group.box),crop,cropBox: group.box};
  });
  const cats = prepareCats(sources.cats);
  const shadows = cats.map(cat => {
    const w = Math.round(cat.box.w*.78), h = cat.id.startsWith('sleep') ? 18 : 10;
    const image = spriteCanvas(w,h), g = image.getContext('2d')!;
    g.save(); g.translate(w/2,h/2); g.scale(w/2,h/2);
    const gradient = g.createRadialGradient(0,0,0,0,0,1);
    gradient.addColorStop(0,'rgba(98,53,23,.18)'); gradient.addColorStop(1,'rgba(98,53,23,0)');
    g.fillStyle = gradient; g.fillRect(-1,-1,2,2); g.restore();
    return {id: cat.id,image,box: {x: cat.pivot.x-w/2,y: cat.pivot.y-h/2,w,h}};
  });
  const contactShadows = [
    {id: 'pot-left',x: 109,y: 863,w: 136,h: 20},
    {id: 'pot-front',x: 1416,y: 857,w: 79,h: 16},
    {id: 'pot-right',x: 1631,y: 856,w: 80,h: 17},
    {id: 'cup',x: 1520,y: 875,w: 132,h: 25},
    {id: 'paw-stand',x: 1320,y: 860,w: 114,h: 19},
    {id: 'bench',x: 1520,y: 832,w: 290,h: 22},
  ].map(({id,x,y,w,h}) => {
    const image = spriteCanvas(w,h),g = image.getContext('2d')!;
    g.translate(w/2,h/2);g.scale(w/2,h/2);
    const gradient = g.createRadialGradient(-.12,0,.06,0,0,1);
    gradient.addColorStop(0,'rgba(111,65,35,.25)');gradient.addColorStop(.48,'rgba(111,65,35,.13)');
    gradient.addColorStop(1,'rgba(111,65,35,0)');g.fillStyle = gradient;g.fillRect(-1,-1,2,2);
    return {id,image,box: {x: x-w/2,y: y-h/2,w,h}};
  });
  return {background: sources.backdrop,garden,gardenBase,rightLeaves,cornerTrees,portrait: portraitArt(sources.backdrop,sources.courtyard,sources.upper,sources.easelClear),foliage,sign: signArt(original),cats,shadows,
    contactShadows,
    foregrounds: foregroundArt(sources.backdrop,sources.foreground),landscapeForegrounds: landscapeForegrounds(sources.backdrop,sources.foreground)};
}
