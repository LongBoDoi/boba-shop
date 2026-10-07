import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/** The kitchen's palette: warm wood, white tile, brushed steel and the shop's pink. */
export const SHOP = {
  wall: '#FBF2E7',
  tile: '#EEDFCD',
  wood: '#E9B87E',
  woodTop: '#F7D7A9',
  woodEdge: '#C9924F',
  woodDark: '#9C6836',
  plaque: '#F7DCAE',
  steel: '#E7EDF1',
  steelTop: '#F8FBFC',
  steelEdge: '#B3BDC5',
  steelDeep: '#8F9AA2',
  pink: '#F79DB7',
  pinkDark: '#E87FA0',
  pinkLine: '#D4648A',
  pinkGrip: '#F2607F',
  glass: '#EDF4F5',
  glassEdge: '#C7D6D6',
  handle: '#3E3A38',
  chalk: '#36332F',
};

/** A plump little heart — the knob on every lid and the button on every tap. */
export function heartPath(cx: number, cy: number, s: number) {
  return (
    `M${cx} ${cy + s * 0.78}` +
    ` C${cx - s * 1.05} ${cy + s * 0.08} ${cx - s * 0.66} ${cy - s * 0.62} ${cx} ${cy - s * 0.12}` +
    ` C${cx + s * 0.66} ${cy - s * 0.62} ${cx + s * 1.05} ${cy + s * 0.08} ${cx} ${cy + s * 0.78} Z`
  );
}

export interface RoomShelf {
  /** Top of the equipment standing on this shelf. */
  top: number;
  /** The surface itself. */
  base: number;
  /** Stainless serving bar (the topping pans are set into it) rather than a wooden shelf. */
  steel?: boolean;
}

interface KitchenRoomProps {
  width: number;
  height: number;
  shelves: RoomShelf[];
  /** The work top in the middle of the room, where the cup stands. */
  tableLine: number;
  /** Where the pink cabinet doors along the bottom start. */
  cabinetTop: number;
  /** The wooden coaster under the cup. */
  matX: number;
  matW: number;
  cupH: number;
}

/**
 * The room itself: tiled wall, two pink pendant lamps, wooden shelves for the dispensers, a
 * stainless bar for the topping pans, the wooden work top with the cup's coaster, and the pink
 * cabinet doors underneath. Everything here is scenery — the equipment you touch is drawn on top.
 */
