/** Warm illustrated cat guests, shared by the queue, tickets, book and title. */
import type { CustomerLook } from '../game/customers';
import { blend, shade, svgDoc, uid } from './svg';

export type CatPart = 'shadow' | 'tail' | 'leftLeg' | 'rightLeg' | 'torso' | 'torsoBack' | 'leftArm' | 'rightArm' | 'head' | 'profile' | 'back';

export type Mood = 'delighted' | 'happy' | 'neutral' | 'angry';

export interface CharacterOptions {
  mood: Mood;
  blinking?: boolean;
  width: number;
  /** Crop to the ears and cheeks for avatars. */
  headOnly?: boolean;
  /** Standing in the cafe queue, with paws and a contact shadow on the floor. */
  fullBody?: boolean;
  /** Isolated, full-size rig layer; UI portraits still use the complete illustration. */
  part?: CatPart;
}

const INK = '#654737';
const FACE = 'M22 39Q19 24 22 11Q24 6 29 10L40 22Q50 19 61 22L73 10Q78 6 80 12Q83 25 79 39Q86 48 83 60L87 63L82 65L84 69L78 70Q74 84 50 85Q27 84 22 70L16 69L18 65L13 63L17 59Q14 48 22 39Z';

/** Retain the established scene bounds so feet, occlusion and touch targets stay aligned. */
export function characterSize(width: number, headOnly?: boolean, fullBody = false): { width: number; height: number } {
  return { width, height: headOnly ? width * (62 / 60) : width * (fullBody ? 1.76 : 1.2) };
}

/** The saved human-era look fields remain stable identities; the painter interprets them as coats. */
function coat(look: CustomerLook) {
  const silver = look.hair === '#9A9A9A' || look.hair === '#A8A8A8' || look.hairStyle === 'balding';
  const cream = blend('#FFF2D9', look.skin, .12);
  const ginger = blend('#DEA467', look.skin, .18);
  const dark = blend(look.hair, '#887466', .48);
  const base = silver ? '#B9B5A9' : look.hairStyle === 'bun' ? dark
    : look.hairStyle === 'bob' || look.hairStyle === 'long' ? cream : ginger;
  return { base, cream, marking: silver ? '#7D8079' : look.hairStyle === 'bob' ? '#B97B49' : shade(base, -28),
    outline: blend(base, INK, .75), dark };
}

