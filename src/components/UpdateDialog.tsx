import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { timing } from '../motion';
import { colors, fonts } from '../theme';
import { NewBuild } from '../updates/useNewBuild';
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
              {/* A card over the whole screen that takes every touch must always have a way off
                  it. Without this one, a download that stalled left the game unusable until the
                  app was force-stopped — the update gives up on its own eventually, but a player
                  staring at a bar that has not moved should not have to wait for it. */}
              <Button label="Để sau" variant="secondary" onPress={update.dismiss} style={styles.action} />
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

/**
 * The *other* new version: the one that has to be installed rather than downloaded into place.
 *
 * It is the same card as above, deliberately, because to the player it is the same question. What
 * differs is the honest answer underneath it, and that is not the same on the two platforms:
 *
 * - On Android the app really can install it, and because every release is signed with the same
 *   keystore it goes over the top as an update — so the shop is kept, and the card says so.
 * - On iOS no app can install an `.ipa`, so the only thing on offer is the download page. The
 *   re-signing that follows is usually a fresh install, which takes the shop with it, so this is
 *   the one place in the game that tells the player to make a backup **first**. Saying "your shop
 *   is kept" on both platforms would have been one sentence of comfort and a lost week.
 */
export function NewBuildDialog({ build }: { build: NewBuild }) {
  const appear = useSharedValue(0);
  useEffect(() => {
    appear.value = withTiming(1, timing());
  }, [appear]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: appear.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [{ scale: 0.96 + appear.value * 0.04 }],
  }));
  const working = build.status === 'downloading' || build.status === 'installing';
  const size = build.megabytes > 0 ? ` (${build.megabytes} MB)` : '';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, dimStyle]} />
      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.mark}>🧋</Text>
          <Text style={styles.title}>{working ? 'Đang cài bản mới' : 'Cần cài lại app'}</Text>

          {build.status === 'offered' && (
            <>
              <Text style={styles.note}>
                Bản {build.version} đổi phần gốc của app, nên bản cập nhật trong game không mang
                theo được — phải cài lại một lần.
              </Text>
              {build.canInstall ? (
                <>
                  <Text style={styles.note}>Cài đè lên bản cũ — tiệm của bạn vẫn được giữ nguyên.</Text>
                  <Button label={`Tải & cài đặt${size}`} onPress={build.accept} style={styles.action} />
                </>
              ) : (
                <>
                  <Text style={styles.note}>
                    iOS không cho app tự cài. Hãy sao lưu tiệm trong ⚙️ Cài đặt trước, rồi mở
                    trang tải.
                  </Text>
                  <Button label="Mở trang tải" onPress={build.accept} style={styles.action} />
                </>
              )}
              <Button label="Để sau" variant="secondary" onPress={build.dismiss} />
            </>
          )}

          {build.status === 'downloading' && (
            <>
              <Text style={styles.note}>Đang tải bản {build.version}…{size}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(clamp(build.progress) * 100)}%` }]} />
              </View>
              {/* A 95 MB download on a phone connection is the longest wait in the game, and this
                  card takes every touch — so it keeps a way off itself throughout. */}
              <Button label="Để sau" variant="secondary" onPress={build.dismiss} style={styles.action} />
            </>
          )}

          {build.status === 'installing' && (
            <Text style={styles.note}>Đang mở trình cài đặt — chọn “Cài đặt” để tiếp tục.</Text>
          )}

          {build.status === 'failed' && (
            <>
              <Text style={styles.note}>Chưa tải được bản mới. Thử lại lần sau nhé.</Text>
              <Button label="Đóng" variant="secondary" onPress={build.dismiss} style={styles.action} />
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
