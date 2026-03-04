/**
 * Loot pools and roll logic for weapon drops from enemies.
 * Option C: roll rarity, then for each slot pre-fill or leave empty.
 */
import type { WeaponInstance } from '../state/PlayingState.js';
import { MAX_WEAPON_DURABILITY } from '../state/PlayingState.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS, MATERIALS, SHIELD_MATERIALS } from '../weapons/materialTiers.js';
import { getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import { rollEnchantForSlot } from './enchantmentConfig.js';
import type { EnchantmentSlot } from './enchantmentConfig.js';
import { rollItemRarity, getMaxSlotsForRarity, PRE_FILL_CHANCE } from './rarityConfig.js';
import type { ItemRarity } from './rarityConfig.js';

export interface LootPoolDef {
  /** Full weapon keys that can drop (e.g. sword_bronze, dagger_steel). */
  weaponKeys: string[];
  /** @deprecated Unused; rarity and pre-fill drive slots. Kept for reference. */
  enchantChance?: number;
  /** @deprecated Unused. Kept for reference. */
  secondEnchantChance?: number;
}

/** Loot pools by id. */
export const LOOT_POOLS: Record<string, LootPoolDef> = {
  goblin: {
    weaponKeys: ['dagger_bronze', 'dagger_steel', 'sword_bronze', 'defender_bronze'],
    enchantChance: 0.25,
    secondEnchantChance: 0.2
  },
  goblinChieftain: {
    weaponKeys: ['mace_bronze', 'mace_steel', 'greatsword_bronze', 'greatsword_steel'],
    enchantChance: 0.5,
    secondEnchantChance: 0.3
  },
  skeleton: {
    weaponKeys: ['sword_bronze', 'sword_steel', 'dagger_bronze', 'dagger_steel', 'defender_bronze'],
    enchantChance: 0.3,
    secondEnchantChance: 0.2
  },
  zombie: {
    weaponKeys: ['sword_bronze', 'mace_bronze', 'dagger_bronze'],
    enchantChance: 0.2,
    secondEnchantChance: 0.15
  },
  bandit: {
    weaponKeys: ['mace_bronze', 'mace_steel', 'sword_bronze', 'sword_steel', 'dagger_steel', 'defender_bronze'],
    enchantChance: 0.35,
    secondEnchantChance: 0.25
  },
  lesserDemon: {
    weaponKeys: ['sword_bronze', 'sword_steel', 'dagger_steel', 'mace_steel', 'defender_bronze'],
    enchantChance: 0.4,
    secondEnchantChance: 0.3
  },
  greaterDemon: {
    weaponKeys: ['sword_steel', 'sword_adamant', 'greatsword_steel', 'mace_steel', 'crossbow', 'bow_willow', 'staff_willow', 'defender_steel'],
    enchantChance: 0.55,
    secondEnchantChance: 0.35
  },
  fireDragon: {
    weaponKeys: ['sword_steel', 'sword_adamant', 'greatsword_steel', 'greatsword_adamant', 'mace_steel', 'crossbow', 'bow_yew', 'staff_yew', 'defender_steel'],
    enchantChance: 0.6,
    secondEnchantChance: 0.4
  },
  villageOgre: {
    weaponKeys: ['mace_steel', 'greatsword_bronze', 'greatsword_steel', 'defender_bronze', 'defender_steel'],
    enchantChance: 0.5,
    secondEnchantChance: 0.35
  },
  default: {
    weaponKeys: (() => {
      const keys: string[] = [];
      for (const base of TIERED_WEAPON_KEYS) {
        for (const mat of MATERIALS) keys.push(`${base}_${mat.id}`);
      }
      for (const mat of SHIELD_MATERIALS) keys.push(`shield_${mat.id}`);
      for (const base of TIERED_OFFHAND_KEYS) {
        for (const mat of MATERIALS) keys.push(`${base}_${mat.id}`);
      }
      return keys;
    })(),
    enchantChance: 0.2,
    secondEnchantChance: 0.1
  }
};

/**
 * Roll a weapon drop for the given enemy type. Returns null if no drop or invalid pool.
 * Option C: roll rarity, slot count from rarity, then per-slot pre-fill or empty.
 */
export function rollWeaponDrop(enemyType: string, poolId?: string): WeaponInstance | null {
  const pool = poolId && LOOT_POOLS[poolId] ? LOOT_POOLS[poolId] : LOOT_POOLS.default;
  if (!pool || pool.weaponKeys.length === 0) return null;
  const key = pool.weaponKeys[Math.floor(Math.random() * pool.weaponKeys.length)];
  if (!Weapons[key]) return null;
  const rarity: ItemRarity = rollItemRarity();
  const slotCount = getMaxSlotsForRarity(rarity);
  const enchantSlot: EnchantmentSlot = getEquipSlotForWeapon(key) === 'offhand' ? 'offhand' : 'weapon';
  const effectIds: (string | null)[] = [];
  for (let i = 0; i < slotCount; i++) {
    if (Math.random() < PRE_FILL_CHANCE) {
      const rolled = rollEnchantForSlot(enchantSlot);
      effectIds.push(rolled?.id ?? null);
    } else {
      effectIds.push(null);
    }
  }
  return {
    key,
    durability: MAX_WEAPON_DURABILITY,
    rarity,
    effectIds
  };
}

/** Repair amount: 35% of max weapon durability per whetstone. */
export const WHETSTONE_REPAIR_PERCENT = 0.35;

/**
 * Roll whether a whetstone drops. Caller should use enemy's whetstoneDropChance.
 */
export function rollWhetstoneDrop(chance: number): boolean {
  return chance > 0 && Math.random() < chance;
}

/**
 * Roll whether a page drops. Caller should use enemy's pageDropChance.
 */
export function rollPageDrop(chance: number): boolean {
  return chance > 0 && Math.random() < chance;
}
