import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Drink, getIngredient, MIN_FILL, Tea } from '../game/ingredients';
import { CupBuild } from '../game/reducer';
import { DURATION, timing } from '../motion';
import { colors, fonts } from '../theme';
import { SHOP } from './art/KitchenRoom';
import { ART, JAR_SPOUT, JAR_TEA, TEA_BG, TEA_ROOM } from './art/kitchenArt';
import { KitchenCup } from './KitchenCup';
import { Spill, Stream, TapSwipe, useHoldPour } from './pour';

/**
 * How tall a jar is next to the headroom its shelf has. The plate's second shelf gives 233 of its
 * 1286 pixels, which makes for a small jar, so they are drawn over that — a tall dispenser
 * standing proud of the board above it rather than tucked under it.
 */
const JAR_FIT = 1.35;
/**
 * How far from the end of the shelf a jar starts going soft, as a share of its own width. It
 * blurs and fades on the way out rather than being cut off by the edge of the board.
 */
const HAZE = 1.3;
/** How much of a jar is left by the time it is right at the end: soft, but still clearly a jar. */
const HAZE_LEFT = 0.5;
/** A breath between two jars, in the plate's own pixels, so they do not stand on each other. */
const JAR_GAP = 24;
/** The plaque under a jar, hung on the front edge of the board it stands on. */
const NAME = { drop: 6, height: 58 };

export interface TeaTap {
  id: string;
  name: string;
  color: string;
}

interface TeaWindowProps {
  /** The room the window opens over. */
  width: number;
  height: number;
  /** The strip along the top the order card already has; the window stays under it. */
  topInset: number;
  /** The day's dispensers, in shelf order. */
  teas: TeaTap[];
  cup: Drink;
  build: CupBuild;
  /** The live level, which a held-open tap drives straight past the committed fill. */
  level: SharedValue<number>;
  onPour: (category: 'tea', optionId: string, amount: number) => void;
  onNudge: (message: string) => void;
  onClose: () => void;
}

/**
 * The tea station, opened. The shelf is no longer poured from where it stands — the cup is
 * carried to it and this window comes up to pour in, so the jars, the cup and the measure are all
 * big enough to work with.
 *
 * Like the room behind it the window is one painting (`TEA_BG`): its frame, the board its name is
 * written across, three shelves and the work top are all in the plate, and everything the player
 * touches is placed on the lines `TEA_ROOM` measures off it. The jars stand on the second shelf,
 * three at a time with the rest a swipe away; the cup stands in the middle of the work top, in
 * front of the shelves rather than under them; and how full it is is read off the card on the
 * right rather than off the glass.
 */
