import type { Customer } from '../game/reducer';

/** Restored saves may reuse an id for a different appearance. */
export function ownerOf(customer: Customer): string {
  const { skin, hair, hairStyle, shirt, accessory } = customer.look;
  return `c:${customer.id}:${skin}${hair}${hairStyle}${shirt}${accessory}`;
}
