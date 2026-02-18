/**
 * Hit category for block resolution. Used for "wrong answer" costs at higher difficulties:
 * light/ranged = full block; heavy = partial damage + high stamina; lunge = full block but higher stamina.
 */
export type HitCategory = 'light' | 'heavy' | 'lunge' | 'ranged' | 'zone';

/** Block effectiveness when blocking a heavy attack (base reduction × this = effective). */
export const HEAVY_BLOCK_EFFECTIVITY = 0.35;
/** Block stamina cost multiplier for heavy attacks. */
export const HEAVY_BLOCK_STAMINA_MULT = 2;
/** Block stamina cost multiplier for lunge attacks. */
export const LUNGE_BLOCK_STAMINA_MULT = 1.5;

/**
 * Combat component shape. Attack handler may be player or enemy.
 */
export interface CombatShape {
  entity?: unknown;
  isPlayer: boolean;
  attackRange: number;
  attackDamage: number;
  attackArc: number;
  windUpTime: number;
  attackHandler: unknown;
  enemyAttackHandler?: unknown;
  playerAttack?: unknown;
  isBlocking: boolean;
  isAttacking: boolean;
  isWindingUp: boolean;
  attackTimer: number;
  attackDuration: number | null;
  currentAttackAnimationKey: string | null;
  currentAttackIsCircular: boolean;
  currentAttackReverseSweep?: boolean;
  currentAttackAoeInFront?: boolean;
  currentAttackAoeOffset?: number;
  currentAttackAoeRadius?: number;
  currentAttackIsDashAttack?: boolean;
  attackArcOffset?: number;
  enemySlashSweepProgress?: number;
  currentAttackStunBuildup?: number;
  currentAttackKnockbackForce?: number;
  weapon?: unknown;
  attackInputBuffered?: unknown;
  tryFlushBufferedAttack?(): void;
}
