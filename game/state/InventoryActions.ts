/**
 * Centralized inventory/equipment/chest actions. All mutations go through this module.
 * Callers pass an optional syncCombat callback to update the player Combat component.
 */
import type { PlayingStateShape } from './PlayingState.js';
import {
  type InventorySlot,
  type WeaponInstance,
  type WhetstoneConsumable,
  type HerbConsumable,
  type MushroomConsumable,
  type HoneyConsumable,
  type PotionConsumable,
  type GoldConsumable,
  getSlotKey,
  getActiveWeaponSet,
  setActiveWeaponSet,
  INVENTORY_SLOT_COUNT,
  MAX_WEAPON_DURABILITY,
  CHEST_SLOT_COUNT,
  TOOLBELT_SLOT_COUNT,
  isWeaponInstance,
  isWhetstoneSlot,
  isHerbSlot,
  isMushroomSlot,
  isHoneySlot,
  isPotionSlot,
  isGoldSlot
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
  const active = getActiveWeaponSet(ps);
  if (slot === 'mainhand') {
    if (weapon?.twoHanded && active.offhandKey && active.offhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    setActiveWeaponSet(ps, {
      mainhandKey: item.key,
      mainhandDurability: item.durability,
      mainhandPrefixId: item.prefixId,
      mainhandSuffixId: item.suffixId
    });
    if (weapon?.twoHanded) {
      setActiveWeaponSet(ps, {
        offhandKey: 'none',
        offhandDurability: MAX_WEAPON_DURABILITY,
        offhandPrefixId: undefined,
        offhandSuffixId: undefined
      });
    }
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: item.key,
      offhandDurability: item.durability,
      offhandPrefixId: item.prefixId,
      offhandSuffixId: item.suffixId
    });
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
  const active = getActiveWeaponSet(ps);
  const key = equipSlot === 'mainhand' ? active.mainhandKey : active.offhandKey;
  const durability =
    durabilityOverride !== undefined
      ? durabilityOverride
      : equipSlot === 'mainhand'
        ? active.mainhandDurability
        : active.offhandDurability;
  const prefixId = equipSlot === 'mainhand' ? active.mainhandPrefixId : active.offhandPrefixId;
  const suffixId = equipSlot === 'mainhand' ? active.mainhandSuffixId : active.offhandSuffixId;
  if (!key || key === 'none') return;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;

  let index = bagIndex;
  if (index === undefined || index < 0 || index >= INVENTORY_SLOT_COUNT || ps.inventorySlots[index] != null) {
    index = ps.inventorySlots.findIndex((s) => s == null);
    if (index < 0) return;
  }
  ps.inventorySlots[index] = { key, durability, prefixId, suffixId } as WeaponInstance;
  if (equipSlot === 'mainhand') {
    setActiveWeaponSet(ps, {
      mainhandKey: 'none',
      mainhandDurability: MAX_WEAPON_DURABILITY,
      mainhandPrefixId: undefined,
      mainhandSuffixId: undefined
    });
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: 'none',
      offhandDurability: MAX_WEAPON_DURABILITY,
      offhandPrefixId: undefined,
      offhandSuffixId: undefined
    });
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

/** Take weapon from chest and equip directly to mainhand or offhand (active set). */
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
  const active = getActiveWeaponSet(ps);
  if (slot === 'mainhand') {
    if (weapon?.twoHanded && active.offhandKey && active.offhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    setActiveWeaponSet(ps, {
      mainhandKey: instance.key,
      mainhandDurability: instance.durability,
      mainhandPrefixId: instance.prefixId,
      mainhandSuffixId: instance.suffixId
    });
    if (weapon?.twoHanded) {
      setActiveWeaponSet(ps, {
        offhandKey: 'none',
        offhandDurability: MAX_WEAPON_DURABILITY,
        offhandPrefixId: undefined,
        offhandSuffixId: undefined
      });
    }
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: instance.key,
      offhandDurability: instance.durability,
      offhandPrefixId: instance.prefixId,
      offhandSuffixId: instance.suffixId
    });
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

