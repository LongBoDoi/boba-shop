/** Small cups share the playable cup's clear shell, cat-ear lid and hollow straw. */
import { Drink, getIngredient, ICE_LEVELS, Tea, Topping } from '../game/ingredients';
import { CUP_FINISH_RISE, CUP_LID_HOLE_Y } from './finishingArt';
import { CUP_CONTENTS, cupFillPath, cupSurface } from './cupGeometry';
import { referencePartSvg, CUP_DISPLAY_HEIGHT } from './referenceCupArt';
import { el, shade, svgDoc, uid } from './svg';

export interface CupOptions {
  width: number;
  backgroundColor: string;
  straw?: boolean;
  sealed?: boolean;
  tapered?: boolean;
  fill?: number;
  surface?: boolean;
  surfacePhase?: number;
}
export interface CupLayout {
  svgWidth: number; svgHeight: number;
  originX: number; originY: number;
  boxWidth: number; boxHeight: number;
}
export function cupLayout(width: number, opts: { straw?: boolean; sealed?: boolean } = {}): CupLayout {
  const height = width * CUP_DISPLAY_HEIGHT / 113;
  const top = height * (opts.straw ? CUP_FINISH_RISE : opts.sealed ? 60 : 0) / 174;
  return {svgWidth:width,svgHeight:height+top,originX:0,originY:top,boxWidth:width,boxHeight:height};
}

export function cupSvg(drink: Drink, opts: CupOptions): string {
  const box = cupLayout(opts.width,opts);
  const tea = drink.tea ? getIngredient('tea',drink.tea) as Tea | undefined : undefined;
  const milk = drink.milk && drink.milk !== 'none' ? getIngredient('milk',drink.milk) : undefined;
  const foam = drink.foam && drink.foam !== 'none' ? getIngredient('foam',drink.foam) : undefined;
  const fill = Math.max(0,Math.min(1,opts.fill ?? (tea ? .72 : milk ? .3 : 0)));
  const color = (milk ? tea?.milkyColor ?? milk.color : tea?.color) ?? '#fffef6';
  const clip = uid('cup-contents'), depth = uid('cup-tea');
  const surface = cupSurface(fill);
  let inner = '';
  if (fill > 0) {
    inner += el('path',{d:cupFillPath(fill),fill:`url(#${depth})`});
    inner += el('ellipse',{cx:56.5,cy:surface.y,rx:surface.rx,ry:surface.ry,fill:shade(color,12)});
    if (opts.surface) inner += el('path', {d:`M${28+(opts.surfacePhase??0)*8} ${surface.y}Q56 ${surface.y-5} 82 ${surface.y}`,fill:'none',stroke:'#ffffff70','stroke-width':1.4});
  }
  for (let i=0;i<drink.toppings.length*12;i++) {
    const topping = getIngredient('toppings',drink.toppings[i%drink.toppings.length]) as Topping | undefined;
    const x=29+(i%7)*9+(Math.floor(i/7)%2)*4, y=156-Math.floor(i/7)*7;
    const material = {fill:topping?.color??'#39261b',stroke:'#38292088','stroke-width':.6};
    inner += topping?.shape === 'cube'
      ? el('rect',{x:x-4,y:y-4,width:8,height:8,rx:1.4,...material})
      : el('circle',{cx:x,cy:y,r:4.3,...material});
    inner += el('ellipse',{cx:x-1.2,cy:y-1.3,rx:1.2,ry:.65,fill:'#ffffff66'});
  }
  const cubes = ICE_LEVELS.find(i=>i.id===drink.ice)?.cubes ?? 0;
  for(let i=0;i<Math.min(cubes,6);i++) {
    const x=25+(i%3)*22,y=Math.max(32,surface.y-3)+Math.floor(i/3)*19;
    inner += el('rect',{x,y,width:17,height:18,rx:3,transform:`rotate(${i%2?13:-12} ${x+8} ${y+9})`,fill:'#edf8fa70',stroke:'#ffffffb3','stroke-width':1.3});
  }
  if (foam && fill>0) {
    inner += el('ellipse',{cx:56.5,cy:surface.y,rx:surface.rx-1,ry:surface.ry,fill:foam.color});
    for (let i=0;i<4;i++) {
      inner += el('ellipse',{cx:56.5+i*.5,cy:surface.y-i*4-3,rx:27-i*6,ry:7-i,fill:foam.color,stroke:shade(foam.color,-19),'stroke-width':.7});
    }
  }
  let out=`<defs><clipPath id="${clip}"><path d="${CUP_CONTENTS}"/></clipPath><linearGradient id="${depth}" x2=".8" y2="1"><stop stop-color="${shade(color,9)}"/><stop offset="1" stop-color="${shade(color,-16)}"/></linearGradient></defs>`;
  out += el('g',{'clip-path':`url(#${clip})`},inner);
  out += referencePartSvg('cup');
  if(opts.sealed || opts.straw) out += referencePartSvg('lid');
  if(opts.straw) {
    const upper=uid('straw-upper'),lower=uid('straw-lower');
    out+=`<defs><clipPath id="${upper}"><path d="M0-${CUP_FINISH_RISE}H113V${CUP_LID_HOLE_Y}H0Z"/></clipPath><clipPath id="${lower}"><path d="M0${CUP_LID_HOLE_Y}H113V174H0Z"/></clipPath></defs>`;
    out+=el('g',{'clip-path':`url(#${lower})`,opacity:.26},referencePartSvg('straw'));
    out+=el('g',{'clip-path':`url(#${upper})`},referencePartSvg('straw'));
  }
  const top=opts.straw?CUP_FINISH_RISE:opts.sealed?60:0;
  return svgDoc(box.svgWidth,box.svgHeight,out,`0 ${-top} 113 ${174+top}`,{preserveAspectRatio:"none"});
}
