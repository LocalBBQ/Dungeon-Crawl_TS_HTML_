/**
 * Armor equip/unequip/swap actions. Mutations on PlayingState.
 * Armor is stored in the same inventorySlots as weapons (12 slots).
 */
import type { PlayingStateShape } from './PlayingState.js';
import {
  type ArmorSlotId,
  INVENTORY_SLOT_COUNT,
  MAX_ARMOR_DURABILITY
} from './PlayingState.js';
import { getArmor } from '../armor/armorConfigs.js';

export function canEquipArmorInSlot(armorKey: string, slot: ArmorSlotId): boolean {
  const config = getArmor(armorKey);
  return config != null && config.slot === slot;
}

function getEquippedKey(ps: PlayingStateShape, slot: ArmorSlotId): string {
  switch (slot) {
    case 'head': return ps.equippedArmorHeadKey;
    case 'chest': return ps.equippedArmorChestKey;
    case 'hands': return ps.equippedArmorHandsKey;
    case 'feet': return ps.equippedArmorFeetKey;
  }
}

function getEquippedDurability(ps: PlayingStateShape, slot: ArmorSlotId): number {
  switch (slot) {
    case 'head': return ps.equippedArmorHeadDurability;
    case 'chest': return ps.equippedArmorChestDurability;
    case 'hands': return ps.equippedArmorHandsDurability;
    case 'feet': return ps.equippedArmorFeetDurability;
  }
}

function setEquipped(ps: PlayingStateShape, slot: ArmorSlotId, key: string, durability: number): void {
  switch (slot) {
    case 'head':
      ps.equippedArmorHeadKey = key;
      ps.equippedArmorHeadDurability = durability;
      break;
    case 'chest':
      ps.equippedArmorChestKey = key;
      ps.equippedArmorChestDurability = durability;
      break;
    case 'hands':
      ps.equippedArmorHandsKey = key;
      ps.equippedArmorHandsDurability = durability;
      break;
    case 'feet':
      ps.equippedArmorFeetKey = key;
      ps.equippedArmorFeetDurability = durability;
      break;
  }
}

export function equipArmorFromInventory(
  ps: PlayingStateShape,
  inventoryIndex: number,
  slot: ArmorSlotId
): void {
  if (inventoryIndex < 0 || inventoryIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const item = ps.inventorySlots[inventoryIndex];
  if (!item || item.durability <= 0) return;
  if (!canEquipArmorInSlot(item.key, slot)) return;

  const currentKey = getEquippedKey(ps, slot);
  const currentDur = getEquippedDurability(ps, slot);

  setEquipped(ps, slot, item.key, item.durability);
  if (currentKey && currentKey !== 'none') {
    ps.inventorySlots[inventoryIndex] = { key: currentKey, durability: currentDur };
  } else {
    ps.inventorySlots[inventoryIndex] = null;
  }
}

export function unequipArmorToInventory(
  ps: PlayingStateShape,
  slot: ArmorSlotId,
  inventoryIndex?: number
): void {
  const key = getEquippedKey(ps, slot);
  const durability = getEquippedDurability(ps, slot);
  if (!key || key === 'none') return;

  const targetIndex = inventoryIndex ?? ps.inventorySlots?.findIndex((s) => s == null) ?? -1;
  if (targetIndex < 0 || targetIndex >= INVENTORY_SLOT_COUNT) return;
  if (ps.inventorySlots![targetIndex] != null && inventoryIndex === undefined) return;

  setEquipped(ps, slot, 'none', MAX_ARMOR_DURABILITY);
  ps.inventorySlots![targetIndex] = { key, durability };
}

export function swapArmorWithInventory(
  ps: PlayingStateShape,
  slot: ArmorSlotId,
  inventoryIndex: number
): void {
  if (inventoryIndex < 0 || inventoryIndex >= INVENTORY_SLOT_COUNT || !ps.inventorySlots) return;
  const invItem = ps.inventorySlots[inventoryIndex];
  const equipKey = getEquippedKey(ps, slot);
  const equipDur = getEquippedDurability(ps, slot);

  if (invItem && (invItem.durability <= 0 || !canEquipArmorInSlot(invItem.key, slot))) return;

  setEquipped(ps, slot, invItem ? invItem.key : 'none', invItem ? invItem.durability : MAX_ARMOR_DURABILITY);
  ps.inventorySlots[inventoryIndex] =
    equipKey && equipKey !== 'none' ? { key: equipKey, durability: equipDur } : null;
}

export function swapArmorWithArmor(
  ps: PlayingStateShape,
  slotA: ArmorSlotId,
  slotB: ArmorSlotId
): void {
  const keyA = getEquippedKey(ps, slotA);
  const durA = getEquippedDurability(ps, slotA);
  const keyB = getEquippedKey(ps, slotB);
  const durB = getEquippedDurability(ps, slotB);

  const configA = keyA !== 'none' ? getArmor(keyA) : null;
  const configB = keyB !== 'none' ? getArmor(keyB) : null;
  if (keyA !== 'none' && configA?.slot !== slotB) return;
  if (keyB !== 'none' && configB?.slot !== slotA) return;

  setEquipped(ps, slotA, keyB && keyB !== 'none' ? keyB : 'none', keyB && keyB !== 'none' ? durB : MAX_ARMOR_DURABILITY);
  setEquipped(ps, slotB, keyA && keyA !== 'none' ? keyA : 'none', keyA && keyA !== 'none' ? durA : MAX_ARMOR_DURABILITY);
}
