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
