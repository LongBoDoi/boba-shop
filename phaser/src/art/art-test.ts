/**
 * A scratch page (`/art-test.html` on the dev server) that draws every SVG port in `art/` with a
 * spread of parameters, inline and — in the last section — rasterised through an `Image` from a
 * data URL, the way a Phaser texture is made. Not part of the game.
 */
import type { CustomerLook } from '../../../src/game/customers';
import { ACCESSORIES, HAIR_STYLES } from '../../../src/game/customers';
import { CATEGORIES, CategoryId, Drink, EMPTY_DRINK } from '../../../src/game/ingredients';
import baloo500 from '../../../node_modules/@expo-google-fonts/baloo-2/500Medium/Baloo2_500Medium.ttf?url';
import baloo700 from '../../../node_modules/@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf?url';
import baloo800 from '../../../node_modules/@expo-google-fonts/baloo-2/800ExtraBold/Baloo2_800ExtraBold.ttf?url';
import { characterSize, characterSvg, Mood } from './character';
import { counterSvg } from './counter';
import { counterTopSvg } from './counterTop';
import { cupLayout, cupSvg, CupOptions } from './cup';
import {
  bubblePointerColor, bubblePointerSvg, clockIconSvg, coinSvg, CONFETTI_COLORS, confettiPieceSvg, orderPadSvg,
  patienceHeartSvg, patienceRingColor, patienceRingSvg, risingHeartSvg, starSvg, steamPuffSvg, sunRaysSvg,
  titleAwningSvg, titlePearlsSvg, titleWallpaperSvg,
} from './icons';
import { ingredientIconSvg } from './ingredientIcon';
import { kitchenActionIconSvg, kitchenBottleSvg, kitchenIceBoxSvg } from './kitchenEquipment';
import { backdropClouds, backdropWindow, cloudSvg, cloudX, shopBackdropSvg } from './shopBackdrop';
import { svgDataUrl } from './svg';
import { colors } from './theme';

const style = document.createElement('style');
style.textContent = [[500, baloo500], [700, baloo700], [800, baloo800]]
  .map(([weight, url]) => `@font-face { font-family: 'Baloo 2'; font-weight: ${weight}; src: url('${url}') format('truetype'); }`)
  .join('\n');
document.head.appendChild(style);

const root = document.getElementById('root')!;
let row: HTMLElement = root;

function section(title: string) {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  row = document.createElement('div');
  row.className = 'row';
  root.appendChild(row);
}

function cell(svg: string, label: string, kind = '') {
  const div = document.createElement('div');
  div.className = `cell ${kind}`;
  div.innerHTML = `${svg}<small>${label}</small>`;
  row.appendChild(div);
}

function imgCell(svg: string, label: string, kind = '') {
  const div = document.createElement('div');
  div.className = `cell ${kind}`;
  const img = new Image();
  img.src = svgDataUrl(svg);
  img.onerror = () => console.error(`raster failed: ${label}`);
  div.appendChild(img);
  const small = document.createElement('small');
  small.textContent = `${label} (img)`;
  div.appendChild(small);
  row.appendChild(div);
}

function stage(width: number, height: number, label: string) {
  const div = document.createElement('div');
  div.className = 'cell';
  const s = document.createElement('div');
  s.className = 'stage';
  s.style.width = `${width}px`;
  s.style.height = `${height}px`;
  div.appendChild(s);
  const small = document.createElement('small');
  small.textContent = label;
  div.appendChild(small);
  row.appendChild(div);
  return (svg: string, left: number, top: number, extra: Partial<CSSStyleDeclaration> = {}) => {
    const holder = document.createElement('div');
    holder.innerHTML = svg;
    holder.style.left = `${left}px`;
    holder.style.top = `${top}px`;
    Object.assign(holder.style, extra);
    s.appendChild(holder);
    return holder;
  };
}

// ------------------------------------------------------------------ fixtures

const LOOKS: CustomerLook[] = HAIR_STYLES.map((hairStyle, i) => ({
  skin: ['#F6C8A4', '#E9B48E', '#C98E64', '#F1D2B6', '#A9714B', '#F6C8A4', '#E9B48E'][i],
  hair: hairStyle === 'balding' ? '#A8A8A8' : ['#2B1B17', '#6B4423', '#C2563A', '#2B1B17', '#E8C26A', '#6B4423', '#2B1B17'][i],
  hairStyle,
  shirt: ['#7FD6C2', '#FFCF6E', '#B79CF2', '#FF9A76', '#9FD3FF', '#F7A8C6', '#B7E07A'][i],
  accessory: ACCESSORIES[i % ACCESSORIES.length],
}));
const MOODS: Mood[] = ['delighted', 'happy', 'neutral', 'angry'];

