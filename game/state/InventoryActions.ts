/**
 * Centralized inventory/equipment/chest actions. All mutations go through this module.
 * Callers pass an optional syncCombat callback to update the player Combat component.
 */
import type { PlayingStateShape } from './PlayingState.js';
import {
  type InventorySlot,
  getSlotKey,
  INVENTORY_SLOT_COUNT,
  MAX_WEAPON_DURABILITY,
  CHEST_SLOT_COUNT
} from './PlayingState.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { canEquipWeaponInSlot } from '../weapons/weaponSlot.js';

type WeaponLike = { twoHanded?: boolean; offhandOnly?: boolean };
type SyncCombat = (ps: PlayingStateShape) => void;

function getWeapon(key: string): WeaponLike | undefined {
  return Weapons[key] as WeaponLike | undefined;
}

export function setInventorySlot(ps: PlayingStateShape, index: number, item: InventorySlot): void {
  if (index < 0 || index >= INVENTORY_SLOT_COUNT) return;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;
  ps.inventorySlots[index] = item;
}

export function getInventorySlotKey(ps: PlayingStateShape, index: number): string | null {
  if (index < 0 || index >= INVENTORY_SLOT_COUNT) return null;
  return getSlotKey(ps.inventorySlots?.[index] ?? null);
}

export function swapInventorySlots(ps: PlayingStateShape, i: number, j: number): void {
  if (i < 0 || i >= INVENTORY_SLOT_COUNT || j < 0 || j >= INVENTORY_SLOT_COUNT) return;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;
  const a = ps.inventorySlots[i];
  const b = ps.inventorySlots[j];
  ps.inventorySlots[i] = b;
  ps.inventorySlots[j] = a;
}

