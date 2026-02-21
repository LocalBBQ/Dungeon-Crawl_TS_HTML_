/**
 * Tests for InventoryActions (pure state mutations).
 * Uses minimal PlayingStateShape where possible; relies on game registries for equip tests.
 */
import { describe, it, expect } from 'vitest';
import {
  setInventorySlot,
  getInventorySlotKey,
  swapInventorySlots,
  equipFromInventory,
  unequipToInventory,
} from '../../game/state/InventoryActions.js';
import {
  PlayingState,
  INVENTORY_SLOT_COUNT,
  MAX_WEAPON_DURABILITY,
  type WeaponInstance,
} from '../../game/state/PlayingState.js';

describe('setInventorySlot', () => {
  it('sets slot at valid index', () => {
    const ps = new PlayingState('none', 'none');
    const item: WeaponInstance = { key: 'sword_rusty', durability: 100 };
    setInventorySlot(ps, 0, item);
    expect(ps.inventorySlots![0]).toEqual(item);
    expect(getInventorySlotKey(ps, 0)).toBe('sword_rusty');
  });

  it('ignores out-of-range index', () => {
    const ps = new PlayingState('none', 'none');
    const before = [...(ps.inventorySlots || [])];
    setInventorySlot(ps, -1, { key: 'sword_rusty', durability: 100 });
    setInventorySlot(ps, INVENTORY_SLOT_COUNT, { key: 'sword_rusty', durability: 100 });
    expect(ps.inventorySlots).toEqual(before);
  });
});

describe('getInventorySlotKey', () => {
  it('returns null for empty slot', () => {
    const ps = new PlayingState('none', 'none');
    expect(getInventorySlotKey(ps, 0)).toBeNull();
  });

  it('returns key for weapon slot', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'dagger_rusty', durability: 50 });
    expect(getInventorySlotKey(ps, 0)).toBe('dagger_rusty');
  });

  it('returns null for out-of-range index', () => {
    const ps = new PlayingState('none', 'none');
    expect(getInventorySlotKey(ps, -1)).toBeNull();
    expect(getInventorySlotKey(ps, INVENTORY_SLOT_COUNT)).toBeNull();
  });
});

describe('swapInventorySlots', () => {
  it('swaps two slots', () => {
    const ps = new PlayingState('none', 'none');
    const a: WeaponInstance = { key: 'sword_rusty', durability: 100 };
    const b: WeaponInstance = { key: 'dagger_rusty', durability: 50 };
    setInventorySlot(ps, 0, a);
    setInventorySlot(ps, 1, b);
    swapInventorySlots(ps, 0, 1);
    expect(getInventorySlotKey(ps, 0)).toBe('dagger_rusty');
    expect(getInventorySlotKey(ps, 1)).toBe('sword_rusty');
  });

  it('does nothing for out-of-range indices', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'sword_rusty', durability: 100 });
    swapInventorySlots(ps, -1, 1);
    swapInventorySlots(ps, 0, INVENTORY_SLOT_COUNT);
    expect(getInventorySlotKey(ps, 0)).toBe('sword_rusty');
  });
});

describe('equipFromInventory', () => {
  it('equips mainhand from inventory slot', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'sword_rusty', durability: 100 });
    equipFromInventory(ps, 0, 'mainhand');
    expect(ps.equippedMainhandKey).toBe('sword_rusty');
    expect(ps.equippedMainhandDurability).toBe(100);
    expect(ps.inventorySlots![0]).toBeNull();
  });

  it('equips offhand from inventory slot', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'shield', durability: MAX_WEAPON_DURABILITY });
    equipFromInventory(ps, 0, 'offhand');
    expect(ps.equippedOffhandKey).toBe('shield');
    expect(ps.inventorySlots![0]).toBeNull();
  });

  it('does nothing for empty slot', () => {
    const ps = new PlayingState('none', 'none');
    ps.equippedMainhandKey = 'none';
    equipFromInventory(ps, 0, 'mainhand');
    expect(ps.equippedMainhandKey).toBe('none');
  });

  it('does nothing for zero durability', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'sword_rusty', durability: 0 });
    equipFromInventory(ps, 0, 'mainhand');
    expect(ps.equippedMainhandKey).toBe('none');
  });
});

describe('unequipToInventory', () => {
  it('moves mainhand to first empty inventory slot', () => {
    const ps = new PlayingState('none', 'none');
    ps.equippedMainhandKey = 'sword_rusty';
    ps.equippedMainhandDurability = 80;
    unequipToInventory(ps, 'mainhand');
    expect(ps.equippedMainhandKey).toBe('none');
    expect(ps.equippedMainhandDurability).toBe(MAX_WEAPON_DURABILITY);
    expect(ps.inventorySlots!.some((s) => s != null && 'key' in s && s.key === 'sword_rusty')).toBe(true);
  });

  it('does nothing when mainhand is none', () => {
    const ps = new PlayingState('none', 'none');
    ps.equippedMainhandKey = 'none';
    const before = ps.inventorySlots!.filter((s) => s != null).length;
    unequipToInventory(ps, 'mainhand');
    expect(ps.inventorySlots!.filter((s) => s != null).length).toBe(before);
  });

  it('does nothing when inventory is full', () => {
    const ps = new PlayingState('none', 'none');
    for (let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
      setInventorySlot(ps, i, { key: 'sword_rusty', durability: 1 });
    }
    ps.equippedMainhandKey = 'dagger_rusty';
    ps.equippedMainhandDurability = 50;
    unequipToInventory(ps, 'mainhand');
    expect(ps.equippedMainhandKey).toBe('dagger_rusty');
  });
});