/** Swap two chest slots (for reordering when dragging within the chest). */
export function swapChestSlots(ps: PlayingStateShape, indexA: number, indexB: number): void {
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  if (indexA < 0 || indexA >= CHEST_SLOT_COUNT || indexB < 0 || indexB >= CHEST_SLOT_COUNT || indexA === indexB) return;
  const a = ps.chestSlots[indexA];
  const b = ps.chestSlots[indexB];
  ps.chestSlots[indexA] = b;
  ps.chestSlots[indexB] = a;
}

export function putInChestFromEquipment(
  ps: PlayingStateShape,
  equipSlot: 'mainhand' | 'offhand',
  syncCombat?: SyncCombat
): void {
  const active = getActiveWeaponSet(ps);
  const key = equipSlot === 'mainhand' ? active.mainhandKey : active.offhandKey;
  const durability = equipSlot === 'mainhand' ? active.mainhandDurability : active.offhandDurability;
  const prefixId = equipSlot === 'mainhand' ? active.mainhandPrefixId : active.offhandPrefixId;
  const suffixId = equipSlot === 'mainhand' ? active.mainhandSuffixId : active.offhandSuffixId;
  if (!key || key === 'none') return;
  if (!ps.chestSlots || ps.chestSlots.length !== CHEST_SLOT_COUNT) return;
  const empty = ps.chestSlots.findIndex((s) => s == null);
  if (empty >= 0) ps.chestSlots[empty] = { key, durability, prefixId, suffixId };
  if (equipSlot === 'mainhand') {
    setActiveWeaponSet(ps, {
      mainhandKey: 'none',
      mainhandDurability: MAX_WEAPON_DURABILITY,
      mainhandPrefixId: undefined,
      mainhandSuffixId: undefined
    });
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: 'none',
      offhandDurability: MAX_WEAPON_DURABILITY,
      offhandPrefixId: undefined,
      offhandSuffixId: undefined
    });
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
  const active = getActiveWeaponSet(ps);
  const equipKey = equipSlot === 'mainhand' ? active.mainhandKey : active.offhandKey;
  const equipDurability = equipSlot === 'mainhand' ? active.mainhandDurability : active.offhandDurability;
  const equipPrefixId = equipSlot === 'mainhand' ? active.mainhandPrefixId : active.offhandPrefixId;
  const equipSuffixId = equipSlot === 'mainhand' ? active.mainhandSuffixId : active.offhandSuffixId;

  if (equipSlot === 'mainhand') {
    const newMainWeapon = bagItem ? getWeapon(bagItem.key) : undefined;
    if (newMainWeapon?.twoHanded && active.offhandKey && active.offhandKey !== 'none') {
      unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
    }
    setActiveWeaponSet(ps, {
      mainhandKey: bagItem ? bagItem.key : 'none',
      mainhandDurability: bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY,
      mainhandPrefixId: bagItem?.prefixId,
      mainhandSuffixId: bagItem?.suffixId
    });
    if (newMainWeapon?.twoHanded) {
      setActiveWeaponSet(ps, {
        offhandKey: 'none',
        offhandDurability: MAX_WEAPON_DURABILITY,
        offhandPrefixId: undefined,
        offhandSuffixId: undefined
      });
    }
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: bagItem ? bagItem.key : 'none',
      offhandDurability: bagItem ? bagItem.durability : MAX_WEAPON_DURABILITY,
      offhandPrefixId: bagItem?.prefixId,
      offhandSuffixId: bagItem?.suffixId
    });
  }
  ps.inventorySlots[bagIndex] =
    equipKey && equipKey !== 'none' ? { key: equipKey, durability: equipDurability, prefixId: equipPrefixId, suffixId: equipSuffixId } : null;
  syncCombat?.(ps);
}

