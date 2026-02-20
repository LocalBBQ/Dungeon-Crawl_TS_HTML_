// Status effects (stun, etc.) - shared by player and enemies
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';

/** Pack modifier stats from config (set by EnemyManager when in pack). */
export interface PackBuffStats {
  speedMultiplier?: number;
  damageMultiplier?: number;
  knockbackResist?: number;
  attackCooldownMultiplier?: number;
  stunBuildupPerHitMultiplier?: number;
  detectionRangeMultiplier?: number;
}

/** Entity with components map for stun threshold lookup. */
interface EntityWithComponents {
  components?: Map<string, unknown>;
}

export class StatusEffects implements Component {
  entity?: EntityWithComponents & { getComponent?: (c: new (...args: unknown[]) => unknown) => unknown } | null;
  isPlayer: boolean;
  stunnedUntil: number;
  stunDurationTotal: number;
  hasBeenStunnedOnce: boolean;
  stunBuildup: number;
  lastStunBuildupTime: number;
  buffedUntil: number;
  speedMultiplier: number;
  damageMultiplier: number;
  knockbackResist: number;
  packModifierName: string | null;
  packSpeedMultiplier: number;
  packDamageMultiplier: number;
  packKnockbackResist: number;
  packAttackCooldownMultiplier: number;
  packStunBuildupMultiplier: number;
  packDetectionRangeMultiplier: number;

  /** Rising Gale (Blessed Winds): stacks 0–2, duration refreshed on hit. */
  risingGaleStacks: number;
  risingGaleUntil: number;

  /** Airborne: immobilizing + forced displacement until this time (seconds). */
  airborneUntil: number;
  /** 'fixed' = no displacement; 'direction' = move in direction at speed; 'target' = move toward point. */
  airborneMode: 'fixed' | 'direction' | 'target';
  airborneVelX: number;
  airborneVelY: number;
  airborneTargetX: number;
  airborneTargetY: number;
  airborneSpeed: number;

  constructor(isPlayer = false) {
    this.entity = null;
    this.isPlayer = isPlayer;
    this.stunnedUntil = 0;
    this.stunDurationTotal = 0;
    this.hasBeenStunnedOnce = false;
    this.stunBuildup = 0;
    this.lastStunBuildupTime = 0;
    this.buffedUntil = 0;
    this.speedMultiplier = 1;
    this.damageMultiplier = 1;
    this.knockbackResist = isPlayer
      ? (typeof GameConfig !== 'undefined' ? (GameConfig.player?.knockback?.knockbackResist ?? 0) : 0)
      : 0;
    this.packModifierName = null;
    this.packSpeedMultiplier = 1;
    this.packDamageMultiplier = 1;
    this.packKnockbackResist = 0;
    this.packAttackCooldownMultiplier = 1;
    this.packStunBuildupMultiplier = 1;
    this.packDetectionRangeMultiplier = 1;
    this.risingGaleStacks = 0;
    this.risingGaleUntil = 0;
    this.airborneUntil = 0;
    this.airborneMode = 'fixed';
    this.airborneVelX = 0;
    this.airborneVelY = 0;
    this.airborneTargetX = 0;
    this.airborneTargetY = 0;
    this.airborneSpeed = 0;
  }

  /** Apply Rising Gale: add one stack (max 2), refresh duration to 6s. */
  applyRisingGale(durationSeconds = 6): void {
    const now = performance.now() / 1000;
    if (this.risingGaleStacks < 2) this.risingGaleStacks += 1;
    this.risingGaleUntil = now + durationSeconds;
  }

  /** Consume all Rising Gale stacks (e.g. when casting Storm Release). */
  consumeRisingGale(): void {
    this.risingGaleStacks = 0;
  }

  get isAirborne(): boolean {
    const now = performance.now() / 1000;
    return now < this.airborneUntil;
  }

