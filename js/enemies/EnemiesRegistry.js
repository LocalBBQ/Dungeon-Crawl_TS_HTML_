// Registry of enemy types (built from enemy class files). Populates GameConfig.enemy.types at load.
// weaponAndBehavior: one map for attack handler creation (lean approach).
var Enemies = {
    goblin: window.EnemyGoblin,
    skeleton: window.EnemySkeleton,
    lesserDemon: window.EnemyLesserDemon,
    greaterDemon: window.EnemyGreaterDemon,
    goblinChieftain: window.EnemyGoblinChieftain,
    bandit: window.EnemyBandit,
    banditDagger: window.EnemyBanditDagger
};

Enemies.weaponAndBehavior = {
    goblin: { weaponId: 'goblinDagger', behaviorId: 'slashAndLeap' },
    lesserDemon: { weaponId: 'lesserDemonClaw', behaviorId: 'slashAndLeap' },
    goblinChieftain: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
    greaterDemon: { weaponId: 'demonClaw', behaviorId: 'chargeRelease' },
    skeleton: { weaponId: 'skeletonNoMelee', behaviorId: 'rangedOnly' },
    bandit: { weaponId: 'mace', behaviorId: 'comboAndCharge' },
    banditDagger: { weaponId: 'dagger', behaviorId: 'slashAndLeap' }
};

Enemies.getConfig = function (type) {
    const def = this[type];
    return def && def.config ? def.config : null;
};

Enemies.createAttackHandler = function (enemyType) {
    const map = Enemies.weaponAndBehavior && Enemies.weaponAndBehavior[enemyType];
    const config = Enemies.getConfig(enemyType) || (GameConfig && GameConfig.enemy && GameConfig.enemy.types && GameConfig.enemy.types[enemyType]);
    const weaponId = (map && map.weaponId) || (config && config.weaponId);
    const behaviorId = (map && map.behaviorId) || (config && config.behaviorId) || 'slashOnly';
    const weapon = (typeof EnemyWeapons !== 'undefined' && EnemyWeapons.resolveWeapon) ? EnemyWeapons.resolveWeapon(weaponId) : null;
    if (typeof window !== 'undefined' && window.WeaponAttackHandler) {
        const options = {
            isPlayer: false,
            behaviorType: behaviorId,
            windUpTime: config && config.windUpTime != null ? config.windUpTime : 0.6,
            cooldownMultiplier: config && config.attackCooldownMultiplier != null ? config.attackCooldownMultiplier : 1,
            damageMultiplier: config && config.damageMultiplier != null ? config.damageMultiplier : 1,
            attackDurationMultiplier: config && config.attackDurationMultiplier != null ? config.attackDurationMultiplier : 1
        };
        return new window.WeaponAttackHandler(weapon, options);
    }
    const EnemyAttackHandlerClass = typeof window !== 'undefined' ? window.EnemyAttackHandler : null;
    if (!EnemyAttackHandlerClass) return null;
    const options = config ? { windUpTime: config.windUpTime, cooldownMultiplier: config.attackCooldownMultiplier ?? 1, damageMultiplier: config.damageMultiplier ?? 1 } : {};
    return new EnemyAttackHandlerClass(weapon, behaviorId, options);
};

// Populate GameConfig.enemy.types so existing callers keep working without change
(function () {
    if (typeof GameConfig === 'undefined' || !GameConfig.enemy) return;
    if (!GameConfig.enemy.types) GameConfig.enemy.types = {};
    for (const key of Object.keys(Enemies)) {
        if (Enemies[key] && Enemies[key].config) {
            GameConfig.enemy.types[key] = Enemies[key].config;
        }
    }
})();
