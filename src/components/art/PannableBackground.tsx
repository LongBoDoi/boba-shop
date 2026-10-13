import { memo, useCallback, useRef } from 'react';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, View } from 'react-native';

interface PannableBackgroundProps {
  source: ImageSourcePropType;
  imageWidth: number;
  imageHeight: number;
  width: number;
  height: number;
}

/** A full-height painting that scrolls independently of the equipment standing in front of it. */
export const PannableBackground = memo(function PannableBackground({
  source,
  imageWidth,
  imageHeight,
  width,
  height,
}: PannableBackgroundProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const drawnWidth = imageWidth * scale;
  const drawnHeight = imageHeight * scale;
  const maxOffset = Math.max(0, drawnWidth - width);
  const top = (height - drawnHeight) / 2;

  // Start at the middle, including on web where contentOffset isn't supported. Recenter when
  // the viewport changes size; ordinary game updates leave the player's scroll position alone.
  const center = useCallback(() => {
    scrollRef.current?.scrollTo({ x: maxOffset / 2, y: 0, animated: false });
  }, [maxOffset]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={StyleSheet.absoluteFill}
      contentOffset={{ x: maxOffset / 2, y: 0 }}
      onLayout={center}
      onContentSizeChange={center}
      scrollEnabled={maxOffset > 0}
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
        <Image
          source={source}
          resizeMode="stretch"
          style={{ position: 'absolute', top, width: drawnWidth, height: drawnHeight }}
        />
      </View>
    </ScrollView>
  );
});
