// Enemy weapon references and enemy-only attack definitions.
// One object + resolver; no separate registry. Shared weapons (e.g. Dagger) live in Weapons.
// resolveWeapon(weaponId) returns Weapons[weaponId] or EnemyWeapons[weaponId].

var EnemyWeapons = {
    /** Chieftain club: defined in ChieftainClubWeapon.js; overhead slam, small AOE in front. */
    get chieftainClub() {
        return (typeof window !== 'undefined' && window.ChieftainClubWeapon) ? window.ChieftainClubWeapon : this._chieftainClubFallback;
    },
    _chieftainClubFallback: {
        id: 'chieftainClub',
        name: 'Chieftain Club',
        visual: 'maceClub',
        heavySmash: { chargeTime: 1.15, releaseDuration: 0.22, damage: 16, knockbackForce: 280, aoeInFront: true, aoeOffset: 55, aoeRadius: 42 },
        getHeavySmashProperties() {
            const h = this.heavySmash;
            const range = h.aoeInFront ? (h.aoeOffset || 0) + (h.aoeRadius || 40) : (h.range || 100);
            return {
                range,
                damage: h.damage,
                arc: Math.PI * 2,
                isCircular: false,
                chargeTime: h.chargeTime,
                releaseDuration: h.releaseDuration,
                knockbackForce: h.knockbackForce,
                aoeInFront: !!(h.aoeInFront),
                aoeOffset: h.aoeOffset != null ? h.aoeOffset : 55,
                aoeRadius: h.aoeRadius != null ? h.aoeRadius : 42
            };
        }
    },

    get maceClub() { return this.chieftainClub; },

    /** Goblin Shiv: goblin-specific dagger (extends DaggerWeapon); jagged blade, same slash/leap behavior. */
    get goblinDagger() {
        return (typeof window !== 'undefined' && window.GoblinDaggerWeaponInstance) ? window.GoblinDaggerWeaponInstance : this._goblinDaggerFallback;
    },
    _goblinDaggerFallback: null,

    /** Greater demon claw: charge-release cone. */
    demonClaw: {
        id: 'demonClaw',
        name: 'Demon Claw',
        visual: 'claw',
        getChargeReleaseProperties() {
            return {
                range: 70,
                damage: 18,
                arc: typeof Utils !== 'undefined' ? Utils.degToRad(100) : (100 * Math.PI / 180),
                chargeTime: 1.0,
                releaseDuration: 0.2,
                knockbackForce: 280
            };
        }
    },

    /** Lesser demon: slash + lunge (weapon-like interface for EnemyAttackHandler). */
    lesserDemonClaw: {
        id: 'lesserDemonClaw',
        name: 'Lesser Demon Claw',
        visual: 'claw',
        baseRange: 45,
        baseDamage: 7,
        baseArcDegrees: 90,
        cooldown: 0.85,
        getComboStageProperties(stage) {
            if (stage !== 1) return null;
            const arc = typeof Utils !== 'undefined' ? Utils.degToRad(90) : (Math.PI / 2);
            return { range: 45, damage: 7, arc, knockbackForce: 180 };
        },
        getDashAttackProperties() {
            return { damage: 10, knockbackForce: 260, range: 55 };
        }
    },

    /** Skeleton: ranged only; no melee. Handler uses behavior 'rangedOnly' and never starts melee. */
    skeletonNoMelee: {
        id: 'skeletonNoMelee',
        name: 'Skeleton',
        visual: null,
        noMelee: true,
        getComboStageProperties() { return null; },
        getDashAttackProperties() { return null; },
        cooldown: 1.5
    },

};

/** Resolve weapon by id: shared (Weapons) or enemy-only (EnemyWeapons). */
EnemyWeapons.resolveWeapon = function (weaponId) {
    if (!weaponId) return null;
    if (typeof Weapons !== 'undefined' && Weapons[weaponId]) return Weapons[weaponId];
    if (EnemyWeapons[weaponId] && typeof EnemyWeapons[weaponId] === 'object') return EnemyWeapons[weaponId];
    return null;
};

// Goblins use goblinDagger (Goblin Shiv); fallback to shared Dagger if not loaded.
EnemyWeapons.getGoblinWeapon = function () {
    if (EnemyWeapons.goblinDagger) return EnemyWeapons.goblinDagger;
    return (typeof Weapons !== 'undefined' && Weapons.dagger) ? Weapons.dagger : null;
};

if (typeof window !== 'undefined') {
    window.EnemyWeapons = EnemyWeapons;
}
