import { useState } from 'preact/hooks';

import { shallow, useGame } from '../hooks';
import { playSound } from '../sound';
import { dispatch, store } from '../store';
import { uiState } from '../ui-state';
import { GameMode } from '../game/reducer';
import { decodeSaveCode, encodeSaveCode } from '../game/saveCode';
import { Button } from './Button';

/** The modes, in the order they are offered. */
const MODES: { id: GameMode; label: string; note: string }[] = [
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
 * The volumes as four labelled steps rather than a slider: read at a glance, hit with a thumb,
 * never left at an awkward 3%. A saved level in between two is shown as the nearest.
 */
const LEVELS: { level: number; label: string }[] = [
  { level: 0, label: 'Tắt' },
  { level: 0.35, label: 'Nhỏ' },
  { level: 0.7, label: 'Vừa' },
  { level: 1, label: 'Lớn' },
];

/**
 * A card over whatever screen opened it (`SettingsSheet.tsx`): the game mode, how loud the shop
 * is, the backup code, and a way back. It scrolls — sideways on a short phone the sound section
 * and the button out of it would otherwise fall off the bottom.
 */
export function SettingsSheet() {
  const { mode, audio } = useGame((state) => ({ mode: state.mode, audio: state.audio }), shallow);
  const close = () => uiState.set({ settings: false });

  return (
    <div class="overlay live">
      <div class="overlay-dim overlay-dim-in" />
      <div class="overlay-center settings-center">
        <div class="settings-card card-in">
          <div class="settings-inner">
            <div class="card-title">Cài đặt</div>
            <div class="settings-section">Chế độ chơi</div>
            {MODES.map((option) => {
              const chosen = option.id === mode;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={option.label}
                  class={`settings-row ${chosen ? 'chosen' : ''}`}
                  onClick={() => dispatch({ type: 'SET_MODE', mode: option.id })}
                >
                  <span class={`settings-mark ${chosen ? 'chosen' : ''}`}>{chosen && <span class="settings-dot" />}</span>
                  <span class="settings-row-text">
                    <span class="settings-row-label">{option.label}</span>
                    <span class="settings-row-note">{option.note}</span>
                  </span>
                </button>
              );
            })}
            <div class="settings-section">Âm thanh</div>
            <VolumeRow label="Nhạc nền" level={audio.music} onChange={(music) => dispatch({ type: 'SET_AUDIO', audio: { music } })} />
            <VolumeRow label="Hiệu ứng" level={audio.sfx} onChange={(sfx) => dispatch({ type: 'SET_AUDIO', audio: { sfx } })} />
            <div class="settings-section">Sao lưu tiệm</div>
            <Backup />
            <Button label="Xong" onPress={close} class="settings-done" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One volume. Changing the effects volume plays a tap at the new level, so the player hears what
 * they chose; the music is already playing and follows the change straight away.
 */
function VolumeRow({ label, level, onChange }: { label: string; level: number; onChange: (level: number) => void }) {
  const chosen = LEVELS.reduce(
    (best, step, index) => {
      const gap = Math.abs(step.level - level);
      return gap < best.gap ? { index, gap } : best;
    },
    { index: 0, gap: Number.POSITIVE_INFINITY },
  ).index;
  return (
    <div class="settings-volume">
      <div class="settings-volume-label">{label}</div>
      <div class="settings-steps" role="radiogroup" aria-label={label}>
        {LEVELS.map((step, index) => (
          <button
            key={step.label}
            type="button"
            role="radio"
            aria-checked={index === chosen}
            aria-label={`${label}: ${step.label}`}
            class={`settings-step ${index === chosen ? 'chosen' : ''}`}
            onClick={() => {
              onChange(step.level);
              // After the change, so it is heard at the level just chosen rather than the old one.
              if (step.level > 0) playSound('tap');
            }}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The shop as a line of text the player keeps. The code is a read-only text box, so copying it is
 * the browser's own job (select, copy) — `styles.css` lets text boxes be selected on a page that
 * otherwise refuses selection. Restoring asks twice: it replaces the whole shop, a shift in
 * progress included, and a mis-paste cannot be undone.
 */
function Backup() {
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
    const restored = decodeSaveCode(pasted);
    if (restored) dispatch({ type: 'RESTORE', state: restored });
    // A refusal has to be visible: a truncated code looks exactly like one that worked.
    setSaid(restored ? 'Đã phục hồi tiệm ✓' : 'Mã không đúng hoặc bị thiếu.');
  };

  return (
    <div class="settings-backup">
      <div class="settings-note">Cài lại app có thể làm mất tiệm. Lưu mã này ra chỗ khác để phục hồi sau.</div>
      {code === null ? (
        <Button label="Hiện mã lưu" variant="secondary" onPress={() => setCode(encodeSaveCode(store.state))} />
      ) : (
        <textarea
          class="settings-code live"
          value={code}
          readOnly
          spellcheck={false}
          aria-label="Mã lưu tiệm — giữ để chọn và sao chép"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      <textarea
        class="settings-paste live"
        value={pasted}
        placeholder="Dán mã lưu vào đây…"
        autocapitalize="none"
        autocomplete="off"
        spellcheck={false}
        aria-label="Dán mã lưu để phục hồi tiệm"
        onInput={(event) => {
          const box = event.currentTarget;
          // Grows with what is pasted, between one line and a few, as the multiline input did.
          box.style.height = 'auto';
          box.style.height = `${Math.max(44, Math.min(90, box.scrollHeight + 4))}px`;
          setPasted(box.value);
          setArming(false);
          setSaid(null);
        }}
      />
      {pasted.trim().length > 0 && (
        <Button
          label={arming ? 'Chắc chưa? Ghi đè tiệm hiện tại' : 'Phục hồi từ mã'}
          variant="secondary"
          onPress={restore}
        />
      )}
      {said && <div class="settings-note">{said}</div>}
    </div>
  );
}
