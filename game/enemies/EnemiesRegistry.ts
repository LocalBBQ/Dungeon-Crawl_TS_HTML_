// Registry of enemy types. Populates GameConfig.enemy.types at load.
import {
    EnemyGoblin,
    EnemySkeleton,
    EnemyLesserDemon,
    EnemyGreaterDemon,
    EnemyGoblinChieftain,
    EnemyBandit,
    EnemyGoblinBrute,
    EnemySkeletonVeteran,
    EnemyZombie,
    EnemyZombieVeteran,
    EnemyBanditVeteran,
    EnemyLesserDemonVeteran,
    EnemyGreaterDemonVeteran,
    EnemyGoblinChieftainVeteran,
    EnemyFireDragonAlpha,
    EnemyGoblinElite,
    EnemySkeletonElite,
    EnemyZombieElite,
    EnemyBanditElite,
    EnemyLesserDemonElite,
    EnemyGreaterDemonElite,
    EnemyGoblinChieftainElite,
    EnemyFireDragonElite,
    EnemyTrainingDummy,
    EnemyFireDragon,
    EnemyVillageOgre,
    EnemyVillageOgreAlpha,
    EnemyVillageOgreElite
} from '../config/enemyConfigs.js';
import { GameConfig } from '../config/GameConfig.js';
import { EnemyWeapons } from '../weapons/EnemyWeaponsRegistry.js';
import { WeaponAttackHandler } from '../weapons/WeaponAttackHandler.js';
import { EnemyAttackHandler } from '../weapons/EnemyAttackHandler.js';
import type { EnemyTypeDefinition } from './EnemyType.js';

export interface WeaponAndBehaviorEntry {
  weaponId: string;
  behaviorId: string;
}

const weaponAndBehavior: Record<string, WeaponAndBehaviorEntry> = {
  goblin: { weaponId: 'goblinDagger', behaviorId: 'slashAndLeap' },
  goblinBrute: { weaponId: 'goblinDagger', behaviorId: 'slashAndLeap' },
  goblinElite: { weaponId: 'goblinDagger', behaviorId: 'slashAndLeap' },
  lesserDemon: { weaponId: 'lesserDemonClaw', behaviorId: 'slashAndLeap' },
  lesserDemonVeteran: { weaponId: 'lesserDemonClaw', behaviorId: 'slashAndLeap' },
  lesserDemonElite: { weaponId: 'lesserDemonClaw', behaviorId: 'slashAndLeap' },
  goblinChieftain: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  goblinChieftainVeteran: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  goblinChieftainElite: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  greaterDemon: { weaponId: 'demonClaw', behaviorId: 'chargeRelease' },
  greaterDemonVeteran: { weaponId: 'demonClaw', behaviorId: 'chargeRelease' },
  greaterDemonElite: { weaponId: 'demonClaw', behaviorId: 'chargeRelease' },
  skeleton: { weaponId: 'skeletonNoMelee', behaviorId: 'rangedOnly' },
  skeletonVeteran: { weaponId: 'skeletonNoMelee', behaviorId: 'rangedOnly' },
  skeletonElite: { weaponId: 'skeletonNoMelee', behaviorId: 'rangedOnly' },
  bandit: { weaponId: 'mace', behaviorId: 'comboAndCharge' },
  banditVeteran: { weaponId: 'mace', behaviorId: 'comboAndCharge' },
  banditElite: { weaponId: 'mace', behaviorId: 'comboAndCharge' },
  zombie: { weaponId: 'zombieClaw', behaviorId: 'slashOnly' },
  zombieVeteran: { weaponId: 'zombieClaw', behaviorId: 'slashOnly' },
  zombieElite: { weaponId: 'zombieClaw', behaviorId: 'slashOnly' },
  trainingDummy: { weaponId: 'goblinDagger', behaviorId: 'slashOnly' },
  fireDragon: { weaponId: 'dragonClaw', behaviorId: 'slashAndLeap' },
  fireDragonAlpha: { weaponId: 'dragonClaw', behaviorId: 'slashAndLeap' },
  fireDragonElite: { weaponId: 'dragonClaw', behaviorId: 'slashAndLeap' },
  villageOgre: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  villageOgreAlpha: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' },
  villageOgreElite: { weaponId: 'chieftainClub', behaviorId: 'chargeRelease' }
};

