/** Clear dome lid and wide boba straw, in the painted cup's 113×174 coordinates. */
export function paintLid(c: CanvasRenderingContext2D) {
  c.save();
  const glass = c.createLinearGradient(8, -24, 104, 22);
  glass.addColorStop(0, '#FFFFFF8C');
  glass.addColorStop(0.24, '#FFF9EA33');
  glass.addColorStop(0.5, '#FFFFFF0D');
  glass.addColorStop(0.8, '#AB9B8833');
  glass.addColorStop(1, '#FFF8E84D');
  c.fillStyle = glass;
  c.strokeStyle = '#968A7E99';
  c.lineWidth = 0.75;
  c.beginPath();
  c.moveTo(7, 15);
  c.bezierCurveTo(11, -30, 102, -30, 106, 15);
  c.ellipse(56.5, 15, 49.5, 14, 0, 0, Math.PI);
  c.closePath();
  c.fill(); c.stroke();
  c.beginPath(); c.ellipse(56.5, 16, 52, 15, 0, 0, Math.PI * 2);
  c.fillStyle = '#FFF5E51A'; c.fill(); c.stroke();
  c.beginPath(); c.ellipse(56.5, 14.5, 50, 14, 0, 0, Math.PI);
  c.strokeStyle = '#FFFDF1D9'; c.lineWidth = 1.2; c.stroke();
  c.beginPath(); c.ellipse(56.5, 16.5, 51, 14, 0, 0, Math.PI);
  c.strokeStyle = '#8F83766B'; c.lineWidth = 0.65; c.stroke();
  c.beginPath(); c.moveTo(23, 5); c.quadraticCurveTo(27, -9, 41, -13);
  c.strokeStyle = '#FFFFFFB3'; c.lineWidth = 2.4; c.lineCap = 'round'; c.stroke();
  c.restore();
}

export function paintStraw(c: CanvasRenderingContext2D, inDrink = false) {
  c.save();
  c.translate(69, -34); c.rotate(0.1);
  const pink = c.createLinearGradient(0, 0, 9, 0);
  pink.addColorStop(0, '#B77C69'); pink.addColorStop(0.16, '#FAD7C7');
  pink.addColorStop(0.4, '#F1C2B2'); pink.addColorStop(0.75, '#D49A88'); pink.addColorStop(1, '#B47C6B');
  const body = () => {
    c.fillStyle = pink; c.strokeStyle = '#9C746380'; c.lineWidth = 0.55;
    c.beginPath(); c.roundRect(0, 0, 9, 123, 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(2, 6); c.lineTo(2, 115);
    c.strokeStyle = '#FFF0DFB3'; c.lineWidth = 0.8; c.stroke();
  };
  if (inDrink) {
    c.save(); c.beginPath(); c.rect(-1, 53, 11, 72); c.clip(); c.globalAlpha = 0.25; body(); c.restore();
    c.save(); c.beginPath(); c.rect(-1, -4, 11, 57); c.clip(); body(); c.restore();
  } else body();
  c.beginPath(); c.ellipse(4.5, 1, 4.5, 2, 0, 0, Math.PI * 2);
  c.fillStyle = '#8D5D4D'; c.fill(); c.strokeStyle = '#FFE7D1'; c.lineWidth = 0.65; c.stroke();
  c.restore();
}
