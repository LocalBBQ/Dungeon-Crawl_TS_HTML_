// Bandit: humanoid enemy with mace — player-like combo (light) and charged heavy attacks via comboAndCharge behavior.
(function () {
    const weapon = (typeof Weapons !== 'undefined' && Weapons.mace) ? Weapons.mace : null;
    let attackRange = 95, attackDamage = 22, attackCooldown = 0.35;
    if (weapon) {
        const first = weapon.getComboStageProperties && weapon.getComboStageProperties(1);
        if (first) {
            attackRange = first.range;
            attackDamage = first.damage;
        }
        if (weapon.cooldown != null) attackCooldown = weapon.cooldown;
    }

    const config = {
        maxHealth: 55,
        moveSpeed: 82,
        weaponId: 'mace',
        attackRange,
        attackDamage,
        detectionRange: 220,
        color: '#5c4a3a',
        attackCooldown,
        windUpTime: 0,
        attackCooldownMultiplier: 2.5,
        attackDurationMultiplier: 2.5,
        damageMultiplier: 1,
        stunThreshold: 90,
        stunBuildupPerHit: 35,
        knockbackResist: 0,
        knockback: {
            force: 180,
            decay: 0.88
        },
        lunge: { enabled: false },
            maxStamina: 50,
        staminaRegen: 3,
        attackStaminaCost: 25
    };

    window.EnemyBandit = EnemyType.fromConfig(config);
})();