  /**
   * Apply airborne: immobilizing effect with optional forced displacement.
   * - No options: fixed in place for duration.
   * - directionX/Y + speed: move in that direction at speed for duration.
   * - targetX/Y + speed: move toward that point at speed until duration ends or arrived.
   */
  applyAirborne(
    durationSeconds: number,
    options?: {
      directionX?: number;
      directionY?: number;
      targetX?: number;
      targetY?: number;
      speed?: number;
    }
  ): void {
    const now = performance.now() / 1000;
    const end = now + durationSeconds;
    if (end > this.airborneUntil) this.airborneUntil = end;

    const speed = options?.speed ?? 0;
    if (options?.targetX != null && options?.targetY != null && speed > 0) {
      this.airborneMode = 'target';
      this.airborneTargetX = options.targetX;
      this.airborneTargetY = options.targetY;
      this.airborneSpeed = speed;
      this.airborneVelX = 0;
      this.airborneVelY = 0;
    } else if (
      options?.directionX != null &&
      options?.directionY != null &&
      speed > 0
    ) {
      this.airborneMode = 'direction';
      const len = Math.sqrt(options.directionX ** 2 + options.directionY ** 2);
      const nx = len > 0 ? options.directionX / len : 0;
      const ny = len > 0 ? options.directionY / len : 0;
      this.airborneVelX = nx * speed;
      this.airborneVelY = ny * speed;
      this.airborneTargetX = 0;
      this.airborneTargetY = 0;
      this.airborneSpeed = 0;
    } else {
      this.airborneMode = 'fixed';
      this.airborneVelX = 0;
      this.airborneVelY = 0;
      this.airborneTargetX = 0;
      this.airborneTargetY = 0;
      this.airborneSpeed = 0;
    }
  }

  /** Velocity for this frame while airborne (forced displacement). Immobilize = no player/enemy input; this is the forced move. */
  getAirborneVelocity(entityX: number, entityY: number): { vx: number; vy: number } {
    if (!this.isAirborne) return { vx: 0, vy: 0 };
    if (this.airborneMode === 'fixed') return { vx: 0, vy: 0 };
    if (this.airborneMode === 'direction') {
      return { vx: this.airborneVelX, vy: this.airborneVelY };
    }
    const dx = this.airborneTargetX - entityX;
    const dy = this.airborneTargetY - entityY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return { vx: 0, vy: 0 };
    const n = Utils.normalize(dx, dy);
    return { vx: n.x * this.airborneSpeed, vy: n.y * this.airborneSpeed };
  }

  setPackBuff(modifierName: string, stats: PackBuffStats): void {
    this.packModifierName = modifierName;
    this.packSpeedMultiplier = stats.speedMultiplier ?? 1;
    this.packDamageMultiplier = stats.damageMultiplier ?? 1;
    this.packKnockbackResist = Math.max(0, Math.min(1, stats.knockbackResist ?? 0));
    this.packAttackCooldownMultiplier = stats.attackCooldownMultiplier ?? 1;
    this.packStunBuildupMultiplier = stats.stunBuildupPerHitMultiplier ?? 1;
    this.packDetectionRangeMultiplier = stats.detectionRangeMultiplier ?? 1;
  }

  clearPackBuff(): void {
    this.packModifierName = null;
    this.packSpeedMultiplier = 1;
    this.packDamageMultiplier = 1;
    this.packKnockbackResist = 0;
    this.packAttackCooldownMultiplier = 1;
    this.packStunBuildupMultiplier = 1;
    this.packDetectionRangeMultiplier = 1;
  }

  get isStunned(): boolean {
    const now = performance.now() / 1000;
    return now < this.stunnedUntil;
  }

  get stunMeterPercent(): number {
    const threshold = this._getStunThreshold();
    return threshold <= 0 ? 0 : Math.min(1, this.stunBuildup / threshold);
  }

