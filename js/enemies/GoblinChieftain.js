(function () {
    const weapon = (typeof EnemyWeapons !== 'undefined' && EnemyWeapons.chieftainClub) ? EnemyWeapons.chieftainClub : null;
    const heavySmash = weapon && weapon.heavySmash ? weapon.heavySmash : {
        chargeTime: 1.15,
        releaseDuration: 0.22,
        damage: 16,
        knockbackForce: 280,
        aoeInFront: true,
        aoeOffset: 55,
        aoeRadius: 42
    };
    // Attack range for AI: when aoeInFront, use offset + radius; otherwise use range
    const attackRange = heavySmash.aoeInFront
        ? (heavySmash.aoeOffset || 55) + (heavySmash.aoeRadius || 42)
        : (heavySmash.range || 97);

    const config = {
        maxHealth: 60,
        moveSpeed: 20,
        weaponId: 'chieftainClub',
        attackRange,
        attackDamage: heavySmash.damage,
        detectionRange: 220,
        color: '#2d5a2d',
        attackCooldown: 1.2,
        windUpTime: 0.5,
        stunThreshold: 70,
        stunBuildupPerHit: 24,
        knockbackResist: 0.5,
        knockback: {
            force: 200,
            decay: 0.86
        },
        heavySmash,
        warCry: {
            enabled: true,
            radius: 180,
            cooldown: 12.0,
            buffDuration: 5.0,
            speedMultiplier: 1.2,
            damageMultiplier: 1.2
        },
    };

    function createAttack() {
        return new ChieftainAttack();
    }

    window.EnemyGoblinChieftain = EnemyType.fromConfig(config, createAttack);
})();
