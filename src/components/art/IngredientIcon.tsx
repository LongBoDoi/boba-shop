import { memo } from 'react';
import Svg, { Circle, G, Image as SvgImage, Path, Rect } from 'react-native-svg';

import { CategoryId, getIngredient, ICE_LEVELS, Tea, TOPPINGS } from '../../game/ingredients';
import { colors } from '../../theme';
import { shade } from './Character';
import { PIECE } from './kitchenArt';

interface IngredientIconProps {
  category: CategoryId;
  id: string;
  size: number;
}

/** Shop-style pictograms for every ingredient, drawn in a 40×40 box. */
export const IngredientIcon = memo(function IngredientIcon({ category, id, size }: IngredientIconProps) {
  const option = getIngredient(category, id);
  if (!option) return null;

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {category === 'tea' && <TeaTin tea={option as Tea} />}
      {category === 'toppings' && <ToppingBowl id={id} />}
      {category === 'ice' && <IceCubes cubes={ICE_LEVELS.find((level) => level.id === id)?.cubes ?? 0} />}
      {category === 'milk' && <MilkCarton id={id} />}
      {category === 'sweetness' && <SugarJar percent={Number(id)} />}
      {category === 'foam' && <FoamDollop color={option.isNone ? '#EDEDED' : option.color} />}
      {option.isNone && <Path d="M9 31 L31 9" stroke={colors.bad} strokeWidth={3.5} strokeLinecap="round" />}
    </Svg>
  );
});

function TeaTin({ tea }: { tea: Tea }) {
  return (
    <G>
      <Rect x={10} y={10} width={20} height={26} rx={4} fill={tea.color} />
      <Rect x={9} y={5} width={22} height={7} rx={2.5} fill={shade(tea.color, -30)} />
      <Rect x={13} y={17} width={14} height={11} rx={3} fill="#FFFFFF" opacity={0.9} />
      <Path d="M16 26 C16 20 21 19 25 19 C25 23 21 26 16 26 Z" fill={tea.color} />
      <Rect x={11.5} y={12} width={2.5} height={22} rx={1.2} fill="#FFFFFF" opacity={0.25} />
    </G>
  );
}

function ToppingBowl({ id }: { id: string }) {
  const topping = TOPPINGS.find((t) => t.id === id);
  const color = topping?.color ?? '#000';
  const spots = [
    [13, 19],
    [20, 17],
    [27, 19],
    [16.5, 14],
    [23.5, 14],
  ];
  return (
    <G>
      {spots.map(([x, y]) =>
        topping?.shape === 'pearl' ? (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={3.6} fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
        ) : (
          <Rect key={`${x}-${y}`} x={x - 3.3} y={y - 3.3} width={6.6} height={6.6} rx={1.6} fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth={0.8} />
        ),
      )}
      <Path d="M5 21 H35 C35 30 28 35 20 35 C12 35 5 30 5 21 Z" fill="#FFFFFF" stroke="#E7D5C5" strokeWidth={1.5} />
      <Path d="M7.5 25.5 H32.5" stroke={colors.primary} strokeWidth={2.2} />
    </G>
  );
}

function IceCubes({ cubes }: { cubes: number }) {
  const positions = cubes === 0 ? [[13, 13]] : cubes <= 2 ? [[7, 15], [19, 12]] : [[5, 18], [16, 9], [20, 20]];
  return (
    <G>
      {positions.map(([x, y]) => (
        <SvgImage key={`${x}-${y}`} href={PIECE.ice} x={x} y={y} width={18} height={18} />
      ))}
    </G>
  );
}

function MilkCarton({ id }: { id: string }) {
  const body = id === 'oat' ? '#F1E3C8' : id === 'whole' ? '#FFFFFF' : '#EEEEEE';
  const stripe = id === 'oat' ? '#C08E4F' : id === 'whole' ? '#5AA9E6' : '#C9C9C9';
  return (
    <G>
      <Path d="M12 15 L20 6 L28 15 V35 H12 Z" fill={body} stroke="#DCCFC2" strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M12 15 L20 6 L28 15 Z" fill={stripe} />
      <Rect x={12} y={21} width={16} height={7} fill={stripe} />
      <Rect x={18} y={3} width={4} height={4} rx={1} fill={stripe} />
    </G>
  );
}

function SugarJar({ percent }: { percent: number }) {
  const fill = (percent / 100) * 18;
  return (
    <G>
      <Rect x={9} y={12} width={22} height={23} rx={6} fill="#FFFFFF" stroke="#E7D5C5" strokeWidth={1.5} />
      {fill > 0 && <Rect x={11} y={33 - fill} width={18} height={fill} rx={4} fill="#F5B82E" />}
      <Rect x={11} y={6} width={18} height={7} rx={2.5} fill={colors.primary} />
      <Rect x={12.5} y={14.5} width={2.5} height={16} rx={1.2} fill="#FFFFFF" opacity={0.6} />
    </G>
  );
}

function FoamDollop({ color }: { color: string }) {
  return (
    <G>
      <Rect x={8} y={29} width={24} height={6} rx={2} fill="#C9A27E" />
      <Path
        d="M8 30 C4 30 4 23 9 22 C8 16 15 13 18 17 C20 11 29 12 29 18 C35 18 36 26 32 30 Z"
        fill={color}
        stroke={shade(color, -18)}
        strokeWidth={1.2}
      />
      <Circle cx={16} cy={21} r={1.8} fill="#FFFFFF" opacity={0.8} />
    </G>
  );
}
