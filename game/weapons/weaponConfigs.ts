// All weapon configs and instances (including chieftain club for enemies).
import { Weapon } from './Weapon.js';
import type { WeaponConfigInput } from './Weapon.js';
import type { StageConfigInput } from './weaponBehavior.js';

const swordConfig: WeaponConfigInput = {
    name: 'sword',
    baseRange: 80,
    baseDamage: 15,
    baseArcDegrees: 60,
    cooldown: 0.115,
    speed: 1.2,
    comboWindow: 1.5,
    baseStunBuildup: 25,
    weaponLength: 55,
    block: {
        enabled: true,
        arcDegrees: 100,
        damageReduction: 0.38,
        staminaCost: 22,
        animationKey: 'block'
    },
    stages: [
        { name: 'slash', arcDegrees: 90, duration: 450, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28 },
        { name: 'slash', arcDegrees: 90, duration: 450, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28, reverseSweep: true },
        { name: 'stab', arcDegrees: 24, duration: 340, staminaCost: 12, range: 120, damageMultiplier: 1.0, animationKey: 'melee2', stunBuildup: 22, thrust: true, thrustWidth: 44 }
    ],
    dashAttack: { name: 'spin', arcDegrees: 360, duration: 740, staminaCost: 25, range: 72, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 350, dashDuration: 0.25, stunBuildup: 50 },
    chargeAttack: {
        minChargeTime: 0.125,
        maxChargeTime: 2.0,
        damageMultiplier: 2.0,
        rangeMultiplier: 1.2,
        staminaCostMultiplier: 1.5,
        chargedThrustDashSpeed: 380,
        chargedThrustDashDistanceMin: 50,
        chargedThrustDashDistanceMax: 170
    },
    attackVisual: {
        thrustLungeForwardWorld: 32,
        thrustAnticipationRatio: 0.32
    }
};

const shieldConfig: WeaponConfigInput = {
    name: 'shield',
    offhandOnly: true,
    baseRange: 0,
    baseDamage: 0,
    baseArcDegrees: 180,
    cooldown: 0, // defensive-only; no attack cooldown
    comboWindow: 0,
    stages: [],
    block: {
        enabled: true,
        arcDegrees: 180,
        damageReduction: 0.65,
        staminaCost: 25,
        animationKey: 'block',
        shieldBash: {
            knockback: 1500,
            dashSpeed: 380,
            dashDuration: 0.11,
            staminaCost: 14,
            range: 100,
            arcDegrees: 120
        }
    }
};

const defenderConfig: WeaponConfigInput = {
    name: 'Defender',
    offhandOnly: true,
    baseRange: 0,
    baseDamage: 5,
    baseArcDegrees: 90,
    cooldown: 0,
    comboWindow: 0,
    stages: [],
    block: {
        enabled: true,
        arcDegrees: 100,
        damageReduction: 0.38,
        staminaCost: 20,
        animationKey: 'block'
    }
};

const greatswordConfig: WeaponConfigInput = {
    name: 'greatsword',
    twoHanded: true,
    baseRange: 120,
    baseDamage: 20,
    baseArcDegrees: 100,
    cooldown: 0.1,
    speed: 1.0,
    comboWindow: 1.5,
    baseStunBuildup: 35,
    weaponLength: 52,
    maxComboStage: 3,
    block: {
        enabled: true,
        arcDegrees: 100,
        damageReduction: 0.45,
        staminaCost: 22,
        animationKey: 'block',
        parryWindowMs: 200,
        parryRallyPercent: 0.75
    },
    stages: [
        { name: 'slash1', arcDegrees: 120, duration: 480, staminaCost: 16, range: 100, damageMultiplier: 1.0, animationKey: 'melee', stunBuildup: 35 },
        { name: 'slash2', arcDegrees: 110, duration: 520, staminaCost: 18, range: 100, damageMultiplier: 1.4, animationKey: 'melee2', stunBuildup: 42, reverseSweep: true },
        { name: 'chop', arcDegrees: 24, duration: 420, staminaCost: 20, range: 70, damageMultiplier: 2.0, animationKey: 'meleeChop', stunBuildup: 55, knockbackForce: 200, thrust: true, thrustWidth: 28 },
        { name: 'spin360', arcDegrees: 360, duration: 1000, staminaCost: 24, range: 120, damageMultiplier: 1.8, animationKey: 'meleeSpin', stunBuildup: 50 }
    ],
    chargeAttack: {
        minChargeTime: 0.15,
        maxChargeTime: 2.0,
        damageMultiplier: 2.0,
        rangeMultiplier: 1.1,
        staminaCostMultiplier: 1.5,
        chargedStageIndex: 4
    },
    dashAttack: {
        name: 'stab',
        arcDegrees: 24,
        duration: 320,
        staminaCost: 14,
        range: 140,
        damageMultiplier: 1.3,
        animationKey: 'melee2',
        thrust: true,
        thrustWidth: 42,
        stunBuildup: 28,
        dashSpeed: 340,
        dashDuration: 0.14
    }
};