export const KitchenRoom = memo(function KitchenRoom({
  width: W,
  height: H,
  shelves,
  tableLine,
  cabinetTop,
  matX,
  matW,
  cupH,
}: KitchenRoomProps) {
  if (W <= 0 || H <= 0) return null;

  const tileW = Math.max(36, Math.round(W / 8));
  const tileH = Math.round(tileW * 0.8);
  let grout = '';
  for (let x = tileW; x < W; x += tileW) grout += `M${x} 0 V${cabinetTop} `;
  for (let y = tileH; y < cabinetTop; y += tileH) grout += `M0 ${y} H${W} `;

  const headroom = shelves[0]?.top ?? 34;
  const lampR = Math.max(11, Math.round(Math.min(W * 0.052, headroom * 0.46)));
  const lampY = Math.round(lampR + Math.max(4, (headroom - lampR * 2) * 0.5));
  const railY = Math.round(tableLine - cupH - 20);
  const slab = Math.max(9, Math.round(H * 0.024));
  const counterH = Math.max(11, Math.round(H * 0.028));

  // Props standing on the work top, left and right of the cup's coaster.
  const jarW = Math.round(cupH * 0.4);
  const jarH = Math.round(cupH * 0.46);
  const jarX = W - 10 - jarW;
  const boardW = Math.round(cupH * 0.74);
  const boardX = jarX - 8 - boardW;
  const roomForBoard = boardX > matX + matW + 6;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        {/* ---- tiled wall */}
        <Rect width={W} height={cabinetTop} fill={SHOP.wall} />
        <Path d={grout} stroke={SHOP.tile} strokeWidth={1.6} fill="none" />
        <Rect width={W} height={Math.round(H * 0.1)} fill="#FFFFFF" opacity={0.35} />

        {/* ---- pendant lamps in the corners */}
        {[Math.round(W * 0.11), Math.round(W * 0.89)].map((cx) => (
          <Lamp key={cx} cx={cx} y={lampY} r={lampR} />
        ))}

        {/* ---- shelves: wood for the dispensers, a steel bar for the topping pans */}
        {shelves.map((shelf, i) =>
          shelf.steel ? (
            <SteelBar key={i} W={W} shelf={shelf} slab={slab} />
          ) : (
            <WoodShelf key={i} W={W} base={shelf.base} slab={slab} />
          ),
        )}

        {/* ---- the steel rail the shop hangs its notes from */}
        <Rect x={14} y={railY} width={W - 28} height={4.5} rx={2.2} fill="#C3CBD2" />
        <Rect x={14} y={railY} width={W - 28} height={1.8} rx={1} fill="#EDF1F4" />
        {[16, W - 26].map((x) => (
          <Rect key={x} x={x} y={railY - 3} width={10} height={11} rx={3} fill="#9AA4AC" />
        ))}

        {/* ---- the work top in the middle, with the cup's wooden coaster */}
        <Rect x={0} y={tableLine} width={W} height={counterH} fill={SHOP.wood} />
        <Rect x={0} y={tableLine} width={W} height={3} fill={SHOP.woodTop} />
        <Rect x={0} y={tableLine + counterH - 3} width={W} height={3} fill={SHOP.woodEdge} />
        <Rect x={0} y={tableLine + counterH} width={W} height={3} fill={SHOP.woodDark} opacity={0.2} />

        <PropStrawJar x={jarX} base={tableLine} w={jarW} h={jarH} />
        {roomForBoard && <PropChalkboard x={boardX} base={tableLine} w={boardW} h={Math.round(cupH * 0.56)} />}

        <Ellipse cx={matX + matW / 2} cy={tableLine - 1} rx={matW / 2} ry={matW * 0.15} fill={SHOP.woodEdge} />
        <Ellipse cx={matX + matW / 2} cy={tableLine - 3.5} rx={matW / 2 - 2} ry={matW * 0.13} fill={SHOP.woodTop} />
        <Ellipse
          cx={matX + matW / 2}
          cy={tableLine - 3.5}
          rx={matW / 2 - 7}
          ry={matW * 0.09}
          fill="none"
          stroke={SHOP.woodEdge}
          strokeWidth={1}
          opacity={0.5}
        />

        {/* ---- pink cabinet doors along the bottom */}
        <Rect x={0} y={cabinetTop} width={W} height={H - cabinetTop} fill={SHOP.pinkDark} />
        <Rect x={0} y={cabinetTop} width={W} height={4} fill={SHOP.steelEdge} />
        <Rect x={0} y={cabinetTop + 4} width={W} height={2} fill={SHOP.steelDeep} opacity={0.5} />
        {[0, 1, 2].map((i) => {
          const dw = W / 3;
          return (
            <Fragmentish key={i}>
              <Rect
                x={i * dw + 3}
                y={cabinetTop + 9}
                width={dw - 6}
                height={H - cabinetTop - 11}
                rx={4}
                fill={SHOP.pink}
                stroke={SHOP.pinkLine}
                strokeWidth={1.2}
              />
              <Rect
                x={i * dw + dw / 2 - 13}
                y={cabinetTop + 14}
                width={26}
                height={4.5}
                rx={2.2}
                fill={SHOP.handle}
              />
            </Fragmentish>
          );
        })}
      </Svg>
    </View>
  );
});

