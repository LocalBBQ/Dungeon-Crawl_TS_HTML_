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
  /** When > 0, spawn tier-3 (★★★) variants instead of tier-2. Very Hard only. */
  enemyTier3Chance?: number;
}

/** Quest type: standard = level-based run; delve = dungeon descent, kill-all-per-floor. */
export type QuestType = 'standard' | 'delve';

/** Objective type for static quests (what the player must do to complete the run). */
export type QuestObjectiveType =
  | 'kill'
  | 'killBoss'
  | 'gather'
  | 'clearArea'
  | 'survive'
  | 'findInteract';

/** Params per objective type. Only the field for the active type is required. */
export interface QuestObjectiveParams {
  kill?: { count: number; enemyTypes?: string[] };
  killBoss?: { enemyType?: string };
  gather?: { count: number; gatherableType: string };
  clearArea?: Record<string, never>;
  survive?: { durationSeconds: number; minKills?: number };
  findInteract?: { count: number; interactId: string };
}

export interface Quest {
  /** Unique id (used for static quests and completion tracking). */
  id?: string;
  /** Display name (static quests). */
  name?: string;
  /** Short description lines (static quests). */
  description?: string[];
  level: number;
  difficultyId: string;
  /** Full difficulty (static quests) or partial (e.g. bulletin quests with goldMultiplier, label). */
  difficulty?: Partial<DifficultyDef> & { goldMultiplier?: number; label?: string };
  seed?: number;
  /** When 'delve', player enters a dungeon entrance and descends floor by floor (1x1 underground scene tile per floor, kill all to progress). */
  questType?: QuestType;
  /** Objective type for this run (static quests). When set, completion uses objectiveParams. */
  objectiveType?: QuestObjectiveType;
  /** Params for objectiveType (static quests). */
  objectiveParams?: QuestObjectiveParams;
  /** If true, completing this quest counts toward unlocking the next biome. */
  gatesBiomeUnlock?: boolean;
  /** Order within biome for display (static quests). */
  order?: number;
}
