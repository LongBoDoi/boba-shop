import { memo, ReactNode, useCallback, useRef } from 'react';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';

interface PannableBackgroundProps {
  children?: ReactNode;
  source: ImageSourcePropType;
  imageWidth: number;
  imageHeight: number;
  width: number;
  height: number;
  offset: SharedValue<number>;
  scrollEnabled?: boolean;
  onPanBegin: () => void;
}

/** Shared projection for the painting and objects anchored to its horizontal surfaces. */
export function fitBackground(width: number, height: number, imageWidth: number, imageHeight: number) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;
  return { scale, drawnWidth, drawnHeight, top: (height - drawnHeight) / 2 };
}

/** Scenery and its mounted equipment share one native scrolling content view. */
export const PannableBackground = memo(function PannableBackground({
  children,
  source,
  imageWidth,
  imageHeight,
  width,
  height,
  offset,
  scrollEnabled = true,
  onPanBegin,
}: PannableBackgroundProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { drawnWidth, drawnHeight, top } = fitBackground(width, height, imageWidth, imageHeight);
  const maxOffset = Math.max(0, drawnWidth - width);

  // Start at the left-hand tea shelf. Ordinary game updates keep the player's pan position.
  const resetView = useCallback(() => {
    onPanBegin();
    offset.set(0);
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [offset, onPanBegin]);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.set(Math.max(0, Math.min(maxOffset, event.contentOffset.x)));
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      style={StyleSheet.absoluteFill}
      contentOffset={{ x: 0, y: 0 }}
      onLayout={resetView}
      onContentSizeChange={resetView}
      scrollEnabled={scrollEnabled && maxOffset > 0}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onScrollBeginDrag={onPanBegin}
      bounces={false}
      alwaysBounceHorizontal={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      accessibilityLabel="Khung cảnh tiệm trà sữa"
      accessibilityHint="Vuốt sang trái hoặc phải để xem quanh tiệm"
    >
      <View style={{ width: drawnWidth, height, overflow: 'hidden' }}>
        <View style={StyleSheet.absoluteFill} onTouchStart={onPanBegin}>
          <Image
            source={source}
            resizeMode="stretch"
            style={{ position: 'absolute', top, width: drawnWidth, height: drawnHeight }}
          />
        </View>
        {children}
      </View>
    </Animated.ScrollView>
  );
});
