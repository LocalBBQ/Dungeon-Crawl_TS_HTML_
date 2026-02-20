// Enemy weapon references and resolver. Shared weapons (e.g. Dagger) live in Weapons.
import { Utils } from '../utils/Utils.ts';
import { Weapons } from './WeaponsRegistry.ts';
import { ChieftainClubWeaponInstance, GoblinDaggerWeaponInstance } from './weaponConfigs.js';

export interface EnemyWeaponLike {
    id?: string;
    name?: string;
    visual?: string | null;
    noMelee?: boolean;
    cooldown?: number;
    comboWindow?: number;
    getHeavySmashProperties?(): unknown;
    getChargeReleaseProperties?(): unknown;
    getComboStageProperties?(stage: number): unknown;
    getDashAttackProperties?(): unknown;
}

const demonClaw: EnemyWeaponLike = {
    id: 'demonClaw',
    name: 'Demon Claw',
    visual: 'claw',
    getChargeReleaseProperties() {
        return {
            range: 70,
            damage: 18,
            arc: Utils.degToRad(100),
            chargeTime: 1.0,
            releaseDuration: 0.2,
            knockbackForce: 280
        };
    }
};

const lesserDemonClaw: EnemyWeaponLike = {
    id: 'lesserDemonClaw',
    name: 'Lesser Demon Claw',
    visual: 'claw',
    baseRange: 45,
    baseDamage: 7,
    baseArcDegrees: 90,
    cooldown: 0.85,
    getComboStageProperties(stage: number) {
        if (stage !== 1) return null;
        return { range: 45, damage: 7, arc: Math.PI / 2, knockbackForce: 180 };
    },
    getDashAttackProperties() {
        return { damage: 10, knockbackForce: 260, range: 55 };
    }
};

const skeletonNoMelee: EnemyWeaponLike = {
    id: 'skeletonNoMelee',
    name: 'Skeleton',
    visual: null,
    noMelee: true,
    getComboStageProperties() {
        return null;
    },
    getDashAttackProperties() {
        return null;
    },
    cooldown: 1.5
};

const zombieClaw: EnemyWeaponLike = {
    id: 'zombieClaw',
    name: 'Zombie Claw',
    visual: 'claw',
    baseRange: 58,
    baseDamage: 6,
    baseArcDegrees: 80,
    cooldown: 1.0,
    getComboStageProperties(stage: number) {
        if (stage !== 1) return null;
        return { range: 58, damage: 6, arc: Utils.degToRad(80), knockbackForce: 140 };
    },
    getDashAttackProperties() {
        return null;
    }
};

const dragonClaw: EnemyWeaponLike = {
    id: 'dragonClaw',
    name: 'Dragon Claw',
    visual: 'claw',
    baseRange: 68,
    baseDamage: 20,
    baseArcDegrees: 100,
    cooldown: 0.9,
    getComboStageProperties(stage: number) {
        if (stage !== 1) return null;
        return { range: 68, damage: 20, arc: Utils.degToRad(100), knockbackForce: 280 };
    },
    getDashAttackProperties() {
        return { damage: 26, knockbackForce: 380, range: 70 };
    }
};

export const EnemyWeapons: Record<string, EnemyWeaponLike> & {
    resolveWeapon(weaponId: string): EnemyWeaponLike | null;
    getGoblinWeapon(): EnemyWeaponLike | null;
} = {
    chieftainClub: ChieftainClubWeaponInstance,
    maceClub: ChieftainClubWeaponInstance,
    goblinDagger: GoblinDaggerWeaponInstance,
    demonClaw,
    lesserDemonClaw,
    skeletonNoMelee,
    zombieClaw,
    dragonClaw,

    resolveWeapon(weaponId: string): EnemyWeaponLike | null {
        if (!weaponId) return null;
        const weapons = Weapons as Record<string, EnemyWeaponLike>;
        const w = weapons[weaponId];
        if (w) return w;
        // Player registry uses tiered keys (e.g. mace_rusty); enemies use base id and get rusty tier
        if (weaponId === 'mace') return weapons['mace_rusty'] ?? null;
        if (weaponId === 'dagger') return weapons['dagger_rusty'] ?? null;
        const e = EnemyWeapons[weaponId];
        if (e && typeof e === 'object') return e;
        return null;
    },

    getGoblinWeapon(): EnemyWeaponLike | null {
        if (EnemyWeapons.goblinDagger) return EnemyWeapons.goblinDagger;
        return (Weapons as Record<string, EnemyWeaponLike>)['dagger_rusty'] ?? null;
    }
};