export function swapEquipmentWithEquipment(ps: PlayingStateShape, syncCombat?: SyncCombat): void {
  const active = getActiveWeaponSet(ps);
  const mainKey = active.mainhandKey;
  const mainDur = active.mainhandDurability;
  const mainPrefix = active.mainhandPrefixId;
  const mainSuffix = active.mainhandSuffixId;
  const offKey = active.offhandKey;
  const offDur = active.offhandDurability;
  const offPrefix = active.offhandPrefixId;
  const offSuffix = active.offhandSuffixId;
  if (mainKey && mainKey !== 'none' && !canEquipWeaponInSlot(mainKey, 'offhand')) return;
  if (offKey && offKey !== 'none' && !canEquipWeaponInSlot(offKey, 'mainhand')) return;
  setActiveWeaponSet(ps, {
    mainhandKey: offKey,
    mainhandDurability: offDur,
    mainhandPrefixId: offPrefix,
    mainhandSuffixId: offSuffix,
    offhandKey: mainKey,
    offhandDurability: mainDur,
    offhandPrefixId: mainPrefix,
    offhandSuffixId: mainSuffix
  });
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
  if (getTotalGoldFromInventory(ps) < cost) return false;
  const enchantSlot: EnchantmentSlot = getEquipSlotForWeapon(instance.key) === 'offhand' ? 'offhand' : 'weapon';
  if (which === 'prefix' || which === 'both') {
    const rolled = rollEnchantForSlot(enchantSlot);
    instance.prefixId = rolled?.id;
  }
  if (which === 'suffix' || which === 'both') {
    const rolled = rollEnchantForSlot(enchantSlot);
    instance.suffixId = rolled?.id;
  }
  return tryConsumeGold(ps, cost);
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
    const active = getActiveWeaponSet(ps);
    const key = equipSlot === 'mainhand' ? active.mainhandKey : active.offhandKey;
    const durability = equipSlot === 'mainhand' ? active.mainhandDurability : active.offhandDurability;
    const prefixId = equipSlot === 'mainhand' ? active.mainhandPrefixId : active.offhandPrefixId;
    const suffixId = equipSlot === 'mainhand' ? active.mainhandSuffixId : active.offhandSuffixId;
    if (!key || key === 'none') return false;
    instance = { key, durability, prefixId, suffixId };
    if (equipSlot === 'mainhand') {
      setActiveWeaponSet(ps, {
        mainhandKey: 'none',
        mainhandDurability: MAX_WEAPON_DURABILITY,
        mainhandPrefixId: undefined,
        mainhandSuffixId: undefined
      });
      const weapon = getWeapon(key);
      if (weapon?.twoHanded) {
        setActiveWeaponSet(ps, {
          offhandKey: 'none',
          offhandDurability: MAX_WEAPON_DURABILITY,
          offhandPrefixId: undefined,
          offhandSuffixId: undefined
        });
      }
    } else {
      setActiveWeaponSet(ps, {
        offhandKey: 'none',
        offhandDurability: MAX_WEAPON_DURABILITY,
        offhandPrefixId: undefined,
        offhandSuffixId: undefined
      });
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
  const active = getActiveWeaponSet(ps);
  if (equipSlot === 'mainhand' && weapon?.twoHanded && active.offhandKey && active.offhandKey !== 'none') {
    unequipToInventory(ps, 'offhand', undefined, undefined, syncCombat);
  }
  if (equipSlot === 'mainhand') {
    setActiveWeaponSet(ps, {
      mainhandKey: instance.key,
      mainhandDurability: instance.durability,
      mainhandPrefixId: instance.prefixId,
      mainhandSuffixId: instance.suffixId
    });
    if (weapon?.twoHanded) {
      setActiveWeaponSet(ps, {
        offhandKey: 'none',
        offhandDurability: MAX_WEAPON_DURABILITY,
        offhandPrefixId: undefined,
        offhandSuffixId: undefined
      });
    }
  } else {
    setActiveWeaponSet(ps, {
      offhandKey: instance.key,
      offhandDurability: instance.durability,
      offhandPrefixId: instance.prefixId,
      offhandSuffixId: instance.suffixId
    });
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
 * Add one herb to inventory: stack with existing herb slot or use first empty slot.
 * Returns true if added.
 */
export function addHerbToInventory(ps: PlayingStateShape): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is HerbConsumable => isHerbSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as HerbConsumable).count += 1;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'herb', count: 1 };
  return true;
}

/**
 * Add one mushroom to inventory: stack with existing mushroom slot or use first empty slot.
 * Returns true if added.
 */
