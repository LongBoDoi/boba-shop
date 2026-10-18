/** A customer, as SVG markup. Ported from `src/components/art/Character.tsx`. */
import type { CustomerLook } from '../../../src/game/customers';
import { shade, svgDoc } from './svg';

export type Mood = 'delighted' | 'happy' | 'neutral' | 'angry';

export interface CharacterOptions {
  mood: Mood;
  blinking?: boolean;
  width: number;
  /** Crop to the head for avatars. */
  headOnly?: boolean;
}

const INK = '#2B1B17';

/** The drawing's size for a given width: 100×120 whole, 60×62 cropped to the head. */
export function characterSize(width: number, headOnly?: boolean): { width: number; height: number } {
  return { width, height: headOnly ? width * (62 / 60) : width * 1.2 };
}

/** A customer drawn in a 100×120 box: shoulders at the bottom, head centred at (50, 52). */
export function characterSvg(look: CustomerLook, opts: CharacterOptions): string {
  const { mood, blinking, width, headOnly } = opts;
  const viewBox = headOnly ? '20 18 60 62' : '0 0 100 120';
  const { height } = characterSize(width, headOnly);
  const skinShade = shade(look.skin, -18);
  let body = '';

  // Long hair falls behind the shoulders.
  if (look.hairStyle === 'long') {
    body += `<path d="M22 56 C20 30 36 22 50 22 C64 22 80 30 78 56 L82 100 L18 100 Z" fill="${look.hair}"/>`;
  }

  if (!headOnly) {
    body +=
      '<g>' +
      `<path d="M12 120 C12 94 28 82 50 82 C72 82 88 94 88 120 Z" fill="${look.shirt}"/>` +
      `<path d="M40 83 L50 96 L60 83" fill="none" stroke="${shade(look.shirt, -25)}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<rect x="43" y="70" width="14" height="14" rx="5" fill="${skinShade}"/>` +
      '</g>';
  }

  body +=
    `<circle cx="24.5" cy="55" r="5.5" fill="${skinShade}"/>` +
    `<circle cx="75.5" cy="55" r="5.5" fill="${skinShade}"/>` +
    `<circle cx="50" cy="52" r="26" fill="${look.skin}"/>`;

  body += hair(look);

  if (mood === 'happy' || mood === 'delighted') {
    body +=
      '<ellipse cx="35" cy="62" rx="5" ry="3.2" fill="#FF7FA0" opacity="0.45"/>' +
      '<ellipse cx="65" cy="62" rx="5" ry="3.2" fill="#FF7FA0" opacity="0.45"/>';
  }
  if (mood === 'angry') body += '<circle cx="50" cy="52" r="26" fill="#FF4D4D" opacity="0.18"/>';

  body += eyes(mood, blinking);
  body += mouth(mood);

  if (look.accessory === 'glasses') {
    body +=
      `<g fill="none" stroke="${INK}" stroke-width="1.8">` +
      '<circle cx="40" cy="54" r="7"/><circle cx="60" cy="54" r="7"/><path d="M47 54 L53 54"/>' +
      '</g>';
  }
  if (look.accessory === 'bow') {
    body +=
      '<g>' +
      '<path d="M62 28 L72 22 L72 34 Z M62 28 L52 22 L52 34 Z" fill="#FF6F9C"/>' +
      '<circle cx="62" cy="28" r="3" fill="#E0507F"/>' +
      '</g>';
  }

  if (mood === 'angry') {
    body += '<path d="M70 30 L76 30 M73 27 L73 33 M68 34 L71 31 M75 31 L78 34" stroke="#E5534B" stroke-width="2" stroke-linecap="round"/>';
  }

  return svgDoc(width, height, body, viewBox);
}

function hair(look: CustomerLook): string {
  const fill = look.hair;
  switch (look.hairStyle) {
    case 'short':
      return `<path d="M23 52 C20 28 36 20 52 21 C68 22 82 32 77 52 C74 42 64 35 50 35 C37 35 28 42 23 52 Z" fill="${fill}"/>`;
    case 'bob':
    case 'long':
      return `<path d="M22 66 C17 34 33 21 50 21 C67 21 83 34 78 66 L72 66 C73 50 66 37 50 37 C34 37 27 50 28 66 Z" fill="${fill}"/>`;
    case 'bun':
      return (
        `<g fill="${fill}">` +
        '<circle cx="50" cy="19" r="10"/>' +
        '<path d="M23 52 C20 30 36 23 50 23 C64 23 80 30 77 52 C73 41 63 36 50 36 C37 36 27 41 23 52 Z"/>' +
        '</g>'
      );
    case 'spiky':
      return `<path d="M23 50 L24 32 L32 36 L34 22 L42 31 L48 18 L54 30 L62 20 L66 33 L74 26 L75 38 L78 48 C72 40 62 36 50 36 C38 36 29 41 23 50 Z" fill="${fill}"/>`;
    case 'cap':
      return (
        '<g>' +
        `<path d="M23 44 C23 26 36 20 50 20 C64 20 77 26 77 44 Z" fill="${shade(look.shirt, -20)}"/>` +
        `<path d="M50 40 L88 40 C88 46 80 47 70 46 L50 45 Z" fill="${shade(look.shirt, -35)}"/>` +
        `<circle cx="50" cy="21" r="2.5" fill="${shade(look.shirt, -35)}"/>` +
        '</g>'
      );
    case 'balding':
      return (
        `<g fill="${fill}">` +
        '<path d="M24 56 C22 44 25 38 30 36 C29 44 30 50 31 56 Z"/>' +
        '<path d="M76 56 C78 44 75 38 70 36 C71 44 70 50 69 56 Z"/>' +
        '</g>'
      );
  }
  return '';
}

function eyes(mood: Mood, blinking?: boolean): string {
  if (blinking || mood === 'delighted') {
    // Closed eyes: flat lines for a blink, happy arcs when delighted.
    const d = mood === 'delighted' ? 'M36 56 Q40 50 44 56 M56 56 Q60 50 64 56' : 'M36 55 L44 55 M56 55 L64 55';
    return `<path d="${d}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>`;
  }
  let out =
    '<g>' +
    `<circle cx="40" cy="54" r="3.4" fill="${INK}"/>` +
    `<circle cx="60" cy="54" r="3.4" fill="${INK}"/>` +
    '<circle cx="41.2" cy="52.8" r="1.1" fill="#FFFFFF"/>' +
    '<circle cx="61.2" cy="52.8" r="1.1" fill="#FFFFFF"/>';
  if (mood === 'angry') {
    out += `<path d="M34 45 L45 49 M66 45 L55 49" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  if (mood === 'neutral') {
    out += `<path d="M35 46.5 L45 46.5 M55 46.5 L65 46.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  }
  return `${out}</g>`;
}

function mouth(mood: Mood): string {
  switch (mood) {
    case 'delighted':
      return `<path d="M41 63 Q50 63 59 63 Q58 73 50 73 Q42 73 41 63 Z" fill="#B8323F" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
    case 'happy':
      return `<path d="M42 64 Q50 71 58 64" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
    case 'neutral':
      return `<path d="M44 66 L56 66" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'angry':
      return `<path d="M42 69 Q50 62 58 69" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`;
  }
}