export function characterSvg(look: CustomerLook, opts: CharacterOptions): string {
  const { mood, blinking, width, headOnly, fullBody } = opts;
  const { height } = characterSize(width, headOnly, fullBody);
  const c = coat(look);
  const fur = uid('cat-fur'), muzzle = uid('cat-cream'), cloth = uid('cat-knit');
  const ear = uid('cat-ear'), head = uid('cat-head');
  const shirt = blend(look.shirt, '#CBB38C', .3);
  const defs = `<defs>
    <radialGradient id="${fur}" cx="32%" cy="24%" r="82%"><stop stop-color="${shade(c.base, 32)}"/><stop offset=".58" stop-color="${c.base}"/><stop offset="1" stop-color="${shade(c.base, -20)}"/></radialGradient>
    <radialGradient id="${muzzle}" cx="38%" cy="20%" r="85%"><stop stop-color="#FFFAEB"/><stop offset=".72" stop-color="${c.cream}"/><stop offset="1" stop-color="#DAC4A2"/></radialGradient>
    <linearGradient id="${cloth}" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="${shade(shirt, 24)}"/><stop offset=".5" stop-color="${shirt}"/><stop offset="1" stop-color="${shade(shirt, -22)}"/></linearGradient>
    <linearGradient id="${ear}" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#BF8670"/><stop offset="1" stop-color="#EDBEA5"/></linearGradient>
    <clipPath id="${head}"><path d="${FACE}"/></clipPath>
  </defs>`;
  const parts: Partial<Record<CatPart, string>> = {};
  let out = '';

  if (!headOnly) {
    if (fullBody) {
      parts.shadow = '<ellipse cx="51" cy="170" rx="33" ry="4.2" fill="#6C4D31" opacity=".17"/><ellipse cx="50" cy="169.5" rx="23" ry="2" fill="#6C4D31" opacity=".12"/>';
      parts.tail = `<path d="M68 146C91 152 96 130 88 119C83 112 77 117 81 123C87 133 81 142 71 132" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.5"/><path d="M87 126L91 125M87 133L92 134M82 139L85 143" fill="none" stroke="${c.marking}" stroke-width="3"/>`;
      for (const [part, mirror] of [['leftLeg', false], ['rightLeg', true]] as const) {
        parts[part] = `<g${mirror ? ' transform="translate(100 0) scale(-1 1)"' : ''}><path d="M29 126Q40 122 50 128L46 168Q35 172 26 168Q22 161 31 158Z" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.4"/><path d="M29 158Q38 154 46 159L45 167Q35 170 27 167Q24 162 29 158Z" fill="url(#${muzzle})"/><path d="M32 163V166M38 163V167" stroke="${c.outline}" opacity=".5" fill="none"/></g>`;
      }
    }
    parts.torso = `<path d="M31 84Q50 78 69 84L74 134Q51 140 26 134Z" fill="url(#${cloth})" stroke="${shade(shirt, -38)}" stroke-width="1.4"/>
      <path d="M34 86Q50 100 66 86L63 94Q50 105 37 94Z" fill="${shade(shirt, -15)}"/>
      <path d="M36 89Q50 100 64 89M30 130Q50 134 70 130" fill="none" stroke="${shade(shirt, 38)}" stroke-width="1.6"/>
      <path d="M31 101L30 121M69 101L70 121" fill="none" stroke="${shade(shirt, -28)}" opacity=".35"/>`;
    parts.torsoBack = parts.torso;
    parts.torso += `<path d="M45 107Q50 110 55 107L55 117Q50 121 45 117Z" fill="${shade(shirt, 30)}" stroke="${shade(shirt, -18)}" stroke-width=".7"/>
      <path d="M50 115V112Q45 108 47 108Q50 108 50 112Q51 108 54 109Q54 112 50 113" fill="#FFF0CD"/>`;
    for (let i = 0; i < 9; i++) {
      const stitch = `<path d="M${32 + i * 4} 126l1 2l1-2" fill="none" stroke="${shade(shirt, 35)}" stroke-width=".65" opacity=".5"/>`;
      parts.torso += stitch; parts.torsoBack += stitch;
    }
    for (const [part, mirror] of [['leftArm', false], ['rightArm', true]] as const) {
      parts[part] = `<g${mirror ? ' transform="translate(100 0) scale(-1 1)"' : ''}>
        <path d="M21 112L28 115L27 126Q25 132 20 129Q15 127 18 119Z" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.1"/>
        <path d="M31 85Q21 87 17 113L27 118L34 100Q38 87 31 85Z" fill="url(#${cloth})" stroke="${shade(shirt, -38)}" stroke-width="1.2"/>
        <path d="M19 112L27 115" fill="none" stroke="${shade(shirt, 30)}" stroke-width="1.4"/>
        <path d="M20 124L20 127M24 124L24 128" stroke="${c.outline}" opacity=".5"/></g>`;
    }
  }

  // One continuous silhouette keeps ears, cheek tufts and the face from looking pasted together.
  out += `<path d="${FACE}" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.6"/>
    <g clip-path="url(#${head})">${markings(look, c.marking, c.dark)}
    <path d="M24 13Q23 26 26 34L35 26Z M76 13Q79 26 75 34L65 26Z" fill="url(#${ear})"/>
    <path d="M25 16L27 28L31 26M75 16L73 28L69 26" fill="none" stroke="#F9D8BD" stroke-width="1.4" opacity=".7"/>
    <path d="M26 69Q31 62 37 64Q50 57 63 64Q70 62 75 69Q72 82 50 83Q29 82 26 69Z" fill="url(#${muzzle})"/>
    <path d="M23 39Q19 50 22 56M29 24L34 27M39 26L44 25M56 25L60 26M73 40L77 44" stroke="${shade(c.base, 65)}" opacity=".62" stroke-width="1.5" fill="none"/>
    <path d="M20 61L24 60M23 65L27 63M76 60L80 61M73 64L78 66M36 77L39 78M62 78L65 77" stroke="${c.marking}" opacity=".32" stroke-width=".8" fill="none"/>
    </g>`;

  out += `<ellipse cx="29" cy="63" rx="6" ry="3.2" fill="#D98E72" opacity="${mood === 'happy' || mood === 'delighted' ? '.36' : '.17'}"/>
    <ellipse cx="71" cy="63" rx="6" ry="3.2" fill="#D98E72" opacity="${mood === 'happy' || mood === 'delighted' ? '.36' : '.17'}"/>`;
  out += eyes(mood, blinking);
  out += `<path d="M46.5 63Q50 61.5 53.5 63Q53 65 50 66.5Q47 65 46.5 63Z" fill="#AD7566" stroke="#7C5143" stroke-width=".7"/>
    <path d="M48 63.5H50" stroke="#F7C7AF" stroke-width=".9"/>`;
  out += mouth(mood);
  out += `<g fill="none" stroke="${c.outline}" stroke-width=".8" opacity=".7">
    <path d="M30 66L18 63M30 69L16 69M70 66L82 63M70 69L84 69"/>
    <path d="M35 66h.2M38 68h.2M65 66h-.2M62 68h-.2" stroke-width="1.3"/></g>`;

  if (look.hairStyle === 'balding') {
    out += `<path d="M31 47Q37 44 42 46M58 46Q63 44 69 47" fill="none" stroke="#FFF6DE" stroke-width="2.7"/>
      <path d="M27 58l3 1M70 59l3-1" fill="none" stroke="${c.outline}" opacity=".5" stroke-width=".8"/>`;
  }
  if (look.accessory === 'glasses') {
    out += `<g fill="none" stroke="#86613E" stroke-width="1.35"><ellipse cx="37" cy="55" rx="10" ry="9"/><ellipse cx="63" cy="55" rx="10" ry="9"/><path d="M47 54Q50 52 53 54M27 52L21 49M73 52L79 49"/></g>
      <path d="M30 52Q31 48 35 48M56 52Q57 48 61 48" fill="none" stroke="#FFF7D9" stroke-width="1.2" opacity=".8"/>`;
  }
  if (look.hairStyle === 'cap') {
    out += `<path d="M28 32Q29 17 49 17Q68 17 72 33Z" fill="url(#${cloth})" stroke="${shade(shirt, -40)}" stroke-width="1.3"/>
      <path d="M50 19Q57 24 57 32M33 29Q49 25 66 29" fill="none" stroke="${shade(shirt, 35)}" stroke-width="1.1"/>
      <path d="M28 32Q47 28 71 32L79 36Q76 42 64 39L37 36Z" fill="${shade(shirt, -14)}" stroke="${shade(shirt, -40)}" stroke-width="1.2"/>
      <path d="M33 32Q53 30 69 33" fill="none" stroke="${shade(shirt, 48)}"/>
      <ellipse cx="49" cy="17" rx="2.4" ry="1.5" fill="${shade(shirt, -30)}"/>`;
  } else if (look.accessory === 'bow') {
    out += `<path d="M69 30Q57 18 58 28L59 35Q62 38 69 32Q80 38 80 32L79 25Q77 21 69 30Z" fill="#CC886F" stroke="#955F4C" stroke-width="1"/>
      <path d="M61 27L66 30M73 30L77 27" stroke="#F6C5A5" fill="none"/>
      <circle cx="69" cy="31" r="3" fill="#E6A28A" stroke="#955F4C" stroke-width=".8"/>`;
  }
  parts.head = out;
  parts.profile = `<path d="M32 38L30 13Q31 8 35 13L48 27Q59 22 69 30Q81 38 79 57L82 63L77 65Q75 83 53 84Q34 84 28 74L19 70Q15 66 21 62L27 57Q26 45 32 38Z" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.6"/>
    <path d="M33 16L35 32L42 28Z" fill="url(#${ear})"/>
    <path d="M26 61Q37 57 40 66Q44 76 60 78Q42 87 28 74L20 70Q16 66 26 61Z" fill="url(#${muzzle})"/>
    <path d="M19 63L26 64L22 68Z" fill="#AD7566" stroke="#7C5143" stroke-width=".6"/>
    <path d="M23 69Q28 73 33 69M29 68L17 68M30 72L19 75" fill="none" stroke="${c.outline}" stroke-width="1"/>
    <ellipse cx="37" cy="53" rx="2.9" ry="4.5" fill="#49382C"/><circle cx="36" cy="51.5" r="1.1" fill="#FFF8E5"/>
    <path d="M51 29L49 39M59 29L55 39M70 47L76 45M69 54L77 53" stroke="${c.marking}" stroke-width="2.5" opacity=".6" fill="none"/>
    <path d="M68 69Q64 76 56 78" stroke="${shade(c.base, 42)}" stroke-width="1.4" fill="none"/>`;
  if (look.accessory === 'glasses') parts.profile += '<ellipse cx="36" cy="54" rx="7" ry="9" fill="none" stroke="#86613E" stroke-width="1.3"/><path d="M43 52L65 47" stroke="#86613E" stroke-width="1.3"/>';
  if (look.hairStyle === 'cap') parts.profile += `<path d="M31 32Q37 17 56 21Q68 23 71 34L34 36Q13 38 16 33Z" fill="url(#${cloth})" stroke="${shade(shirt, -40)}" stroke-width="1.2"/>`;
  parts.back = `<path d="${FACE}" fill="url(#${fur})" stroke="${c.outline}" stroke-width="1.6"/><g clip-path="url(#${head})">${look.hairStyle === 'bun' ? '' : markings(look, c.marking, c.dark)}<path d="M25 14L28 29M75 14L72 29M37 72Q50 77 63 72" fill="none" stroke="${shade(c.base, 35)}" stroke-width="1.5"/></g>`;
  if (look.hairStyle === 'cap') parts.back += `<path d="M28 32Q29 17 49 17Q68 17 72 33Q50 38 28 32Z" fill="url(#${cloth})" stroke="${shade(shirt, -40)}" stroke-width="1.3"/><path d="M44 32Q50 24 56 32" fill="${c.base}" stroke="${shade(shirt, -40)}"/><path d="M43 33H57" stroke="${shade(shirt, -30)}" stroke-width="2"/>`;
  const layers: CatPart[] = ['shadow', 'tail', 'leftLeg', 'rightLeg', 'torso', 'leftArm', 'rightArm', 'head'];
  const content = opts.part ? parts[opts.part] ?? '' : layers.map(part => parts[part] ?? '').join('');
  return svgDoc(width, height, defs + '<g stroke-linecap="round" stroke-linejoin="round">' + content + '</g>', headOnly ? '8 0 84 86.8' : fullBody ? '0 0 100 176' : '0 0 100 120');
}

