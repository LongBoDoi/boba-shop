import { fortuneCatArt, fortuneCatPose } from './fortuneCat';
import { storefrontArt, type StorefrontSources } from './storefrontArt';
import { storefrontCatPose } from './storefrontCats';
import { compose, ID, storefrontLayout, subjectTransform, titleTransform, UPPER_STOREY, type StorefrontLayout, type TitleTransform } from './storefrontLayout';
import type { ArtBox } from './titleSprite';
import { skyMotion } from './storefrontSky';

type Sprite = HTMLImageElement | HTMLCanvasElement;
export type ScenePainter = (image: Sprite,box: ArtBox,transform?: TitleTransform,clip?: ArtBox) => void;
let prepared: {key: string;art: ReturnType<typeof storefrontArt>;arm: ReturnType<typeof fortuneCatArt>} | null = null;
export function prepareStorefront(image: HTMLImageElement,sources: StorefrontSources) {
  const {backdrop,foliage,cats,foreground,armSheet,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear} = sources;
  if (!backdrop || !foliage || !cats || !foreground || !armSheet) return null;
  const key = [image,backdrop,foliage,cats,foreground,armSheet,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear].map(i => i?.src).join('|');
  if (!prepared || prepared.key !== key) prepared = {
    key,art: storefrontArt(image,{backdrop,foliage,cats,foreground,armSheet,courtyard,upper,garden,rightLeaves,cornerTrees,easelClear}),arm: fortuneCatArt(armSheet),
  };
  return prepared;
}
type Prepared = NonNullable<ReturnType<typeof prepareStorefront>>;

function environment(paint: ScenePainter,image: Sprite,box: ArtBox) {
  const scale = Math.max(box.w/image.width,box.h/image.height);
  paint(image,{x: box.x+(box.w-image.width*scale)/2,y: box.y+(box.h-image.height*scale)/2,
    w: image.width*scale,h: image.height*scale},ID,box);
}

