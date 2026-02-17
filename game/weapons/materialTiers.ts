/**
 * Weapon material tiers: Rusty (weakest/default), Bronze, Iron, Steel, Mithril, Adamant, Rune, Dragon.
 * Each tier has its own color and explicit baseDamage per weapon type (no multipliers).
 */

export interface MaterialDef {
    id: string;
    displayName: string;
    color: string;
}

export const MATERIALS: MaterialDef[] = [
    { id: 'rusty', displayName: 'Rusty', color: '#a0522d' },
    { id: 'bronze', displayName: 'Bronze', color: '#b87333' },
    { id: 'iron', displayName: 'Iron', color: '#5a5a5a' },
    { id: 'steel', displayName: 'Steel', color: '#a8a8b0' },
    { id: 'mithril', displayName: 'Mithril', color: '#6b8cae' },
    { id: 'adamant', displayName: 'Adamant', color: '#4a7c59' },
    { id: 'rune', displayName: 'Rune', color: '#7eb8e8' },
    { id: 'dragon', displayName: 'Dragon', color: '#cc4444' }
];

/** Weapon types that get material tier variants (shield is single, no tiers). */
export const TIERED_WEAPON_KEYS = ['sword', 'greatsword', 'dagger', 'mace', 'crossbow'] as const;

/** Offhand types that get material tier variants (shield is single, no tiers). */
export const TIERED_OFFHAND_KEYS = ['defender'] as const;

export type TieredWeaponKey = (typeof TIERED_WEAPON_KEYS)[number];

/**
 * Explicit baseDamage per (weapon key, material id). No multipliers.
 * Rusty = weakest, Dragon = strongest per weapon.
 */
export const TIER_DAMAGE_TABLE: Record<string, Record<string, number>> = {
    sword: {
        rusty: 8, bronze: 12, iron: 15, steel: 18, mithril: 21, adamant: 24, rune: 26, dragon: 28
    },
    greatsword: {
        rusty: 10, bronze: 15, iron: 19, steel: 23, mithril: 26, adamant: 29, rune: 32, dragon: 35
    },
    dagger: {
        rusty: 2, bronze: 4, iron: 5, steel: 6, mithril: 8, adamant: 9, rune: 10, dragon: 12
    },
    mace: {
        rusty: 12, bronze: 17, iron: 20, steel: 24, mithril: 27, adamant: 30, rune: 33, dragon: 36
    },
    crossbow: {
        rusty: 14, bronze: 19, iron: 22, steel: 26, mithril: 29, adamant: 32, rune: 35, dragon: 38
    },
    defender: {
        rusty: 5, bronze: 7, iron: 9, steel: 11, mithril: 13, adamant: 15, rune: 17, dragon: 20
    }
};

export function getTierDamage(weaponKey: string, materialId: string): number | undefined {
    const byWeapon = TIER_DAMAGE_TABLE[weaponKey];
    return byWeapon ? byWeapon[materialId] : undefined;
}

export function getMaterialById(id: string): MaterialDef | undefined {
    return MATERIALS.find((m) => m.id === id);
}
