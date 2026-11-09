/** A complete backdrop plus independent transparent subjects; there are no silhouette patches. */
import { ArtBox, alphaBounds, cleanSprite, cropSprite, padFoliage, spriteCanvas } from './titleSprite';
import { prepareCats } from './storefrontCats';
import { portraitArt } from './storefrontPortrait';
import { pottedFoliage } from './storefrontPlants';

export type {ArtBox} from './titleSprite';
export interface StorefrontSources {
  backdrop?: HTMLImageElement; foliage?: HTMLImageElement; cats?: HTMLImageElement;
  foreground?: HTMLImageElement; armSheet?: HTMLImageElement;
  courtyard?: HTMLImageElement;
  upper?: HTMLImageElement;
  garden?: HTMLImageElement;
  plantFoliage?: HTMLImageElement;
  cornerTrees?: HTMLImageElement;
  easelClear?: HTMLImageElement;
  neighborhood?: HTMLImageElement;
  landscapeNeighborhood?: HTMLImageElement;
}
export interface StorefrontLayer {
  id: string; image: HTMLCanvasElement; box: ArtBox; pivot: {x: number;y: number};
  amplitude: number; frequency: number; phase: number;
}
export interface ForegroundLayer {id: string; image: HTMLCanvasElement; box: ArtBox; back?: HTMLCanvasElement}
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
    {id: 'pot-left',from: {x: 29,y: 690,w: 151,h: 188},center: 109,bottom: 866,height: 166,mouth: {x: 106,y: 704.5,rx: 62,ry: 8.5}},
    {id: 'pot-shelf',from: {x: 837,y: 369,w: 70,h: 62},center: 888,bottom: 417,height: 34,mouth: null},
    {id: 'paw-stand',from: {x: 1173,y: 730,w: 240,h: 145},center: 1356,bottom: 865,height: 130,mouth: {x: 1360,y: 777,rx: 42,ry: 6.5}},
    {id: 'cup',from: {x: 1403,y: 467,w: 269,h: 418},center: 1549.5,bottom: 879,height: 402,mouth: {x: 1615,y: 757.5,rx: 36,ry: 7.5}},
  ];
  return specs.map(spec => {
    const image = cleanSprite(cropSprite(source,spec.from)),bounds = alphaBounds(image,32);
    const cropped = cropSprite(image,bounds),scale = spec.height/bounds.h;
    let back: HTMLCanvasElement | undefined;
    if (spec.mouth) {
      const {rx,ry} = spec.mouth;
      const x = spec.mouth.x-spec.from.x-bounds.x,y = spec.mouth.y-spec.from.y-bounds.y;
      // Split only the opening: rear lip/soil → stem → front lip/body, all from native paint.
      const opening = spriteCanvas(cropped.width,cropped.height),og = opening.getContext('2d')!;
      og.beginPath();og.rect(0,0,opening.width,y+ry*.45);og.clip();
      og.fillStyle = '#fff';og.beginPath();og.ellipse(x,y,rx,ry,0,0,Math.PI*2);og.fill();
      back = cropSprite(cropped,{x: 0,y: 0,w: cropped.width,h: cropped.height});
      const bg = back.getContext('2d')!;bg.globalCompositeOperation = 'destination-in';bg.drawImage(opening,0,0);
      const fg = cropped.getContext('2d')!;fg.globalCompositeOperation = 'destination-out';fg.drawImage(opening,0,0);
      fg.globalCompositeOperation = 'source-over';
    }
    return {id: spec.id,image: cropped,box: {x: spec.center-bounds.w*scale/2,
      y: spec.bottom-spec.height,w: bounds.w*scale,h: spec.height},back};
  });
}

export function storefrontArt(original: HTMLImageElement, sources: Required<Omit<StorefrontSources,'courtyard'|'upper'|'garden'|'plantFoliage'|'cornerTrees'|'easelClear'|'neighborhood'|'landscapeNeighborhood'>> & Pick<StorefrontSources,'courtyard'|'upper'|'garden'|'plantFoliage'|'cornerTrees'|'easelClear'|'neighborhood'|'landscapeNeighborhood'>) {
  const plants = sources.plantFoliage ? pottedFoliage(sources.plantFoliage) : [];
  const cornerTrees = sources.cornerTrees ? [0,1].map(i => cropSprite(sources.cornerTrees!,
    {x: sources.cornerTrees!.width/2*i,y: 0,w: sources.cornerTrees!.width/2,h: sources.cornerTrees!.height})) : null;
  const garden = sources.garden ? cropSprite(sources.garden,{x: 0,y: 0,w: sources.garden.width,h: sources.garden.height}) : null;
  const neighborhood = sources.neighborhood;
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
    const plant = plants.find(plant => plant.id === group.id);
    if (plant) return {...group,...plant,image: plant.crop,box: plant.cropBox,amplitude: .018};
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
  return {background: sources.backdrop,neighborhood,landscapeNeighborhood: sources.landscapeNeighborhood,garden,gardenBase,cornerTrees,portrait: portraitArt(sources.backdrop,sources.courtyard,sources.upper,sources.easelClear),foliage,sign: signArt(original),cats,shadows,
    contactShadows,
    foregrounds: foregroundArt(sources.backdrop,sources.foreground)};
}
