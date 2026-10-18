import { playSound } from '../sound';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  class?: string;
}

/**
 * The game's one button (`Button.tsx`). Every press plays the same cue, here rather than at the
 * call sites, so no screen can forget it — and on the title screen it is the press of "Mở cửa tiệm"
 * that unlocks the browser's audio, so that press is itself heard.
 */
export function Button({ label, onPress, variant = 'primary', disabled, class: cls = '' }: ButtonProps) {
  return (
    <button
      type="button"
      class={`btn btn-${variant} live ${cls}`}
      disabled={disabled}
      onClick={() => {
        playSound('button');
        onPress();
      }}
    >
      <span class="btn-label">{label}</span>
    </button>
  );
}
