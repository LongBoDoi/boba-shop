import type { CustomerLook } from '../game/customers';
import { n, shade, uid } from './svg';
import type { Mood } from './character';

type Coat = { base: string; cream: string; marking: string; outline: string; dark: string };
type Paint = { fur: string; muzzle: string; cloth: string; ear: string };
const point = (p: { x: number; y: number }) => `${n(p.x)} ${n(p.y)}`;

/** Each direction is a new drawing projected from a rounded head, not a squeezed front/profile. */
export function catHeadAngle(look: CustomerLook, c: Coat, paint: Paint, degrees: number, mood: Mood, blink: boolean) {
  const yaw = degrees * Math.PI / 180, cos = Math.cos(yaw), sin = Math.sin(yaw);
  const project = (x: number, y: number, z: number) => ({ x: 50 + x * cos - z * sin, y, z: x * sin + z * cos });
  const surface = (lon: number, lat: number) => project(33 * Math.sin(lon) * Math.cos(lat), 53 + 30 * Math.sin(lat), 30 * Math.cos(lon) * Math.cos(lat));
  const rx = Math.hypot(33 * cos, 30 * sin), clip = uid('cat-angle');
  const outline = `M${n(50-rx+4)} 39Q${n(50-rx-2)} 48 ${n(50-rx)} 59L${n(47-rx)} 64L${n(53-rx)} 66L${n(50-rx+1)} 70L${n(57-rx)} 71Q29 84 50 85Q73 84 ${n(43+rx)} 71L${n(50+rx-1)} 70L${n(47+rx)} 66L${n(53+rx)} 64L${n(50+rx)} 59Q${n(52+rx)} 47 ${n(46+rx)} 39Q50 20 ${n(50-rx+4)} 39Z`;
  let out = `<defs><clipPath id="${clip}"><path d="${outline}"/></clipPath></defs>`;
  const ears = [-1,1].map(side => ({ side, ...project(side * 25, 28, -2) })).sort((a,b) => a.z-b.z);
  for (const ear of ears) {
    const width = 9 + (ear.z + 25) / 50 * 4, top = 9 - ear.z * .025;
    out += `<path d="M${n(ear.x-width)} 40Q${n(ear.x-width-2)} 20 ${n(ear.x-3)} ${n(top)}Q${n(ear.x)} ${n(top-2)} ${n(ear.x+width)} 30L${n(ear.x+width)} 42Z" fill="url(#${paint.fur})" stroke="${c.outline}" stroke-width="1.5"/>
      <path d="M${n(ear.x-width+3)} 33L${n(ear.x-2)} ${n(top+6)}L${n(ear.x+width-4)} 32Z" fill="url(#${paint.ear})" opacity="${n(Math.max(0, cos) * (ear.z < -10 ? .55 : .9))}"/>`;
  }
  out += `<path d="${outline}" fill="url(#${paint.fur})" stroke="${c.outline}" stroke-width="1.5"/><g clip-path="url(#${clip})">`;
  // Coat patches follow the curved surface and disappear around its far side.
  for (let lat = -75; lat < 75; lat += 10) for (let lon = -180; lon < 180; lon += 10) {
    const a = lon + 5, b = lat + 5;
    let fill = '';
    if (look.hairStyle === 'bun' && Math.abs(a) < (b > 5 ? 65 : 18 + Math.max(0,b)*2)) fill = c.cream;
    if (look.hairStyle === 'bob' && b < 5 && a > -85 && a < -15) fill = c.marking;
    if (look.hairStyle === 'bob' && b < -10 && a > 28 && a < 95) fill = c.dark;
    if (!fill) continue;
    const vertices = [[lon,lat],[lon+10,lat],[lon+10,lat+10],[lon,lat+10]].map(([a,b]) => surface(a*Math.PI/180,b*Math.PI/180));
    if (vertices.some(p => p.z < -1)) continue;
    const light = Math.max(-12, Math.min(9, -vertices[0].x*.12 + 6));
    const color = shade(fill, light);
    out += `<path d="M${vertices.map(point).join('L')}Z" fill="${color}" stroke="${color}" stroke-width=".35"/>`;
  }
  if (!['bob','bun'].includes(look.hairStyle)) {
    for (const lon of [-.36,0,.36]) {
      const vertices = [surface(lon-.1,-.85),surface(lon+.1,-.85),surface(lon*.8,-.38)];
      if (vertices.every(p=>p.z>0)) out += `<path d="M${vertices.map(point).join('L')}Z" fill="${c.marking}" opacity=".75"/>`;
    }
    for (const side of [-1,1]) for (let row=0;row<2;row++) {
      const from=surface(side*1.15,.05+row*.22),to=surface(side*.75,.14+row*.22);
      if(from.z>0&&to.z>0)out+=`<path d="M${point(from)}L${point(to)}" stroke="${c.marking}" stroke-width="2.5" opacity=".65"/>`;
    }
  }
  // Small strokes, anchored to the fur surface, keep the intermediate angles illustrated.
  for(let i=0;i<24;i++) {
    const lon=(i*2.399963)%(Math.PI*2)-Math.PI,lat=-.7+(i%7)*.22;
    const a=surface(lon,lat),b=surface(lon+.035,lat+.055);
    if(a.z>6&&b.z>6)out+=`<path d="M${point(a)}L${point(b)}" fill="none" stroke="${shade(c.base,45)}" opacity=".32" stroke-width=".7"/>`;
  }
  out+='</g>';
  if (cos > -.12) {
    const muzzle=project(0,69,29);
    const mw=Math.hypot(18*cos,8*sin);
    out+=`<ellipse cx="${n(muzzle.x)}" cy="71" rx="${n(mw)}" ry="10" fill="url(#${paint.muzzle})"/>`;
  }
  for (const side of [-1,1]) {
    const eye=project(side*13,54,25), visible=eye.z/28;
    if(visible<.12)continue;
    const ew=3.5*Math.max(.5,visible);
    if(blink||mood==='delighted')out+=`<path d="M${n(eye.x-ew-1)} 56Q${n(eye.x)} ${mood==='delighted'?'49':'59'} ${n(eye.x+ew+1)} 56" fill="none" stroke="#49382C" stroke-width="1.9"/>`;
    else out+=`<ellipse cx="${n(eye.x)}" cy="54" rx="${n(ew)}" ry="4.6" fill="#49382C"/><ellipse cx="${n(eye.x)}" cy="56" rx="${n(ew*.65)}" ry="1.3" fill="#B28C54"/><circle cx="${n(eye.x-.8)}" cy="52.2" r="1.05" fill="#FFF8E5"/>`;
    const cheek=project(side*23,64,21);
    if(cheek.z>0)out+=`<ellipse cx="${n(cheek.x)}" cy="64" rx="4.2" ry="2.5" fill="#D98E72" opacity=".3"/>`;
    if(mood==='angry')out+=`<path d="M${n(eye.x-5)} ${side<0?'47':'50'}L${n(eye.x+5)} ${side<0?'50':'47'}" stroke="#674B38" stroke-width="1.6"/>`;
    if(look.hairStyle==='balding')out+=`<path d="M${n(eye.x-5)} 47Q${n(eye.x)} 44 ${n(eye.x+5)} 47" fill="none" stroke="#fff3db" stroke-width="2.2"/>`;
    if(look.accessory==='glasses') {
      const gr=Math.max(3,9*visible);
      out+=`<ellipse cx="${n(eye.x)}" cy="55" rx="${n(gr)}" ry="9" fill="none" stroke="#86613E" stroke-width="1.3"/>`;
      const temple=project(side*29,48,5);
      out+=`<path d="M${n(eye.x+side*gr)} 52L${point(temple)}" stroke="#86613E" stroke-width="1.2"/>`;
    }
  }
  if(cos>-.12) {
    const nose=project(0,64,34),mouth=project(0,70,31);
    const nw=2.5+Math.abs(cos);
    out+=`<path d="M${n(nose.x-nw)} 62.7Q${n(nose.x)} 61 ${n(nose.x+nw)} 62.7L${n(nose.x)} 66Z" fill="#AD7566" stroke="#7C5143" stroke-width=".7"/>`;
    const span=Math.max(3,8*Math.abs(cos));
    out+=`<path d="M${n(nose.x)} 66L${point(mouth)}M${n(mouth.x-span)} ${mood==='angry'?'73':'69'}Q${n(mouth.x-span*.5)} ${mood==='angry'?'67':'75'} ${point(mouth)}Q${n(mouth.x+span*.5)} ${mood==='angry'?'67':'75'} ${n(mouth.x+span)} ${mood==='angry'?'73':'69'}" fill="none" stroke="#75503E" stroke-width="1.2"/>`;
    for(const side of [-1,1])for(const row of [0,1]){
      const a=project(side*18,67+row*3,27),b=project(side*37,64+row*7,14);
      if(a.z>0)out+=`<path d="M${point(a)}L${point(b)}" stroke="${c.outline}" stroke-width=".7" opacity=".7"/>`;
    }
  }
  if(look.hairStyle==='cap') {
    const w=Math.hypot(24*cos,21*sin), brim=project(0,34,24);
    out+=`<path d="M${n(50-w)} 32Q${n(50-w)} 17 50 18Q${n(50+w)} 18 ${n(50+w)} 33Z" fill="url(#${paint.cloth})" stroke="${c.outline}" stroke-width="1.1"/><ellipse cx="${n(brim.x)}" cy="34" rx="${n(Math.max(5,26*Math.abs(cos)))}" ry="3" fill="url(#${paint.cloth})" stroke="${c.outline}" stroke-width="1"/>`;
  } else if(look.accessory==='bow') {
    const bow=project(23,30,8);
    if(bow.z>-7)out+=`<path d="M${n(bow.x)} 30l-8-5v10Z M${n(bow.x)} 30l8-5v10Z" fill="#CC886F" stroke="#955F4C" stroke-width=".8"/><circle cx="${n(bow.x)}" cy="30" r="2.6" fill="#E6A28A"/>`;
  }
  return out;
}

