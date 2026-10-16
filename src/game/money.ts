/**
 * Game prices are whole units of 10.000 ₫, shown the way Vietnamese menus and price lists do: 40k,
 * 300k, 3.180k.
 *
 * The grouping is not decoration. A drink costs eight units and a tip is one, so nothing used to
 * reach four digits — but the shop's till now keeps everything it has ever earned, and a week's
 * trade reads as `3180k` without it. The separator is a dot, as Vietnamese writes it, and it is
 * done by hand rather than through `toLocaleString`: the locale data behind that is the one thing
 * here that a phone's JavaScript engine may not have.
 */
export function formatMoney(amount: number): string {
  return `${group(amount * 10)}k`;
}

function group(thousands: number): string {
  return String(thousands).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
