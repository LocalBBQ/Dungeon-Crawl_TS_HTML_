/**
 * Centralized inventory/equipment/chest actions. All mutations go through this module.
 * Callers pass an optional syncCombat callback to update the player Combat component.
 */
import type { PlayingStateShape } from './PlayingState.js';
import {
  type InventorySlot,
  type WeaponInstance,
  type WhetstoneConsumable,
  getSlotKey,
  INVENTORY_SLOT_COUNT,
  MAX_WEAPON_DURABILITY,
  CHEST_SLOT_COUNT,
  isWeaponInstance,
  isWhetstoneSlot
} from './PlayingState.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { canEquipWeaponInSlot, getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import { rollEnchantForSlot } from '../config/enchantmentConfig.js';
import type { EnchantmentSlot } from '../config/enchantmentConfig.js';
import { WHETSTONE_REPAIR_PERCENT } from '../config/lootConfig.js';

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
  if (!item || !isWeaponInstance(item)) return;
  if (item.durability <= 0) return;
  if (!canEquipWeaponInSlot(item.key, slot)) return;
  const weapon = getWeapon(item.key);
  if (slot === 'mainhand') {
    if (weapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    ps.equippedMainhandKey = item.key;
    ps.equippedMainhandDurability = item.durability;
    ps.equippedMainhandPrefixId = item.prefixId;
    ps.equippedMainhandSuffixId = item.suffixId;
    if (weapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedOffhandPrefixId = undefined;
      ps.equippedOffhandSuffixId = undefined;
    }
  } else {
    ps.equippedOffhandKey = item.key;
    ps.equippedOffhandDurability = item.durability;
    ps.equippedOffhandPrefixId = item.prefixId;
    ps.equippedOffhandSuffixId = item.suffixId;
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
  const prefixId = equipSlot === 'mainhand' ? ps.equippedMainhandPrefixId : ps.equippedOffhandPrefixId;
  const suffixId = equipSlot === 'mainhand' ? ps.equippedMainhandSuffixId : ps.equippedOffhandSuffixId;
  if (!key || key === 'none') return;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;

  let index = bagIndex;
  if (index === undefined || index < 0 || index >= INVENTORY_SLOT_COUNT || ps.inventorySlots[index] != null) {
    index = ps.inventorySlots.findIndex((s) => s == null);
    if (index < 0) return;
  }
  ps.inventorySlots[index] = { key, durability, prefixId, suffixId } as WeaponInstance;
  if (equipSlot === 'mainhand') {
    ps.equippedMainhandKey = 'none';
    ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
    ps.equippedMainhandPrefixId = undefined;
    ps.equippedMainhandSuffixId = undefined;
  } else {
    ps.equippedOffhandKey = 'none';
    ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
    ps.equippedOffhandPrefixId = undefined;
    ps.equippedOffhandSuffixId = undefined;
  }
  syncCombat?.(ps);
}

export function equipFromChest(ps: PlayingStateShape, chestIndex: number, bagIndex: number): void {
  if (!ps.chestSlots || chestIndex < 0 || chestIndex >= CHEST_SLOT_COUNT) return;
  if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const instance = ps.chestSlots[chestIndex];
  if (!instance) return;
  ps.inventorySlots[bagIndex] = { key: instance.key, durability: instance.durability, prefixId: instance.prefixId, suffixId: instance.suffixId };
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
    ps.equippedMainhandPrefixId = instance.prefixId;
    ps.equippedMainhandSuffixId = instance.suffixId;
    if (weapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedOffhandPrefixId = undefined;
      ps.equippedOffhandSuffixId = undefined;
    }
  } else {
    ps.equippedOffhandKey = instance.key;
    ps.equippedOffhandDurability = instance.durability;
    ps.equippedOffhandPrefixId = instance.prefixId;
    ps.equippedOffhandSuffixId = instance.suffixId;
  }
  ps.chestSlots[chestIndex] = null;
  syncCombat?.(ps);
}

export function putInChestFromInventory(ps: PlayingStateShape, bagIndex: number): void {
  if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const item = ps.inventorySlots[bagIndex];
  if (!item || !isWeaponInstance(item)) return;
  ps.inventorySlots[bagIndex] = null;
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  const empty = ps.chestSlots.findIndex((s) => s == null);
  if (empty >= 0) ps.chestSlots[empty] = { key: item.key, durability: item.durability, prefixId: item.prefixId, suffixId: item.suffixId };
}