  _getStunThreshold(): number {
    if (this.isPlayer) {
      const cfg = (GameConfig as { player?: { stun?: { threshold?: number } } }).player?.stun ?? {};
      return cfg.threshold ?? 100;
    }
    const ent = this.entity as EntityWithComponents | null | undefined;
    if (ent?.components) {
      for (const comp of ent.components.values()) {
        const c = comp as { enemyType?: string };
        if (c.enemyType != null && GameConfig.enemy?.types?.[c.enemyType]) {
          const typeCfg = GameConfig.enemy.types[c.enemyType] as { stunThreshold?: number } | undefined;
          if (typeCfg?.stunThreshold != null) return typeCfg.stunThreshold;
        }
      }
    }
    const cfg = (GameConfig as { statusEffects?: { enemyStunThreshold?: number } }).statusEffects ?? {};
    return cfg.enemyStunThreshold ?? 100;
  }

  _getStunDuration(): number {
    if (this.isPlayer) {
      const cfg = (GameConfig as { player?: { stun?: { duration?: number } } }).player?.stun ?? {};
      return cfg.duration ?? 1;
    }
    const cfg = (GameConfig as { statusEffects?: { enemyStunDuration?: number } }).statusEffects ?? {};
    return cfg.enemyStunDuration ?? 1;
  }

  _getStunDecayPerSecond(): number {
    if (this.isPlayer) {
      const cfg = (GameConfig as { player?: { stun?: { decayPerSecond?: number } } }).player?.stun ?? {};
      return cfg.decayPerSecond ?? 0;
    }
    const cfg = (GameConfig as { statusEffects?: { enemyStunDecayPerSecond?: number } }).statusEffects ?? {};
    return cfg.enemyStunDecayPerSecond ?? 0;
  }

  _getStunDecayCooldown(): number {
    if (this.isPlayer) {
      const cfg = (GameConfig as { player?: { stun?: { decayCooldown?: number } } }).player?.stun ?? {};
      return cfg.decayCooldown ?? 0;
    }
    const cfg = (GameConfig as { statusEffects?: { enemyStunDecayCooldown?: number } }).statusEffects ?? {};
    return cfg.enemyStunDecayCooldown ?? 0;
  }

  applyStun(duration: number): void {
    const now = performance.now() / 1000;
    const end = now + duration;
    if (end > this.stunnedUntil) {
      this.stunnedUntil = end;
      this.stunDurationTotal = end - now;
      this.hasBeenStunnedOnce = true;
    }
  }

  get stunDurationPercentRemaining(): number {
    const now = performance.now() / 1000;
    if (now >= this.stunnedUntil || this.stunDurationTotal <= 0) return 0;
    return Math.min(1, (this.stunnedUntil - now) / this.stunDurationTotal);
  }

  addStunBuildup(amount: number): void {
    if (amount <= 0) return;
    const threshold = this._getStunThreshold();
    if (threshold <= 0) return;
    this.stunBuildup += amount;
    this.lastStunBuildupTime = performance.now() / 1000;
    if (this.stunBuildup >= threshold) {
      this.applyStun(this._getStunDuration());
      this.stunBuildup = 0;
    }
  }

  applyWarCryBuff(durationSeconds: number, speedMultiplier?: number, damageMultiplier?: number): void {
    const now = performance.now() / 1000;
    this.buffedUntil = now + durationSeconds;
    this.speedMultiplier = speedMultiplier ?? 1;
    this.damageMultiplier = damageMultiplier ?? 1;
  }

  update(deltaTime: number, systems?: SystemsMap): void {
    const now = performance.now() / 1000;
    if (now >= this.buffedUntil) {
      this.speedMultiplier = 1;
      this.damageMultiplier = 1;
    }
    if (now >= this.risingGaleUntil) this.risingGaleStacks = 0;
    if (now < this.stunnedUntil) return;
    const decay = this._getStunDecayPerSecond();
    if (decay <= 0 || this.stunBuildup <= 0) return;
    const cooldown = this._getStunDecayCooldown();
    if (cooldown > 0 && now - this.lastStunBuildupTime < cooldown) return;
    this.stunBuildup = Math.max(0, this.stunBuildup - decay * deltaTime);
  }
}
