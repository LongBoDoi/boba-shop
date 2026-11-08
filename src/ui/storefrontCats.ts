import { ArtBox, cleanSprite, cropSprite, spriteCanvas } from './titleSprite';

export interface CatPart {
  image: HTMLCanvasElement; box: ArtBox; pivot: {x: number; y: number}; phase: number; amplitude: number;
}
export interface StorefrontCat {
  id: string; image: HTMLCanvasElement; blink?: HTMLCanvasElement; box: ArtBox;
  pivot: {x: number; y: number}; breath: number; frequency: number; phase: number; parts: CatPart[];
  shoulderCover?: {image: HTMLCanvasElement; box: ArtBox};
}

export function storefrontCatPose(cat: Pick<StorefrontCat, 'breath' | 'frequency' | 'phase'>, seconds: number) {
  return {scaleY: 1+cat.breath*(.5+.5*Math.sin(seconds*cat.frequency+cat.phase))};
}

export function prepareCats(source: HTMLImageElement): StorefrontCat[] {
  const cats: StorefrontCat[] = [
    {id: 'roof', box: {x: 605,y: 0,w: 404,h: 180}, pivot: {x: 808,y: 165}, breath: .009,frequency: 1.7,phase: 0,parts: [],image: spriteCanvas(1,1)},
    {id: 'baker', box: {x: 600,y: 410,w: 166,h: 91}, pivot: {x: 685,y: 493}, breath: .022,frequency: 1.9,phase: .8,parts: [],image: spriteCanvas(1,1)},
    {id: 'sleep-left', box: {x: 65,y: 742,w: 267,h: 155}, pivot: {x: 195,y: 887}, breath: .027,frequency: 1.6,phase: .6,parts: [],image: spriteCanvas(1,1)},
    {id: 'sleep-right', box: {x: 1382,y: 484,w: 178,h: 105}, pivot: {x: 1468,y: 580}, breath: .027,frequency: 1.8,phase: 1.7,parts: [],image: spriteCanvas(1,1)},
  ];
  for (const cat of cats) cat.image = cleanSprite(cropSprite(source, cat.box));
  const part = (cat: StorefrontCat, box: ArtBox, path: string, pivot: {x: number;y: number},
    erase: ArtBox, phase: number, amplitude = .11) => {
    const image = spriteCanvas(box.w, box.h), g = image.getContext('2d')!;
    g.translate(-box.x,-box.y); g.clip(new Path2D(path)); g.drawImage(cat.image,cat.box.x,cat.box.y);
    cat.parts.push({image,box,pivot,phase,amplitude});
    const b = cat.image.getContext('2d')!, body = b.getImageData(0,0,cat.image.width,cat.image.height);
    const mask = g.getImageData(0,0,image.width,image.height).data;
    // Erase the extracted pixels completely. Compositing its partly transparent
    // alpha over itself leaves a ghost contour that shows through the new paw.
    for (let y = Math.max(erase.y,box.y); y < Math.min(erase.y+erase.h,box.y+box.h); y++) {
      for (let x = Math.max(erase.x,box.x); x < Math.min(erase.x+erase.w,box.x+box.w); x++) {
        if (mask[((y-box.y)*image.width+x-box.x)*4+3] > 0) {
          body.data[((y-cat.box.y)*cat.image.width+x-cat.box.x)*4+3] = 0;
        }
      }
    }
    b.putImageData(body,0,0);
  };
  const roof = cats[0], baker = cats[1], right = cats[3];
  // Keep the roof cat and its tail intact. Even a stationary rectangular tail
  // extraction exposes its straight left edge when the wrist folds away from it.
  // Follow the painted cheek contour, rather than truncating it with a rectangle.
  // The tail stays behind the wrist; only the cheek can cover the shoulder.
  const shoulderBox = {x: 865,y: 102,w: 80,h: 68};
  const shoulder = cropSprite(roof.image,
    {...shoulderBox,x: shoulderBox.x-roof.box.x,y: shoulderBox.y-roof.box.y});
  const cheekMask = spriteCanvas(shoulderBox.w,shoulderBox.h), cg = cheekMask.getContext('2d')!;
  cg.translate(-shoulderBox.x,-shoulderBox.y);
  cg.fill(new Path2D('M865 102 H932 C938 111 936 122 935 134 '
    + 'C934 145 923 152 912 156 Q897 162 865 162 Z'));
  const sg = shoulder.getContext('2d')!;
  sg.globalCompositeOperation = 'destination-in'; sg.drawImage(cheekMask,0,0);
  roof.shoulderCover = {box: shoulderBox,image: shoulder};
  // The curled tail shares the left sleeper's haunch contour. Keep that original silhouette
  // intact and let it breathe with the body instead of cutting a separate tail out of the hip.
  part(right,{x: 1493,y: 534,w: 65,h: 55},'M1518 536 Q1532 534 1544 550 Q1554 569 1537 580 L1509 582 Q1495 579 1496 570 Q1499 562 1515 563 Q1528 564 1525 552Z',{x: 1517,y: 566},{x: 1530,y: 534,w: 30,h: 55},.8);

  const blink = spriteCanvas(baker.image.width,baker.image.height), bg = blink.getContext('2d')!;
  bg.drawImage(baker.image,0,0); bg.translate(-baker.box.x,-baker.box.y);
  const fur = baker.image.getContext('2d')!;
  for (const [expectedX,expectedY] of [[663,468],[704,468]]) {
    let x0 = expectedX+7,y0 = expectedY+8,x1 = expectedX-7,y1 = expectedY-8;
    for (let y = expectedY-8;y <= expectedY+8;y++) for (let x = expectedX-7;x <= expectedX+7;x++) {
      const p = fur.getImageData(x-baker.box.x,y-baker.box.y,1,1).data;
      if (p[3] > 200 && p[0] < 160 && p[1] < 110 && p[2] < 80) {x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
    }
    const x = x1 >= x0 ? (x0+x1)/2 : expectedX, y = y1 >= y0 ? (y0+y1)/2 : expectedY;
    const rx = x1 >= x0 ? (x1-x0)/2+2 : 6, ry = y1 >= y0 ? (y1-y0)/2+2 : 7;
    const gradient = bg.createLinearGradient(x-rx,y,x+rx,y);
    for (const [stop,sampleX] of [[0,Math.round(x-rx-2)],[1,Math.round(x+rx+2)]]) {
      const p = fur.getImageData(sampleX-baker.box.x,Math.round(y)-baker.box.y,1,1).data;
      gradient.addColorStop(stop,`rgb(${p[0]},${p[1]},${p[2]})`);
    }
    bg.fillStyle = gradient; bg.beginPath(); bg.ellipse(x,y,rx,ry,0,0,Math.PI*2); bg.fill();
    bg.strokeStyle = '#80522E'; bg.lineWidth = 2; bg.lineCap = 'round'; bg.beginPath();
    bg.moveTo(x-3,y); bg.quadraticCurveTo(x,y+1.4,x+3,y); bg.stroke();
  }
  baker.blink = blink;
  return cats;
}
