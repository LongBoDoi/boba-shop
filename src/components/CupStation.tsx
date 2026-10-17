import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { playSound } from '../audio/audio';
import { CUP_SIZES, CupSize, EMPTY_DRINK } from '../game/ingredients';
import { timing } from '../motion';
import { pointerEventsStyles } from '../pointerEvents';
import { fonts } from '../theme';
import { kitchenHolderFor } from './art/KitchenRoom';
import { ROOM_BG_CUP_STATION, ROOM_BG_SIZE } from './art/kitchenArt';
import { fitBackground } from './art/PannableBackground';
import { CUP_ART, CUP_FOOT } from './cupGeometry';
import { KitchenCup } from './KitchenCup';
import { GRABBY } from './pour';

interface CupStationOptions {
  width: number;
  height: number;
  cupId: number;
  occupied: boolean;
  abort: number;
  panOffset: SharedValue<number>;
  cupSizeFor: (size: CupSize) => { width: number; height: number };
  onPickCup: (size: CupSize) => void;
  onDragging: (dragging: boolean) => void;
  onNudge: (message: string) => void;
}

/** The rack stays in the panorama; the cup lifted from it travels in screen coordinates. */
export function useCupStation(options: CupStationOptions) {
  const { width, height, cupId, abort, panOffset, onDragging } = options;
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const [held, setHeld] = useState<CupSize | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  const emptyLevel = useSharedValue(0);
  const drag = useRef({ active: false, pageX: 0, pageY: 0, x: 0, y: 0, distance: 0 });
  const { scale, top } = fitBackground(width, height, ROOM_BG_SIZE.width, ROOM_BG_SIZE.height);
  const rack = ROOM_BG_CUP_STATION;
  const holder = kitchenHolderFor(width, height);

  const cancel = useCallback(() => {
    drag.current.active = false;
    opacity.set(0);
    setHeld(null);
    onDragging(false);
  }, [opacity, onDragging]);

  useEffect(() => () => cancel(), [abort, width, height, cupId, cancel]);

  const rackNode = CUP_SIZES.map((size, index) => {
    const stackTop = [282, 249, 214][index];
    const target = {
      x: (rack.x + rack.width * index / 3) * scale,
      y: top + stackTop * scale,
      width: rack.width / 3 * scale,
      height: (rack.y + rack.height - stackTop) * scale,
    };
    const takeCup = () => {
      if (latest.current.occupied) {
        latest.current.onNudge('Đổ bỏ ly đang pha trước khi lấy ly mới');
        return;
      }
      latest.current.onPickCup(size);
      playSound('cupDown');
    };
    return (
      <View key={size} testID={`cup-stack-${size}`} {...GRABBY}
        accessible accessibilityRole="button" accessibilityLabel={`Lấy ly cỡ ${size}`}
        accessibilityHint="Kéo ly từ chồng ly lên thảm pha chế"
        accessibilityState={{ disabled: options.occupied }}
        onAccessibilityTap={takeCup}
        onResponderGrant={(event: GestureResponderEvent) => {
          if (latest.current.occupied) {
            latest.current.onNudge('Đổ bỏ ly đang pha trước khi lấy ly mới');
            playSound('nudge');
            return;
          }
          const cup = latest.current.cupSizeFor(size);
          const startX = target.x - panOffset.get() + event.nativeEvent.locationX - cup.width / 2;
          const startY = target.y + event.nativeEvent.locationY - cup.height / 2;
          drag.current = { active: true, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY,
            x: startX, y: startY, distance: 0 };
          x.set(startX);
          y.set(startY);
          opacity.set(1);
          setHeld(size);
          onDragging(true);
          playSound('cupPickup');
        }}
        onResponderMove={(event: GestureResponderEvent) => {
          if (!drag.current.active) return;
          const dx = event.nativeEvent.pageX - drag.current.pageX;
          const dy = event.nativeEvent.pageY - drag.current.pageY;
          drag.current.distance = Math.hypot(dx, dy);
          x.set(drag.current.x + dx);
          y.set(drag.current.y + dy);
        }}
        onResponderRelease={() => {
          if (!drag.current.active) return;
          drag.current.active = false;
          onDragging(false);
          const cup = latest.current.cupSizeFor(size);
          /*
           * Anywhere on the mat counts, not the middle of it. Two things make that more than a
           * bigger tolerance: the cup is tested by the point it would *stand* on — the middle of
           * its painted base ring, like `homeY` — rather than by the middle of its box, which is
           * half a cup higher up and is what used to be asked to land on a mat a third of that
           * tall; and the mat is grown by the cup's own measurements, so a cup overlapping it at
           * all is stood on it. The finger holds the cup by its box's centre, so in practice this
           * takes a drop anywhere from the work top down to the front edge of the counter — and
           * it is more forgiving than the old box-centre test on every side, which is the point.
           */
          const footX = x.get() + cup.width / 2;
          const footY = y.get() + cup.height * CUP_FOOT / CUP_ART.h;
          const padX = cup.width / 2;
          const padY = 24 + cup.height * 0.45;
          const overMat = footX >= holder.left - padX && footX <= holder.left + holder.width + padX
            && footY >= holder.top - padY && footY <= holder.top + holder.height + padY;
          if (drag.current.distance >= 8 && overMat && !latest.current.occupied) {
            opacity.set(0);
            setHeld(null);
            takeCup();
          } else {
            x.set(withTiming(drag.current.x, timing()));
            y.set(withTiming(drag.current.y, timing()));
            opacity.set(withDelay(220, withTiming(0, timing(100))));
            latest.current.onNudge('Kéo ly đúng cỡ lên thảm để bắt đầu pha');
          }
        }}
        onResponderTerminate={cancel}
        style={{ position: 'absolute', left: target.x, top: target.y,
          width: Math.max(44, target.width), height: Math.max(44, target.height) }} />
    );
  });

  const carriedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(), transform: [{ translateX: x.get() }, { translateY: y.get() }],
  }));
  const cup = options.cupSizeFor(held ?? 'M');
  const carriedCup = held && (
    <Animated.View testID="carried-empty-cup"
      style={[styles.carried, { width: cup.width, height: cup.height }, carriedStyle, pointerEventsStyles.none]}>
      <KitchenCup drink={{ ...EMPTY_DRINK, size: held }} width={cup.width} height={cup.height} level={emptyLevel} />
      <Text style={styles.size}>{held}</Text>
    </Animated.View>
  );
  return { rackNode, carriedCup };
}

const styles = StyleSheet.create({
  carried: { position: 'absolute', left: 0, top: 0 },
  size: { position: 'absolute', right: -8, top: 0, paddingHorizontal: 6,
    backgroundColor: '#FFF4DC', borderColor: '#C99F6A', borderWidth: 1, borderRadius: 5,
    color: '#795331', fontFamily: fonts.bold, fontSize: 12 },
});
