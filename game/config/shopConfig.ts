/**
 * Shop inventory: weapons the shopkeeper sells, grouped by material tier.
 * All tiers from materialTiers are sold (Bronze through Dragon).
 * Bow and staff use wood tiers (Oak through Elder).
 * Weapon keys must exist in WeaponsRegistry (e.g. sword_bronze, bow_oak, staff_elder).
 */
import { MATERIALS, TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS, WOOD_MATERIALS } from '../weapons/materialTiers.js';

export interface ShopItem {
  weaponKey: string;
  price: number;
}

export interface ShopSection {
  /** Section label shown in the shop UI (e.g. "Rusty", "Steel"). */
  title: string;
  items: ShopItem[];
}

/** Base price (gold) for each weapon type at Bronze tier. */
const BRONZE_BASE_PRICE: Record<string, number> = {
  sword: 25,
  dagger: 20,
  greatsword: 45,
  mace: 35,
  defender: 22,
};

/** Base price for bow and staff at Oak tier; added per wood tier. */
const OAK_BASE_PRICE: Record<string, number> = {
  bow: 30,
  staff: 35,
};

/** Crossbow is a single (non-tiered) weapon. */
const CROSSBOW_PRICE = 40;

/** Extra price per wood tier (index matches WOOD_MATERIALS order). */
const WOOD_TIER_PRICE_ADD: Record<string, number> = {
  oak: 0,
  willow: 25,
  yew: 55,
  elder: 95,
};

/** Extra price added per material tier (index matches MATERIALS order). */
const TIER_PRICE_ADD: Record<string, number> = {
  bronze: 0,
  steel: 80,
  adamant: 180,
  dragon: 320,
};

function buildShopSections(): ShopSection[] {
  const sections: ShopSection[] = [];
  for (const material of MATERIALS) {
    const add = TIER_PRICE_ADD[material.id] ?? 0;
    const items: ShopItem[] = [];
    for (const baseKey of TIERED_WEAPON_KEYS) {
      const basePrice = BRONZE_BASE_PRICE[baseKey] ?? 30;
      items.push({
        weaponKey: `${baseKey}_${material.id}`,
        price: basePrice + add,
      });
    }
    for (const baseKey of TIERED_OFFHAND_KEYS) {
      const basePrice = BRONZE_BASE_PRICE[baseKey] ?? 22;
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
  for (const wood of WOOD_MATERIALS) {
    const add = WOOD_TIER_PRICE_ADD[wood.id] ?? 0;
    const items: ShopItem[] = [];
    const bowPrice = (OAK_BASE_PRICE.bow ?? 30) + add;
    const staffPrice = (OAK_BASE_PRICE.staff ?? 35) + add;
    items.push({ weaponKey: `bow_${wood.id}`, price: bowPrice });
    items.push({ weaponKey: `staff_${wood.id}`, price: staffPrice });
    sections.push({
      title: `${wood.displayName} (Bow & Staff)`,
      items,
    });
  }
  sections.push({
    title: 'Crossbow',
    items: [{ weaponKey: 'crossbow', price: CROSSBOW_PRICE }],
  });
  return sections;
}

/** Shop organized by material tier. One section per tier (Rusty → Dragon), each with all weapon types. */
export const SHOP_SECTIONS: ShopSection[] = buildShopSections();

/** Flat list of all shop items (for code that needs a single list). */
export const SHOP_ITEMS: ShopItem[] = SHOP_SECTIONS.flatMap((s) => s.items);

/** Order and display names for weapon-type dropdowns in the shop UI. */
export const SHOP_WEAPON_TYPE_ORDER: string[] = [...TIERED_WEAPON_KEYS, ...TIERED_OFFHAND_KEYS, 'bow', 'staff', 'crossbow'];

export const SHOP_WEAPON_TYPE_LABELS: Record<string, string> = {
  sword: 'Sword',
  dagger: 'Dagger',
  greatsword: 'Greatsword',
  mace: 'Mace',
  defender: 'Defender',
  bow: 'Bow',
  staff: 'Staff',
  crossbow: 'Crossbow',
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