export function addMushroomToInventory(ps: PlayingStateShape): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is MushroomConsumable => isMushroomSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as MushroomConsumable).count += 1;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'mushroom', count: 1 };
  return true;
}

/**
 * Add one honey to inventory: stack with existing honey slot or use first empty slot.
 * Returns true if added.
 */
export function addHoneyToInventory(ps: PlayingStateShape): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is HoneyConsumable => isHoneySlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as HoneyConsumable).count += 1;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'honey', count: 1 };
  return true;
}

/**
 * Add one potion to inventory: stack with existing potion slot or use first empty slot.
 * Returns true if added.
 */
export function addPotionToInventory(ps: PlayingStateShape): boolean {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is PotionConsumable => isPotionSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as PotionConsumable).count += 1;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'potion', count: 1 };
  return true;
}

/**
 * Total gold from all inventory slots. Migrates legacy ps.gold into inventory on first read.
 */
export function getTotalGoldFromInventory(ps: PlayingStateShape): number {
  const legacy = (ps as { gold?: number }).gold;
  if (legacy != null && legacy > 0) {
    addGoldToInventory(ps, legacy);
    (ps as { gold?: number }).gold = 0;
  }
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isGoldSlot(s) ? sum + s.count : sum), 0);
}

/**
 * Add gold to inventory: stack with existing gold slot or use first empty slot.
 * Returns true if all amount was added (inventory had room).
 */
export function addGoldToInventory(ps: PlayingStateShape, amount: number): boolean {
  if (amount <= 0 || !ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return amount <= 0;
  const existing = ps.inventorySlots.findIndex((s): s is GoldConsumable => isGoldSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as GoldConsumable).count += amount;
    return true;
  }
  const empty = ps.inventorySlots.findIndex((s) => s == null);
  if (empty < 0) return false;
  ps.inventorySlots[empty] = { type: 'gold', count: amount };
  return true;
}

/**
 * Spend gold from inventory. Deducts from gold slot(s); returns true if enough was present.
 */
export function tryConsumeGold(ps: PlayingStateShape, amount: number): boolean {
  if (amount <= 0) return true;
  const total = getTotalGoldFromInventory(ps);
  if (total < amount) return false;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  let remaining = amount;
  for (let i = 0; i < ps.inventorySlots.length && remaining > 0; i++) {
    const slot = ps.inventorySlots[i];
    if (!isGoldSlot(slot)) continue;
    const take = Math.min(remaining, slot.count);
    slot.count -= take;
    remaining -= take;
    if (slot.count <= 0) ps.inventorySlots[i] = null;
  }
  return true;
}

/**
 * Find first inventory slot index containing at least one potion.
 */
export function findFirstPotionSlotIndex(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return -1;
  return ps.inventorySlots.findIndex((s) => isPotionSlot(s) && s.count >= 1);
}

/**
 * Use one potion from the given inventory slot (consumes 1; caller adds heal charge).
 * Returns true if a potion was consumed.
 */
export function usePotionFromInventory(ps: PlayingStateShape, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return false;
  const slot = ps.inventorySlots[slotIndex];
  if (!isPotionSlot(slot) || slot.count < 1) return false;
  if (slot.count === 1) {
    ps.inventorySlots[slotIndex] = null;
  } else {
    (ps.inventorySlots[slotIndex] as PotionConsumable).count -= 1;
  }
  return true;
}

/**
 * Use one potion from the given toolbelt slot (consumes 1; caller adds heal charge).
 * Returns true if a potion was consumed.
 */
export function usePotionFromToolbelt(ps: PlayingStateShape, toolbeltIndex: number): boolean {
  if (toolbeltIndex < 0 || toolbeltIndex >= TOOLBELT_SLOT_COUNT || !ps.toolbeltSlots) return false;
  const slot = ps.toolbeltSlots[toolbeltIndex];
  if (!slot || slot.type !== 'potion' || slot.count < 1) return false;
  if (slot.count === 1) {
    ps.toolbeltSlots[toolbeltIndex] = null;
  } else {
    ps.toolbeltSlots[toolbeltIndex] = { type: 'potion', count: slot.count - 1 };
  }
  return true;
}