const SHOWCASE: Drink = { size: 'M', toppings: ['pearls'], sweetness: null, ice: 'regular', tea: 'taro', milk: 'whole', foam: 'cheese' };
const DRINKS: { drink: Drink; name: string }[] = [
  { drink: SHOWCASE, name: 'showcase (taro, milk, ice, pearls, cheese)' },
  { drink: { ...EMPTY_DRINK, size: 'M', tea: 'black' }, name: 'black tea' },
  { drink: { ...EMPTY_DRINK, size: 'M', tea: 'thai', milk: 'oat', ice: 'less', toppings: ['pudding', 'lychee'], sweetness: '50' }, name: 'thai, oat, less ice, pudding+lychee, 50%' },
  { drink: { ...EMPTY_DRINK, size: 'M', tea: 'matcha', foam: 'brulee', toppings: ['grass'], sweetness: '100' }, name: 'matcha, brulee, grass jelly, 100%' },
  { drink: { ...EMPTY_DRINK, size: 'M', milk: 'whole' }, name: 'milk only' },
  { drink: { ...EMPTY_DRINK, size: 'M', toppings: ['redbean', 'crystal'] }, name: 'toppings only' },
  { drink: EMPTY_DRINK, name: 'empty' },
];

// ------------------------------------------------------------------ title reconstruction

section('Title screen reconstruction (compare ref-title.png, 390 wide)');
{
  const put = stage(390, 560, 'wallpaper + pearls + awning + fans + showcase cup');
  put(titleWallpaperSvg(390, 560), 0, 0);
  put(titlePearlsSvg(390, 844), 0, 0);
  put(titleAwningSvg(390), 0, 0);
  const cupWidth = Math.min(130, 390 * 0.32);
  const layout = cupLayout(cupWidth, { straw: true });
  put(cupSvg(SHOWCASE, { width: cupWidth, backgroundColor: colors.wall, straw: true }), 195 - cupWidth / 2 - layout.originX, 437 - layout.boxHeight);
  put(characterSvg({ skin: '#F6C8A4', hair: '#2B1B17', hairStyle: 'bun', shirt: '#7FD6C2', accessory: 'none' }, { mood: 'delighted', width: 74 }), 61, 441 - 88.8);
  put(characterSvg({ skin: '#E9B48E', hair: '#6B4423', hairStyle: 'cap', shirt: '#FFCF6E', accessory: 'glasses' }, { mood: 'happy', width: 74 }), 271, 441 - 88.8);
}

// ------------------------------------------------------------------ counter reconstruction

section('Counter page reconstruction (compare ref-counter.png below its HUD)');
{
  const W = 390;
  const backH = 357;
  const rimTop = 317;
  const rimH = 28;
  const put = stage(W, 766, 'backdrop (back) + clouds + backdrop (front) + customers + counter + counter top');
  put(shopBackdropSvg(W, backH, 'back'), 0, 0);
  const win = backdropWindow(W, backH);
  const glass = put('', win.x, win.y, { width: `${win.w}px`, height: `${win.h}px`, overflow: 'hidden', borderRadius: `${win.radius}px` });
  for (const cloud of backdropClouds(W, backH)) {
    const c = document.createElement('div');
    c.style.position = 'absolute';
    c.style.top = `${cloud.top}px`;
    c.style.left = `${cloudX(cloud.offset, win.w, cloud.size)}px`;
    c.innerHTML = cloudSvg(cloud.size);
    glass.appendChild(c);
  }
  put(shopBackdropSvg(W, backH, 'front'), 0, 0);
  put(characterSvg(LOOKS[1], { mood: 'happy', width: 100 }), 145, 227);
  put(characterSvg({ ...LOOKS[6], accessory: 'bow' }, { mood: 'happy', width: 100 }), 275, 227);
  put(bubblePointerSvg(bubblePointerColor(true)), 187, 186);
  put(orderPadSvg(), 182, 198);
  put(patienceRingSvg(0.9, patienceRingColor(0.9)), 207, 191);
  put(counterSvg(W, rimH), 0, rimTop);
  put(counterTopSvg(W, 766 - rimTop - rimH), 0, rimTop + rimH);
}

// ------------------------------------------------------------------ characters

section('Characters — every hair style × mood (width 80)');
for (const look of LOOKS) {
  for (const mood of MOODS) cell(characterSvg(look, { mood, width: 80 }), `${look.hairStyle} / ${look.accessory} / ${mood}`);
}
section('Characters — blinking, headOnly');
for (const look of LOOKS) {
  cell(characterSvg(look, { mood: 'happy', blinking: true, width: 80 }), `${look.hairStyle} blinking`);
  cell(characterSvg(look, { mood: 'neutral', width: 40, headOnly: true }), `${look.hairStyle} headOnly 40 (${characterSize(40, true).height.toFixed(1)}h)`);
}

// ------------------------------------------------------------------ cups

const cupCases: { opts: Omit<CupOptions, 'backgroundColor'>; bg: string; kind: string; name: string }[] = [
  { opts: { width: 124.8, straw: true }, bg: colors.wall, kind: 'wall', name: 'title 124.8 straw' },
  { opts: { width: 26, straw: true }, bg: '#FFFFFF', kind: '', name: 'bubble 26 straw' },
  { opts: { width: 26, straw: true, sealed: true, tapered: false }, bg: 'transparent', kind: 'wall', name: 'held 26 sealed straight' },
  { opts: { width: 70, tapered: false }, bg: 'transparent', kind: 'wall', name: 'toss 70 straight' },
  { opts: { width: 90, sealed: true }, bg: '#FFFFFF', kind: '', name: '90 sealed no straw' },
  { opts: { width: 100, surface: true, fill: 0.5 }, bg: '#FFFFFF', kind: '', name: '100 surface fill .5' },
  { opts: { width: 100, surface: true, surfacePhase: 0.3, fill: 1 }, bg: '#FFFFFF', kind: '', name: '100 surface phase .3 fill 1' },
];
for (const { opts, bg, kind, name } of cupCases) {
  section(`Cups — ${name}`);
  for (const { drink, name: dn } of DRINKS) cell(cupSvg(drink, { ...opts, backgroundColor: bg }), dn, kind);
}

