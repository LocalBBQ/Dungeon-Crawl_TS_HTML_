/**
 * Health component shape.
 */
export interface HealthShape {
  maxHealth: number;
  currentHealth: number;
  entity?: unknown;
  isInvincible: boolean;
  wasJustHit: boolean;
  readonly isDead: boolean;
  readonly percent: number;
  takeDamage(amount: number, isBlocked?: boolean): boolean;
  heal(amount: number): void;
}