function markings(look: CustomerLook, color: string, dark: string): string {
  if (look.hairStyle === 'bun') {
    return '<path d="M50 28Q47 46 38 55Q30 60 25 70Q35 84 50 84Q68 83 76 70Q68 58 61 55Q53 46 50 28Z" fill="#F9EDD6"/>';
  }
  if (look.hairStyle === 'bob') {
    return `<path d="M17 7Q41 5 44 29Q46 46 33 49Q17 48 14 38Z" fill="${color}"/><path d="M68 9Q88 6 88 32Q83 49 68 45Q60 40 66 29Z" fill="${dark}"/>`;
  }
  if (look.hairStyle === 'long') {
    return `<path d="M16 11Q33 9 38 28L28 40L17 37ZM63 27Q68 12 83 11L84 36L72 40Z" fill="${color}" opacity=".6"/>
      <path d="M39 31L42 34M46 28L49 32M55 29L57 32" stroke="${color}" stroke-width="1" opacity=".4"/>`;
  }
  return `<g fill="${color}" opacity=".8"><path d="M39 24Q42 26 45 39Q39 37 37 27ZM47 22L53 22L50 38Q46 30 47 22ZM58 24L64 26Q60 36 55 39Z"/>
    <path d="M16 45Q25 45 29 50Q22 51 17 49ZM15 54Q24 53 29 58L17 58ZM84 45Q75 45 71 50Q78 51 83 49ZM85 54Q76 53 71 58L83 58Z"/></g>`;
}

