/**
 * Quest board config: difficulties and fixed quest list (procedural-ready).
 */
import { GameConfig } from './GameConfig.js';
import type { DifficultyDef, Quest, QuestObjectiveType, QuestObjectiveParams } from '../types/quest.js';

/** Level id for the delve (dungeon descent) mode. Single level, multiple floors. */

export const DELVE_LEVEL = 10;

/** Canonical obstacles config for delve: underground only, 1x1 scene tile (delve.dirt). Use when regenerating or advancing delve floors. */
export const DELVE_OBSTACLES_CONFIG = {
  border: { spacing: 40, type: 'rock' as const },
  useSceneTiles: true,
  sceneTileLayout: {
    tileSize: 1200,
    cols: 1,
    rows: 1,
    pool: [{ id: 'delve.dirt', weight: 1 }],
  },
};

/** Level id for the dragon arena (boss-only). Portal returns to hub. */
export const DRAGON_ARENA_LEVEL = 11;

/** Level id for the ogre den (Village Outskirts boss). Portal returns to hub. */
export const OGRE_DEN_LEVEL = 12;

export const difficulties: Record<string, DifficultyDef> = {
  normal: {
    id: 'normal',
    label: 'Normal',
    goldMultiplier: 1,
    packDensityMultiplier: 1,
    packSizeBonus: 0,
    enemyTier2Chance: 0,
  },
  hard: {
    id: 'hard',
    label: 'Hard ★★',
    goldMultiplier: 2.5,
    packDensityMultiplier: 1.8,
    packSizeBonus: 2,
    enemyTier2Chance: 1,
  },
  veryHard: {
    id: 'veryHard',
    label: 'Very Hard ★★★',
    goldMultiplier: 4,
    packDensityMultiplier: 2.2,
    packSizeBonus: 3,
    enemyTier2Chance: 0,
    enemyTier3Chance: 1,
  },
};

/**
 * Returns the fixed list of quests for the board (level × difficulty).
 * Later can be replaced with generateQuests(seed?, options?) for procedural quests.
 */
export function getQuestsForBoard(): Quest[] {
  const levels = GameConfig?.levels ?? {};
  const levelKeys = Object.keys(levels)
    .map(Number)
    .filter((n) => n > 0 && n !== DELVE_LEVEL)
    .sort((a, b) => a - b);
  const difficultyIds = Object.keys(difficulties);
  const list: Quest[] = [];
  for (const level of levelKeys) {
    for (const difficultyId of difficultyIds) {
      const difficulty = difficulties[difficultyId];
      list.push({
        level,
        difficultyId,
        difficulty,
        questType: 'standard',
      });
    }
  }
  // Delve: dungeon descent (one option per difficulty)
  const delveDifficulty = difficulties.normal;
  list.push({
    level: DELVE_LEVEL,
    difficultyId: 'normal',
    difficulty: delveDifficulty,
    questType: 'delve',
  });
  return list;
}

/** Picks a random objective type and params for an Investigations board quest at the given level. */
function getRandomObjectiveForLevel(level: number): { objectiveType: QuestObjectiveType; objectiveParams: QuestObjectiveParams } {
  const levels = GameConfig?.levels ?? {};
  const levelConfig = levels[level] as { killsToUnlockPortal?: number; enemyTypes?: string[] } | undefined;
  const killTarget = levelConfig?.killsToUnlockPortal ?? 20;
  const enemyTypes = levelConfig?.enemyTypes ?? [];
  const types: QuestObjectiveType[] = ['kill', 'survive', 'gather'];
  const roll = Math.floor(Math.random() * types.length);
  switch (types[roll]) {
    case 'kill': {
      const count = Math.max(10, Math.floor(killTarget * (0.5 + Math.random() * 0.5)));
      const useTypes = enemyTypes.length > 0 && Math.random() < 0.5;
      return {
        objectiveType: 'kill',
        objectiveParams: useTypes
          ? { kill: { count, enemyTypes: enemyTypes.slice(0, 4) } }
          : { kill: { count } },
      };
    }
    case 'survive': {
      const durations = [60, 75, 90, 105, 120];
      const durationSeconds = durations[Math.floor(Math.random() * durations.length)];
      const minKills = Math.max(3, Math.floor(killTarget * 0.15));
      return {
        objectiveType: 'survive',
        objectiveParams: { survive: { durationSeconds, minKills } },
      };
    }
    case 'gather': {
      const gatherableType = level >= 2 && Math.random() < 0.5 ? 'ore' : 'herb';
      const count = level >= 2 ? 4 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 4);
      return {
        objectiveType: 'gather',
        objectiveParams: { gather: { count, gatherableType } },
      };
    }
    default:
      return { objectiveType: 'kill', objectiveParams: { kill: { count: killTarget } } };
  }
}

