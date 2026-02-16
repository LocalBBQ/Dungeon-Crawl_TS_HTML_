// Minimal helper for enemy type definitions (config) used by EnemiesRegistry.
export interface EnemyTypeDefinition {
  config: Record<string, unknown>;
}

export function EnemyType(config: Record<string, unknown>): EnemyTypeDefinition {
  return { config };
}

EnemyType.fromConfig = function (config: Record<string, unknown>): EnemyTypeDefinition {
  return { config };
};
