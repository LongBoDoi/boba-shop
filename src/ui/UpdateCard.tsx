import { useUi } from '../hooks';
import { UpdateOffer } from '../updates';
import { Button } from './Button';

/**
 * "There is a new version" — the one card for both kinds, deliberately, because to the player it
 * is the same question. What differs is the honest answer underneath it.
 *
 * It is over every screen rather than a row on the menu, because the question comes up once a
 * launch wherever the player happens to be, and `App.tsx` holds it back while a shift is actually
 * running so an unasked-for question cannot drain three patience timers while it is read.
 *
 * **Every state has a way off it.** The card covers the screen and takes every touch, so a
 * download that stalls on a bad connection would otherwise leave the player holding a picture of a
 * boba shop — a complete freeze as far as they are concerned, and one that a browser will never
 * show you, because none of this runs there.
 */
export function UpdateCard() {
  const offer = useUi((ui) => ui.update);
  if (!offer) return null;
  return offer.kind === 'live' ? <LiveCard offer={offer} /> : <NewFileCard offer={offer} />;
}

function Frame({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <div class="overlay live">
      <div class="overlay-dim overlay-dim-in" />
      <div class="overlay-center">
        <div class="update-card card-in">
          <div class="update-mark">🧋</div>
          <div class="card-title">{title}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * What actually went wrong, under the apology.
 *
 * It is the one place in the game that shows text nobody wrote in Vietnamese, because it is not
 * for reading — it is for repeating to whoever can fix it. A failure the player cannot describe
 * is a failure that costs a whole build to find out about, which is exactly what happened here.
 */
function Reason({ reason }: { reason: string }) {
  if (!reason) return null;
  return <p class="update-reason">{reason}</p>;
}

function Bar({ progress }: { progress: number }) {
  return (
    <div class="update-track">
      <div class="update-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
    </div>
  );
}

function LiveCard({ offer }: { offer: UpdateOffer }) {
  const working = offer.status === 'downloading' || offer.status === 'applying';
  return (
    <Frame title={working ? 'Đang cập nhật' : 'Có bản mới!'}>
      {offer.status === 'offered' && (
        <>
          <p class="update-note">Bản mới tải thẳng vào game, không cần cài lại app.</p>
          <p class="update-note">Game sẽ khởi động lại — tiệm của bạn vẫn được giữ nguyên.</p>
          <Button label="Cập nhật ngay" onPress={offer.accept} />
          <Button label="Để sau" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
      {offer.status === 'downloading' && (
        <>
          <p class="update-note">Đang tải bản mới…</p>
          <Bar progress={offer.progress} />
          <Button label="Để sau" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
      {offer.status === 'applying' && <p class="update-note">Đang khởi động lại…</p>}
      {offer.status === 'failed' && (
        <>
          <p class="update-note">Chưa tải được bản mới. Thử lại lần sau nhé.</p>
          <Reason reason={offer.reason} />
          <Button label="Đóng" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
    </Frame>
  );
}

/**
 * The *other* new version: the one that has to be installed rather than downloaded into place.
 *
 * - On Android the app really can install it, and because every release is signed with the same
 *   key it goes over the top as an update — so the shop is kept, and the card says so.
 * - On iOS no app can install an `.ipa`, so the only thing on offer is the download page. The
 *   re-signing that follows is usually a fresh install, which takes the shop with it, so this is
 *   the one place in the game that tells the player to make a backup **first**. Saying "your shop
 *   is kept" on both platforms would have been one sentence of comfort and a lost week.
 */
function NewFileCard({ offer }: { offer: UpdateOffer }) {
  const working = offer.status === 'downloading' || offer.status === 'applying';
  const size = offer.megabytes > 0 ? ` (${offer.megabytes} MB)` : '';
  return (
    <Frame title={working ? 'Đang cài bản mới' : 'Cần cài lại app'}>
      {offer.status === 'offered' && (
        <>
          <p class="update-note">
            Bản {offer.version} đổi phần gốc của app, nên bản cập nhật trong game không mang theo
            được — phải cài lại một lần.
          </p>
          {offer.canInstall ? (
            <>
              <p class="update-note">Cài đè lên bản cũ — tiệm của bạn vẫn được giữ nguyên.</p>
              <Button label={`Tải & cài đặt${size}`} onPress={offer.accept} />
            </>
          ) : (
            <>
              <p class="update-note">
                iOS không cho app tự cài. Hãy sao lưu tiệm trong ⚙️ Cài đặt trước, rồi mở trang tải.
              </p>
              <Button label="Mở trang tải" onPress={offer.accept} />
            </>
          )}
          <Button label="Để sau" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
      {offer.status === 'downloading' && (
        <>
          <p class="update-note">Đang tải bản cài đặt…</p>
          <Bar progress={offer.progress} />
          <Button label="Để sau" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
      {offer.status === 'applying' && <p class="update-note">Làm theo hướng dẫn cài đặt của máy nhé.</p>}
      {offer.status === 'failed' && (
        <>
          <p class="update-note">Chưa tải được bản cài đặt. Thử lại lần sau nhé.</p>
          <Reason reason={offer.reason} />
          <Button label="Đóng" variant="secondary" onPress={offer.dismiss} />
        </>
      )}
    </Frame>
  );
}
