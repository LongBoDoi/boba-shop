import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { Tone } from '../game/reducer';

// Browser vibration is unreliable and needs permission, so haptics are phone-only.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapHaptic() {
  if (enabled) Haptics.selectionAsync().catch(() => {});
}

export function toneHaptic(tone: Tone) {
  if (!enabled) return;
  const type =
    tone === 'good'
      ? Haptics.NotificationFeedbackType.Success
      : tone === 'ok'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(type).catch(() => {});
}
