/**
 * Movement component shape (base). Subclasses add player/enemy-specific fields.
 */
export interface MovementShape {
  baseSpeed: number;
  speed: number;
  velocityX: number;
  velocityY: number;
  targetX: number | null;
  targetY: number | null;
  facingAngle: number;
  path: Array<{ x: number; y: number }>;
  pathIndex: number;
  entity?: unknown;
  stuckTimer: number;
  attackTarget?: unknown;
  isKnockedBack: boolean;
  knockbackVelocityX: number;
  knockbackVelocityY: number;
  knockbackDecay: number;
  isDodging?: boolean;
  isAttackDashing?: boolean;
  pathLength?: number;
  startAttackDash?(x: number, y: number, duration: number, speed: number): void;
  stop?(): void;
  applyKnockback(dx: number, dy: number, force: number): void;
}
