// Goblin uses the Dagger weapon; melee slash matches player's dagger (no wind-up, same timing/cooldown).
// Lunge uses dash attack stats from dagger.
(function () {
    const weapon = (typeof EnemyWeapons !== 'undefined' && EnemyWeapons.resolveWeapon) ? EnemyWeapons.resolveWeapon('goblinDagger') : null;
    let attackRange = 40, attackDamage = 5, attackCooldown = 1.2, lungeDamage = 8, lungeKnockbackForce = 240;
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
        maxHealth: 30,
        moveSpeed: 25,
        weaponId: 'goblinDagger',
        attackRange,
        attackDamage,
        detectionRange: 200,
        color: '#44aa44',
        attackCooldown,
        windUpTime: 0, // Same as player dagger: no wind-up, slash starts immediately (like click)
        attackCooldownMultiplier: 1,
        damageMultiplier: 1,
        stunThreshold: 60,
        stunBuildupPerHit: 18,
        knockbackResist: 0,
        knockback: {
            force: 160,
            decay: 0.88
        },
        lunge: {
            enabled: true,
            chargeRange: 150,
            chargeTime: 0.8,
            lungeSpeed: 200,
            lungeDistance: 120,
            lungeDamage,
            hitRadiusBonus: 0,
            knockback: { force: lungeKnockbackForce },
            hopBackChance: 0.5,
            hopBackDelay: 1.5,
            hopBackDistance: 60,
            hopBackSpeed: 140
        },
        // Stamina: goblins back off when exhausted until 50% recovered
        maxStamina: 30,
        staminaRegen: 4,
        attackStaminaCost: 12
    };

    window.EnemyGoblin = EnemyType.fromConfig(config);
})();
