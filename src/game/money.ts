/** Game prices are whole units of 10.000 ₫, shown the way Vietnamese menus do: 40k, 300k. */
export function formatMoney(amount: number): string {
  return `${amount * 10}k`;
}
