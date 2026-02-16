// Bandit with dagger: humanoid bandit look, player dagger (slash + lunge). Spawns on thick grove, small farm, bandit ambush.
(function () {
    const weapon = (typeof Weapons !== 'undefined' && Weapons.dagger) ? Weapons.dagger : null;
    let attackRange = 40, attackDamage = 5, attackCooldown = 0.25, lungeDamage = 8, lungeKnockbackForce = 240;
    if (weapon) {
        const first = weapon.getComboStageProperties && weapon.getComboStageProperties(1);
        const dash = weapon.getDashAttackProperties && weapon.getDashAttackProperties();
        if (first) {
            attackRange = first.range;
            attackDamage = first.damage;
        }
        if (weapon.cooldown != null) attackCooldown = weapon.cooldown;
        if (dash) {
            lungeDamage = dash.damage;
            if (dash.knockbackForce != null) lungeKnockbackForce = dash.knockbackForce;
        }
    }

    const config = {
        maxHealth: 42,
        moveSpeed: 88,
        weaponId: 'dagger',
        attackRange,
        attackDamage,
        detectionRange: 220,
        color: '#5c4a3a',
        attackCooldown,
        windUpTime: 2.0,
        attackCooldownMultiplier: 2.5,
        damageMultiplier: 1,
        stunThreshold: 75,
        stunBuildupPerHit: 20,
        knockbackResist: 0,
        knockback: {
            force: 150,
            decay: 0.88
        },
        lunge: {
            enabled: true,
            chargeRange: 155,
            chargeTime: 1.0,
            lungeSpeed: 250,
            lungeDistance: 120,
            lungeDamage,
            hitRadiusBonus: 0,
            knockback: { force: lungeKnockbackForce },
            hopBackChance: 0.4,
            hopBackDelay: 0.6,
            hopBackDistance: 48,
            hopBackSpeed: 150
        },
        packModifier: 'swift',
        maxStamina: 45,
        staminaRegen: 3,
        attackStaminaCost: 10
    };

    window.EnemyBanditDagger = EnemyType.fromConfig(config);
})();
