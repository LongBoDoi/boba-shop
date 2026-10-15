import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { Update } from '../updates/useUpdate';
import { Button } from './Button';

/**
 * The new version, offered over whatever is on screen.
 *
 * It is a dialog rather than a card on the menu because the answer is the player's and the
 * question only comes up once a launch: it is asked wherever they happen to be, it takes the
 * screen until it is answered, and "Để sau" puts it away until the next time the game is opened.
 *
 * Accepting restarts the app. That is said out loud — along with the fact that the shop is kept —
 * because a game restarting itself unannounced looks like a crash.
 */
export function UpdateDialog({ update }: { update: Update }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.96 + appear.value * 0.04 }],
  }));
  const working = update.status === 'downloading' || update.status === 'applying';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, dimStyle]} />
      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.mark}>🧋</Text>
          <Text style={styles.title}>{working ? 'Đang cập nhật' : 'Có bản mới!'}</Text>

          {update.status === 'offered' && (
            <>
              <Text style={styles.note}>
                Bản mới tải thẳng vào game, không cần cài lại app.
                {update.publishedAt ? ` Phát hành ${asDate(update.publishedAt)}.` : ''}
              </Text>
              <Text style={styles.note}>Game sẽ khởi động lại — tiệm của bạn vẫn được giữ nguyên.</Text>
              <Button label="Cập nhật ngay" onPress={update.accept} style={styles.action} />
              <Button label="Để sau" variant="secondary" onPress={update.dismiss} />
            </>
          )}

          {update.status === 'downloading' && (
            <>
              <Text style={styles.note}>Đang tải bản mới…</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(clamp(update.progress) * 100)}%` }]} />
              </View>
            </>
          )}

          {update.status === 'applying' && <Text style={styles.note}>Đang khởi động lại…</Text>}

          {update.status === 'failed' && (
            <>
              <Text style={styles.note}>Chưa tải được bản mới. Thử lại lần sau nhé.</Text>
              <Button label="Đóng" variant="secondary" onPress={update.dismiss} style={styles.action} />
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

/** `15/10/2025`, the way Vietnamese writes a date — and without asking Hermes for Intl. */
function asDate(when: Date): string {
  return `${when.getDate()}/${when.getMonth() + 1}/${when.getFullYear()}`;
}

function clamp(fraction: number): number {
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
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
  mark: {
    fontSize: 40,
    lineHeight: 48,
    textAlign: 'center',
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.display,
    color: colors.ink,
    textAlign: 'center',
  },
  note: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  action: {
    marginTop: 4,
  },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    marginTop: 2,
  },
  fill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
});
