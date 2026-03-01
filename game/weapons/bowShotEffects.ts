/**
 * Modular bow shot behavior: charge level is 1–3; the effect of each level is pluggable.
 * Default effect: level N fires N arrows (slight spread). Other effects can be slotted in
 * (e.g. damage scaling, piercing, spread angle).
 */
import { Utils } from '../utils/Utils.js';

export interface ProjectileManagerLike {
  createProjectile?(
    x: number, y: number, angle: number, speed: number, damage: number, range: number,
    owner: unknown, ownerType: 'player' | 'enemy', stunBuildup?: number,
    ...rest: unknown[]
  ): unknown;
}

export const BOW_CHARGE_LEVELS = 3 as const;
export type BowChargeLevel = 0 | 1 | 2 | 3;

/** Seconds to reach each charge level. [level1, level2, level3]. Below level1 = level 0 (no shot). */
export interface BowChargeThresholds {
  level1: number;
  level2: number;
  level3: number;
}

export interface BowShotLevelEffectContext {
  /** Player entity (owner of projectiles). */
  owner: unknown;
  /** Spawn position X. */
  x: number;
  /** Spawn position Y. */
  y: number;
  /** Base aim angle (radians). */
  aimAngle: number;
  /** Per-arrow damage. */
  damage: number;
  /** Projectile speed. */
  speed: number;
  /** Max range. */
  range: number;
  /** Stun buildup per hit. */
  stunBuildup: number;
  /** Projectile manager to create projectiles. */
  projectileManager: ProjectileManagerLike;
  /** Owner type for projectiles. */
  ownerType: 'player' | 'enemy';
}

/**
 * Effect applied when releasing a charged bow shot at a given level (1–3).
 * Implementations can spawn projectiles, apply damage, etc.
 */
export type BowShotLevelEffect = (
  level: BowChargeLevel,
  context: BowShotLevelEffectContext
) => void;

/**
 * Returns charge level 0–3 from charge duration (seconds) and thresholds.
 * Below level1 => 0; level1..level2 => 1; level2..level3 => 2; >= level3 => 3.
 */
export function getBowChargeLevel(
  chargeDurationSec: number,
  thresholds: BowChargeThresholds
): BowChargeLevel {
  if (chargeDurationSec < thresholds.level1) return 0;
  if (chargeDurationSec < thresholds.level2) return 1;
  if (chargeDurationSec < thresholds.level3) return 2;
  return 3;
}

/** Default effect: level N fires N arrows with a small spread. */
export const defaultBowShotLevelEffect: BowShotLevelEffect = (level, ctx) => {
  if (level < 1) return;
  const count = level;
  const spreadDegrees = 6;
  const spreadRad = Utils.degToRad(spreadDegrees);
  const startAngle = ctx.aimAngle - (count - 1) * 0.5 * spreadRad;
  for (let i = 0; i < count; i++) {
    const angle = startAngle + i * spreadRad;
    ctx.projectileManager.createProjectile(
      ctx.x,
      ctx.y,
      angle,
      ctx.speed,
      ctx.damage,
      ctx.range,
      ctx.owner,
      ctx.ownerType,
      ctx.stunBuildup
    );
  }
};

/** Registry: weapon id or 'default' -> effect. Allows per-weapon or global override. */
const shotLevelEffectRegistry: Map<string, BowShotLevelEffect> = new Map([
  ['default', defaultBowShotLevelEffect],
]);

export function registerBowShotLevelEffect(id: string, effect: BowShotLevelEffect): void {
  shotLevelEffectRegistry.set(id, effect);
}

export function getBowShotLevelEffect(weaponId?: string): BowShotLevelEffect {
  if (weaponId && shotLevelEffectRegistry.has(weaponId)) {
    return shotLevelEffectRegistry.get(weaponId)!;
  }
  return shotLevelEffectRegistry.get('default') ?? defaultBowShotLevelEffect;
}
