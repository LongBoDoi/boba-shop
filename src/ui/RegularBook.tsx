import { useMemo } from 'preact/hooks';

import { characterSvg } from '../art/character';
import { useGame } from '../hooks';
import { uiState } from '../ui-state';
import { EMPTY_DRINK } from '../game/ingredients';
import { DayConfig } from '../game/levels';
import { Regular, REGULARS, RegularMemory, usualHidden } from '../game/regulars';
import { Button } from './Button';
import { ChipTile, chipsFor } from './OrderBubble';
import { Svg } from './Svg';

const FACE = 44;
const TILE = 40;

/**
 * Sổ khách (`RegularBook.tsx`): who the shop has met, and what they have. A player who has been away
 * a week meets faces they cannot place, so this is what keeps remembering a pleasure and not a test.
 *
 * It opens from the menu and the day-end card and **not from the pause card**, where the clock is
 * stopped and a look would be free. A shift can wait at the menu too, so whoever is standing in it
 * on a usual, or is still to come in it, has that usual kept back here (`usualHidden`).
 */
export function RegularBook() {
  const regulars = useGame((state) => state.regulars);
  const config = useGame((state) => state.config);
  return (
    <div class="overlay live">
      <div class="overlay-dim overlay-dim-in" />
      <div class="overlay-center settings-center">
        <div class="settings-card card-in">
          <div class="settings-inner">
            <div class="card-title">Sổ khách</div>
            {REGULARS.map((regular) => (
              <BookEntry key={regular.id} regular={regular} memory={regulars[regular.id]} config={config} />
            ))}
            <Button label="Xong" onPress={() => uiState.set({ book: false })} class="settings-done" />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookEntry({ regular, memory, config }: { regular: Regular; memory: RegularMemory | undefined; config: DayConfig }) {
  const waiting = useGame((state) => usualHidden(state, regular.id));
  const face = useMemo(() => characterSvg(regular.look, { mood: 'happy', width: FACE * 0.92, headOnly: true }), [regular.look]);
  if (!memory) {
    return (
      <div class="book-entry">
        <div class="book-head">
          <div class="book-face"><span class="book-unknown" aria-hidden="true">?</span></div>
          <div class="book-text"><div class="book-name">Chưa gặp</div></div>
        </div>
      </div>
    );
  }
  return (
    <div class="book-entry">
      <div class="book-head">
        <div class="book-face"><Svg markup={face} /></div>
        <div class="book-text">
          <div class="book-name">{regular.name}</div>
          <div class="book-note">{`Đã phục vụ ${memory.visits} lần · đúng liền ${memory.streak} lần`}</div>
        </div>
      </div>
      {waiting ? (
        <div class="book-note">Ca đang dở — tự nhớ nhé!</div>
      ) : (
        <div class="book-usual">
          {chipsFor(memory.usual, EMPTY_DRINK, config).map((chip) => (
            <ChipTile key={chip.key} chip={chip} width={TILE} tile={TILE} listed />
          ))}
        </div>
      )}
    </div>
  );
}