function eyes(mood: Mood, blinking?: boolean): string {
  if (blinking || mood === 'delighted') {
    const d = mood === 'delighted' ? 'M32 56Q37 48 42 56M58 56Q63 48 68 56' : 'M32 55Q37 58 42 55M58 55Q63 58 68 55';
    return `<path d="${d}" fill="none" stroke="#49382C" stroke-width="2.1"/>`;
  }
  let out = '<g fill="#49382C"><ellipse cx="37" cy="54.5" rx="3.5" ry="4.8"/><ellipse cx="63" cy="54.5" rx="3.5" ry="4.8"/></g>' +
    '<g fill="#B28C54"><ellipse cx="37" cy="56.6" rx="2" ry="1.3"/><ellipse cx="63" cy="56.6" rx="2" ry="1.3"/></g>' +
    '<g fill="#FFF8E5"><circle cx="36" cy="52.7" r="1.3"/><circle cx="62" cy="52.7" r="1.3"/></g>';
  if (mood === 'angry') out += '<path d="M31 48L42 51M58 51L69 48" fill="none" stroke="#674B38" stroke-width="2"/>';
  if (mood === 'neutral') out += '<path d="M33 48L41 48M59 48L67 48" fill="none" stroke="#674B38" stroke-width="1.2"/>';
  return out;
}

function mouth(mood: Mood): string {
  const open = mood === 'delighted' ? '<path d="M43 70Q50 73 57 70Q56 78 50 78Q44 78 43 70Z" fill="#825344"/><path d="M46 76Q50 72 54 76" fill="#D89583"/>' : '';
  const d = mood === 'angry' ? 'M50 67V70M42 73Q45 68 50 70Q55 68 58 73'
    : mood === 'neutral' ? 'M50 67V70M44 71Q48 73 50 70Q52 73 56 71'
    : 'M50 67V70M41 69Q44 75 50 70Q56 75 59 69';
  return `${open}<path d="${d}" fill="none" stroke="#75503E" stroke-width="1.3"/>`;
}
