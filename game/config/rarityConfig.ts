/**
 * Item rarity (weapon/armor instance): common, magic, rare, legendary.
 * Drives effect slot count, drop weights, and UI colors.
 */

export type ItemRarity = 'common' | 'magic' | 'rare' | 'legendary';

/** Max effect slots per rarity. Common = 0, Magic = 1, Rare/Legendary = 2. */
export const RARITY_SLOT_COUNT: Record<ItemRarity, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 2
};

export function getMaxSlotsForRarity(rarity: ItemRarity): number {
  return RARITY_SLOT_COUNT[rarity] ?? 0;
}

/** Weights for rolling rarity on drop (need not sum to 1; normalized). */
export const RARITY_DROP_WEIGHTS: Record<ItemRarity, number> = {
  common: 60,
  magic: 25,
  rare: 12,
  legendary: 3
};

const RARITY_ORDER: ItemRarity[] = ['common', 'magic', 'rare', 'legendary'];

/**
 * Roll a random item rarity from RARITY_DROP_WEIGHTS.
 */
export function rollItemRarity(): ItemRarity {
  const total = RARITY_ORDER.reduce((s, r) => s + RARITY_DROP_WEIGHTS[r], 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= RARITY_DROP_WEIGHTS[r];
    if (roll <= 0) return r;
  }
  return 'common';
}

/** Chance (0–1) each slot is pre-filled at drop. */
export const PRE_FILL_CHANCE = 0.7;

export interface RarityStyle {
  border: string;
  text: string;
  slotTint?: string;
}

/** UI colors per rarity (borders, text, optional slot tint). */
const RARITY_STYLES: Record<ItemRarity, RarityStyle> = {
  common: { border: '#9a9a9a', text: '#b0b0b0' },
  magic: { border: '#5882b4', text: '#7eb8e8', slotTint: 'rgba(94,130,180,0.12)' },
  rare: { border: '#8b5a9b', text: '#b070c0', slotTint: 'rgba(139,90,155,0.12)' },
  legendary: { border: '#c9a227', text: '#e8d4a0', slotTint: 'rgba(201,162,39,0.15)' }
};

export function getRarityStyle(rarity: ItemRarity): RarityStyle {
  return RARITY_STYLES[rarity] ?? RARITY_STYLES.common;
}
