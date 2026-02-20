// Registry of player weapons: tiered variants (sword_rusty, sword_bronze, ...) + single shield.
import { Weapon } from './Weapon.js';
import { BASE_WEAPON_CONFIGS, shieldConfig, defenderConfig, blessedWindsConfig } from './weaponConfigs.js';
import { MATERIALS, TIERED_WEAPON_KEYS, TIERED_OFFHAND_KEYS, getTierDamage } from './materialTiers.js';

const BASE_DISPLAY_NAMES: Record<string, string> = {
    sword: 'Sword',
    greatsword: 'Greatsword',
    dagger: 'Dagger',
    mace: 'Mace',
    crossbow: 'Crossbow',
    bow: 'Bow'
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

    registry['shield'] = Weapon.fromConfig(shieldConfig);
    registry['blessedWinds'] = Weapon.fromConfig(blessedWindsConfig);

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
