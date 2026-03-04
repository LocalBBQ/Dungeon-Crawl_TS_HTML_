/**
 * Weapon material tiers: 4 tiers — Bronze (weakest/default), Steel, Adamant, Dragon.
 * Each tier has its own color and explicit baseDamage per weapon type (no multipliers).
 */

export interface MaterialDef {
    id: string;
    displayName: string;
    color: string;
}

export const MATERIALS: MaterialDef[] = [
    { id: 'bronze', displayName: 'Bronze', color: '#a86b2c' },
    { id: 'steel', displayName: 'Steel', color: '#a8a8b0' },
    { id: 'adamant', displayName: 'Adamant', color: '#4a7c59' },
    { id: 'dragon', displayName: 'Dragon', color: '#b83c3c' }
];

/** Wood types for bow and staff (tiered like shield materials). */
export const WOOD_MATERIALS: MaterialDef[] = [
    { id: 'oak', displayName: 'Oak', color: '#8B6914' },
    { id: 'willow', displayName: 'Willow', color: '#9aab7e' },
    { id: 'yew', displayName: 'Yew', color: '#4a6b2e' },
    { id: 'elder', displayName: 'Elder', color: '#2d4a1f' }
];

/** Base damage per bow wood tier. */
export const BOW_WOOD_DAMAGE: Record<string, number> = {
    oak: 10,
    willow: 14,
    yew: 18,
    elder: 22
};

/** Base damage per staff wood tier. */
export const STAFF_WOOD_DAMAGE: Record<string, number> = {
    oak: 14,
    willow: 18,
    yew: 22,
    elder: 26
};

/** Weapon types that get material tier variants (shield is single, no tiers). Bow and staff use wood tiers; crossbow is single. */
export const TIERED_WEAPON_KEYS = ['sword', 'greatsword', 'dagger', 'mace'] as const;

/** Offhand types that get material tier variants. */
export const TIERED_OFFHAND_KEYS = ['defender'] as const;

/** Four shield tiers: Wooden (base), Iron, Steel, Rune. */
export const SHIELD_MATERIALS: MaterialDef[] = [
    { id: 'wooden', displayName: 'Wooden', color: '#8B6914' },
    { id: 'iron', displayName: 'Iron', color: '#5a5a5a' },
    { id: 'steel', displayName: 'Steel', color: '#a8a8b0' },
    { id: 'rune', displayName: 'Rune', color: '#7eb8e8' }
];

/** Block stats per shield tier (damageReduction 0–1, staminaCost per block). */
export const SHIELD_BLOCK_TABLE: Record<string, { damageReduction: number; staminaCost: number }> = {
    wooden: { damageReduction: 0.55, staminaCost: 28 },
    iron: { damageReduction: 0.62, staminaCost: 25 },
    steel: { damageReduction: 0.70, staminaCost: 22 },
    rune: { damageReduction: 0.78, staminaCost: 20 }
};

export type TieredWeaponKey = (typeof TIERED_WEAPON_KEYS)[number];

/**
 * Explicit baseDamage per (weapon key, material id). No multipliers.
 * 4 tiers: Bronze (weakest), Steel, Adamant, Dragon (strongest).
 */
export const TIER_DAMAGE_TABLE: Record<string, Record<string, number>> = {
    sword: {
        bronze: 10, steel: 16, adamant: 22, dragon: 28
    },
    greatsword: {
        bronze: 12, steel: 20, adamant: 27, dragon: 35
    },
    dagger: {
        bronze: 3, steel: 6, adamant: 9, dragon: 12
    },
    mace: {
        bronze: 14, steel: 22, adamant: 29, dragon: 36
    },
    defender: {
        bronze: 6, steel: 11, adamant: 15, dragon: 20
    }
};

export function getTierDamage(weaponKey: string, materialId: string): number | undefined {
    const byWeapon = TIER_DAMAGE_TABLE[weaponKey];
    return byWeapon ? byWeapon[materialId] : undefined;
}

export function getBowWoodDamage(woodId: string): number | undefined {
    return BOW_WOOD_DAMAGE[woodId];
}

export function getStaffWoodDamage(woodId: string): number | undefined {
    return STAFF_WOOD_DAMAGE[woodId];
}

export function getMaterialById(id: string): MaterialDef | undefined {
    return MATERIALS.find((m) => m.id === id);
}
