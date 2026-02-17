/**
 * Quest board config: difficulties and fixed quest list (procedural-ready).
 */
import { GameConfig } from './GameConfig.ts';
import type { DifficultyDef, Quest } from '../types/quest.ts';

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
  nightmare: {
    id: 'nightmare',
    label: 'Nightmare ★★★',
    goldMultiplier: 4,
    packDensityMultiplier: 2.2,
    packSizeBonus: 3,
    enemyTier2Chance: 1,
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
    .filter((n) => n > 0)
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
      });
    }
  }
  return list;
}

/**
 * Returns exactly `count` random quests for the bulletin board (no duplicates).
 * Each time the board is opened, the player sees a new set of 3 randomized options.
 */
export function getRandomQuestsForBoard(count: number = 3): Quest[] {
  const full = getQuestsForBoard();
  if (full.length <= count) return full;
  const shuffled = [...full];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** Short description for a quest (objectives / enemies) for bulletin board display. */
export function getQuestDescription(quest: Quest): string[] {
  const levels = GameConfig?.levels ?? {};
  const levelConfig = levels[quest.level] as { killsToUnlockPortal?: number; enemyTypes?: string[] } | undefined;
  const lines: string[] = [];
  if (levelConfig?.killsToUnlockPortal != null) {
    lines.push(`Slay ${levelConfig.killsToUnlockPortal} foes to open the portal.`);
  }
  if (levelConfig?.enemyTypes?.length) {
    const unique = [...new Set(levelConfig.enemyTypes)];
    const label = unique.length <= 3 ? unique.join(', ') : `${unique.slice(0, 2).join(', ')} and more`;
    lines.push('Foes: ' + label);
  }
  if (quest.difficulty?.enemyTier2Chance === 1) {
    lines.push('All enemies 2★');
  }
  if (quest.difficulty?.goldMultiplier != null && quest.difficulty.goldMultiplier > 1) {
    lines.push(`${(quest.difficulty.goldMultiplier * 100 - 100).toFixed(0)}% bonus gold`);
  }
  return lines.length ? lines : ['Enter and survive.'];
}
