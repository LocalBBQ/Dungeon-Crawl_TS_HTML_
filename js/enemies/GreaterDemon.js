(function () {
    const config = {
        maxHealth: 80,
        moveSpeed: 30,
        attackRange: 60,
        attackDamage: 12,
        detectionRange: 300,
        color: '#aa4444',
        attackCooldown: 0.67,
        windUpTime: 0.5,
        stunBuildupPerHit: 22,
        knockbackResist: 0.2,
        knockback: {
            force: 230,
            decay: 0.86
        },
        pillarFlame: {
            castDelay: 2.0,
            activeDuration: 2.0,
            radius: 45,
            damage: 8,
            damageInterval: 0.4,
            cooldown: 18.0,
            pillarRange: 220
        }
    };

    window.EnemyGreaterDemon = EnemyType.fromConfig(config);
})();