export function TeaWindow({
  width: W,
  height: H,
  topInset,
  teas,
  cup,
  build,
  level,
  onPour,
  onNudge,
  onClose,
}: TeaWindowProps) {
  const open = useSharedValue(0);
  useEffect(() => {
    open.set(withTiming(1, timing(DURATION.base)));
  }, [open]);

  // As big as the room will take, keeping the plate's shape: the full width bar a margin, or
  // what is left under the order card if that is the tighter of the two.
  const free = Math.max(0, topInset) + Math.round(H * 0.02);
  const band = H - free - Math.round(H * 0.03);
  const w = Math.round(Math.min(W - Math.round(W * 0.09), (band * TEA_ROOM.width) / TEA_ROOM.height));
  const h = Math.round((w * TEA_ROOM.height) / TEA_ROOM.width);
  const left = Math.round((W - w) / 2);
  const top = Math.round(free + (band - h) / 2);
  /** Plate pixels to window pixels — the same trick the room itself is placed with. */
  const at = (v: number) => Math.round((v * w) / TEA_ROOM.width);

  // The shelf is a carousel the width of the board: a jar is as tall as the board above it leaves
  // room for, they stand shoulder to shoulder with no gap at all, and the row runs the whole way
  // across, going soft at both ends. The one over the cup is the one that pours.
  const jarH = at(Math.round((TEA_ROOM.shelves[1].stand - TEA_ROOM.shelves[0].base) * JAR_FIT));
  const jarW = Math.round(jarH * ART.jar);
  const slot = jarW + at(JAR_GAP);
  // The plaque hangs below the jar, over the front edge of the board, and the shelf has to be
  // deep enough not to clip it off.
  const nameH = at(NAME.height);
  const nameTop = jarH + at(NAME.drop);
  // The run is as many *whole* jars as the window will take either side of the cup, and it is
  // measured symmetrically about the cup rather than off the board's own middle: the two are a
  // good fifty plate pixels apart, and a lopsided run fades one side sooner than the other.
  // Whole slots, because a run that ends mid-jar cuts the outermost one in half.
  const reach = Math.min(at(TEA_ROOM.cup.cx), w - at(TEA_ROOM.cup.cx));
  const over = (Math.max(1, Math.floor(reach / slot - 0.5)) + 0.5) * slot;
  const bayX = Math.round(at(TEA_ROOM.cup.cx) - over);
  const bayW = Math.round(over * 2);
  const jarTop = at(TEA_ROOM.shelves[1].stand) - jarH;
  /** Where the row has to sit for the `i`th jar to be the one over the cup. */
  const centred = (i: number) => Math.round(over - (i * slot + slot / 2));

  const cupH = at(TEA_ROOM.cup.height);
  const cupW = Math.round(cupH * ART.cup);
  const cupX = at(TEA_ROOM.cup.cx) - Math.round(cupW / 2);
  const cupTop = at(TEA_ROOM.cup.stand) - cupH;

  // The whole row moves with the finger and stops at its ends: there is no wrapping round, so
  // the shelf beside the first and the last tea is simply empty, the way the end of a row is.
  //
  // It opens in the middle of the row. It used to open on whichever tap the cup was nearest when
  // it was let go, which is the last one whenever the cup lands at the right-hand end of the
  // shelf — arbitrary, and never where you meant. A cup that already holds tea is the exception:
  // that tea is the only one it can take more of, so it is the one brought over.
  const held = cup.tea ? teas.findIndex((option) => option.id === cup.tea) : -1;
  const opened = held >= 0 ? held : Math.floor((teas.length - 1) / 2);
  const [chosen, setChosen] = useState(opened);
  const shift = useSharedValue(centred(opened));
  const grabbed = useRef(0);
  /** Settle on a jar, bringing it to the middle. */
  const slide = (i: number) => {
    const want = Math.max(0, Math.min(teas.length - 1, i));
    setChosen(want);
    shift.set(withTiming(centred(want), timing()));
  };
  const swipe: TapSwipe = {
    begin: () => {
      grabbed.current = shift.get();
    },
    move: (dx) =>
      shift.set(Math.max(centred(teas.length - 1), Math.min(centred(0), grabbed.current + dx))),
    // Whichever jar ended up nearest the middle is the one that settles there.
    end: (dx) => slide(Math.round((over - slot / 2 - (grabbed.current + dx)) / slot)),
  };

  // What is running right now, so the cup shows the tea's colour before `POUR` is dispatched.
  const [pouring, setPouring] = useState<string | null>(null);
  const inCup = pouring ? { ...cup, tea: cup.tea ?? pouring } : cup;
  const running = pouring ? teas.find((option) => option.id === pouring) : undefined;
  // The cup never moves in here, but the stream is written against a cup that can.
  const cupLine = useSharedValue(cupTop);
  useEffect(() => {
    cupLine.set(cupTop);
  }, [cupLine, cupTop]);

  const scrim = useAnimatedStyle(() => ({ opacity: open.get() }));
  const panel = useAnimatedStyle(() => ({
    opacity: open.get(),
    transform: [{ scale: 0.94 + open.get() * 0.06 }],
  }));
  const shelf = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));

  const sign = TEA_ROOM.sign;
  const spout = jarTop + Math.round(jarH * JAR_SPOUT);
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* The room behind goes quiet: it is dimmed, and it stops taking touches. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim, scrim]}
        onStartShouldSetResponder={() => true}
        onResponderRelease={onClose}
      />

      <Animated.View style={[styles.panel, { left, top, width: w, height: h }, panel]}>
        <Image source={TEA_BG} style={{ width: w, height: h }} />

        {/* The sign board is painted; only what it says is not. */}
        <View
          pointerEvents="none"
          style={[
            styles.sign,
            { left: at(sign.x0), top: at(sign.top), width: at(sign.x1 - sign.x0), height: at(sign.base - sign.top) },
          ]}
        >
          <Text style={[styles.signText, { fontSize: at(sign.base - sign.top) * 0.56 }]} numberOfLines={1}>
            Pha trà
          </Text>
        </View>

        {/* The shelf, clipped to the three it shows, so the ones waiting their turn are off the
            board rather than out over the vines. */}
        <View style={[styles.bay, { left: bayX, top: jarTop, width: bayW, height: nameTop + nameH }]}>
          <Animated.View style={[StyleSheet.absoluteFill, shelf]}>
            {teas.map((option, i) => {
              return (
                <Tap
                  key={option.id}
                  tea={option}
                  left={i * slot + Math.round((slot - jarW) / 2)}
                  width={jarW}
                  height={jarH}
                  name={{ top: nameTop, height: nameH, width: slot }}
                  shelf={{ shift, width: bayW }}
                  chosen={i === chosen}
                  locked={cup.tea !== null && cup.tea !== option.id}
                  fill={build.fill}
                  level={level}
                  swipe={teas.length > 1 ? swipe : undefined}
                  onStart={(on) => setPouring(on ? option.id : null)}
                  onCommit={(amount) => onPour('tea', option.id, amount)}
                  onPick={() => slide(i)}
                  onNudge={onNudge}
                />
              );
            })}
          </Animated.View>
        </View>

        {/* The half of the pour that is already inside the glass goes under the cup, so the glass
            tints it and the cat covers it; the half still in open air is drawn after. */}
        {running && (
          <Stream
            side="back"
            x={at(TEA_ROOM.cup.cx)}
            top={spout}
            cupY={cupLine}
            cupH={cupH}
            color={running.color}
            level={level}
            width={Math.max(4, at(22))}
          />
        )}

        <View style={{ position: 'absolute', left: cupX, top: cupTop, width: cupW, height: cupH }} pointerEvents="none">
          <KitchenCup drink={inCup} width={cupW} height={cupH} level={level} />
          <Spill level={level} cupW={cupW} cupH={cupH} color={running?.color ?? '#F7F4EC'} />
        </View>

        {running && (
          <Stream
            side="front"
            x={at(TEA_ROOM.cup.cx)}
            top={spout}
            cupY={cupLine}
            cupH={cupH}
            color={running.color}
            level={level}
            width={Math.max(4, at(22))}
          />
        )}

        <Measure
          box={{
            left: at(TEA_ROOM.board.x0),
            top: at(TEA_ROOM.board.top),
            width: at(TEA_ROOM.board.x1 - TEA_ROOM.board.x0),
            height: at(TEA_ROOM.board.base - TEA_ROOM.board.top),
          }}
          level={level}
          color={(inCup.tea ? getIngredient('tea', inCup.tea)?.color : undefined) ?? colors.sky}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          hitSlop={10}
          onPress={onClose}
          style={[
            styles.shut,
            {
              left: at(TEA_ROOM.shut.cx) - Math.round(at(TEA_ROOM.shut.d) / 2),
              top: at(TEA_ROOM.shut.cy) - Math.round(at(TEA_ROOM.shut.d) / 2),
              width: at(TEA_ROOM.shut.d),
              height: at(TEA_ROOM.shut.d),
              borderRadius: at(TEA_ROOM.shut.d),
            },
          ]}
        >
          <Svg width={at(TEA_ROOM.shut.d)} height={at(TEA_ROOM.shut.d)} viewBox="0 0 64 64">
            <Path d="M22 22 L42 42 M42 22 L22 42" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" fill="none" />
          </Svg>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * One dispenser on the shelf: hold it open and it runs into the cup. Where there are more teas
 * than the shelf shows, the same finger swipes the shelf along instead — see `useHoldPour`.
 */
