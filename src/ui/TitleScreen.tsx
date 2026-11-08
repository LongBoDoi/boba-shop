import { useRef, useState } from 'preact/hooks';

import { useGame, useUi } from '../hooks';
import { suspendedShift } from '../game/reducer';
import { playSound } from '../sound';
import { dispatch } from '../store';
import { uiState } from '../ui-state';
import { Button } from './Button';
import { Storefront } from './Storefront';
import { storefrontBox, storefrontLayout } from './storefrontLayout';
import { useViewport } from './viewport';
import './title.css';

/** Fill the viewport with an undistorted shop; controls stay inside the safe area. */
export function TitleScreen() {
  const { width, height } = useViewport();
  const phase = useGame((state) => state.phase);
  const day = useGame((state) => state.day);
  const waiting = useGame(suspendedShift);
  const covered = useUi((state) => state.settings || state.book);
  const [greeting, setGreeting] = useState(0);
  // Hold the resume offer through App's outgoing-screen wipe, just as the old menu did.
  const offer = useRef({ day, waiting });
  if (phase === 'title') offer.current = { day, waiting };
  const { day: openDay, waiting: resuming } = offer.current;
  const layout = storefrontLayout(width,height);
  const roof = storefrontBox(layout,'roof',{x: 605,y: 0,w: 404,h: 180});
  const baker = storefrontBox(layout,'baker',{x: 600,y: 410,w: 166,h: 91});
  const greet = () => { playSound('meow'); setGreeting(Date.now()); };

  return (
    <main class={`title storefront live ${covered ? 'is-covered' : ''}`}
      aria-label="Tiệm Trà Sữa — màn hình bắt đầu">
      <h1 class="storefront-heading">Tiệm Trà Sữa</h1>
      <div class="storefront-frame">
        <Storefront width={width} height={height} paused={covered} greeting={greeting} />
        <button type="button" class="storefront-cat live cat-roof" style={roof} aria-label="Chào mèo trên mái hiên" onClick={greet} />
        <button type="button" class="storefront-cat live cat-baker" style={baker} aria-label="Chào mèo làm bánh" onClick={greet} />
        <div key={greeting} class={`storefront-hello ${greeting ? 'show' : ''}`} style={{top: roof.top+roof.height+8}} aria-live="polite">
          {greeting ? 'Meo! Mời bạn vào tiệm ♡' : ''}
        </div>
      </div>
      <button type="button" class="storefront-settings live" aria-label="Cài đặt" title="Cài đặt"
        onClick={() => { playSound('button'); uiState.set({ settings: true }); }}>
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="title-gear" x1="0" y1="0" x2="1" y2="1">
              <stop stop-color="#B7C4CA" /><stop offset=".48" stop-color="#7E919D" /><stop offset="1" stop-color="#566975" />
            </linearGradient>
          </defs>
          <path d="m27 5 10 0 1.3 7 4 1.7 6-4 7 7-4 6 1.7 4L60 28v9l-7 1.3-1.7 4 4 6-7 7-6-4-4 1.7L37 60H27l-1.3-7-4-1.7-6 4-7-7 4-6-1.7-4L4 37v-9l7-1.3 1.7-4-4-6 7-7 6 4 4-1.7Z"
            fill="url(#title-gear)" stroke="#53636D" stroke-width="2" stroke-linejoin="round" />
          <circle cx="32" cy="32" r="17" fill="#758995" stroke="#CAD4D8" stroke-width="3" />
          <circle cx="32" cy="32" r="10" fill="#F7F4E9" stroke="#506570" stroke-width="4" />
          <path d="M20 18a19 19 0 0 1 25 2" fill="none" stroke="#E2E6E4" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <div class="storefront-actions">
        <Button class={`storefront-start ${resuming || openDay > 1 ? 'has-day' : ''}`} label={resuming || openDay > 1 ? `Ngày ${openDay}` : 'Bắt đầu'}
          onPress={() => dispatch(resuming ? { type: 'RESUME_DAY' } : { type: 'START_DAY', day: openDay })} />
      </div>
      <button type="button" class="storefront-book live" onClick={() => { playSound('button'); uiState.set({ book: true }); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" /><path d="M12 5v15M5 8h4M5 11h4M15 8h4M15 11h4" />
        </svg>
        Sổ khách
      </button>
    </main>
  );
}
