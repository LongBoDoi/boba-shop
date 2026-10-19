/**
 * The far (customer-facing) edge of the counter: a raised rim the customers stand behind.
 */
import { el, svgDoc, uid } from './svg';
import { colors } from './theme';

export function counterSvg(width: number, height: number): string {
  const topH = Math.round(height * 0.42); // lit top of the rim
  const seam = 46;
  const rimTop = uid('rimTop');
  const rimFace = uid('rimFace');
  let body =
    '<defs>' +
    `<linearGradient id="${rimTop}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#F3DCBC"/><stop offset="1" stop-color="${colors.counterLight}"/>` +
    '</linearGradient>' +
    `<linearGradient id="${rimFace}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${colors.counter}"/><stop offset="1" stop-color="${colors.counterEdge}"/>` +
    '</linearGradient>' +
    '</defs>';
  // Front face of the rim, darkening toward the bottom.
  body += el('rect', { y: topH, width, height: height - topH, fill: `url(#${rimFace})` });
  // Faint plank seams, matching the surface grain.
  for (let i = 0; i < Math.ceil(width / seam); i++) {
    body += el('rect', { x: i * seam, y: topH, width: 1.4, height: height - topH, fill: colors.counterEdge, opacity: 0.18 });
  }
  // Lit top of the rim with a bright highlight catching the light.
  body += el('rect', { width, height: topH, fill: `url(#${rimTop})` });
  body += el('rect', { width, height: 2.5, fill: '#FFE9CC', opacity: 0.85 });
  // Soft shade under the lit top.
  body += el('rect', { y: topH - 2, width, height: 2, fill: colors.counterEdge, opacity: 0.4 });
  return svgDoc(width, height, body);
}
