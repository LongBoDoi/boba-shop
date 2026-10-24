import { CUP_MOUTH } from './cupGeometry';

/** Clear dome viewed from the same elevated angle as the cup's opening. */
export function paintOverheadLid(c: CanvasRenderingContext2D) {
  c.save();
  const { x, y, rx, ry } = CUP_MOUTH;
  const glass = c.createLinearGradient(12, 10, 104, 78);
  glass.addColorStop(0, '#FFFFFF80'); glass.addColorStop(0.45, '#FFF9EA16'); glass.addColorStop(1, '#BEA98E55');
  c.fillStyle = glass;
  c.strokeStyle = '#A5957E'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(x, y - 1, rx + 3, ry + 2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(x, y - 5, rx - 4, ry - 4, 0, 0, Math.PI * 2);
  c.strokeStyle = '#E4D9C688'; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.ellipse(x, y - 1, rx + 1, ry + 1, 0, 0, Math.PI);
  c.strokeStyle = '#FFFDF1'; c.lineWidth = 2.5; c.stroke();
  c.beginPath(); c.ellipse(x, y - 5, rx - 7, ry - 7, 0, 3.5, 4.6);
  c.strokeStyle = '#FFFFFFCC'; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
  c.beginPath(); c.ellipse(68, 39, 6, 4.2, 0, 0, Math.PI * 2);
  c.fillStyle = '#A18F7344'; c.fill(); c.strokeStyle = '#FFF6E3AA'; c.lineWidth = 1; c.stroke();
  c.restore();
}

/** A short projected straw, with its submerged end visible through the lid. */
export function paintOverheadStraw(c: CanvasRenderingContext2D) {
  c.save(); c.translate(68, 39); c.rotate(0.35);
  c.globalAlpha = 0.3; c.fillStyle = '#B87965'; c.fillRect(-3.4, 0, 6.8, 24); c.globalAlpha = 1;
  const straw = c.createLinearGradient(-4, 0, 4, 0);
  straw.addColorStop(0, '#F9DAC8'); straw.addColorStop(0.35, '#FFD9CA'); straw.addColorStop(1, '#CF8B78');
  c.fillStyle = straw; c.strokeStyle = '#AC7865'; c.lineWidth = 0.9;
  c.beginPath(); c.roundRect(-4, -34, 8, 35, 1.6); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -34, 4, 2.8, 0, 0, Math.PI * 2);
  c.fillStyle = '#9B6150'; c.fill(); c.strokeStyle = '#FCE6CD'; c.stroke();
  c.beginPath(); c.moveTo(-2, -29); c.lineTo(-2, -3); c.strokeStyle = '#FFF2DC'; c.lineWidth = 1; c.stroke();
  c.restore();
}

export function paintStraw(c: CanvasRenderingContext2D) {
  c.save();
  c.translate(69, -34); c.rotate(0.1);
  const pink = c.createLinearGradient(0, 0, 9, 0);
  pink.addColorStop(0, '#FFE4DB'); pink.addColorStop(0.4, '#F1B1A6'); pink.addColorStop(1, '#C88679');
  c.fillStyle = pink; c.strokeStyle = '#A56D59'; c.lineWidth = 1.2;
  c.beginPath(); c.roundRect(0, 0, 9, 123, 2); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(4.5, 1, 4.5, 2, 0, 0, Math.PI * 2);
  c.fillStyle = '#A76555'; c.fill(); c.stroke();
  c.beginPath(); c.moveTo(2, 6); c.lineTo(2, 115);
  c.strokeStyle = '#FFF0DF'; c.stroke();
  c.restore();
}
