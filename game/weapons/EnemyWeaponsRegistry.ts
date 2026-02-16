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

    resolveWeapon(weaponId: string): EnemyWeaponLike | null {
        if (!weaponId) return null;
        const w = (Weapons as Record<string, EnemyWeaponLike>)[weaponId];
        if (w) return w;
        const e = EnemyWeapons[weaponId];
        if (e && typeof e === 'object') return e;
        return null;
    },

    getGoblinWeapon(): EnemyWeaponLike | null {
        if (EnemyWeapons.goblinDagger) return EnemyWeapons.goblinDagger;
        return (Weapons as Record<string, EnemyWeaponLike>).dagger ?? null;
    }
};
