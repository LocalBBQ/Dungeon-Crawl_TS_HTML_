/**
 * Tests for ArmorActions (canEquipArmorInSlot, equipArmorFromInventory).
 */
import { describe, it, expect } from 'vitest';
import { canEquipArmorInSlot, equipArmorFromInventory } from '../../game/state/ArmorActions.js';
import { PlayingState, INVENTORY_SLOT_COUNT } from '../../game/state/PlayingState.js';
import { setInventorySlot } from '../../game/state/InventoryActions.js';

describe('canEquipArmorInSlot', () => {
  it('returns true for matching slot (head)', () => {
    expect(canEquipArmorInSlot('leather_cap', 'head')).toBe(true);
  });
  it('returns true for matching slot (chest)', () => {
    expect(canEquipArmorInSlot('chainmail', 'chest')).toBe(true);
  });
  it('returns false for wrong slot', () => {
    expect(canEquipArmorInSlot('leather_cap', 'chest')).toBe(false);
  });
  it('returns false for unknown armor key', () => {
    expect(canEquipArmorInSlot('unknown_armor', 'head')).toBe(false);
  });
});

describe('equipArmorFromInventory', () => {
  it('equips armor from inventory to slot', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'leather_cap', durability: 100 });
    equipArmorFromInventory(ps, 0, 'head');
    expect(ps.equippedArmorHeadKey).toBe('leather_cap');
    expect(ps.equippedArmorHeadDurability).toBe(100);
    expect(ps.inventorySlots![0]).toBeNull();
  });

  it('swaps when slot already filled', () => {
    const ps = new PlayingState('none', 'none');
    ps.equippedArmorHeadKey = 'leather_cap';
    ps.equippedArmorHeadDurability = 80;
    setInventorySlot(ps, 0, { key: 'chain_coif', durability: 100 });
    equipArmorFromInventory(ps, 0, 'head');
    expect(ps.equippedArmorHeadKey).toBe('chain_coif');
    expect(ps.inventorySlots![0]).not.toBeNull();
    expect(ps.inventorySlots![0] && 'key' in ps.inventorySlots![0] && ps.inventorySlots![0].key).toBe('leather_cap');
  });

  it('does nothing for out-of-range index', () => {
    const ps = new PlayingState('none', 'none');
    setInventorySlot(ps, 0, { key: 'leather_cap', durability: 100 });
    equipArmorFromInventory(ps, -1, 'head');
    equipArmorFromInventory(ps, INVENTORY_SLOT_COUNT, 'head');
    expect(ps.equippedArmorHeadKey).toBe('none');
    expect(ps.inventorySlots![0]).not.toBeNull();
  });
});
