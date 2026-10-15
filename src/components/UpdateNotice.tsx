import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { describeBuild, formatBytes, Release } from '../updates/releases';
import { UpdateState } from '../updates/useUpdate';
import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { Button } from './Button';

interface UpdateNoticeProps {
  state: UpdateState;
  onInstall: (release: Release) => void;
}

/**
 * A quiet strip on the title screen when a newer release exists. It is only ever shown between
 * days, never over a shift — installing replaces the app, and opening a browser would abandon a
 * run. Nothing is shown while the game is up to date, nor when GitHub simply could not be reached:
 * being unable to check is not news.
 */
export function UpdateNotice({ state, onInstall }: UpdateNoticeProps) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  switch (state.status) {
    case 'off':
    case 'checking':
    case 'current':
      return null;
    case 'failed':
      // A failed check is silent; a failed install is worth saying, since they asked for it.
      return state.reason === 'network' ? null : (
        <Card>
          <Text style={styles.line}>
            {state.reason === 'noFile'
              ? 'Bản mới chưa có file cho máy này.'
              : 'Chưa cài được bản mới. Thử lại sau nhé.'}
          </Text>
        </Card>
      );
    case 'downloading':
      return (
        <Card>
          <Text style={styles.title}>Đang tải bản mới…</Text>
          <Progress fraction={state.fraction} />
          <Text style={styles.note}>{Math.round(state.fraction * 100)}%</Text>
        </Card>
      );
    case 'opened':
      return (
        <Card>
          <Text style={styles.title}>
            {Platform.OS === 'android' ? 'Đang mở trình cài đặt…' : 'Đã mở trang tải bản mới'}
          </Text>
          <Text style={styles.note}>
            {Platform.OS === 'android'
              ? 'Chọn "Cài đặt" để cập nhật. Dữ liệu trong máy vẫn được giữ.'
              : 'Tải file .ipa rồi cài lại bằng Sideloadly hoặc AltStore trên máy tính.'}
          </Text>
        </Card>
      );
    case 'available': {
      const { release } = state;
      const file = Platform.OS === 'android' ? release.apk : release.ipa;
      return (
        <Card>
          <Text style={styles.title}>Có bản mới! 🎉</Text>
          <Text style={styles.note}>
            Bản {describeBuild(release)}
            {file ? ` • ${formatBytes(file.bytes)}` : ''}
          </Text>
          {/* Kept to one short line: what it means for iOS is spelled out after they tap. */}
          {Platform.OS !== 'android' && <Text style={styles.note}>iOS: phải cài lại bằng máy tính.</Text>}
          <View style={styles.row}>
            <Button
              label={Platform.OS === 'android' ? 'Cập nhật' : 'Mở trang tải'}
              onPress={() => onInstall(release)}
              style={styles.grow}
            />
            <Pressable onPress={() => setHidden(true)} accessibilityRole="button" style={styles.later}>
              <Text style={styles.laterLabel}>Để sau</Text>
            </Pressable>
          </View>
        </Card>
      );
    }
  }
}

function Card({ children }: { children: React.ReactNode }) {
  const appear = useSharedValue(0);
  // One gentle fade in, matching the title card's own entrance. No loop, nothing that pulses.
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const style = useAnimatedStyle(() => ({ opacity: appear.value }));
  return <Animated.View style={[styles.card, style]}>{children}</Animated.View>;
}

function Progress({ fraction }: { fraction: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryTint,
    borderRadius: 20,
    padding: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  line: {
    fontSize: 15,
    fontFamily: fonts.semi,
    color: colors.ink,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  grow: {
    flex: 1,
  },
  later: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  laterLabel: {
    fontSize: 15,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
