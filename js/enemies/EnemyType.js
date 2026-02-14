// Minimal helper for enemy type definitions (config) used by EnemiesRegistry
function EnemyType(config) {
    return { config };
}

EnemyType.fromConfig = function (config) {
    return { config };
};

if (typeof window !== 'undefined') {
    window.EnemyType = EnemyType;
}
