import type { ItemRarity } from '../config/rarityConfig.js';

/** Unified tooltip hover: weapon, armor, whetstone, herb, mushroom, honey, potion, or gold slot; null when none. Used by Game and InventoryChestCanvas. */
export type TooltipHover =
    | { type: 'weapon'; weaponKey: string; x: number; y: number; durability?: number; rarity?: ItemRarity; effectIds?: (string | null)[] }
    | { type: 'armor'; armorKey: string; x: number; y: number; durability?: number }
    | { type: 'whetstone'; x: number; y: number; count: number }
    | { type: 'herb'; x: number; y: number; count: number }
    | { type: 'mushroom'; x: number; y: number; count: number }
    | { type: 'honey'; x: number; y: number; count: number }
    | { type: 'potion'; x: number; y: number; count: number }
    | { type: 'gold'; x: number; y: number; count: number }
    | { type: 'page'; x: number; y: number; count: number }
    | { type: 'enchantScroll'; x: number; y: number; count: number }
    | null;
