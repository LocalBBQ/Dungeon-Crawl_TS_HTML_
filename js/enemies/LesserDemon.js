(function () {
    const config = {
        maxHealth: 45,
        moveSpeed: 32,
        attackRange: 45,
        attackDamage: 7,
        detectionRange: 220,
        color: '#884444',
        attackCooldown: 0.85,
        windUpTime: 0.5,
        stunBuildupPerHit: 18,
        knockbackResist: 0.1,
        knockback: {
            force: 180,
            decay: 0.87
        },
        lunge: {
            enabled: true,
            chargeRange: 160,
            chargeTime: 0.7,
            lungeSpeed: 220,
            lungeDistance: 130,
            lungeDamage: 10,
            knockback: { force: 260 }
        }
    };

    window.EnemyLesserDemon = EnemyType.fromConfig(config);
})();