/** Shared composition for WebGL, reduced motion, loading fallback and context loss. */
export function paintStorefront(paint: ScenePainter,scene: Prepared,layout: StorefrontLayout,seconds: number) {
  const {art,arm} = scene;
  if (art.portrait.wall && art.portrait.paving) {
    environment(paint,art.portrait.wall,{x: 0,y: 0,w: layout.w,h: layout.floor});
    environment(paint,art.portrait.paving,{x: 0,y: layout.floor,w: layout.w,h: layout.h-layout.floor});
  }
  if (layout.portrait) {
    const sky = art.portrait.sky,upper = subjectTransform(layout,'upper');
    const roofTop = upper.ty+UPPER_STOREY.peakY*upper.d;
    paint(sky.sky,{x: 0,y: 0,w: layout.w,h: layout.floor});
    for (let i = 0;i < 3;i++) {
      const pose = skyMotion(seconds,i),width = Math.min(layout.w*(.32+i*.06),upper.a*800*(1+i*.15));
      paint(sky.clouds[i],{x: pose.cloudX*(layout.w+width)-width,
        y: roofTop*(.12+i*.24)-width*.08,w: width,h: width*150/360});
    }
    for (let i = 0;i < 3;i++) {
      const pose = skyMotion(seconds,i),size = Math.min(layout.w*(.044-i*.005),upper.a*(100-i*10));
      paint(sky.birds[pose.wing],{x: pose.birdX*(layout.w+size*3)-size,
        y: roofTop*pose.birdY,w: size,h: size*.75});
    }
    if (art.garden) {
      const width = layout.w*1.25;
      const height = width*art.garden.height/art.garden.width;
      paint(art.garden,{x: (layout.w-width)/2,y: layout.floor-height*art.gardenBase,w: width,h: height});
    }
    if (art.portrait.upper) paint(art.portrait.upper,
      {x: 0,y: 0,w: UPPER_STOREY.width,h: UPPER_STOREY.height},upper);
  }
  const still = (item: {image: Sprite;box: ArtBox},id: string) => paint(item.image,item.box,subjectTransform(layout,id));
  const native = !layout.portrait && Math.abs(layout.h-941)<.01;
  if (native) paint(art.background,{x: 0,y: 0,w: 1672,h: 941},layout.shop);
  else {
    if (!layout.portrait || !art.cornerTrees) still(art.portrait.tree,'tree');
    if (layout.portrait) {
      still(art.portrait.facadeClean,'facade');still(art.portrait.awning,'awning');
      const benchShadow = art.contactShadows.find(s => s.id === 'bench')!;
      still(benchShadow,'bench');still(art.portrait.bench,'bench');
    } else {
      still(art.portrait.windowLeft,'window-left');still(art.portrait.windowRight,'window-right');
      const bench = art.portrait.bench;
      paint(bench.image,{...bench.box,w: (layout.w-layout.shop.tx)/layout.shop.a-bench.box.x},layout.shop);
      still(art.portrait.facade,'facade');
      still(art.portrait.easel,'easel');
    }
    still(art.portrait.mat,'mat');still(art.portrait.bracket,'sign');
  }
  if (layout.portrait) for (const shadow of art.contactShadows) if (shadow.id !== 'bench') still(shadow,shadow.id);
  for (const leaf of art.foliage) {
    if (layout.portrait && art.cornerTrees && leaf.id === 'canopy') continue;
    const replacement = layout.portrait && leaf.id === 'plant-right' ? art.rightLeaves : null;
    paint(replacement?.image ?? (native ? leaf.image : leaf.crop),replacement?.box ?? (native ? leaf.box : leaf.cropBox),
      compose(subjectTransform(layout,leaf.id),titleTransform(leaf.pivot,leaf.amplitude*Math.sin(seconds*leaf.frequency+leaf.phase))));
  }
  if (layout.portrait && art.cornerTrees) {
    const width = Math.min(layout.w*.72,440*layout.unit),height = width*art.cornerTrees[0].height/art.cornerTrees[0].width;
    for (let i = 0;i < 2;i++) {
      const x = i ? layout.w-width+48*layout.unit : -48*layout.unit,y = -24*layout.unit;
      const pivot = {x: i ? layout.w+48*layout.unit : -48*layout.unit,y: y+height};
      paint(art.cornerTrees[i],{x,y,w: width,h: height},titleTransform(pivot,.012*Math.sin(seconds*1.3+i*1.8)));
    }
  }
  // At the facade the plant stands behind the original easel, rather than hiding its lettering.
  if (layout.portrait) still(art.portrait.easel,'easel');
  const sign = art.sign;
  paint(sign.image,sign.box,compose(subjectTransform(layout,'sign'),titleTransform(sign.pivot,sign.amplitude*Math.sin(seconds*sign.frequency+sign.phase))));
  const cat = (id: string) => {
    const figure = art.cats.find(c => c.id === id)!;
    const pose = storefrontCatPose(figure,seconds);
    const sway = id === 'baker' ? .006*Math.sin(seconds*1.7) : id === 'roof' ? .003*Math.sin(seconds*1.3) : 0;
    const parent = compose(subjectTransform(layout,id),titleTransform(figure.pivot,sway,1,pose.scaleY));
    const shadow = art.shadows.find(s => s.id === id)!;still(shadow,id);
    for (const part of figure.parts) paint(part.image,part.box,compose(parent,titleTransform(part.pivot,part.amplitude*Math.sin(seconds*1.9+part.phase))));
    const blinkTime = (seconds+figure.phase)%3.7;
    paint(figure.blink && (blinkTime < .13 || blinkTime > .26 && blinkTime < .34) ? figure.blink : figure.image,figure.box,parent);
    if (id === 'roof') {
      paint(arm.frames[fortuneCatPose(seconds).frame],arm.box,parent);
      if (figure.shoulderCover) paint(figure.shoulderCover.image,figure.shoulderCover.box,parent);
    }
  };
  cat('roof');cat('baker');cat('sleep-right');
  for (const prop of layout.portrait ? art.foregrounds : art.landscapeForegrounds) still(prop,prop.id);
  cat('sleep-left');
}

export function paintStorefrontStill(canvas: HTMLCanvasElement,image: HTMLImageElement,sources: StorefrontSources,width: number,height: number) {
  const scene = prepareStorefront(image,sources),g = canvas.getContext('2d');
  if (!scene || !g) return false;
  const ratio = Math.min(window.devicePixelRatio || 1,2,3344/width),layout = storefrontLayout(width,height);
  canvas.width = Math.round(width*ratio);canvas.height = Math.round(height*ratio);
  const scale = canvas.width/layout.w;
  g.setTransform(scale,0,0,canvas.height/layout.h,0,0);g.fillStyle = '#FBE3C7';g.fillRect(0,0,layout.w,layout.h);
  paintStorefront((source,box,m = ID,clip) => {
    g.save();
    if (clip) {g.beginPath();g.rect(clip.x,clip.y,clip.w,clip.h);g.clip();}
    g.transform(m.a,m.b,m.c,m.d,m.tx,m.ty);g.drawImage(source,box.x,box.y,box.w,box.h);g.restore();
  },scene,layout,0);
  return true;
}