/**
 * Find first toolbelt slot index with at least one potion, or -1.
 */
export function findFirstPotionToolbeltIndex(ps: PlayingStateShape): number {
  if (!ps.toolbeltSlots || ps.toolbeltSlots.length !== TOOLBELT_SLOT_COUNT) return -1;
  return ps.toolbeltSlots.findIndex((s) => s != null && s.type === 'potion' && s.count >= 1);
}

/**
 * Move one potion from an inventory slot to a toolbelt slot. Stacks if toolbelt slot already has potions.
 * Returns true if moved.
 */
export function addPotionToToolbeltFromInventory(
  ps: PlayingStateShape,
  fromInventoryIndex: number,
  toolbeltIndex: number
): boolean {
  if (toolbeltIndex < 0 || toolbeltIndex >= TOOLBELT_SLOT_COUNT || !ps.toolbeltSlots) return false;
  if (fromInventoryIndex < 0 || fromInventoryIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return false;
  const invSlot = ps.inventorySlots[fromInventoryIndex];
  if (!isPotionSlot(invSlot) || invSlot.count < 1) return false;
  const existing = ps.toolbeltSlots[toolbeltIndex];
  if (existing != null && existing.type !== 'potion') return false;
  if (invSlot.count === 1) {
    ps.inventorySlots[fromInventoryIndex] = null;
  } else {
    (ps.inventorySlots[fromInventoryIndex] as PotionConsumable).count -= 1;
  }
  if (existing && existing.type === 'potion') {
    ps.toolbeltSlots[toolbeltIndex] = { type: 'potion', count: existing.count + 1 };
  } else {
    ps.toolbeltSlots[toolbeltIndex] = { type: 'potion', count: 1 };
  }
  return true;
}

/**
 * Move one potion from a toolbelt slot back to inventory (stack with existing potion or first empty slot).
 * Returns true if moved.
 */
export function removePotionFromToolbeltToInventory(ps: PlayingStateShape, toolbeltIndex: number): boolean {
  if (toolbeltIndex < 0 || toolbeltIndex >= TOOLBELT_SLOT_COUNT || !ps.toolbeltSlots) return false;
  const slot = ps.toolbeltSlots[toolbeltIndex];
  if (!slot || slot.type !== 'potion' || slot.count < 1) return false;
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return false;
  const existing = ps.inventorySlots.findIndex((s): s is PotionConsumable => isPotionSlot(s));
  if (existing >= 0) {
    (ps.inventorySlots[existing] as PotionConsumable).count += 1;
  } else {
    const empty = ps.inventorySlots.findIndex((s) => s == null);
    if (empty < 0) return false;
    ps.inventorySlots[empty] = { type: 'potion', count: 1 };
  }
  if (slot.count === 1) {
    ps.toolbeltSlots[toolbeltIndex] = null;
  } else {
    ps.toolbeltSlots[toolbeltIndex] = { type: 'potion', count: slot.count - 1 };
  }
  return true;
}

/**
 * Use one whetstone from the given inventory slot on a weapon. Target can be equipped mainhand/offhand (repairs both hands) or an inventory weapon slot.
 * Repairs by 35% of max durability per target. One whetstone used. Returns true if used.
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

  if (target === 'mainhand' || target === 'offhand') {
    // One whetstone applies to both equipped hands (active set)
    const active = getActiveWeaponSet(ps);
    let repaired = false;
    const updates: Partial<{ mainhandDurability: number; offhandDurability: number }> = {};
    if (active.mainhandKey && active.mainhandKey !== 'none') {
      updates.mainhandDurability = Math.min(MAX_WEAPON_DURABILITY, active.mainhandDurability + repairAmount);
      repaired = true;
    }
    if (active.offhandKey && active.offhandKey !== 'none') {
      updates.offhandDurability = Math.min(MAX_WEAPON_DURABILITY, active.offhandDurability + repairAmount);
      repaired = true;
    }
    if (!repaired) return false;
    setActiveWeaponSet(ps, updates);
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