/**
 * Returns exactly `count` random quests for the Investigations board (no duplicates).
 * Each quest gets a random objective type (kill / survive / gather) for variety.
 */
export function getRandomQuestsForBoard(count: number = 3): Quest[] {
  const full = getQuestsForBoard();
  let chosen: Quest[];
  if (full.length <= count) {
    chosen = full;
  } else {
    const shuffled = [...full];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    chosen = shuffled.slice(0, count);
  }
  return chosen.map((q) => {
    if (q.questType === 'delve' || q.level === DRAGON_ARENA_LEVEL || q.level === OGRE_DEN_LEVEL) return q;
    const { objectiveType, objectiveParams } = getRandomObjectiveForLevel(q.level);
    return { ...q, objectiveType, objectiveParams };
  });
}

/** Short description for a quest (objectives / enemies) for board display. */
export function getQuestDescription(quest: Quest): string[] {
  const lines: string[] = [];
  if (quest.questType === 'delve') {
    lines.push('Find the dungeon entrance and descend.');
    lines.push('Kill all enemies on each floor to unlock the stairs.');
    lines.push('Difficulty and rewards increase per floor.');
    if (quest.difficulty?.goldMultiplier != null && quest.difficulty.goldMultiplier > 1) {
      lines.push(`${(quest.difficulty.goldMultiplier * 100 - 100).toFixed(0)}% bonus gold`);
    }
    return lines;
  }
  if (quest.level === DRAGON_ARENA_LEVEL) {
    lines.push('Slay the Fire Dragon to open the portal.');
    lines.push('Boss: Fire Dragon');
    if (quest.difficulty?.goldMultiplier != null && quest.difficulty.goldMultiplier > 1) {
      lines.push(`${(quest.difficulty.goldMultiplier * 100 - 100).toFixed(0)}% bonus gold`);
    }
    return lines;
  }
  if (quest.level === OGRE_DEN_LEVEL) {
    lines.push('Slay the Ogre to open the portal.');
    lines.push('Boss: Village Ogre');
    if (quest.difficulty?.goldMultiplier != null && quest.difficulty.goldMultiplier > 1) {
      lines.push(`${(quest.difficulty.goldMultiplier * 100 - 100).toFixed(0)}% bonus gold`);
    }
    return lines;
  }
  const levels = GameConfig?.levels ?? {};
  const levelConfig = levels[quest.level] as { enemyTypes?: string[] } | undefined;
  const enemyLabel =
    levelConfig?.enemyTypes?.length &&
    quest.level !== DRAGON_ARENA_LEVEL &&
    quest.level !== OGRE_DEN_LEVEL
      ? (() => {
          const unique = [...new Set(levelConfig.enemyTypes)];
          return unique.length <= 3 ? unique.join(', ') : `${unique.slice(0, 2).join(', ')} and more`;
        })()
      : '';

  if (quest.objectiveType && quest.objectiveParams) {
    switch (quest.objectiveType) {
      case 'kill': {
        const p = quest.objectiveParams.kill;
        if (p) {
          if (p.enemyTypes?.length) {
            lines.push(`Slay ${p.count} foes (${p.enemyTypes.slice(0, 3).join(', ')}${p.enemyTypes.length > 3 ? '…' : ''}).`);
          } else {
            lines.push(`Slay ${p.count} foes to open the portal.`);
          }
        }
        break;
      }
      case 'survive': {
        const p = quest.objectiveParams.survive;
        if (p) {
          lines.push(`Survive for ${p.durationSeconds} seconds${p.minKills != null ? ` and slay at least ${p.minKills} foes` : ''}.`);
        }
        break;
      }
      case 'gather': {
        const p = quest.objectiveParams.gather;
        if (p) {
          const name = p.gatherableType === 'ore' ? 'ore' : 'herbs';
          lines.push(`Gather ${p.count} ${name} to open the portal.`);
        }
        break;
      }
      default:
        break;
    }
    if (enemyLabel) lines.push('Foes: ' + enemyLabel);
  } else {
    if (levelConfig && (levelConfig as { killsToUnlockPortal?: number }).killsToUnlockPortal != null) {
      lines.push(`Slay ${(levelConfig as { killsToUnlockPortal: number }).killsToUnlockPortal} foes to open the portal.`);
    }
    if (enemyLabel) lines.push('Foes: ' + enemyLabel);
  }

  if (quest.difficulty?.enemyTier3Chance === 1) {
    lines.push('All enemies 3★');
  } else if (quest.difficulty?.enemyTier2Chance === 1) {
    lines.push('All enemies 2★');
  }
  if (quest.difficulty?.goldMultiplier != null && quest.difficulty.goldMultiplier > 1) {
    lines.push(`${(quest.difficulty.goldMultiplier * 100 - 100).toFixed(0)}% bonus gold`);
  }
  return lines.length ? lines : ['Enter and survive.'];
}
