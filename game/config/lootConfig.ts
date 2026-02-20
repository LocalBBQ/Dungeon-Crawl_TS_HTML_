/**
 * Loot pools and roll logic for weapon drops from enemies.
 */
import type { WeaponInstance } from '../state/PlayingState.js';
import { MAX_WEAPON_DURABILITY } from '../state/PlayingState.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS, MATERIALS } from '../weapons/materialTiers.js';
import { getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import { rollEnchantForSlot } from './enchantmentConfig.js';
import type { EnchantmentSlot } from './enchantmentConfig.js';

export interface LootPoolDef {
  /** Full weapon keys that can drop (e.g. sword_rusty, dagger_bronze). */
  weaponKeys: string[];
  /** Chance (0–1) that the item has at least one enchant. */
  enchantChance: number;
  /** If has enchants, chance (0–1) to get a second enchant. */
  secondEnchantChance: number;
}

/** Loot pools by id. */
export const LOOT_POOLS: Record<string, LootPoolDef> = {
  goblin: {
    weaponKeys: ['dagger_rusty', 'dagger_bronze', 'sword_rusty', 'defender_rusty'],
    enchantChance: 0.25,
    secondEnchantChance: 0.2
  },
  goblinChieftain: {
    weaponKeys: ['mace_rusty', 'mace_bronze', 'mace_iron', 'greatsword_rusty', 'greatsword_bronze'],
    enchantChance: 0.5,
    secondEnchantChance: 0.3
  },
  skeleton: {
    weaponKeys: ['sword_rusty', 'sword_bronze', 'dagger_rusty', 'dagger_bronze', 'defender_rusty'],
    enchantChance: 0.3,
    secondEnchantChance: 0.2
  },
  zombie: {
    weaponKeys: ['sword_rusty', 'mace_rusty', 'dagger_rusty'],
    enchantChance: 0.2,
    secondEnchantChance: 0.15
  },
  bandit: {
    weaponKeys: ['mace_rusty', 'mace_bronze', 'sword_rusty', 'sword_bronze', 'dagger_bronze', 'defender_rusty'],
    enchantChance: 0.35,
    secondEnchantChance: 0.25
  },
  lesserDemon: {
    weaponKeys: ['sword_iron', 'sword_steel', 'dagger_iron', 'mace_iron', 'defender_bronze'],
    enchantChance: 0.4,
    secondEnchantChance: 0.3
  },
  greaterDemon: {
    weaponKeys: ['sword_steel', 'sword_mithril', 'greatsword_iron', 'greatsword_steel', 'mace_steel', 'crossbow_iron', 'defender_iron'],
    enchantChance: 0.55,
    secondEnchantChance: 0.35
  },
  fireDragon: {
    weaponKeys: ['sword_steel', 'sword_mithril', 'greatsword_steel', 'greatsword_mithril', 'mace_steel', 'crossbow_iron', 'defender_iron'],
    enchantChance: 0.6,
    secondEnchantChance: 0.4
  },
  default: {
    weaponKeys: (() => {
      const keys: string[] = [];
      for (const base of TIERED_WEAPON_KEYS) {
        for (const mat of MATERIALS) keys.push(`${base}_${mat.id}`);
      }
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
 */
export function rollWeaponDrop(enemyType: string, poolId?: string): WeaponInstance | null {
  const pool = poolId && LOOT_POOLS[poolId] ? LOOT_POOLS[poolId] : LOOT_POOLS.default;
  if (!pool || pool.weaponKeys.length === 0) return null;
  const key = pool.weaponKeys[Math.floor(Math.random() * pool.weaponKeys.length)];
  if (!Weapons[key]) return null;
  const enchantSlot: EnchantmentSlot = getEquipSlotForWeapon(key) === 'offhand' ? 'offhand' : 'weapon';
  let prefixId: string | undefined;
  let suffixId: string | undefined;
  if (Math.random() < pool.enchantChance) {
    const first = rollEnchantForSlot(enchantSlot);
    if (first) prefixId = first.id;
    if (Math.random() < pool.secondEnchantChance) {
      const second = rollEnchantForSlot(enchantSlot);
      if (second) suffixId = second.id;
    }
  }
  return {
    key,
    durability: MAX_WEAPON_DURABILITY,
    prefixId,
    suffixId
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
