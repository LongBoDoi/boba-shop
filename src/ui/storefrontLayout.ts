import type { ArtBox } from './titleSprite';

export interface TitleTransform {a: number;b: number;c: number;d: number;tx: number;ty: number}
export const ID: TitleTransform = {a: 1,b: 0,c: 0,d: 1,tx: 0,ty: 0};
/** Roof sprite wall edges join the original cafe posts at one shared architectural scale. */
export const UPPER_STOREY = {
  width: 1536,height: 1024,baseY: 900,wallLeft: 148,wallRight: 1388,peakY: 230,fitPeakY: 230,
  eaveLeft: 126,eaveRight: 1408,
};
export function titleTransform(pivot: {x: number;y: number},angle = 0,sx = 1,sy = 1): TitleTransform {
  const co = Math.cos(angle), si = Math.sin(angle), a = co*sx, b = si*sx, c = -si*sy, d = co*sy;
  return {a,b,c,d,tx: pivot.x-a*pivot.x-c*pivot.y,ty: pivot.y-b*pivot.x-d*pivot.y};
}
export function compose(p: TitleTransform,q: TitleTransform): TitleTransform {
  return {a: p.a*q.a+p.c*q.b,b: p.b*q.a+p.d*q.b,c: p.a*q.c+p.c*q.d,d: p.b*q.c+p.d*q.d,
    tx: p.a*q.tx+p.c*q.ty+p.tx,ty: p.b*q.tx+p.d*q.ty+p.ty};
}
function place(scale: number,fromX: number,fromY: number,toX: number,toY: number): TitleTransform {
  return {a: scale,b: 0,c: 0,d: scale,tx: toX-fromX*scale,ty: toY-fromY*scale};
}

/** One cottage composition, framed vertically or horizontally without stretching its subjects. */
export function storefrontLayout(width: number,height: number) {
  const w = 1672,h = w*height/width,unit = w/width,portrait = height > width*1.15;
  const roofScaleRatio = (1367-320)/(UPPER_STOREY.wallRight-UPPER_STOREY.wallLeft);
  // Keep the existing cafe zoom when changing the roof pitch.
  const houseHeight = 824-148+(UPPER_STOREY.baseY-UPPER_STOREY.fitPeakY)*roofScaleRatio;
  const treeScale = Math.min(width*.72,360)*unit/486;
  const tree = place(treeScale,0,0,-32*unit,-22*unit);
  const controlSpace = portrait ? (height <= 650 ? 180 : 200) : (height <= 500 ? 82 : 130);
  const floor = h-controlSpace*unit;
  // Frame the facade closely; the two prop groups keep their own clear ground contacts.
  const framingScale = (w-96)/1240;
  const shopScale = Math.min(framingScale*1.38,(floor-(portrait ? 56 : 24)*unit)/houseHeight);
  const propScale = Math.min(shopScale/1.1,framingScale);
  const shop = place(shopScale,844,824,w/2,floor);
  const upperScale = shopScale*roofScaleRatio;
  const upper = place(upperScale,UPPER_STOREY.wallLeft,UPPER_STOREY.baseY,
    shop.tx+320*shopScale,shop.ty+148*shopScale);
  const gardenScale = propScale*.72;
  const rightEdge = portrait ? w-12 : shop.tx+1590*shopScale;
  const strawLeft = rightEdge+(1527-1740)*gardenScale;
  const pawRight = shop.tx+1263*shopScale;
  // A closer doorway reaches behind the straw. Bring the coherent prop group slightly forward.
  const gardenOffset = strawLeft < pawRight
    ? Math.max(68*propScale,398*gardenScale-139*shopScale+6)
    : 68*propScale;
  const garden = place(gardenScale,1740,877,rightEdge,floor+gardenOffset);
  const leftPlant = place(propScale*.65,109,866,portrait ? w*.065 : shop.tx+250*shopScale,floor+38*propScale);
  const leftCat = place(propScale*.72,195,887,portrait ? w*.19 : shop.tx+410*shopScale,floor+60*propScale);
  const perch = garden;
  const easel = place(propScale*.8,329,870,portrait ? w*.22 : shop.tx+440*shopScale,floor+48*propScale);
  const groups: Record<string,TitleTransform> = {
    canopy: tree,tree,upper,easel,awning: {...shop,tx: shop.tx-32*shopScale},
    sign: place(shopScale,166,212,portrait ? 140 : shop.tx+268*shopScale,shop.ty+212*shopScale),
    'plant-left': leftPlant,'pot-left': leftPlant,
    'sleep-left': leftCat,'sleep-right': perch,bench: perch,
    'plant-front': garden,'plant-right': garden,'pot-front': garden,'pot-right': garden,cup: garden,
    'paw-stand': garden,
  };
  return {w,h,unit,portrait,shop,upperBottom: shop.ty+148*shopScale,floor,groups};
}
export type StorefrontLayout = ReturnType<typeof storefrontLayout>;
export function subjectTransform(layout: StorefrontLayout,id: string) {return layout.groups[id] ?? layout.shop;}
export function storefrontBox(layout: StorefrontLayout,id: string,box: ArtBox) {
  const m = subjectTransform(layout,id),unit = layout.unit;
  return {left: (box.x*m.a+m.tx)/unit,top: (box.y*m.d+m.ty)/unit,width: box.w*m.a/unit,height: box.h*m.d/unit};
}
