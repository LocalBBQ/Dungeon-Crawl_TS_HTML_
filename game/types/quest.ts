/**
 * Quest and difficulty types for the quest board and run scaling.
 */

export interface DifficultyDef {
  id: string;
  label: string;
  goldMultiplier: number;
  packDensityMultiplier: number;
  packSizeBonus: number;
  enemyTier2Chance: number;
}

/** Quest type: standard = level-based run; delve = dungeon descent, kill-all-per-floor. */
export type QuestType = 'standard' | 'delve';

export interface Quest {
  level: number;
  difficultyId: string;
  difficulty?: DifficultyDef;
  seed?: number;
  /** When 'delve', player enters a dungeon entrance and descends floor by floor (2x2 tiles per floor, kill all to progress). */
  questType?: QuestType;
}
