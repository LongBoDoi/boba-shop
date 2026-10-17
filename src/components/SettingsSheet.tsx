import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { playSound } from '../audio/audio';
import { AudioSettings, GameMode } from '../game/reducer';
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

/**
 * The volumes this card offers, as four labelled steps rather than a slider.
 *
 * A slider would be a new gesture built out of `PanResponder`, in a game where every other
 * gesture is a drag of something painted; four steps are read at a glance, hit reliably with a
 * thumb, and cannot be left at an awkward 3%. The game itself takes any level between 0 and 1
 * (`clampAudio`), so these are this card's offer and not a rule — a save holding something in
 * between is shown as the nearest one rather than being rounded off behind the player's back.
 */
const LEVELS: { level: number; label: string }[] = [
  { level: 0, label: 'Tắt' },
  { level: 0.35, label: 'Nhỏ' },
  { level: 0.7, label: 'Vừa' },
  { level: 1, label: 'Lớn' },
];

interface SettingsSheetProps {
  mode: GameMode;
  onChangeMode: (mode: GameMode) => void;
  audio: AudioSettings;
  onChangeAudio: (audio: Partial<AudioSettings>) => void;
  /**
   * The shop as a backup code, and a pasted one back.
   *
   * Passed as two closures rather than as the state and a dispatch, so this card never has to
   * know what a `GameState` is — and so the code is only built when the player actually asks for
   * one, which matters because building it serialises the whole shop.
   */
  onExport: () => string;
  /** True if the code was a shop. False is shown as a refusal, not swallowed. */
  onImport: (code: string) => boolean;
  onClose: () => void;
}

/**
 * A card over whatever screen opened it: the game mode, how loud the shop is, and a way back.
 *
 * **It scrolls.** It did not need to while the mode was the only setting, and two volume rows is
 * what tips it over: the card is centred in the window with no slack, and sideways on a short
 * phone the whole of the sound section — and the button out of it — fell off the bottom.
 */
export function SettingsSheet({ mode, onChangeMode, audio, onChangeAudio, onExport, onImport, onClose }: SettingsSheetProps) {
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
          <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} bounces={false}>
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
            <Text style={styles.section}>Âm thanh</Text>
            <VolumeRow label="Nhạc nền" level={audio.music} onChange={(music) => onChangeAudio({ music })} />
            <VolumeRow label="Hiệu ứng" level={audio.sfx} onChange={(sfx) => onChangeAudio({ sfx })} />
            <Text style={styles.section}>Sao lưu tiệm</Text>
            <Backup onExport={onExport} onImport={onImport} />
            <Button label="Xong" onPress={onClose} style={styles.done} />
          </ScrollView>
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

/**
 * One volume, as four steps rather than a slider.
 *
 * Each step previews itself on the way past: changing the effects volume plays a tap at the new
 * level, so the player hears what they are choosing instead of setting a number and going back to
 * the game to find out. The music needs no preview — it is already playing, and `setAudioSettings`
 * follows the finger straight away rather than fading, for exactly this reason.
 */