/** `<></>` inside an Svg tree, kept explicit so the SVG children stay flat. */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Lamp({ cx, y, r }: { cx: number; y: number; r: number }) {
  return (
    <Fragmentish>
      <Rect x={cx - 1} y={0} width={2} height={Math.max(0, y - r)} fill="#7A6253" />
      <Path
        d={`M${cx - r} ${y} Q${cx - r * 0.86} ${y - r * 1.02} ${cx} ${y - r} Q${cx + r * 0.86} ${y - r * 1.02} ${cx + r} ${y} Z`}
        fill={SHOP.pink}
      />
      <Path d={`M${cx - r * 0.5} ${y - r * 0.82} Q${cx - r * 0.2} ${y - r * 1.02} ${cx} ${y - r}`} stroke="#FFFFFF" strokeWidth={2} opacity={0.5} fill="none" />
      <Rect x={cx - r} y={y - 2} width={r * 2} height={4} rx={2} fill={SHOP.pinkLine} />
      <Ellipse cx={cx} cy={y + r * 0.55} rx={r * 0.95} ry={r * 0.75} fill="#FFE49C" opacity={0.3} />
      <Circle cx={cx} cy={y + 2.5} r={r * 0.3} fill="#FFE9A8" />
    </Fragmentish>
  );
}

function WoodShelf({ W, base, slab }: { W: number; base: number; slab: number }) {
  return (
    <Fragmentish>
      <Rect x={0} y={base} width={W} height={slab} fill={SHOP.wood} />
      <Rect x={0} y={base} width={W} height={3} fill={SHOP.woodTop} />
      <Rect x={0} y={base + slab - 3} width={W} height={3} fill={SHOP.woodEdge} />
      <Rect x={0} y={base + slab} width={W} height={4} fill={SHOP.woodDark} opacity={0.16} />
    </Fragmentish>
  );
}

/** The topping bar: a stainless counter the pans are dropped into. */
function SteelBar({ W, shelf, slab }: { W: number; shelf: RoomShelf; slab: number }) {
  const top = Math.max(0, shelf.top - 6);
  return (
    <Fragmentish>
      <Rect x={0} y={top} width={W} height={shelf.base - top} fill={SHOP.steel} />
      <Rect x={0} y={top} width={W} height={4} fill={SHOP.steelTop} />
      <Rect x={0} y={shelf.base} width={W} height={slab} fill="#D5DDE3" />
      <Rect x={0} y={shelf.base} width={W} height={2} fill={SHOP.steelTop} />
      <Rect x={0} y={shelf.base + slab - 2.5} width={W} height={2.5} fill={SHOP.steelEdge} />
    </Fragmentish>
  );
}

/** A tin of striped straws. */
function PropStrawJar({ x, base, w, h }: { x: number; base: number; w: number; h: number }) {
  const straws = [-12, -6, 0, 6, 12];
  return (
    <Fragmentish>
      {straws.map((angle, i) => (
        <Rect
          key={angle}
          x={x + 4 + (i * (w - 10)) / 4}
          y={base - h - h * 0.9}
          width={3.6}
          height={h * 1.2}
          rx={1.8}
          fill={i % 2 === 0 ? '#F2708F' : '#FFD9E3'}
          transform={`rotate(${angle} ${x + 5 + (i * (w - 10)) / 4} ${base - h * 0.4})`}
        />
      ))}
      <Rect x={x} y={base - h} width={w} height={h} rx={3} fill="#A9B3B9" />
      <Rect x={x} y={base - h} width={w} height={4} rx={2} fill="#C6CED3" />
      <Rect x={x + 3} y={base - h + 6} width={3} height={h - 11} rx={1.5} fill="#FFFFFF" opacity={0.35} />
    </Fragmentish>
  );
}

/** A little chalkboard sign leaning on the work top. */
function PropChalkboard({ x, base, w, h }: { x: number; base: number; w: number; h: number }) {
  return (
    <Fragmentish>
      <Rect x={x} y={base - h} width={w} height={h} rx={3} fill={SHOP.woodEdge} />
      <Rect x={x + 3} y={base - h + 3} width={w - 6} height={h - 6} rx={2} fill={SHOP.chalk} />
      {[0.26, 0.46, 0.66].map((at, i) => (
        <Rect
          key={at}
          x={x + 8}
          y={base - h + h * at}
          width={(w - 16) * (i === 1 ? 0.75 : 1)}
          height={2}
          rx={1}
          fill="#FFFFFF"
          opacity={0.75}
        />
      ))}
      <Path d={heartPath(x + w / 2, base - h * 0.17, w * 0.1)} fill="#FF9BB6" />
    </Fragmentish>
  );
}