function Tap({
  tea,
  left,
  width,
  height,
  name,
  shelf,
  chosen,
  locked,
  fill,
  level,
  swipe,
  onStart,
  onCommit,
  onPick,
  onNudge,
}: {
  tea: TeaTap;
  left: number;
  width: number;
  height: number;
  /** The plaque under it: how far below the jar it hangs, and how big it is. */
  name: { top: number; height: number; width: number };
  /** The board it is standing on, and how far along that board it has been swiped. */
  shelf: { shift: SharedValue<number>; width: number };
  /** The one in the middle, over the cup. Only this one pours. */
  chosen: boolean;
  locked: boolean;
  fill: number;
  level: SharedValue<number>;
  swipe?: TapSwipe;
  onStart: (running: boolean) => void;
  onCommit: (amount: number) => void;
  onPick: () => void;
  onNudge: (message: string) => void;
}) {
  const press = useSharedValue(1);
  const { handlers } = useHoldPour({
    enabled: chosen && !locked,
    fill,
    level,
    press,
    onStart,
    onCommit,
    // One off to the side is not a tap you can open — it is one you bring over first, and a
    // touch on it does that as well as a swipe does.
    onBlocked: () => (chosen ? onNudge('Ly đã có trà khác — bấm Đổ bỏ trước') : onPick()),
    swipe,
  });
  // How far into the board it is: 1 in the clear, 0 at either end. A jar on its way off goes
  // soft instead of being cut in half by the edge, and it is read off the swipe itself so it
  // follows the finger rather than snapping when the shelf settles.
  const clear = (sv: SharedValue<number>, w: number) => {
    'worklet';
    const mid = left + width / 2 + sv.get();
    return Math.max(0, Math.min(1, Math.min(mid, w - mid) / (width * HAZE)));
  };
  const style = useAnimatedStyle(() => ({
    opacity: HAZE_LEFT + (1 - HAZE_LEFT) * clear(shelf.shift, shelf.width),
    transform: [{ scale: press.get() }],
  }));
  const haze = useAnimatedStyle(() => ({ opacity: 1 - clear(shelf.shift, shelf.width) }));
  // The plaque goes all the way out, rather than hanging on as a readable label under a jar that
  // has already gone to a ghost.
  const plaque = useAnimatedStyle(() => ({ opacity: clear(shelf.shift, shelf.width) }));
  const option = getIngredient('tea', tea.id) as Tea | undefined;

  return (
    <Animated.View
      {...handlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Vòi ${option?.name ?? tea.name}`}
      accessibilityState={{ selected: chosen }}
      style={[{ position: 'absolute', left, top: 0, width, height: name.top + name.height }, style]}
    >
      {/* Nothing marks the one that pours but where it is standing: in the middle, over the cup. */}
      <Image source={JAR_TEA[tea.id] ?? JAR_TEA.black} style={[{ width, height }, locked && styles.locked]} />
      {/* The same jar again, out of focus, faded in over the sharp one as it nears the end of the
          board: a blur cannot be animated, but one lying over the other can. */}
      <Animated.View style={[styles.layer, haze]} pointerEvents="none">
        <Image
          source={JAR_TEA[tea.id] ?? JAR_TEA.black}
          blurRadius={Math.max(2, Math.round(width * 0.06))}
          style={[{ width, height }, locked && styles.locked]}
        />
      </Animated.View>

      {/* Its name, on a plaque hung off the front of the board. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.name,
          plaque,
          { left: Math.round((width - name.width) / 2), top: name.top, width: name.width, height: name.height },
        ]}
      >
        <Text style={[styles.nameText, { fontSize: Math.max(7, Math.round(name.height * 0.52)) }]} numberOfLines={1}>
          {option?.name ?? tea.name}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * How full the cup is, read off the card on the right: a tube that fills as the tea goes in, with
 * the red line across it that the order has to reach. The glass itself is left clear — a ring
 * printed round a cup this small was never easy to read against the drink behind it.
 */
function Measure({
  box,
  level,
  color,
}: {
  box: { left: number; top: number; width: number; height: number };
  level: SharedValue<number>;
  color: string;
}) {
  const tubeW = Math.round(box.width * 0.34);
  const tubeH = box.height;
  const tubeX = box.left + Math.round((box.width - tubeW) / 2);
  // The tea stands *inside* the tube, so full is the tube less its wall at both ends — otherwise
  // a full cup draws a bar that overshoots the top of its own glass.
  const INSET = 3;
  const bore = tubeH - INSET * 2;
  const mark = INSET + Math.round(bore * MIN_FILL);
  const fill = useAnimatedStyle(() => ({ height: Math.max(0, Math.min(1, level.get())) * bore }));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: tubeX, top: box.top, width: tubeW, height: tubeH }}>
      <View style={[styles.tube, { borderRadius: tubeW / 2 }]} />
      <Animated.View
        style={[
          styles.tubeFill,
          { left: INSET, right: INSET, bottom: INSET, backgroundColor: color, borderRadius: tubeW / 2 },
          fill,
        ]}
      />
      {/* the line the order has to reach */}
      <View style={[styles.mark, { bottom: mark - 1, left: -tubeW * 0.22, right: -tubeW * 0.22 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(48,26,20,0.5)',
  },
  panel: {
    position: 'absolute',
  },
  sign: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signText: {
    fontFamily: fonts.display,
    color: '#7A4A1E',
    includeFontPadding: false,
  },
  bay: {
    position: 'absolute',
    overflow: 'hidden',
  },
  locked: {
    opacity: 0.5,
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  name: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderRadius: 5,
    backgroundColor: SHOP.plaque,
    borderWidth: 1.5,
    borderBottomWidth: 2,
    borderColor: SHOP.woodEdge,
  },
  nameText: {
    fontFamily: fonts.bold,
    color: '#6B4422',
    includeFontPadding: false,
  },
  shut: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  tube: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: SHOP.woodEdge,
    opacity: 0.9,
  },
  tubeFill: {
    position: 'absolute',
  },
  mark: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#E5534B',
  },
});
