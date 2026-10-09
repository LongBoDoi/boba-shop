import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GameMode } from '../game/reducer';
import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { Button } from './Button';

/** The modes, in the order they are offered. */
export const MODES: { id: GameMode; label: string; note: string }[] = [
  {
    id: 'standard',
    label: 'Tiêu chuẩn',
    note: 'Ra quầy nhận order từng khách, khách mới tới sau một lúc.',
  },
  {
    id: 'relaxed',
    label: 'Tự động nhận order',
    note: 'Order tự được nhận, khách mới tới ngay — chỉ việc pha chế.',
  },
];

interface SettingsSheetProps {
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
  onClose: () => void;
}

/** A card over whatever screen opened it: the game mode, and a way back. */
export function SettingsSheet({ mode, onChangeMode, onClose }: SettingsSheetProps) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.96 + appear.value * 0.04 }],
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, dimStyle]} />
      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.title}>Cài đặt</Text>
          <Text style={styles.section}>Chế độ chơi</Text>
          {MODES.map((option) => (
            <ModeRow
              key={option.id}
              label={option.label}
              note={option.note}
              chosen={option.id === mode}
              onPress={() => onChangeMode(option.id)}
            />
          ))}
          <Button label="Xong" onPress={onClose} style={styles.done} />
        </Animated.View>
      </View>
    </View>
  );
}

function ModeRow({
  label,
  note,
  chosen,
  onPress,
}: {
  label: string;
  note: string;
  chosen: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, chosen && styles.rowChosen]}
      accessibilityRole="radio"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={label}
    >
      <View style={[styles.mark, chosen && styles.markChosen]}>{chosen && <View style={styles.markDot} />}</View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, chosen && styles.rowLabelChosen]}>{label}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(43,27,23,0.45)',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.floor,
    borderBottomWidth: 6,
    borderBottomColor: colors.line,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: 'center',
  },
  section: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
  },
  rowChosen: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 2,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markChosen: {
    borderColor: colors.primary,
  },
  markDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  rowLabelChosen: {
    color: colors.primaryDark,
  },
  rowNote: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  done: {
    marginTop: 4,
  },
});