const daggerConfig: WeaponConfigInput = {
    name: 'dagger',
    baseRange: 40,
    baseDamage: 5,
    baseArcDegrees: 90,
    cooldown: 0.125,
    comboWindow: 1.2,
    speed: 2,
    baseStunBuildup: 18,
    weaponLength: 35,
    block: {
        enabled: true,
        arcDegrees: 90,
        damageReduction: 0.35,
        staminaCost: 20,
        animationKey: 'block'
    },
    stages: [
        { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 42, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 80, stunBuildup: 18 },
        { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 42, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 80, stunBuildup: 18, reverseSweep: true },
        { name: 'slash', arcDegrees: 100, duration: 320, staminaCost: 8, range: 44, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 22 }
    ],
    dashAttack: {
        name: 'leap',
        arcDegrees: 90,
        duration: 400,
        staminaCost: 14,
        range: 55,
        damageMultiplier: 1.6,
        animationKey: 'melee',
        dashSpeed: 380,
        dashDuration: 0.16,
        knockbackForce: 240,
        stunBuildup: 28
    }
};

const crossbowConfig: WeaponConfigInput = {
    name: 'crossbow',
    twoHanded: true,
    baseRange: 600,
    baseDamage: 22,
    baseArcDegrees: 0,
    cooldown: 0,
    comboWindow: 0,
    stages: [],
    isRanged: true,
    block: {
        enabled: true,
        arcDegrees: 60,
        damageReduction: 0.3,
        staminaCost: 18,
        animationKey: 'block'
    }
};

const bowConfig: WeaponConfigInput = {
    name: 'bow',
    twoHanded: true,
    baseRange: 550,
    baseDamage: 14,
    baseArcDegrees: 0,
    cooldown: 0,
    comboWindow: 0,
    stages: [],
    isRanged: true,
    isBow: true,
    block: {
        enabled: true,
        arcDegrees: 60,
        damageReduction: 0.28,
        staminaCost: 16,
        animationKey: 'block'
    }
};

const maceConfig: WeaponConfigInput = {
    name: 'mace',
    twoHanded: false,
    baseRange: 95,
    baseDamage: 22,
    baseArcDegrees: 90,
    cooldown: 0.35,
    speed: 0.8,
    comboWindow: 1.0,
    knockback: { force: 1200 },
    weaponLength: 60,
    block: {
        enabled: true,
        arcDegrees: 120,
        damageReduction: 0.48,
        staminaCost: 24,
        animationKey: 'block'
    },
    stages: [
        { name: 'sweep1', arcDegrees: 220, duration: 460, staminaCost: 20, range: 95, damageMultiplier: 1.0, animationKey: 'melee', stunBuildup: 40 },
        { name: 'sweep2', arcDegrees: 220, duration: 500, staminaCost: 22, range: 100, damageMultiplier: 1.3, animationKey: 'melee2', stunBuildup: 45, reverseSweep: true },
        { name: 'sweep3', arcDegrees: 240, duration: 580, staminaCost: 26, range: 105, damageMultiplier: 1.6, animationKey: 'melee', stunBuildup: 55 }
    ],
    chargeAttack: {
        minChargeTime: 0.25,
        maxChargeTime: 2.0,
        damageMultiplier: 2.0,
        rangeMultiplier: 1.0,
        staminaCostMultiplier: 1.5
    }
};

