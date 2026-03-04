// Registry of player weapons: tiered variants (sword_bronze, shield_wooden, ...).
import { Weapon } from './Weapon.js';
import { BASE_WEAPON_CONFIGS, shieldConfig, defenderConfig, blessedWindsConfig, crossbowConfig, bowConfig, staffConfig } from './weaponConfigs.js';
import { MATERIALS, TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS, getTierDamage, SHIELD_MATERIALS, SHIELD_BLOCK_TABLE, WOOD_MATERIALS, getBowWoodDamage, getStaffWoodDamage } from './materialTiers.js';

const BASE_DISPLAY_NAMES: Record<string, string> = {
    sword: 'Sword',
    greatsword: 'Greatsword',
    dagger: 'Dagger',
    mace: 'Mace',
    shield: 'Shield'
};

function buildWeaponsRegistry(): Record<string, Weapon> {
    const registry: Record<string, Weapon> = {};

    for (const baseKey of TIERED_WEAPON_KEYS) {
        const baseConfig = BASE_WEAPON_CONFIGS[baseKey];
        const baseName = BASE_DISPLAY_NAMES[baseKey] ?? baseKey;
        if (!baseConfig) continue;

        for (const material of MATERIALS) {
            const damage = getTierDamage(baseKey, material.id);
            if (damage === undefined) continue;

            const variantConfig = {
                ...baseConfig,
                name: `${material.displayName} ${baseName}`,
                baseDamage: damage,
                color: material.color,
                material: material.id
            };
            registry[`${baseKey}_${material.id}`] = Weapon.fromConfig(variantConfig);
        }
    }

    for (const mat of SHIELD_MATERIALS) {
        const blockStats = SHIELD_BLOCK_TABLE[mat.id];
        if (!blockStats || !shieldConfig.block) continue;
        const variantConfig = {
            ...shieldConfig,
            name: `${mat.displayName} Shield`,
            color: mat.color,
            material: mat.id,
            block: { ...shieldConfig.block, ...blockStats }
        };
        registry[`shield_${mat.id}`] = Weapon.fromConfig(variantConfig);
    }
    registry['blessedWinds'] = Weapon.fromConfig(blessedWindsConfig);

    // Crossbow: single variant (no wood tiers)
    registry['crossbow'] = Weapon.fromConfig({ ...crossbowConfig, name: 'Crossbow', baseDamage: crossbowConfig.baseDamage });

    // Bow: wood tiers (Oak, Willow, Yew, Elder)
    for (const wood of WOOD_MATERIALS) {
        const damage = getBowWoodDamage(wood.id);
        if (damage === undefined) continue;
        registry[`bow_${wood.id}`] = Weapon.fromConfig({
            ...bowConfig,
            name: `${wood.displayName} Bow`,
            baseDamage: damage,
            color: wood.color,
            material: wood.id
        });
    }

    // Staff: wood tiers (Oak, Willow, Yew, Elder)
    for (const wood of WOOD_MATERIALS) {
        const damage = getStaffWoodDamage(wood.id);
        if (damage === undefined) continue;
        registry[`staff_${wood.id}`] = Weapon.fromConfig({
            ...staffConfig,
            name: `${wood.displayName} Staff`,
            baseDamage: damage,
            color: wood.color,
            material: wood.id
        });
    }

    for (const baseKey of TIERED_OFFHAND_KEYS) {
        const baseConfig = defenderConfig;
        for (const material of MATERIALS) {
            const damage = getTierDamage(baseKey, material.id);
            if (damage === undefined) continue;
            const variantConfig = {
                ...baseConfig,
                name: `${material.displayName} Defender`,
                baseDamage: damage,
                color: material.color,
                material: material.id
            };
            registry[`${baseKey}_${material.id}`] = Weapon.fromConfig(variantConfig);
        }
    }
    return registry;
}

export const Weapons: Record<string, unknown> = buildWeaponsRegistry();
