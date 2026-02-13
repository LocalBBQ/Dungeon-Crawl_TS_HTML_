// Mace: two-handed, big sweeps back and forth, heavy knockback
// Balancing: attackSpeed < 1 = slower swings, cooldown = seconds between attacks, cooldownMultiplier = scale cooldown
(function () {
    const config = {
        name: 'mace',
        twoHanded: true,
        baseRange: 95,
        baseDamage: 22,
        baseArcDegrees: 200,
        cooldown: 0.35,
        attackSpeed: 0.4,      // optional: 15% slower swing
        cooldownMultiplier: 2, // optional: 20% longer between attacks
        comboWindow: 1.0,
        knockback: { force: 1200 },
        weaponLength: 71,
        stages: [
            { name: 'sweep1', arcDegrees: 220, duration: 460, staminaCost: 20, range: 95, damageMultiplier: 1.0, animationKey: 'melee', stunBuildup: 40 },
            { name: 'sweep2', arcDegrees: 220, duration: 500, staminaCost: 22, range: 100, damageMultiplier: 1.3, animationKey: 'melee2', stunBuildup: 45, reverseSweep: true },
            { name: 'sweep3', arcDegrees: 240, duration: 580, staminaCost: 26, range: 105, damageMultiplier: 1.6, animationKey: 'melee', stunBuildup: 55 }
        ],
        chargeAttack: {
            minChargeTime: 0.5,
            maxChargeTime: 2.0,
            damageMultiplier: 2.0,
            rangeMultiplier: 1.0,  // no range growth on charge (was 3.0)
            staminaCostMultiplier: 1.5
        }
    };
    window.MaceWeaponInstance = Greatsword.fromConfig(config);
})();