export type EnemiesRegistryType = Record<string, EnemyTypeDefinition | undefined> & {
  weaponAndBehavior: Record<string, WeaponAndBehaviorEntry>;
  getConfig(type: string): Record<string, unknown> | null;
  createAttackHandler(enemyType: string, overrides?: { weaponId?: string; behaviorId?: string }): InstanceType<typeof WeaponAttackHandler> | InstanceType<typeof EnemyAttackHandler> | null;
};

export const Enemies = {
  goblin: EnemyGoblin,
  skeleton: EnemySkeleton,
  lesserDemon: EnemyLesserDemon,
  greaterDemon: EnemyGreaterDemon,
  goblinChieftain: EnemyGoblinChieftain,
  bandit: EnemyBandit,
  goblinBrute: EnemyGoblinBrute,
  skeletonVeteran: EnemySkeletonVeteran,
  zombie: EnemyZombie,
  zombieVeteran: EnemyZombieVeteran,
  banditVeteran: EnemyBanditVeteran,
  lesserDemonVeteran: EnemyLesserDemonVeteran,
  greaterDemonVeteran: EnemyGreaterDemonVeteran,
  goblinChieftainVeteran: EnemyGoblinChieftainVeteran,
  fireDragonAlpha: EnemyFireDragonAlpha,
  goblinElite: EnemyGoblinElite,
  skeletonElite: EnemySkeletonElite,
  zombieElite: EnemyZombieElite,
  banditElite: EnemyBanditElite,
  lesserDemonElite: EnemyLesserDemonElite,
  greaterDemonElite: EnemyGreaterDemonElite,
  goblinChieftainElite: EnemyGoblinChieftainElite,
  fireDragonElite: EnemyFireDragonElite,
  trainingDummy: EnemyTrainingDummy,
  fireDragon: EnemyFireDragon,
  villageOgre: EnemyVillageOgre,
  villageOgreAlpha: EnemyVillageOgreAlpha,
  villageOgreElite: EnemyVillageOgreElite,
  weaponAndBehavior,

  getConfig(type: string): Record<string, unknown> | null {
    const def = Enemies[type];
    return def?.config ?? null;
  },

  createAttackHandler(enemyType: string, overrides?: { weaponId?: string; behaviorId?: string }): InstanceType<typeof WeaponAttackHandler> | InstanceType<typeof EnemyAttackHandler> | null {
    const map = weaponAndBehavior[enemyType];
    const config = Enemies.getConfig(enemyType) ?? (GameConfig?.enemy?.types as Record<string, Record<string, unknown>> | undefined)?.[enemyType] ?? null;
    const weaponId = overrides?.weaponId ?? map?.weaponId ?? (config as { weaponId?: string } | null)?.weaponId;
    const behaviorId = overrides?.behaviorId ?? map?.behaviorId ?? (config as { behaviorId?: string } | null)?.behaviorId ?? 'slashOnly';
    const weapon = EnemyWeapons.resolveWeapon(weaponId);
    const configHeavySmash = (config as { heavySmash?: { aoeOffset?: number; aoeRadius?: number } } | null)?.heavySmash;
    const options = {
      isPlayer: false,
      behaviorType: behaviorId as import('../weapons/WeaponAttackHandler.js').AttackHandlerBehaviorType,
      windUpTime: (config as { windUpTime?: number } | null)?.windUpTime != null ? (config as { windUpTime: number }).windUpTime : 0.6,
      cooldownMultiplier: (config as { attackCooldownMultiplier?: number } | null)?.attackCooldownMultiplier ?? 1,
      damageMultiplier: (config as { damageMultiplier?: number } | null)?.damageMultiplier ?? 1,
      attackDurationMultiplier: (config as { attackDurationMultiplier?: number } | null)?.attackDurationMultiplier ?? 1,
      comboWindow: (config as { comboWindow?: number } | null)?.comboWindow,
      heavySmash: configHeavySmash && (configHeavySmash.aoeOffset != null || configHeavySmash.aoeRadius != null) ? configHeavySmash : undefined
    };
    return new WeaponAttackHandler(weapon, options);
  }
} as unknown as EnemiesRegistryType;

// Populate GameConfig.enemy.types so existing callers keep working.
if (GameConfig?.enemy) {
  if (!GameConfig.enemy.types) (GameConfig.enemy as { types: Record<string, unknown> }).types = {};
  for (const key of Object.keys(Enemies)) {
    if (key === 'weaponAndBehavior' || key === 'getConfig' || key === 'createAttackHandler') continue;
    const def = Enemies[key];
    if (def?.config) (GameConfig.enemy.types as Record<string, unknown>)[key] = def.config;
  }
}
