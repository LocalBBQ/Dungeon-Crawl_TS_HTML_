// Status effects (stun, etc.) - shared by player and enemies
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { GameConfig } from '../config/GameConfig.ts';

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
    if (now < this.stunnedUntil) return;
    const decay = this._getStunDecayPerSecond();
    if (decay <= 0 || this.stunBuildup <= 0) return;
    const cooldown = this._getStunDecayCooldown();
    if (cooldown > 0 && now - this.lastStunBuildupTime < cooldown) return;
    this.stunBuildup = Math.max(0, this.stunBuildup - decay * deltaTime);
  }
}