// ------------------------------------------------------------------ ingredient icons

section('Ingredient icons — every option, 40 and 28');
for (const category of Object.keys(CATEGORIES) as CategoryId[]) {
  for (const option of CATEGORIES[category].options) {
    cell(ingredientIconSvg(category, option.id, 40) + ingredientIconSvg(category, option.id, 28), `${category}/${option.id}`);
  }
}

// ------------------------------------------------------------------ backdrop & counters

section('Shop backdrop 390×500 — all / back / front, clouds');
cell(shopBackdropSvg(390, 500), 'all');
cell(shopBackdropSvg(390, 500, 'back'), 'back');
cell(shopBackdropSvg(390, 500, 'front'), 'front', 'dark');
cell(cloudSvg(30) + cloudSvg(22), 'clouds 30, 22', 'dark');
cell(shopBackdropSvg(844, 300), 'all 844×300 (sideways)');

section('Counter rim and counter top');
cell(counterSvg(390, 30), 'counter 390×30');
cell(counterTopSvg(390, 320), 'counterTop 390×320');
cell(counterTopSvg(600, 260), 'counterTop 600×260');
cell(counterTopSvg(320, 400), 'counterTop 320×400');

// ------------------------------------------------------------------ kitchen equipment

section('Kitchen equipment');
cell(kitchenBottleSvg(60, 150, '#F5CC63'), 'bottle 60×150 #F5CC63');
cell(kitchenBottleSvg(36, 90, '#B26337'), 'bottle 36×90 #B26337');
cell(kitchenIceBoxSvg(160, 80), 'ice box 160×80');
cell(kitchenActionIconSvg('cup'), 'action cup 20', 'dark');
cell(kitchenActionIconSvg('trash'), 'action trash 20');
cell(kitchenActionIconSvg('cup', 40), 'action cup 40', 'dark');
cell(kitchenActionIconSvg('trash', 40), 'action trash 40');

// ------------------------------------------------------------------ icons

section('Small icons');
cell(bubblePointerSvg(bubblePointerColor(true)) + bubblePointerSvg(bubblePointerColor(false)), 'bubble pointer ask / picked');
cell(orderPadSvg() + orderPadSvg(40), 'order pad 26, 40');
for (const f of [1, 0.75, 0.5, 0.2, 0]) cell(patienceRingSvg(f, patienceRingColor(f)) + patienceRingSvg(f, patienceRingColor(f), 40), `ring ${f}`);
for (const f of [1, 0.6, 0.4, 0.1, 0]) cell(patienceHeartSvg(f, 26) + patienceHeartSvg(f, 48), `heart ${f}`);
for (const f of [1, 0.66, 0.25]) cell(clockIconSvg(f, false) + clockIconSvg(f, true) + clockIconSvg(f, false, 36), `clock ${f} (plain, warm, 36)`);
cell(starSvg(true, 64) + starSvg(true, 48) + starSvg(false, 48), 'stars');
cell(sunRaysSvg(200), 'sun rays 200', 'wall');
cell(risingHeartSvg() + steamPuffSvg(), 'rising heart, steam');
cell(coinSvg(18) + coinSvg(32) + coinSvg(64), 'coin 18, 32, 64');
cell(CONFETTI_COLORS.map((c, i) => confettiPieceSvg(c, i % 3 === 0)).join(''), 'confetti');
cell(titleAwningSvg(300), 'title awning 300');

// ------------------------------------------------------------------ raster

section('Rasterised through Image (data URL) — the Phaser texture path');
imgCell(characterSvg(LOOKS[3], { mood: 'angry', width: 80 }), 'character');
imgCell(cupSvg(SHOWCASE, { width: 124.8, backgroundColor: '#FFFFFF', straw: true }), 'cup');
imgCell(cupSvg(DRINKS[2].drink, { width: 100, backgroundColor: '#FFFFFF' }), 'cup sticker');
imgCell(ingredientIconSvg('tea', 'taro', 40), 'tea icon');
imgCell(ingredientIconSvg('ice', 'regular', 40), 'ice icon: external href');
imgCell(shopBackdropSvg(390, 300), 'backdrop');
imgCell(counterTopSvg(390, 300), 'counterTop');
imgCell(coinSvg(32), 'coin');
imgCell(patienceHeartSvg(0.5, 48), 'heart .5');
imgCell(kitchenBottleSvg(60, 150, '#F5CC63'), 'bottle');

(window as unknown as { artTestReady: boolean }).artTestReady = true;
