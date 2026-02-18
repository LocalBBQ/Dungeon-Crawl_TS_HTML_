/**
 * Armor configs and player armor damage reduction.
 */
import type { ArmorSlotId } from '../state/PlayingState.js';
import type { PlayingStateShape } from '../state/PlayingState.js';

export interface ArmorConfig {
  key: string;
  name: string;
  slot: ArmorSlotId;
  damageReduction: number;
  maxDurability?: number;
}

const ARMOR_CAP = 0.75;

const headArmors: ArmorConfig[] = [
  { key: 'leather_cap', name: 'Leather Cap', slot: 'head', damageReduction: 0.05, maxDurability: 100 },
  { key: 'chain_coif', name: 'Chain Coif', slot: 'head', damageReduction: 0.12, maxDurability: 100 },
  { key: 'iron_helm', name: 'Iron Helm', slot: 'head', damageReduction: 0.18, maxDurability: 100 },
];

const chestArmors: ArmorConfig[] = [
  { key: 'padded_vest', name: 'Padded Vest', slot: 'chest', damageReduction: 0.08, maxDurability: 100 },
  { key: 'chainmail', name: 'Chainmail', slot: 'chest', damageReduction: 0.18, maxDurability: 100 },
  { key: 'plate_chest', name: 'Plate Chest', slot: 'chest', damageReduction: 0.25, maxDurability: 100 },
];

const handsArmors: ArmorConfig[] = [
  { key: 'leather_gloves', name: 'Leather Gloves', slot: 'hands', damageReduction: 0.04, maxDurability: 100 },
  { key: 'chain_gauntlets', name: 'Chain Gauntlets', slot: 'hands', damageReduction: 0.10, maxDurability: 100 },
];

const feetArmors: ArmorConfig[] = [
  { key: 'leather_boots', name: 'Leather Boots', slot: 'feet', damageReduction: 0.05, maxDurability: 100 },
  { key: 'chain_boots', name: 'Chain Boots', slot: 'feet', damageReduction: 0.12, maxDurability: 100 },
];

const allArmors = [...headArmors, ...chestArmors, ...handsArmors, ...feetArmors];

export const ARMOR_CONFIGS: Record<string, ArmorConfig> = Object.fromEntries(
  allArmors.map((a) => [a.key, a])
);

export function getArmor(key: string): ArmorConfig | undefined {
  return ARMOR_CONFIGS[key];
}

/** Total damage reduction from all equipped armor (capped at ARMOR_CAP). */
export function getPlayerArmorReduction(ps: PlayingStateShape): number {
  let total = 0;
  const slots: { key: string; durability: number }[] = [
    { key: ps.equippedArmorHeadKey, durability: ps.equippedArmorHeadDurability },
    { key: ps.equippedArmorChestKey, durability: ps.equippedArmorChestDurability },
    { key: ps.equippedArmorHandsKey, durability: ps.equippedArmorHandsDurability },
    { key: ps.equippedArmorFeetKey, durability: ps.equippedArmorFeetDurability },
  ];
  for (const { key, durability } of slots) {
    if (key !== 'none' && durability > 0) {
      const config = getArmor(key);
      if (config) total += config.damageReduction;
    }
  }
  return Math.min(total, ARMOR_CAP);
}

/** Armors available in shop (curated list with prices). */
export const SHOP_ARMOR_ENTRIES: { key: string; price: number }[] = [
  { key: 'leather_cap', price: 80 },
  { key: 'chain_coif', price: 200 },
  { key: 'iron_helm', price: 400 },
  { key: 'padded_vest', price: 120 },
  { key: 'chainmail', price: 350 },
  { key: 'plate_chest', price: 600 },
  { key: 'leather_gloves', price: 60 },
  { key: 'chain_gauntlets', price: 180 },
  { key: 'leather_boots', price: 70 },
  { key: 'chain_boots', price: 220 },
];
