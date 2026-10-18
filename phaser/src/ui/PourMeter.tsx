import { useLayoutEffect, useRef } from 'preact/hooks';

import { useUi } from '../hooks';
import { PourMeter as MeterState, uiState } from '../ui-state';

/** Quarter marks down the track, so the bar can be read at a glance and not only by its label. */
const MARKS = [0.25, 0.5, 0.75];
/**
 * What the cup is called at the level it holds, as the top of each band. Not the quarters the marks
 * are drawn at: "Đầy" covers the brim the cup is actually drawn at. See `PourFeedback.tsx`.
 */
const LABELS = [
  { upTo: 0.02, label: 'Cạn' },
  { upTo: 0.35, label: 'Ít' },
  { upTo: 0.6, label: 'Nửa ly' },
  { upTo: 0.88, label: 'Gần đầy' },
  { upTo: 1, label: 'Đầy' },
];
const OVERFLOW = 'Tràn ly!';

/** `pourLevel` in `cupGeometry.ts`: the actual fill, clamped, with no artificial minimum. */
const pourLevel = (raw: number) => Math.max(0, Math.min(1, raw));

function pourBand(raw: number) {
  if (raw > 1) return LABELS.length;
  const fill = pourLevel(raw);
  for (let i = 0; i < LABELS.length; i++) if (fill <= LABELS[i].upTo) return i;
  return LABELS.length - 1;
}

/**
 * The small floating bar under the order card while the cup stands under a tap (`PourMeter` in
 * `PourFeedback.tsx`). It passes every touch through.
 *
 * Only its appearing, disappearing and colour are renders. The level moves every frame of a pour,
 * so it is written straight onto the fill, the edge and the track — and the label only when the
 * level crosses into another band.
 */
export function PourMeterSlot() {
  const shown = useUi((ui) => ui.meter !== null);
  const color = useUi((ui) => ui.meter?.color ?? '');
  if (!shown) return null;
  return (
    <div class="meter-float">
      <PourMeter color={color} />
    </div>
  );
}

function PourMeter({ color }: { color: string }) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const value = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    let band = -1;
    const apply = (meter: MeterState | null) => {
      if (!meter) return;
      const level = pourLevel(meter.level);
      fill.current!.style.transform = `translateX(${(level - 1) * 100}%)`;
      // The bright front of the liquid belongs to a bar still on its way; held to the end it reads
      // as a gap between the fill and the track's rounded cap.
      edge.current!.style.opacity = String(Math.max(0, Math.min(1, (1 - level) * 16)));
      track.current!.style.borderColor = meter.level > 1 ? '#D34C6A' : '#BC8E61';
      const next = pourBand(meter.level);
      if (next !== band) {
        band = next;
        const text = band >= LABELS.length ? OVERFLOW : LABELS[band].label;
        value.current!.textContent = text;
        value.current!.classList.toggle('overflow', band >= LABELS.length);
        root.current!.setAttribute('aria-valuetext', text);
      }
    };
    apply(uiState.value.meter);
    return uiState.subscribe((ui, was) => {
      if (ui.meter !== was.meter) apply(ui.meter);
    });
  }, []);

  return (
    <div ref={root} class="meter" role="progressbar" aria-label="Lượng trà trong ly">
      <div ref={track} class="meter-track">
        <div class="meter-content">
          <div ref={fill} class="meter-fill" style={{ backgroundColor: color }}>
            <div class="meter-shine" />
            <div ref={edge} class="meter-edge" />
          </div>
          {MARKS.map((mark) => (
            <div key={mark} class="meter-tick" style={{ left: `${mark * 100}%` }} />
          ))}
          <span ref={value} class="meter-value" />
        </div>
      </div>
    </div>
  );
}