export function putInChestFromEquipment(
  ps: PlayingStateShape,
  equipSlot: 'mainhand' | 'offhand',
  syncCombat?: SyncCombat
): void {
  const key = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
  const durability = equipSlot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
  const prefixId = equipSlot === 'mainhand' ? ps.equippedMainhandPrefixId : ps.equippedOffhandPrefixId;
  const suffixId = equipSlot === 'mainhand' ? ps.equippedMainhandSuffixId : ps.equippedOffhandSuffixId;
  if (!key || key === 'none') return;
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  const empty = ps.chestSlots.findIndex((s) => s == null);
  if (empty >= 0) ps.chestSlots[empty] = { key, durability, prefixId, suffixId };
  if (equipSlot === 'mainhand') {
    ps.equippedMainhandKey = 'none';
    ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
    ps.equippedMainhandPrefixId = undefined;
    ps.equippedMainhandSuffixId = undefined;
  } else {
    ps.equippedOffhandKey = 'none';
    ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
    ps.equippedOffhandPrefixId = undefined;
    ps.equippedOffhandSuffixId = undefined;
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
  const bagItem = ps.inventorySlots[bagIndex];
  if (!bagItem || !isWeaponInstance(bagItem)) return;
  if (bagItem.durability <= 0 || !canEquipWeaponInSlot(bagItem.key, equipSlot)) return;
  const equipKey = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
  const equipDurability = equipSlot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
  const equipPrefixId = equipSlot === 'mainhand' ? ps.equippedMainhandPrefixId : ps.equippedOffhandPrefixId;
  const equipSuffixId = equipSlot === 'mainhand' ? ps.equippedMainhandSuffixId : ps.equippedOffhandSuffixId;

  if (equipSlot === 'mainhand') {
    const newMainWeapon = bagItem ? getWeapon(bagItem.key) : undefined;
    if (newMainWeapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    ps.equippedMainhandKey = bagItem ? bagItem.key : 'none';
    ps.equippedMainhandDurability = bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY;
    ps.equippedMainhandPrefixId = bagItem?.prefixId;
    ps.equippedMainhandSuffixId = bagItem?.suffixId;
    if (newMainWeapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedOffhandPrefixId = undefined;
      ps.equippedOffhandSuffixId = undefined;
    }
  } else {
    ps.equippedOffhandKey = bagItem ? bagItem.key : 'none';
    ps.equippedOffhandDurability = bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY;
    ps.equippedOffhandPrefixId = bagItem?.prefixId;
    ps.equippedOffhandSuffixId = bagItem?.suffixId;
  }
  ps.inventorySlots[bagIndex] =
    equipKey && equipKey !== 'none' ? { key: equipKey, durability: equipDurability, prefixId: equipPrefixId, suffixId: equipSuffixId } : null;
  syncCombat?.(ps);
}

export function swapEquipmentWithEquipment(ps: PlayingStateShape, syncCombat?: SyncCombat): void {
  const mainKey = ps.equippedMainhandKey;
  const mainDur = ps.equippedMainhandDurability;
  const mainPrefix = ps.equippedMainhandPrefixId;
  const mainSuffix = ps.equippedMainhandSuffixId;
  const offKey = ps.equippedOffhandKey;
  const offDur = ps.equippedOffhandDurability;
  const offPrefix = ps.equippedOffhandPrefixId;
  const offSuffix = ps.equippedOffhandSuffixId;
  if (mainKey && mainKey !== 'none' && !canEquipWeaponInSlot(mainKey, 'offhand')) return;
  if (offKey && offKey !== 'none' && !canEquipWeaponInSlot(offKey, 'mainhand')) return;
  ps.equippedMainhandKey = offKey;
  ps.equippedMainhandDurability = offDur;
  ps.equippedMainhandPrefixId = offPrefix;
  ps.equippedMainhandSuffixId = offSuffix;
  ps.equippedOffhandKey = mainKey;
  ps.equippedOffhandDurability = mainDur;
  ps.equippedOffhandPrefixId = mainPrefix;
  ps.equippedOffhandSuffixId = mainSuffix;
  syncCombat?.(ps);
}

const REROLL_PREFIX_COST = 50;
const REROLL_SUFFIX_COST = 50;
const REROLL_BOTH_COST = 80;

/**
 * Reroll enchantment(s) on the item in the reroll slot. Deducts gold and updates the instance in place.
 * Returns true if reroll was performed.
 */
export function rerollEnchantSlot(ps: PlayingStateShape, which: 'prefix' | 'suffix' | 'both'): boolean {
  const instance = ps.rerollSlotItem;
  if (!instance?.key) return false;
  const cost = which === 'both' ? REROLL_BOTH_COST : which === 'prefix' ? REROLL_PREFIX_COST : REROLL_SUFFIX_COST;
  if ((ps.gold ?? 0) < cost) return false;
  const enchantSlot: EnchantmentSlot = getEquipSlotForWeapon(instance.key) === 'offhand' ? 'offhand' : 'weapon';
  if (which === 'prefix' || which === 'both') {
    const rolled = rollEnchantForSlot(enchantSlot);
    instance.prefixId = rolled?.id;
  }
  if (which === 'suffix' || which === 'both') {
    const rolled = rollEnchantForSlot(enchantSlot);
    instance.suffixId = rolled?.id;
  }
  ps.gold = (ps.gold ?? 0) - cost;
  return true;
}

/**
 * Move a weapon from inventory, chest, or equipment into the reroll slot.
 * If the reroll slot already has an item, does nothing. Returns true if moved.
 */
export function moveToRerollSlot(
  ps: PlayingStateShape,
  source: 'inventory' | 'chest' | 'equipment',
  index: number,
  syncCombat?: SyncCombat
): boolean {
  if (ps.rerollSlotItem) return false; // slot full
  let instance: WeaponInstance;
  if (source === 'inventory') {
    if (index < 0 || index >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return false;
    const item = ps.inventorySlots[index];
    if (!item || !isWeaponInstance(item)) return false;
    instance = { key: item.key, durability: item.durability, prefixId: item.prefixId, suffixId: item.suffixId };
    ps.inventorySlots[index] = null;
  } else if (source === 'chest') {
    if (!ps.chestSlots || index < 0 || index >= ps.chestSlots.length) return false;
    instance = ps.chestSlots.splice(index, 1)[0];
    if (!instance?.key) return false;
  } else {
    const equipSlot = index === 0 ? 'mainhand' : 'offhand';
    const key = equipSlot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
    const durability = equipSlot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
    const prefixId = equipSlot === 'mainhand' ? ps.equippedMainhandPrefixId : ps.equippedOffhandPrefixId;
    const suffixId = equipSlot === 'mainhand' ? ps.equippedMainhandSuffixId : ps.equippedOffhandSuffixId;
    if (!key || key === 'none') return false;
    instance = { key, durability, prefixId, suffixId };
    if (equipSlot === 'mainhand') {
      ps.equippedMainhandKey = 'none';
      ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedMainhandPrefixId = undefined;
      ps.equippedMainhandSuffixId = undefined;
      const weapon = getWeapon(key);
      if (weapon?.twoHanded) {
        ps.equippedOffhandKey = 'none';
        ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
        ps.equippedOffhandPrefixId = undefined;
        ps.equippedOffhandSuffixId = undefined;
      }
    } else {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedOffhandPrefixId = undefined;
      ps.equippedOffhandSuffixId = undefined;
    }
    syncCombat?.(ps);
  }
  ps.rerollSlotItem = instance;
  return true;
}

/**
 * Move the weapon from the reroll slot to inventory, chest, or equipment.
 * targetIndex: for inventory = slot index (or first free if -1); for equipment 0 = mainhand, 1 = offhand.
 * Returns true if moved.
 */
export function moveFromRerollSlotTo(
  ps: PlayingStateShape,
  target: 'inventory' | 'chest' | 'equipment',
  targetIndex: number,
  syncCombat?: SyncCombat
): boolean {
  const instance = ps.rerollSlotItem;
  if (!instance?.key) return false;
  if (target === 'inventory') {
    const idx = targetIndex >= 0 && targetIndex < INVENTORY_SLOT_COUNT && !ps.inventorySlots?.[targetIndex]
      ? targetIndex
      : ps.inventorySlots?.findIndex((s) => s == null) ?? -1;
    if (idx < 0 || !ps.inventorySlots) return false;
    ps.inventorySlots[idx] = { key: instance.key, durability: instance.durability, prefixId: instance.prefixId, suffixId: instance.suffixId };
    ps.rerollSlotItem = null;
    return true;
  }
  if (target === 'chest') {
    ps.chestSlots = ps.chestSlots ?? [];
    ps.chestSlots.push({ key: instance.key, durability: instance.durability, prefixId: instance.prefixId, suffixId: instance.suffixId });
    ps.rerollSlotItem = null;
    return true;
  }
  const equipSlot = targetIndex === 0 ? 'mainhand' : 'offhand';
  if (!canEquipWeaponInSlot(instance.key, equipSlot)) return false;
  const weapon = getWeapon(instance.key);
  if (equipSlot === 'mainhand' && weapon?.twoHanded && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
    unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
  }
  if (equipSlot === 'mainhand') {
    ps.equippedMainhandKey = instance.key;
    ps.equippedMainhandDurability = instance.durability;
    ps.equippedMainhandPrefixId = instance.prefixId;
    ps.equippedMainhandSuffixId = instance.suffixId;
    if (weapon?.twoHanded) {
      ps.equippedOffhandKey = 'none';
      ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
      ps.equippedOffhandPrefixId = undefined;
      ps.equippedOffhandSuffixId = undefined;
    }
  } else {
    ps.equippedOffhandKey = instance.key;
    ps.equippedOffhandDurability = instance.durability;
    ps.equippedOffhandPrefixId = instance.prefixId;
    ps.equippedOffhandSuffixId = instance.suffixId;
  }
  ps.rerollSlotItem = null;
  syncCombat?.(ps);
  return true;
}

export { REROLL_PREFIX_COST, REROLL_SUFFIX_COST, REROLL_BOTH_COST };

/**
 * Add a weapon instance to the first free inventory slot. Returns true if added, false if inventory full.
 */
export function addWeaponToInventory(ps: PlayingStateShape, instance: WeaponInstance): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const index = ps.inventorySlots.findIndex((s) => s == null);
  if (index < 0) return false;
  ps.inventorySlots[index] = {
    key: instance.key,
    durability: instance.durability,
    prefixId: instance.prefixId,
    suffixId: instance.suffixId
  };
  return true;
}

/**
 * Add one whetstone to inventory: stack with existing whetstone slot or use first empty slot.
 * Returns true if added.
 */
export function addWhetstoneToInventory(ps: PlayingStateShape): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is WhetstoneConsumable => isWhetstoneSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as WhetstoneConsumable).count += 1;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'whetstone', count: 1 };
  return true;
}

