/**
 * Minimal GameConfig shape for type-checking. Extend as needed.
 */
export interface WorldConfig {
  width: number;
  height: number;
  tileSize: number;
}

export interface PlayerConfig {
  startX: number;
  startY: number;
  width: number;
  height: number;
  speed: number;
  maxHealth: number;
  maxStamina: number;
  staminaRegen: number;
  defaultWeapon?: string;
  crossbow?: Record<string, number>;
  [key: string]: unknown;
}

export interface LevelConfig {
  name?: string;
  worldWidth?: number;
  worldHeight?: number;
  packSpawn?: {
    density?: number;
    packSize?: { min: number; max: number };
    patrol?: boolean;
    packSpread?: { min: number; max: number };
    packCountVariance?: number;
    minPackDistance?: number;
  };
  enemyTypes?: string[];
  killsToUnlockPortal?: number;
  theme?: { ground?: unknown; sky?: string; texture?: string };
  obstacles?: unknown;
  tileSize?: number;
  width?: number;
  height?: number;
  playerStart?: { x: number; y: number };
  board?: { x: number; y: number; width: number; height: number };
  weaponChest?: { x: number; y: number; width: number; height: number };
  walls?: Array<{ x: number; y: number; width: number; height: number }>;
}

export interface GameConfigShape {
  world: WorldConfig;
  player: PlayerConfig;
  entityCollision?: { buffer: number };
  statusEffects?: Record<string, number>;
  groundTextures?: Record<string, string>;
  enemy?: {
    types?: Record<string, unknown>;
    pack?: { radius: number; minAllies: number; modifierChance: number };
    spawn?: { maxEnemies: number };
  };
  packModifiers?: Record<string, { damageMultiplier?: number; healthMultiplier?: number; speedMultiplier?: number; color?: string; knockbackResist?: number; attackCooldownMultiplier?: number; stunBuildupPerHitMultiplier?: number }>;
  portal?: { x: number; y: number; width: number; height: number };
  hub?: {
    name?: string;
    tileSize?: number;
    width?: number;
    height?: number;
    playerStart?: { x: number; y: number };
    board?: { x: number; y: number; width: number; height: number };
    weaponChest?: { x: number; y: number; width: number; height: number };
    theme?: { ground?: unknown; sky?: string };
    walls?: Array<{ x: number; y: number; width: number; height: number }>;
  };
  levels?: Record<number, LevelConfig>;
  obstacles?: unknown;
  pathfinding?: { cellSize: number };
  camera?: {
    zoomSpeed: number;
    smoothing?: number;
    fastFollowSmoothing?: number;
    minZoom?: number;
    maxZoom?: number;
  };
  [key: string]: unknown;
}