function VolumeRow({
  label,
  level,
  onChange,
}: {
  label: string;
  level: number;
  onChange: (level: number) => void;
}) {
  // Whichever step is nearest: a save, or an older build, can hold a level between two of them.
  const chosen = LEVELS.reduce(
    (best, step, index) => {
      const gap = Math.abs(step.level - level);
      return gap < best.gap ? { index, gap } : best;
    },
    { index: 0, gap: Number.POSITIVE_INFINITY },
  ).index;
  return (
    <View style={styles.volume}>
      <Text style={styles.volumeLabel}>{label}</Text>
      <View style={styles.steps}>
        {LEVELS.map((step, index) => (
          <Pressable
            key={step.label}
            onPress={() => {
              onChange(step.level);
              // After the change, so it is heard at the level just chosen rather than the old one.
              if (step.level > 0) playSound('tap');
            }}
            style={[styles.step, index === chosen && styles.stepChosen]}
            accessibilityRole="radio"
            accessibilityState={{ selected: index === chosen }}
            accessibilityLabel={`${label}: ${step.label}`}
            hitSlop={4}
          >
            <Text style={[styles.stepLabel, index === chosen && styles.stepLabelChosen]}>{step.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The shop, as a line of text the player keeps.
 *
 * This is the only remedy for the one thing the game cannot fix from inside itself. An Android
 * update installed over the top keeps its data and needs none of this; a true uninstall does not,
 * and on iOS a build re-signed with Sideloadly is a fresh install every time. A code costs no
 * account, no server and no paid developer programme.
 *
 * Two things about how it is presented:
 *
 * - **It is a `TextInput`, not a label.** Copying is the operating system's own job — long-press,
 *   select all, copy — and a clipboard module would be another native dependency for a button.
 *   The box starts collapsed because it is several kilobytes of base64 and would otherwise be the
 *   tallest thing on the card.
 * - **Restoring asks twice.** It replaces the whole shop, including a shift in progress, and a
 *   mis-paste is not undoable. So the button arms, says what it is about to do, and only then
 *   does it.
 */
function Backup({ onExport, onImport }: { onExport: () => string; onImport: (code: string) => boolean }) {
  const [code, setCode] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [arming, setArming] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const restore = () => {
    if (!arming) {
      setArming(true);
      setSaid(null);
      return;
    }
    setArming(false);
    // A refusal has to be visible: a code that lost its tail in a chat window looks exactly like
    // a code that worked, right up until the shop that comes back is the wrong one.
    setSaid(onImport(pasted) ? 'Đã phục hồi tiệm ✓' : 'Mã không đúng hoặc bị thiếu.');
  };

  return (
    <View style={styles.backup}>
      <Text style={styles.backupNote}>
        Cài lại app có thể làm mất tiệm. Lưu mã này ra chỗ khác để phục hồi sau.
      </Text>
      {code === null ? (
        <Button label="Hiện mã lưu" variant="secondary" onPress={() => setCode(onExport())} />
      ) : (
        <TextInput
          style={styles.code}
          value={code}
          editable={false}
          multiline
          selectTextOnFocus
          accessibilityLabel="Mã lưu tiệm — giữ để chọn và sao chép"
        />
      )}
      <TextInput
        style={styles.paste}
        value={pasted}
        onChangeText={(text) => {
          setPasted(text);
          setArming(false);
          setSaid(null);
        }}
        placeholder="Dán mã lưu vào đây…"
        placeholderTextColor={colors.inkSoft}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Dán mã lưu để phục hồi tiệm"
      />
      {pasted.trim().length > 0 && (
        <Button
          label={arming ? 'Chắc chưa? Ghi đè tiệm hiện tại' : 'Phục hồi từ mã'}
          variant="secondary"
          onPress={restore}
        />
      )}
      {said && <Text style={styles.backupNote}>{said}</Text>}
    </View>
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
    maxHeight: '100%',
    borderRadius: 24,
    backgroundColor: colors.floor,
    borderBottomWidth: 6,
    borderBottomColor: colors.line,
  },
  inner: {
    gap: 10,
    padding: 20,
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
  backup: {
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
  },
  backupNote: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  code: {
    maxHeight: 90,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.line,
    fontSize: 11,
    lineHeight: 15,
    color: colors.inkSoft,
  },
  paste: {
    minHeight: 44,
    maxHeight: 90,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.line,
    fontSize: 11,
    lineHeight: 15,
    color: colors.ink,
  },
  volume: {
    gap: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
  },
  volumeLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  steps: {
    flexDirection: 'row',
    gap: 6,
  },
  step: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.line,
  },
  stepChosen: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  stepLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.semi,
    color: colors.inkSoft,
  },
  stepLabelChosen: {
    fontFamily: fonts.bold,
    color: colors.primaryDark,
  },
});