/**
 * Use one whetstone from the given inventory slot on a weapon. Target can be equipped mainhand/offhand or an inventory weapon slot.
 * Repairs that weapon by 35% of max durability. Returns true if used.
 */
export function useWhetstoneOnWeapon(
  ps: PlayingStateShape,
  whetstoneSlotIndex: number,
  target: 'mainhand' | 'offhand' | { bagIndex: number }
): boolean {
  if (whetstoneSlotIndex < 0 || whetstoneSlotIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return false;
  const slot = ps.inventorySlots[whetstoneSlotIndex];
  if (!isWhetstoneSlot(slot) || slot.count < 1) return false;
  const repairAmount = Math.floor(MAX_WEAPON_DURABILITY * WHETSTONE_REPAIR_PERCENT);

  if (target === 'mainhand') {
    if (!ps.equippedMainhandKey || ps.equippedMainhandKey === 'none') return false;
    ps.equippedMainhandDurability = Math.min(MAX_WEAPON_DURABILITY, ps.equippedMainhandDurability + repairAmount);
  } else if (target === 'offhand') {
    if (!ps.equippedOffhandKey || ps.equippedOffhandKey === 'none') return false;
    ps.equippedOffhandDurability = Math.min(MAX_WEAPON_DURABILITY, ps.equippedOffhandDurability + repairAmount);
  } else {
    const bagIndex = target.bagIndex;
    if (bagIndex < 0 || bagIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots[bagIndex]) return false;
    const weaponSlot = ps.inventorySlots[bagIndex];
    if (!isWeaponInstance(weaponSlot)) return false;
    ps.inventorySlots[bagIndex] = {
      ...weaponSlot,
      durability: Math.min(MAX_WEAPON_DURABILITY, weaponSlot.durability + repairAmount)
    };
  }

  if (slot.count === 1) {
    ps.inventorySlots[whetstoneSlotIndex] = null;
  } else {
    (ps.inventorySlots[whetstoneSlotIndex] as WhetstoneConsumable).count -= 1;
  }
  return true;
}