const chieftainClubConfig: WeaponConfigInput = {
    name: 'Chieftain Club',
    visual: 'maceClub',
    baseRange: 97,
    baseDamage: 16,
    baseArcDegrees: 360,
    cooldown: 1.2,
    comboWindow: 0.5,
    stages: [] as StageConfigInput[],
    chargeRelease: {
        chargeTime: 1.15,
        releaseDuration: 0.22,
        damage: 16,
        knockbackForce: 280,
        aoeInFront: true,
        aoeOffset: 55,
        aoeRadius: 42
    }
};

/** Legendary: 1–2 Tempest Thrust (thrust), 3 Storm Release (arcing sweep + tornado projectile). */
const blessedWindsConfig: WeaponConfigInput = {
    name: 'Blessed Winds',
    visual: 'sword',
    twoHanded: true,
    baseRange: 100,
    baseDamage: 18,
    baseArcDegrees: 24,
    cooldown: 0.2,
    speed: 1.1,
    comboWindow: 1.2,
    baseStunBuildup: 22,
    weaponLength: 55,
    maxComboStage: 3,
    block: {
        enabled: true,
        arcDegrees: 100,
        damageReduction: 0.38,
        staminaCost: 22,
        animationKey: 'block'
    },
    stages: [
        { name: 'Tempest Thrust', arcDegrees: 24, duration: 320, staminaCost: 12, range: 140, damageMultiplier: 1.0, animationKey: 'melee2', stunBuildup: 22, thrust: true, thrustWidth: 48 },
        { name: 'Tempest Thrust', arcDegrees: 24, duration: 300, staminaCost: 12, range: 140, damageMultiplier: 1.05, animationKey: 'melee2', stunBuildup: 22, thrust: true, thrustWidth: 48 },
        { name: 'Storm Release', arcDegrees: 130, duration: 420, staminaCost: 18, range: 120, damageMultiplier: 1.3, animationKey: 'melee', stunBuildup: 28, knockbackForce: 180 }
    ],
    attackVisual: {
        thrustLungeForwardWorld: 28,
        thrustAnticipationRatio: 0.3
    }
};

const goblinDaggerConfig: WeaponConfigInput = {
    name: 'Goblin Shiv',
    baseRange: 36,
    baseDamage: 4,
    baseArcDegrees: 90,
    cooldown: 1.8,
    speed: 0.85,
    comboWindow: 0.5,
    baseStunBuildup: 16,
    weaponLength: 30,
    visual: 'goblinDagger',
    stages: [
        { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 38, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 72, stunBuildup: 16 },
        { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 38, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 72, stunBuildup: 16, reverseSweep: true },
        { name: 'slash', arcDegrees: 100, duration: 320, staminaCost: 8, range: 40, damageMultiplier: 1.15, animationKey: 'melee', knockbackForce: 90, stunBuildup: 20 }
    ] as StageConfigInput[],
    dashAttack: {
        name: 'leap',
        arcDegrees: 90,
        duration: 400,
        staminaCost: 14,
        range: 52,
        damageMultiplier: 1.5,
        animationKey: 'melee',
        dashSpeed: 380,
        dashDuration: 0.32,
        knockbackForce: 220,
        stunBuildup: 26
    }
};

export const SwordWeaponInstance = Weapon.fromConfig(swordConfig);
export const ShieldWeaponInstance = Weapon.fromConfig(shieldConfig);
export const GreatswordWeaponInstance = Weapon.fromConfig(greatswordConfig);
export const DaggerWeaponInstance = Weapon.fromConfig(daggerConfig);
export const CrossbowWeaponInstance = Weapon.fromConfig(crossbowConfig);
export const BowWeaponInstance = Weapon.fromConfig(bowConfig);
export const MaceWeaponInstance = Weapon.fromConfig(maceConfig);
export const ChieftainClubWeaponInstance = Weapon.fromConfig(chieftainClubConfig);
export const GoblinDaggerWeaponInstance = Weapon.fromConfig(goblinDaggerConfig);
export const BlessedWindsWeaponInstance = Weapon.fromConfig(blessedWindsConfig);

/** Base configs for tiered player weapons (used by WeaponsRegistry to build material variants). */
export const BASE_WEAPON_CONFIGS: Record<string, WeaponConfigInput> = {
    sword: swordConfig,
    greatsword: greatswordConfig,
    dagger: daggerConfig,
    mace: maceConfig,
    crossbow: crossbowConfig,
    bow: bowConfig
};
export { shieldConfig, defenderConfig, blessedWindsConfig };
