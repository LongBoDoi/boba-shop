import { alphaBounds, cleanSprite, cropSprite, spriteCanvas } from './titleSprite';

/** Planted stem ends sit inside the fitted pot mouths, behind their front rims. */
export const PLANT_ROOTS = [
  {id: 'plant-left',x: 109,y: 710,height: 240},
  {id: 'plant-front',x: 1421,y: 778,height: 135},
  {id: 'plant-right',x: 1631,y: 763,height: 220},
];

export function pottedFoliage(atlas: HTMLImageElement) {
  return PLANT_ROOTS.map((root,index) => {
    const cell = cleanSprite(cropSprite(atlas,{x: atlas.width*index/3,y: 0,w: atlas.width/3,h: atlas.height}));
    const bounds = alphaBounds(cell,32),image = cropSprite(cell,bounds);
    // Measure the actual connected stem, rather than assuming its atlas cell is centered.
    const pixels = image.getContext('2d')!.getImageData(0,0,image.width,image.height).data;
    let total = 0,weightedX = 0;
    for (let y = Math.max(0,image.height-6);y < image.height;y++) for (let x = 0;x < image.width;x++) {
      const alpha = pixels[(y*image.width+x)*4+3];
      if (alpha > 48) {total += alpha;weightedX += (x+.5)*alpha;}
    }
    const stemX = total ? weightedX/total : image.width/2,scale = root.height/image.height;
    // Match the painted scenery's softer sampling, rather than a high-resolution sticker edge.
    // Measure anchors before sampling so the planted stem stays in the same place.
    const texture = spriteCanvas(image.width*scale/1.5,root.height/1.5),g = texture.getContext('2d')!;
    g.imageSmoothingQuality = 'high';g.drawImage(image,0,0,texture.width,texture.height);
    return {id: root.id,crop: texture,cropBox: {x: root.x-stemX*scale,y: root.y-root.height,
      w: image.width*scale,h: root.height},pivot: {x: root.x,y: root.y}};
  });
}