export function catTorsoAngle(shirt: string, paint: Paint, degrees: number) {
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rx=Math.hypot(23*c,17*s);
  const left=50-rx,right=50+rx;
  let out=`<path d="M${n(left+5)} 84Q50 79 ${n(right-5)} 84L${n(right+1)} 134Q50 140 ${n(left-1)} 134Z" fill="url(#${paint.cloth})" stroke="${shade(shirt,-38)}" stroke-width="1.3"/>
    <path d="M${n(left+7)} 86Q50 98 ${n(right-7)} 86M${n(left+3)} 130Q50 135 ${n(right-3)} 130" fill="none" stroke="${shade(shirt,30)}" stroke-width="1.4"/>`;
  if(c>.15){const x=50-17*s,w=5*c;out+=`<path d="M${n(x-w)} 107Q${n(x)} 110 ${n(x+w)} 107V117Q${n(x)} 121 ${n(x-w)} 117Z" fill="${shade(shirt,30)}" stroke="${shade(shirt,-18)}" stroke-width=".7"/>`;}
  for(let i=0;i<9;i++){const x=left+4+i*(rx*2-8)/8;out+=`<path d="M${n(x)} 126l1 2l1-2" stroke="${shade(shirt,35)}" fill="none" stroke-width=".65" opacity=".5"/>`;}
  return out;
}