export function equipFromInventory(
  ps: PlayingStateShape,
  slotIndex: number,
  slot: 'mainhand' | 'offhand',
  syncCombat?: SyncCombat
): void {
  if (slotIndex < 0 || slotIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const item = ps.inventorySlots[slotIndex];
  if (!item) return;
  if (item.durability <= 0) return;
  if (!canEquipWeaponInSlot(item.key, slot)) return;
  const weapon = getWeapon(item.key);
  if (slot === 'mainhand') {
    if (weapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    ps.equippedMainhandKey = item.key;
    ps.equippedMainhandDurability = item.durability;
    if (weapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
    }
  } else {
    ps.equippedOffhandKey = item.key;
    ps.equippedOffhandDurability = item.durability;
  }
  ps.inventorySlots[slotIndex] = null;
  syncCombat?.(ps);
}

export function unequipToInventory(
  ps: PlayingStateShape,
  equipSlot: 'mainhand' | 'offhand',
  bagIndex?: number,
  durabilityOverride?: number,
  syncCombat?: SyncCombat
): void {
  const key = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
  const durability =
    durabilityOverride !== undefined
      ? durabilityOverride
      : equipSlot === 'mainhand'
        ? ps.equippedMainhandDurability
        : ps.equippedOffhandDurability;
  if (!key || key === 'none') return;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;

  let index = bagIndex;
  if (index === undefined || index < 0 || index >= INVENTORY_SLOT_COUNT || ps.inventorySlots[index] != null) {
    index = ps.inventorySlots.findIndex((s) => s == null);
    if (index < 0) return;
  }
  ps.inventorySlots[index] = { key, durability };
  if (equipSlot === 'mainhand') {
    ps.equippedMainhandKey = 'none';
    ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
  } else {
    ps.equippedOffhandKey = 'none';
    ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
  }
  syncCombat?.(ps);
}

export function equipFromChest(ps: PlayingStateShape, chestIndex: number, bagIndex: number): void {
  if (!ps.chestSlots || chestIndex < 0 || chestIndex >= CHEST_SLOT_COUNT) return;
  if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const instance = ps.chestSlots[chestIndex];
  if (!instance) return;
  ps.inventorySlots[bagIndex] = { key: instance.key, durability: instance.durability };
  ps.chestSlots[chestIndex] = null;
}

/** Take weapon from chest and equip directly to mainhand or offhand. */
export function equipFromChestToHand(
  ps: PlayingStateShape,
  chestIndex: number,
  slot: 'mainhand' | 'offhand',
  syncCombat?: SyncCombat
): void {
  if (!ps.chestSlots || chestIndex < 0 || chestIndex >= CHEST_SLOT_COUNT) return;
  const instance = ps.chestSlots[chestIndex];
  if (!instance) return;
  if (instance.durability <= 0) return;
  if (!canEquipWeaponInSlot(instance.key, slot)) return;
  const weapon = getWeapon(instance.key);
  if (slot === 'mainhand') {
    if (weapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    ps.equippedMainhandKey = instance.key;
    ps.equippedMainhandDurability = instance.durability;
    if (weapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
    }
  } else {
    ps.equippedOffhandKey = instance.key;
    ps.equippedOffhandDurability = instance.durability;
  }
  ps.chestSlots[chestIndex] = null;
  syncCombat?.(ps);
}

export function putInChestFromInventory(ps: PlayingStateShape, bagIndex: number): void {
  if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const item = ps.inventorySlots[bagIndex];
  if (!item) return;
  ps.inventorySlots[bagIndex] = null;
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  const empty = ps.chestSlots.findIndex((s) => s == null);
  if (empty >= 0) ps.chestSlots[empty] = { key: item.key, durability: item.durability };
}

export function putInChestFromEquipment(
  ps: PlayingStateShape,
  equipSlot: 'mainhand' | 'offhand',
  syncCombat?: SyncCombat
): void {
  const key = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
  const durability = equipSlot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
  if (!key || key === 'none') return;
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  const empty = ps.chestSlots.findIndex((s) => s == null);
  if (empty >= 0) ps.chestSlots[empty] = { key, durability };
  if (equipSlot === 'mainhand') {
    ps.equippedMainhandKey = 'none';
    ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
  } else {
    ps.equippedOffhandKey = 'none';
    ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
  }
  syncCombat?.(ps);
}

export function swapEquipmentWithInventory(
  ps: PlayingStateShape,
  equipSlot: 'mainhand' | 'offhand',
  bagIndex: number,
  syncCombat?: SyncCombat
): void {
  if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const equipKey = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
  const equipDurability = equipSlot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
  const bagItem = ps.inventorySlots[bagIndex];
  if (bagItem && (bagItem.durability <= 0 || !canEquipWeaponInSlot(bagItem.key, equipSlot))) return;

  if (equipSlot === 'mainhand') {
    const newMainWeapon = bagItem ? getWeapon(bagItem.key) : undefined;
    if (newMainWeapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    ps.equippedMainhandKey = bagItem ? bagItem.key : 'none';
    ps.equippedMainhandDurability = bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY;
    if (newMainWeapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
    }
  } else {
    ps.equippedOffhandKey = bagItem ? bagItem.key : 'none';
    ps.equippedOffhandDurability = bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY;
  }
  ps.inventorySlots[bagIndex] =
    equipKey && equipKey !== 'none' ? { key: equipKey, durability: equipDurability } : null;
  syncCombat?.(ps);
}

export function swapEquipmentWithEquipment(ps: PlayingStateShape, syncCombat?: SyncCombat): void {
  const mainKey = ps.equippedMainhandKey;
  const mainDur = ps.equippedMainhandDurability;
  const offKey = ps.equippedOffhandKey;
  const offDur = ps.equippedOffhandDurability;
  if (mainKey && mainKey !== 'none' && !canEquipWeaponInSlot(mainKey, 'offhand')) return;
  if (offKey && offKey !== 'none' && !canEquipWeaponInSlot(offKey, 'mainhand')) return;
  ps.equippedMainhandKey = offKey;
  ps.equippedMainhandDurability = offDur;
  ps.equippedOffhandKey = mainKey;
  ps.equippedOffhandDurability = mainDur;
  syncCombat?.(ps);
}
