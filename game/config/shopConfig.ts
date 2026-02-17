/**
 * Shop inventory: weapons the shopkeeper sells, grouped by material tier.
 * All tiers from materialTiers are sold (Rusty through Dragon).
 * Weapon keys must exist in WeaponsRegistry (e.g. sword_rusty, sword_dragon).
 */
import { MATERIALS, TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS } from '../weapons/materialTiers.js';

export interface ShopItem {
  weaponKey: string;
  price: number;
}

export interface ShopSection {
  /** Section label shown in the shop UI (e.g. "Rusty", "Steel"). */
  title: string;
  items: ShopItem[];
}

/** Base price (gold) for each weapon type at Rusty tier. */
const RUSTY_BASE_PRICE: Record<string, number> = {
  sword: 25,
  dagger: 20,
  greatsword: 45,
  mace: 35,
  crossbow: 40,
  defender: 22,
};

/** Extra price added per material tier (index matches MATERIALS order). */
const TIER_PRICE_ADD: Record<string, number> = {
  rusty: 0,
  bronze: 30,
  iron: 65,
  steel: 115,
  mithril: 175,
  adamant: 250,
  rune: 340,
  dragon: 450,
};

function buildShopSections(): ShopSection[] {
  const sections: ShopSection[] = [];
  for (const material of MATERIALS) {
    const add = TIER_PRICE_ADD[material.id] ?? 0;
    const items: ShopItem[] = [];
    for (const baseKey of TIERED_WEAPON_KEYS) {
      const basePrice = RUSTY_BASE_PRICE[baseKey] ?? 30;
      items.push({
        weaponKey: `${baseKey}_${material.id}`,
        price: basePrice + add,
      });
    }
    for (const baseKey of TIERED_OFFHAND_KEYS) {
      const basePrice = RUSTY_BASE_PRICE[baseKey] ?? 22;
      items.push({
        weaponKey: `${baseKey}_${material.id}`,
        price: basePrice + add,
      });
    }
    sections.push({
      title: material.displayName,
      items,
    });
  }
  return sections;
}

/** Shop organized by material tier. One section per tier (Rusty → Dragon), each with all weapon types. */
export const SHOP_SECTIONS: ShopSection[] = buildShopSections();

/** Flat list of all shop items (for code that needs a single list). */
export const SHOP_ITEMS: ShopItem[] = SHOP_SECTIONS.flatMap((s) => s.items);

/** Order and display names for weapon-type dropdowns in the shop UI. */
export const SHOP_WEAPON_TYPE_ORDER: string[] = [...TIERED_WEAPON_KEYS, ...TIERED_OFFHAND_KEYS];

export const SHOP_WEAPON_TYPE_LABELS: Record<string, string> = {
  sword: 'Sword',
  dagger: 'Dagger',
  greatsword: 'Greatsword',
  mace: 'Mace',
  crossbow: 'Crossbow',
  defender: 'Defender',
};

/** Shop items grouped by base weapon type (for dropdown menus). */
export function getShopByWeaponType(): Record<string, ShopItem[]> {
  const byType: Record<string, ShopItem[]> = {};
  for (const item of SHOP_ITEMS) {
    const base = item.weaponKey.indexOf('_') > 0 ? item.weaponKey.slice(0, item.weaponKey.indexOf('_')) : item.weaponKey;
    if (!byType[base]) byType[base] = [];
    byType[base].push(item);
  }
  return byType;
}
