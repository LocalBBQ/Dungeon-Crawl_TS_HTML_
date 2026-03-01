/**
 * Static quest definitions for Main Quest screen and biome unlock progression.
 * Static quests are Quest objects with id, name, objectiveType, objectiveParams, etc.
 */
import type { Quest } from '../types/quest.js';

export interface StaticQuestCompleteContext {
  getEnemiesKilledThisLevel(): number;
  getKillsByTypeThisLevel?(): Record<string, number>;
  getAliveCount?(): number;
  getCollectedCount?(type: string): number;
  questSurviveStartTime?: number;
  levelConfig?: { bossSpawn?: { type: string } };
  /** Current time in seconds (for survive objective). */
  now?(): number;
}

export function isStaticQuestComplete(quest: Quest, ctx: StaticQuestCompleteContext): boolean {
  const objectiveType = quest.objectiveType;
  const params = quest.objectiveParams;
  if (!objectiveType || !params) return false;

  const kills = ctx.getEnemiesKilledThisLevel();
  const killsByType = ctx.getKillsByTypeThisLevel?.();
  const aliveCount = ctx.getAliveCount?.();
  const nowSec = ctx.now ? ctx.now() : 0;

  switch (objectiveType) {
    case 'kill': {
      const p = params.kill;
      if (!p) return false;
      if (p.enemyTypes && p.enemyTypes.length > 0 && killsByType) {
        const sum = p.enemyTypes.reduce((acc, t) => acc + (killsByType[t] ?? 0), 0);
        return sum >= p.count;
      }
      return kills >= p.count;
    }
    case 'killBoss': {
      if (aliveCount !== undefined && ctx.levelConfig?.bossSpawn) {
        return aliveCount === 0;
      }
      return kills >= 1 && (aliveCount === undefined || aliveCount === 0);
    }
    case 'gather': {
      const p = params.gather;
      if (!p || !ctx.getCollectedCount) return false;
      return ctx.getCollectedCount(p.gatherableType) >= p.count;
    }
    case 'clearArea': {
      return aliveCount !== undefined ? aliveCount === 0 : kills >= 999;
    }
    case 'survive': {
      const p = params.survive;
      if (!p || ctx.questSurviveStartTime == null) return false;
      const elapsed = nowSec - ctx.questSurviveStartTime;
      if (elapsed < p.durationSeconds) return false;
      if (p.minKills != null && kills < p.minKills) return false;
      return true;
    }
    case 'findInteract': {
      const p = params.findInteract;
      if (!p) return false;
      const count = ctx.getCollectedCount ? ctx.getCollectedCount(p.interactId) : 0;
      return count >= p.count;
    }
    default:
      return false;
  }
}

export const STATIC_QUESTS: Quest[] = [
  // ---- Village Outskirts (level 1) ----
  {
    id: 'outskirts_clear_goblins',
    name: 'Clear the outskirts',
    description: ['Slay 15 foes in the Village Outskirts.'],
    level: 1,
    objectiveType: 'kill',
    objectiveParams: { kill: { count: 15 } },
    gatesBiomeUnlock: true,
    order: 1,
    difficultyId: 'normal',
  },
  {
    id: 'outskirts_herbs',
    name: 'Herb gathering',
    description: ['Gather 5 herbs in the Village Outskirts.'],
    level: 1,
    objectiveType: 'gather',
    objectiveParams: { gather: { count: 5, gatherableType: 'herb' } },
    gatesBiomeUnlock: true,
    order: 2,
    difficultyId: 'normal',
  },
  {
    id: 'outskirts_chieftain',
    name: 'Goblin chieftain',
    description: ['Slay the Goblin Chieftain and 12 other foes.'],
    level: 1,
    objectiveType: 'kill',
    objectiveParams: { kill: { count: 13, enemyTypes: ['goblinChieftain', 'goblin', 'bandit'] } },
    gatesBiomeUnlock: false,
    order: 3,
    difficultyId: 'normal',
  },
  {
    id: 'outskirts_survive',
    name: 'Hold the line',
    description: ['Survive for 90 seconds in the outskirts.'],
    level: 1,
    objectiveType: 'survive',
    objectiveParams: { survive: { durationSeconds: 90, minKills: 5 } },
    gatesBiomeUnlock: true,
    order: 4,
    difficultyId: 'normal',
  },
  {
    id: 'outskirts_ogre_den',
    name: "The Ogre's Den",
    description: ['Enter the Ogre\'s Den and slay the Village Ogre.'],
    level: 12,
    objectiveType: 'killBoss',
    objectiveParams: { killBoss: {} },
    gatesBiomeUnlock: false,
    order: 5,
    difficultyId: 'normal',
  },
  // ---- Cursed Wilds (level 2) ----
  {
    id: 'cursed_slay_undead',
    name: 'Cursed Wilds purge',
    description: ['Slay 25 undead in the Cursed Wilds.'],
    level: 2,
    objectiveType: 'kill',
    objectiveParams: { kill: { count: 25, enemyTypes: ['skeleton', 'zombie'] } },
    gatesBiomeUnlock: true,
    order: 1,
    difficultyId: 'normal',
  },
  {
    id: 'cursed_gather_ore',
    name: 'Dark ore',
    description: ['Gather 8 ore in the Cursed Wilds.'],
    level: 2,
    objectiveType: 'gather',
    objectiveParams: { gather: { count: 8, gatherableType: 'ore' } },
    gatesBiomeUnlock: true,
    order: 2,
    difficultyId: 'normal',
  },
  {
    id: 'cursed_clear',
    name: 'Clear the wilds',
    description: ['Clear all enemies from the area.'],
    level: 2,
    objectiveType: 'clearArea',
    objectiveParams: { clearArea: {} },
    gatesBiomeUnlock: false,
    order: 3,
    difficultyId: 'normal',
  },
  // ---- Demon Approach (level 3) ----
  {
    id: 'demon_slay',
    name: 'Demon approach',
    description: ['Slay 30 foes in the Demon Approach.'],
    level: 3,
    objectiveType: 'kill',
    objectiveParams: { kill: { count: 30 } },
    gatesBiomeUnlock: true,
    order: 1,
    difficultyId: 'normal',
  },
  {
    id: 'demon_boss',
    name: 'Lesser demon',
    description: ['Slay a Lesser Demon and 15 other foes.'],
    level: 3,
    objectiveType: 'kill',
    objectiveParams: { kill: { count: 16, enemyTypes: ['lesserDemon', 'skeleton', 'zombie'] } },
    gatesBiomeUnlock: true,
    order: 2,
    difficultyId: 'normal',
  },
];

export function getStaticQuestsForLevel(level: number): Quest[] {
  return STATIC_QUESTS.filter((q) => q.level === level).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getGateQuestIdsForLevel(level: number): string[] {
  return STATIC_QUESTS.filter((q) => q.level === level && q.gatesBiomeUnlock)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((q) => q.id!);
}

/**
 * If all gate quests for the given level are in completedQuestIds, returns the next level id to unlock; otherwise null.
 */
export function tryUnlockNextBiome(level: number, completedQuestIds: string[]): number | null {
  const gateIds = getGateQuestIdsForLevel(level);
  if (gateIds.length === 0) return null;
  const allGatesComplete = gateIds.every((id) => completedQuestIds.includes(id));
  if (!allGatesComplete) return null;
  return level + 1;
}

export function getStaticQuestById(id: string): Quest | undefined {
  return STATIC_QUESTS.find((q) => q.id === id);
}
