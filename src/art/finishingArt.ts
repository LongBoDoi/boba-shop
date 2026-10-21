/** Clear dome lid and wide boba straw, in the painted cup's 113×174 coordinates. */
export function paintLid(c: CanvasRenderingContext2D) {
  c.save();
  const glass = c.createLinearGradient(8, -24, 104, 22);
  glass.addColorStop(0, '#FFFFFF99');
  glass.addColorStop(0.45, '#FFF9EA22');
  glass.addColorStop(1, '#CDA78066');
  c.fillStyle = glass;
  c.strokeStyle = '#AB805C';
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(7, 15);
  c.bezierCurveTo(11, -30, 102, -30, 106, 15);
  c.ellipse(56.5, 15, 49.5, 11, 0, 0, Math.PI);
  c.closePath();
  c.fill(); c.stroke();
  c.beginPath(); c.ellipse(56.5, 16, 51, 12, 0, 0, Math.PI * 2);
  c.fillStyle = '#FFF5E544'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(56.5, 13, 51, 12, 0, 0, Math.PI);
  c.strokeStyle = '#FFFDF1'; c.lineWidth = 2.4; c.stroke();
  c.beginPath(); c.moveTo(23, 5); c.quadraticCurveTo(27, -9, 41, -13);
  c.strokeStyle = '#FFFFFFCC'; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
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
