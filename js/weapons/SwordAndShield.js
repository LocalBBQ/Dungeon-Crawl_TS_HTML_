// Sword and Shield: one-handed with block and shield bash
(function () {
    const config = {
        name: 'swordAndShield',
        baseRange: 80,
        baseDamage: 15,
        baseArcDegrees: 60,
        cooldown: 0.45,
        comboWindow: 1.6,
        baseStunBuildup: 25,
        weaponLength: 55,
        block: {
            enabled: true,
            arcDegrees: 180,
            damageReduction: 1.0,
            staminaCost: 25,
            animationKey: 'block',
            shieldBash: {
                knockback: 1500,
                dashSpeed: 380,
                dashDuration: 0.22,
                staminaCost: 14,
                range: 100,
                arcDegrees: 120
            }
        },
        stages: [
            { name: 'slash', arcDegrees: 90, duration: 400, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28 },
            { name: 'slash', arcDegrees: 90, duration: 400, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28, reverseSweep: true },
            { name: 'stab', arcDegrees: 24, duration: 420, staminaCost: 12, range: 96, damageMultiplier: 1.0, animationKey: 'melee2', dashSpeed: 60, dashDuration: 0.06, stunBuildup: 22, thrust: true, thrustWidth: 44 }
        ],
        dashAttack: { name: 'spin', arcDegrees: 360, duration: 740, staminaCost: 25, range: 72, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 350, dashDuration: 0.5, stunBuildup: 50 },
        chargeAttack: {
            minChargeTime: 0.5,
            maxChargeTime: 2.0,
            damageMultiplier: 2.0,
            rangeMultiplier: 1.2,
            staminaCostMultiplier: 1.5,
            chargedThrustDashSpeed: 380,
            chargedThrustDashDistanceMin: 50,
            chargedThrustDashDistanceMax: 170
        },
        // Optional per-weapon attack visuals (defaults in PlayerCombatRenderer)
        attackVisual: {
            thrustLungeForwardWorld: 32,
            thrustAnticipationRatio: 0.32
            // e.g. anticipationRatio, pullBackRadians, followThroughExtra, thrustPullBackWorld, etc.
        }
    };
    window.SwordAndShieldWeapon = Weapon.fromConfig(config);
})();
