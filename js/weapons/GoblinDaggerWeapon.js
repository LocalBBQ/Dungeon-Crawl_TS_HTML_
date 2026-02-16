// Goblin Shiv: goblin-specific dagger. Extends DaggerWeapon with a distinct look and slightly tuned stats.
// Used by goblins via EnemyAttackHandler(dagger, 'slashAndLeap'); same combo/dash behavior as base dagger.
(function () {
    const DaggerWeapon = window.DaggerWeapon;
    if (!DaggerWeapon) return;

    class GoblinDaggerWeapon extends DaggerWeapon {
        constructor(config) {
            super(config);
            this.visual = 'goblinDagger';
        }

        static fromConfig(config) {
            return new GoblinDaggerWeapon(config);
        }
    }

    // Balancing: attackSpeed < 1 = slower swings, cooldown = seconds between attacks, cooldownMultiplier = scale cooldown
    const config = {
        name: 'Goblin Shiv',
        baseRange: 36,
        baseDamage: 4,
        baseArcDegrees: 90,
        cooldown: 1.5,
        attackSpeed: 0.85,
        cooldownMultiplier: 1.2,
        comboWindow: .5,
        baseStunBuildup: 16,
        weaponLength: 30,
        stages: [
            { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 38, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 72, stunBuildup: 16 },
            { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 38, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 72, stunBuildup: 16, reverseSweep: true },
            { name: 'slash', arcDegrees: 100, duration: 320, staminaCost: 8, range: 40, damageMultiplier: 1.15, animationKey: 'melee', knockbackForce: 90, stunBuildup: 20 }
        ],
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

    window.GoblinDaggerWeapon = GoblinDaggerWeapon;
    window.GoblinDaggerWeaponInstance = GoblinDaggerWeapon.fromConfig(config);
})();
