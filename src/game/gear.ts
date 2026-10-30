/**
 * What the shop can buy with its till, one purchase each, on the day-end card. There are no running
 * fees and no resale: both were more bookkeeping than the game has any use for.
 *
 * What an item does is read from `state.gear` where it happens, never through `DayConfig`: the config
 * is `getDayConfig(day)` and nothing else, so that a save always comes back on today's numbers.
 */
export interface GearItem {
  id: string;
  name: string;
  /** In whole units of money, like every price. A till reaches several thousand within a month. */
  price: number;
  blurb: string;
}

export const GEAR: GearItem[] = [
  { id: 'plant', name: 'Chậu cây', price: 200, blurb: 'Một chậu cây lớn đứng ngay cạnh quầy.' },
  { id: 'lantern', name: 'Đèn lồng', price: 400, blurb: 'Một chiếc đèn lồng đỏ treo giữa tiệm.' },
  { id: 'bench', name: 'Băng ghế chờ', price: 800, blurb: 'Khách đợi ngoài cửa chờ được lâu hơn.' },
  { id: 'board', name: 'Bảng gọi món', price: 1500, blurb: 'Khách ở chỗ đầu quầy tự gọi món, không cần ra nhận order.' },
];

/** Every id a shop can own. A save naming anything else named something this build lacks. */
export const GEAR_IDS = GEAR.map((item) => item.id);

/** The spot at the counter the order board stands at. */
export const BOARD_SLOT = 0;

export function gearItem(id: string): GearItem | undefined {
  return GEAR.find((item) => item.id === id);
}
