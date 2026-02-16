// Registry of enemy types. Populates GameConfig.enemy.types at load.
import {
    EnemyGoblin,
    EnemySkeleton,
    EnemyLesserDemon,
    EnemyGreaterDemon,
    EnemyGoblinChieftain,
    EnemyBandit,
    EnemyBanditDagger
} from './enemyConfigs.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { EnemyWeapons } from '../weapons/EnemyWeaponsRegistry.ts';
import { WeaponAttackHandler } from '../weapons/WeaponAttackHandler.ts';
import type { EnemyTypeDefinition } from './EnemyType.ts';

export interface WeaponAndBehaviorEntry {
  weaponId: string;
  behaviorId: string;
}

const weaponAndBehavior: Record<string, WeaponAndBehaviorEntry> = {
  goblin: { weaponId: 'goblinDagger', behaviorId: 'slashAndLeap' },
  lesserDemon: { weaponId: 'lesserDemonClaw', behaviorId: 'slashAndLeap' },
  goblinChieftain: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  greaterDemon: { weaponId: 'demonClaw', behaviorId: 'chargeRelease' },
  skeleton: { weaponId: 'skeletonNoMelee', behaviorId: 'rangedOnly' },
  bandit: { weaponId: 'mace', behaviorId: 'comboAndCharge' },
  banditDagger: { weaponId: 'dagger', behaviorId: 'slashAndLeap' }
};

export const Enemies: Record<string, EnemyTypeDefinition | undefined> & {
  weaponAndBehavior: Record<string, WeaponAndBehaviorEntry>;
  getConfig(type: string): Record<string, unknown> | null;
  createAttackHandler(enemyType: string): InstanceType<typeof WeaponAttackHandler> | null;
} = {
  goblin: EnemyGoblin,
  skeleton: EnemySkeleton,
  lesserDemon: EnemyLesserDemon,
  greaterDemon: EnemyGreaterDemon,
  goblinChieftain: EnemyGoblinChieftain,
  bandit: EnemyBandit,
  banditDagger: EnemyBanditDagger,
  weaponAndBehavior,

  getConfig(type: string): Record<string, unknown> | null {
    const def = Enemies[type];
    return def?.config ?? null;
  },

  createAttackHandler(enemyType: string): InstanceType<typeof WeaponAttackHandler> | InstanceType<typeof EnemyAttackHandler> | null {
    const map = weaponAndBehavior[enemyType];
    const config = Enemies.getConfig(enemyType) ?? (GameConfig?.enemy?.types as Record<string, Record<string, unknown>> | undefined)?.[enemyType] ?? null;
    const weaponId = map?.weaponId ?? (config as { weaponId?: string } | null)?.weaponId;
    const behaviorId = map?.behaviorId ?? (config as { behaviorId?: string } | null)?.behaviorId ?? 'slashOnly';
    const weapon = EnemyWeapons.resolveWeapon(weaponId);
    const options = {
      isPlayer: false,
      behaviorType: behaviorId,
      windUpTime: (config as { windUpTime?: number } | null)?.windUpTime != null ? (config as { windUpTime: number }).windUpTime : 0.6,
      cooldownMultiplier: (config as { attackCooldownMultiplier?: number } | null)?.attackCooldownMultiplier ?? 1,
      damageMultiplier: (config as { damageMultiplier?: number } | null)?.damageMultiplier ?? 1,
      attackDurationMultiplier: (config as { attackDurationMultiplier?: number } | null)?.attackDurationMultiplier ?? 1,
      comboWindow: (config as { comboWindow?: number } | null)?.comboWindow
    };
    return new WeaponAttackHandler(weapon, options);
  }
};

// Populate GameConfig.enemy.types so existing callers keep working.
if (GameConfig?.enemy) {
  if (!GameConfig.enemy.types) (GameConfig.enemy as { types: Record<string, unknown> }).types = {};
  for (const key of Object.keys(Enemies)) {
    if (key === 'weaponAndBehavior' || key === 'getConfig' || key === 'createAttackHandler') continue;
    const def = Enemies[key];
    if (def?.config) (GameConfig.enemy.types as Record<string, unknown>)[key] = def.config;
  }
}
