import { spriteCanvas } from './titleSprite';

/** Translation only for clouds; distant birds flap their wings in a small sprite sequence. */
export function skyMotion(seconds: number,index: number) {
  const wrap = (n: number) => ((n%1)+1)%1;
  return {
    cloudX: wrap(index*.37+seconds*(.009+index*.002)),
    birdX: wrap(.18+index*.31+seconds*.039),
    birdY: .25+index*.15+Math.sin(seconds*.65+index)*.025,
    wing: Math.floor(wrap(seconds*1.8+index*.23)*8),
  };
}

export function storefrontSkyArt() {
  const sky = spriteCanvas(2,512),g = sky.getContext('2d')!;
  const blue = g.createLinearGradient(0,0,0,512);
  blue.addColorStop(0,'#A8D5E2');blue.addColorStop(.58,'#D3E8E6');blue.addColorStop(1,'#FFF0CF');
  g.fillStyle = blue;g.fillRect(0,0,2,512);
  const clouds = [0,1,2].map(i => {
    const c = spriteCanvas(360,150),p = c.getContext('2d')!;
    const cream = p.createLinearGradient(0,22,0,132);
    cream.addColorStop(0,'#FFFDF0');cream.addColorStop(.7,'#FFF9E7');cream.addColorStop(1,'#E4EDE4');
    p.fillStyle = cream;
    p.beginPath();p.moveTo(35,125);
    p.bezierCurveTo(5,125,8,80,47,79);p.bezierCurveTo(43,37,108,27,126,58);
    p.bezierCurveTo(148,3+i*7,229,11,235,66);p.bezierCurveTo(277,45,308,65,308,93);
    p.bezierCurveTo(356,79,366,129,324,133);p.bezierCurveTo(236,142,120,137,35,125);p.fill();
    return c;
  });
  const birds = Array.from({length:8},(_,i) => {
    const c = spriteCanvas(64,48),p = c.getContext('2d')!;
    const tip = 20-14*Math.cos(i/8*Math.PI*2);
    p.strokeStyle = '#647E83';p.lineWidth = 3;p.lineCap = 'round';p.lineJoin = 'round';
    p.beginPath();p.moveTo(5,tip);p.quadraticCurveTo(21,tip-3,32,27);
    p.quadraticCurveTo(43,tip-3,59,tip);p.stroke();
    return c;
  });
  return {sky,clouds,birds};
}
