import { StyleSheet } from 'react-native';

// Register these styles so React Native Web compiles box-none into child hit-testing rules.
export const pointerEventsStyles = StyleSheet.create({
  none: { pointerEvents: 'none' },
  boxNone: { pointerEvents: 'box-none' },
});
