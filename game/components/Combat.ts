// Combat component - uses shared WeaponAttackHandler for both player and enemy
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { Movement } from './Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { StatusEffects } from './StatusEffects.ts';
import { Stamina } from './Stamina.ts';
import { Transform } from './Transform.ts';
import { Health } from './Health.ts';
import { AI } from './AI.ts';
import { Weapons } from '../weapons/WeaponsRegistry.ts';
import { Enemies } from '../enemies/EnemiesRegistry.ts';
import { PlayerAttack } from '../weapons/PlayerAttack.ts';
import { WeaponAttackHandler } from '../weapons/WeaponAttackHandler.ts';
import type { HitCategory } from '../types/combat.js';
import {
  HEAVY_BLOCK_EFFECTIVITY,
  HEAVY_BLOCK_STAMINA_MULT,
  LUNGE_BLOCK_STAMINA_MULT
} from '../types/combat.js';

/** Minimal attack handler interface used by Combat. */
export interface AttackHandlerLike {
  attackRange?: number;
  attackDamage?: number;
  attackArc?: number;
  weapon?: unknown;
  isAttacking?: boolean;
  attackTimer?: number;
  attackDuration?: number | null;
  attackDurationEnemy?: number;
  hitEnemies?: Set<unknown>;
  comboStage?: number;
  attackProcessed?: boolean;
  isWindingUp?: boolean;
  isInReleasePhase?: boolean;
  isLunging?: boolean;
  cooldown?: number;
  windUpProgress?: number;
  chargeProgress?: number;
  hasChargeRelease?(): boolean;
  hasHitEnemy?(id: string): boolean;
  canAttack?(): boolean;
  canMeleeAttack?(): boolean;
  getSlashSweepProgress?(): number;
  getWeapon?(): unknown;
  update?(deltaTime: number, entity: unknown): void;
  startAttack?(...args: unknown[]): unknown;
  endAttack?(): void;
  startLunge?(): void;
  endLunge?(...args: unknown[]): void;
  setWeapon?(weapon: unknown): void;
  getNextAttackStaminaCost?(chargeDuration: number, options?: unknown, entity?: unknown): number;
}

/** Entity with getComponent and optional systems. */
interface CombatEntity {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
  systems?: { eventBus?: { emit(name: string, payload: unknown): void }; get?(key: string): unknown };
}

/** Buffered attack input. */
interface AttackInputBuffered {
  targetX: number | null;
  targetY: number | null;
  chargeDuration: number;
  options: Record<string, unknown>;
}


export class Combat implements Component {
  entity: CombatEntity | null;
  isPlayer: boolean;
  attackRange: number;
  attackDamage: number;
  attackArc: number;
  windUpTime: number;
  attackHandler: AttackHandlerLike | null;
  enemyAttackHandler: AttackHandlerLike | null;
  playerAttack: AttackHandlerLike | null;
  currentAttackIsCircular: boolean;
  currentAttackAoeInFront: boolean;
  currentAttackAoeOffset: number;
  currentAttackAoeRadius: number;
  currentAttackAnimationKey: string | null;
  currentAttackIsDashAttack: boolean;
  dashAttackFlashUntil: number;
  attackArcOffset: number;
  currentAttackReverseSweep: boolean;
  currentAttackIsThrust: boolean;
  currentAttackThrustWidth: number;
  currentAttackStageName: string | null;
  isBlocking: boolean;
  blockStartTime: number;
  parryFlashUntil: number;
  blockInputBuffered: boolean;
  blockInputBufferedFacingAngle: number | null;
  attackInputBuffered: AttackInputBuffered | null;
  _currentAttackKnockbackForce: number | null;
  _currentAttackStunBuildup: number | null;
  _offhandWeapon: unknown;

  constructor(
    attackRange: number,
    attackDamage: number,
    attackArc: number,
    cooldown: number,
    windUpTime = 0.5,
    isPlayer = false,
    weapon: unknown = null,
    enemyType: string | null = null
  ) {
    this.entity = null;
    this.isPlayer = isPlayer;
    this.currentAttackIsCircular = false;
    this.currentAttackAoeInFront = false;
    this.currentAttackAoeOffset = 0;
    this.currentAttackAoeRadius = 0;
    this.currentAttackAnimationKey = null;
    this.currentAttackIsDashAttack = false;
    this.dashAttackFlashUntil = 0;
    this.attackArcOffset = 0;
    this.currentAttackReverseSweep = false;
    this.currentAttackIsThrust = false;
    this.currentAttackThrustWidth = 40;
    this.currentAttackStageName = null;
    this.attackHandler = null;
    this.enemyAttackHandler = null;
    this.playerAttack = null;

    this._offhandWeapon = null;
    if (isPlayer) {
      this.attackHandler = new WeaponAttackHandler(weapon, { isPlayer: true });
      this.playerAttack = this.attackHandler;
    } else {
      this.attackHandler =
        (Enemies.createAttackHandler && Enemies.createAttackHandler(enemyType)) ||
        Combat._noOpAttackHandler(attackRange, attackDamage, attackArc);
      this.enemyAttackHandler = this.attackHandler;
    }

    const h = this.attackHandler;
    this.attackRange = h ? (h.attackRange ?? attackRange) : attackRange;
    this.attackDamage = h ? (h.attackDamage ?? attackDamage) : attackDamage;
    this.attackArc = h ? (h.attackArc ?? attackArc) : attackArc;
    if (isPlayer && weapon == null) {
      this.attackRange = attackRange;
      this.attackDamage = attackDamage;
      this.attackArc = attackArc;
    }
    this.windUpTime = windUpTime;
    this.isBlocking = false;
    this.blockStartTime = 0;
    this.parryFlashUntil = 0;
    this.blockInputBuffered = false;
    this.blockInputBufferedFacingAngle = null;
    this.attackInputBuffered = null;
    this._currentAttackKnockbackForce = null;
    this._currentAttackStunBuildup = null;
  }

  static _noOpAttackHandler(
    attackRange: number,
    attackDamage: number,
    attackArc: number
  ): AttackHandlerLike {
    return {
      attackRange: attackRange ?? 0,
      attackDamage: attackDamage ?? 0,
      attackArc: attackArc ?? 0,
      weapon: null,
      isAttacking: false,
      attackTimer: 0,
      attackDuration: null,
      attackDurationEnemy: 0,
      hitEnemies: new Set(),
      comboStage: 0,
      attackProcessed: false,
      isWindingUp: false,
      isInReleasePhase: false,
      isLunging: false,
      cooldown: 0,
      windUpProgress: 0,
      chargeProgress: 0,
      hasChargeRelease: () => false,
      hasHitEnemy: () => false,
      canAttack: () => false,
      canMeleeAttack: () => false,
      getSlashSweepProgress: () => 0,
      getWeapon: () => null,
      update: () => {},
      startAttack: () => null,
      endAttack: () => {},
      startLunge: () => {},
      endLunge: () => {},
    };
  }

  setWeapon(weapon: unknown): void {
    this.setWeapons(weapon, this._offhandWeapon);
  }

  setWeapons(mainhand: unknown, offhand?: unknown | null): void {
    if (this.isPlayer) {
      this._offhandWeapon = offhand ?? null;
      if (
        this.attackHandler &&
        typeof (this.attackHandler as AttackHandlerLike & { setWeapon?(w: unknown): void }).setWeapon === 'function'
      ) {
        (this.attackHandler as AttackHandlerLike & { setWeapon(w: unknown): void }).setWeapon(mainhand);
      }
      if (mainhand) {
        const w = mainhand as {
          getComboStageProperties?(n: number): { range?: number; damage?: number; arc?: number } | null;
          baseRange?: number;
          baseDamage?: number;
          baseArcDegrees?: number;
          twoHanded?: boolean;
        };
        const first = w.getComboStageProperties ? w.getComboStageProperties(1) : null;
        if (first) {
          this.attackRange = first.range ?? this.attackRange;
          this.attackDamage = first.damage ?? this.attackDamage;
          this.attackArc = first.arc ?? this.attackArc;
        } else {
          this.attackRange = w.baseRange ?? this.attackRange;
          this.attackDamage = w.baseDamage ?? this.attackDamage;
          this.attackArc =
            typeof w.baseArcDegrees === 'number' ? Utils.degToRad(w.baseArcDegrees) : this.attackArc;
        }
      }
      const offhandWeapon = this._offhandWeapon as { name?: string; baseDamage?: number } | null;
      if (offhandWeapon && offhandWeapon.name?.includes('Defender') && typeof offhandWeapon.baseDamage === 'number') {
        this.attackDamage += offhandWeapon.baseDamage;
      }
    }
  }

  get weapon(): unknown {
    return this.attackHandler ? this.attackHandler.weapon : null;
  }

  get mainhandWeapon(): unknown {
    return this.weapon;
  }

  get offhandWeapon(): unknown {
    return this._offhandWeapon;
  }

  getPackCooldownMultiplier(): number {
    if (this.isPlayer || !this.entity) return 1;
    const statusEffects = this.entity.getComponent(StatusEffects);
    return statusEffects?.packAttackCooldownMultiplier != null
      ? statusEffects.packAttackCooldownMultiplier
      : 1;
  }

  update(deltaTime: number, systems?: SystemsMap): void {
    if (this.attackHandler && typeof this.attackHandler.update === 'function') {
      this.attackHandler.update(deltaTime, this.entity);
    }
    if (this.isPlayer && this.attackInputBuffered && !this.isAttacking) {
      this.tryFlushBufferedAttack();
    }
    if (this.isPlayer && this.isBlocking && this.entity) {
      const statusEffects = this.entity.getComponent(StatusEffects);
      if (statusEffects?.isStunned) this.stopBlocking();
    }
  }

  startBlocking(): boolean {
    const blockConfig = this._getBlockConfig();
    if (
      this.isPlayer &&
      !this.isAttacking &&
      blockConfig &&
      (blockConfig as { enabled?: boolean }).enabled
    ) {
      this.isBlocking = true;
      this.blockStartTime = Date.now();
      return true;
    }
    return false;
  }

  _getBlockConfig(): unknown {
    if (!this.isPlayer) return null;
    const mainhand = this.mainhandWeapon as { getBlockConfig?(): unknown; twoHanded?: boolean } | null;
    const offhand = this._offhandWeapon as { getBlockConfig?(): unknown } | null;
    const mainhandTwoHanded = mainhand && (mainhand as { twoHanded?: boolean }).twoHanded === true;
    if (!mainhandTwoHanded && offhand) {
      const offBlock = offhand.getBlockConfig ? offhand.getBlockConfig() : null;
      const offEnabled = offBlock && (offBlock as { enabled?: boolean }).enabled !== false;
      if (offEnabled) return offBlock;
    }
    if (!mainhand) return null;
    const mainBlock = mainhand.getBlockConfig ? mainhand.getBlockConfig() : null;
    return mainBlock;
  }

  get blockDamageReduction(): number {
    const blockConfig = this._getBlockConfig() as { damageReduction?: number } | null;
    return blockConfig ? (blockConfig.damageReduction ?? 0) : 0;
  }

  /**
   * Effective block damage reduction for a given hit category. Used for "wrong answer" costs:
   * heavy attacks get reduced block effectiveness; light/lunge/ranged use base.
   */
  getEffectiveBlockDamageReduction(category: HitCategory): number {
    const base = this.blockDamageReduction;
    if (category === 'heavy') return Math.min(1, base * HEAVY_BLOCK_EFFECTIVITY);
    return base;
  }

  /**
   * Consume stamina for blocking. Optional category applies difficulty tunings:
   * heavy = 2× cost, lunge = 1.5× cost; light/ranged = base cost.
   */
  consumeBlockStamina(category?: HitCategory): boolean {
    if (this.isPlayer && this.isBlocking) {
      const blockConfig = this._getBlockConfig() as { staminaCost?: number } | null;
      if (!blockConfig) return false;
      let cost = blockConfig.staminaCost ?? 0;
      if (category === 'heavy') cost *= HEAVY_BLOCK_STAMINA_MULT;
      else if (category === 'lunge') cost *= LUNGE_BLOCK_STAMINA_MULT;
      const stamina = this.entity!.getComponent(Stamina);
      if (stamina && stamina.currentStamina >= cost) {
        stamina.currentStamina -= cost;
        return true;
      }
      this.stopBlocking();
      return false;
    }
    return false;
  }

  stopBlocking(): void {
    this.isBlocking = false;
  }

  shieldBash(
    systems: SystemsMap | undefined,
    targetX: number,
    targetY: number
  ): boolean {
    if (!this.isPlayer || !this.entity) return false;
    const blockConfig = this._getBlockConfig() as {
      shieldBash?: {
        staminaCost?: number;
        arcRad?: number;
        range?: number;
        knockback?: number;
        dashDuration?: number;
        dashSpeed?: number;
      };
    } | null;
    const sb = blockConfig?.shieldBash;
    if (!sb) return false;
    if (!this.isBlocking) return false;

    const stamina = this.entity.getComponent(Stamina);
    if (stamina && stamina.currentStamina < (sb.staminaCost ?? 0)) return false;
    if (stamina) stamina.currentStamina -= sb.staminaCost ?? 0;

    const transform = this.entity.getComponent(Transform);
    const movement = this.entity.getComponent(Movement);
    if (!transform || !movement || !(movement as Movement & { startAttackDash?: unknown }).startAttackDash)
      return true;

    const facingAngle = movement.facingAngle;
    const entityManager = systems?.get?.('entities');
    if (entityManager) {
      const getAll = (entityManager as { getAll?(tag: string): unknown[] }).getAll;
      const enemies = getAll ? getAll.call(entityManager, 'enemy') : [];
      const arcRad = sb.arcRad ?? (120 * Math.PI) / 180;
      const range = sb.range ?? 100;
      const knockback = sb.knockback ?? 500;
      if (enemies && enemies.length > 0) {
        for (const enemy of enemies) {
          const e = enemy as CombatEntity;
          const enemyHealth = e.getComponent(Health);
          const enemyTransform = e.getComponent(Transform);
          if (!enemyHealth || !enemyTransform || enemyHealth.isDead) continue;
          if (
            !Utils.pointInArc(
              enemyTransform.x,
              enemyTransform.y,
              transform.x,
              transform.y,
              facingAngle,
              arcRad,
              range
            )
          )
            continue;
          const enemyMovement = e.getComponent(Movement);
          if (enemyMovement) {
            const dx = enemyTransform.x - transform.x;
            const dy = enemyTransform.y - transform.y;
            const norm = Utils.normalize(dx, dy);
            (enemyMovement as Movement & { applyKnockback(x: number, y: number, f: number): void }).applyKnockback(
              norm.x,
              norm.y,
              knockback
            );
          }
        }
      }
    }
    const dirX = Math.cos(facingAngle);
    const dirY = Math.sin(facingAngle);
    (movement as Movement & { startAttackDash(x: number, y: number, d: number, s?: number): void }).startAttackDash(
      dirX,
      dirY,
      sb.dashDuration ?? 0,
      sb.dashSpeed
    );
    return true;
  }

  canBlockAttack(attackAngle: number, facingAngle: number): boolean {
    if (!this.isBlocking || !this.isPlayer) return false;
    const blockConfig = this._getBlockConfig() as { arcRad?: number } | null;
    if (!blockConfig?.arcRad) return false;
    let angleDiff = Math.abs(attackAngle - facingAngle);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
    return angleDiff <= blockConfig.arcRad / 2;
  }

  /** True if blocking and block started within the weapon's parry window (e.g. greatsword). */
  isInParryWindow(): boolean {
    if (!this.isPlayer || !this.isBlocking) return false;
    const blockConfig = this._getBlockConfig() as { parryWindowMs?: number } | null;
    const parryWindowMs = blockConfig?.parryWindowMs ?? 0;
    if (parryWindowMs <= 0) return false;
    return (Date.now() - this.blockStartTime) <= parryWindowMs;
  }

  /** Parry rally percent from block config (0–1). Only meaningful when parryWindowMs > 0. */
  getParryRallyPercent(): number {
    const blockConfig = this._getBlockConfig() as { parryRallyPercent?: number } | null;
    return Math.max(0, Math.min(1, blockConfig?.parryRallyPercent ?? 0));
  }

  /** Call when a parry succeeds: absorb damage, add rally, trigger white flash. */
  applyParry(rallyAmount: number, flashDurationMs = 220): void {
    this.parryFlashUntil = Date.now() + flashDurationMs;
  }

  _applyAttackResult(result: Record<string, unknown>): void {
    if (!result || typeof result !== 'object') return;
    this._currentAttackKnockbackForce = (result.knockbackForce as number) ?? null;
    this._currentAttackStunBuildup = (result.stunBuildup as number) ?? 25;
    if (result.range != null) this.attackRange = result.range as number;
    if (result.damage != null) this.attackDamage = result.damage as number;
    const offhand = this._offhandWeapon as { name?: string; baseDamage?: number } | null;
    if (offhand && offhand.name?.includes('Defender') && typeof offhand.baseDamage === 'number') {
      this.attackDamage += offhand.baseDamage;
    }
    if (result.arc != null) this.attackArc = result.arc as number;
    this.attackArcOffset = (result.arcOffset as number) ?? 0;
    this.currentAttackReverseSweep = result.reverseSweep === true;
    this.currentAttackIsCircular = result.isCircular === true;
    this.currentAttackIsThrust = result.isThrust === true;
    this.currentAttackThrustWidth = (result.thrustWidth as number) ?? 40;
    this.currentAttackStageName = (result.stageName as string) || null;
    this.currentAttackAnimationKey = (result.animationKey as string) || null;
    this.currentAttackIsDashAttack = result.isDashAttack === true;
    if (result.isDashAttack) this.dashAttackFlashUntil = Date.now() + 400;
    this.currentAttackAoeInFront = result.aoeInFront === true;
    this.currentAttackAoeOffset = result.aoeOffset != null ? (result.aoeOffset as number) : 0;
    this.currentAttackAoeRadius = result.aoeRadius != null ? (result.aoeRadius as number) : 0;
  }

  tryFlushBufferedAttack(): boolean {
    if (!this.isPlayer || !this.attackInputBuffered || this.isAttacking) return false;
    const b = this.attackInputBuffered;
    this.attackInputBuffered = null;
    this.attack(b.targetX, b.targetY, b.chargeDuration, b.options);
    return true;
  }

  _clearAttackState(): void {
    this.currentAttackIsCircular = false;
    this.currentAttackIsThrust = false;
    this.currentAttackThrustWidth = 0;
    this.currentAttackStageName = null;
    this.currentAttackAoeInFront = false;
    this.currentAttackAoeOffset = 0;
    this.currentAttackAoeRadius = 0;
    this.currentAttackAnimationKey = null;
    this.currentAttackIsDashAttack = false;
    this.attackArcOffset = 0;
    this.currentAttackReverseSweep = false;
    this._currentAttackKnockbackForce = null;
    this._currentAttackStunBuildup = null;
  }

  attack(
    targetX: number | null = null,
    targetY: number | null = null,
    chargeDuration = 0,
    options: Record<string, unknown> = {}
  ): unknown {
    if (!this.attackHandler) return false;

    if (this.isPlayer) {
      if (this.isAttacking) {
        this.attackInputBuffered = { targetX, targetY, chargeDuration, options: options || {} };
        return false;
      }
      const staminaCost =
        (this.attackHandler as AttackHandlerLike & { getNextAttackStaminaCost?(c: number, o?: unknown, e?: unknown): number })
          .getNextAttackStaminaCost?.(chargeDuration, options, this.entity) ?? 0;
      const stamina = this.entity?.getComponent(Stamina) ?? null;
      if (stamina && stamina.currentStamina < staminaCost) return false;
      const result = this.attackHandler.startAttack?.(
        targetX,
        targetY,
        this.entity,
        chargeDuration,
        options
      ) as Record<string, unknown> | null;
      if (!result || typeof result !== 'object') return false;
      if (stamina && result.staminaCost != null) stamina.currentStamina -= result.staminaCost as number;
      this._applyAttackResult(result);
      if (result.isStormRelease === true && this.entity) {
        const systems = this.entity.systems as { get?(k: string): unknown } | undefined;
        const projectileManager = systems?.get?.('projectiles') as {
          createProjectile(x: number, y: number, angle: number, speed: number, damage: number, range: number, owner: unknown, ownerType: string, stunBuildup: number, pierce?: boolean, airborneDuration?: number): unknown;
        } | undefined;
        const transform = this.entity.getComponent(Transform);
        if (projectileManager && transform && typeof projectileManager.createProjectile === 'function') {
          projectileManager.createProjectile(
            transform.x,
            transform.y,
            result.stormReleaseAngle as number,
            result.stormReleaseSpeed as number,
            result.stormReleaseDamage as number,
            result.stormReleaseRange as number,
            this.entity,
            'player',
            0,
            true,
            (result.stormReleaseAirborneDuration as number) ?? 1,
            90,
            90
          );
        }
      }
      if (this.entity?.systems) {
        const eventBus =
          (this.entity.systems as { eventBus?: { emit(n: string, p: unknown): void }; get?(k: string): unknown }).eventBus ??
          (this.entity.systems.get?.('eventBus') as { emit(n: string, p: unknown): void } | undefined);
        if (eventBus)
          eventBus.emit('entity:attack', {
            entity: this.entity,
            range: result.range,
            damage: result.damage,
            arc: result.arc,
            comboStage: result.comboStage,
          });
      }
      const durationMs =
        (result.duration as number) >= 100
          ? (result.duration as number)
          : Math.round((result.duration as number) || 0 * 1000);
      const combatRef = this;
      setTimeout(() => {
        // End the player attack here (single authority) so the buffer is only flushed after full duration; prevents game-loop endAttack() from making isAttacking false early and letting a rapid click/timeout restart the animation.
        if (combatRef.isPlayer && combatRef.attackHandler && typeof combatRef.attackHandler.endAttack === 'function') {
          combatRef.attackHandler.endAttack();
        }
        if (!combatRef.isAttacking) combatRef._clearAttackState();
        if (combatRef.isPlayer && combatRef.blockInputBuffered) {
          combatRef.blockInputBuffered = false;
          if (
            combatRef.blockInputBufferedFacingAngle != null &&
            combatRef.entity
          ) {
            const movement = combatRef.entity.getComponent(Movement);
            if (movement) movement.facingAngle = combatRef.blockInputBufferedFacingAngle;
            combatRef.blockInputBufferedFacingAngle = null;
          }
          combatRef.startBlocking();
        }
        if (combatRef.attackInputBuffered) {
          const b = combatRef.attackInputBuffered;
          combatRef.attackInputBuffered = null;
          combatRef.attack(b.targetX, b.targetY, b.chargeDuration, b.options);
        }
      }, durationMs);
      return result;
    }

    const stamina = this.entity?.getComponent(Stamina) ?? null;
    if (stamina) {
      const ai = this.entity!.getComponent(AI);
      const enemyType = ai ? (ai as { enemyType?: string }).enemyType : null;
      const enemyConfig =
        enemyType && GameConfig.enemy?.types
          ? (GameConfig.enemy.types as Record<string, { attackStaminaCost?: number }>)[enemyType]
          : null;
      const cost = enemyConfig?.attackStaminaCost ?? 12;
      if (!stamina.use(cost)) return false;
    }
    const mergedOptions = { ...options, cooldownMultiplier: this.getPackCooldownMultiplier() };
    const result = this.attackHandler.startAttack?.(
      targetX,
      targetY,
      this.entity,
      chargeDuration,
      mergedOptions
    ) as Record<string, unknown> | null;
    if (!result || typeof result !== 'object' || result.range == null) return !!result;
    this._applyAttackResult(result);
    const dashSpeed = result.dashSpeed as number | undefined;
    const dashDuration = result.dashDuration as number | undefined;
    if (dashSpeed != null && dashSpeed > 0 && dashDuration != null && dashDuration > 0 && this.entity) {
      const transform = this.entity.getComponent(Transform);
      const movement = this.entity.getComponent(Movement) as (Movement & { startAttackDash?(x: number, y: number, d: number, s?: number): void }) | null;
      if (transform && movement?.startAttackDash && targetX != null && targetY != null) {
        const dx = targetX - transform.x;
        const dy = targetY - transform.y;
        const normalized = Utils.normalize(dx, dy);
        movement.startAttackDash(normalized.x, normalized.y, dashDuration, dashSpeed);
      }
    }
    const durationMs = result.duration as number;
    const combatRef = this;
    setTimeout(() => {
      combatRef._clearAttackState();
      if (
        combatRef.attackHandler?.isAttacking &&
        typeof combatRef.attackHandler.endAttack === 'function'
      )
        combatRef.attackHandler.endAttack();
    }, durationMs);
    return result;
  }

  get isAttacking(): boolean {
    if (this.isPlayer && this.playerAttack) return !!this.playerAttack.isAttacking;
    if (this.enemyAttackHandler) return !!this.enemyAttackHandler.isAttacking;
    return false;
  }

  get isWindingUp(): boolean {
    if (this.enemyAttackHandler) {
      if (this.enemyAttackHandler.isWindingUp) return true;
      if (
        this.enemyAttackHandler.hasChargeRelease &&
        this.enemyAttackHandler.isAttacking &&
        !this.enemyAttackHandler.isInReleasePhase
      )
        return true;
    }
    return false;
  }

  get attackProcessed(): boolean {
    if (this.enemyAttackHandler) {
      if (this.enemyAttackHandler.hasHitEnemy) return this.enemyAttackHandler.hasHitEnemy('player');
      return !!this.enemyAttackHandler.attackProcessed;
    }
    return false;
  }

  get comboStage(): number {
    if (this.isPlayer && this.playerAttack) return this.playerAttack.comboStage ?? 0;
    if (this.enemyAttackHandler?.comboStage != null) return this.enemyAttackHandler.comboStage;
    return 0;
  }

  get attackTimer(): number {
    if (this.isPlayer && this.playerAttack) return this.playerAttack.attackTimer ?? 0;
    if (this.enemyAttackHandler?.attackTimer != null) return this.enemyAttackHandler.attackTimer;
    return 0;
  }

  get attackDuration(): number {
    if (this.isPlayer && this.attackHandler)
      return this.attackHandler.attackDuration != null ? this.attackHandler.attackDuration : 0;
    if (this.attackHandler?.attackDurationEnemy != null) return this.attackHandler.attackDurationEnemy;
    return 0;
  }

  get hitEnemies(): Set<unknown> {
    if (this.isPlayer && this.playerAttack) return this.playerAttack.hitEnemies ?? new Set();
    if (this.enemyAttackHandler?.hitEnemies) return this.enemyAttackHandler.hitEnemies;
    return new Set();
  }

  get currentAttackKnockbackForce(): number | null {
    return this._currentAttackKnockbackForce;
  }

  get currentAttackStunBuildup(): number {
    return this._currentAttackStunBuildup ?? 0;
  }

  get windUpProgress(): number {
    if (this.enemyAttackHandler) {
      if (this.enemyAttackHandler.windUpProgress != null) return this.enemyAttackHandler.windUpProgress;
      if (this.enemyAttackHandler.chargeProgress != null) return this.enemyAttackHandler.chargeProgress;
    }
    return 0;
  }

  get enemySlashSweepProgress(): number {
    if (
      !this.enemyAttackHandler ||
      typeof this.enemyAttackHandler.getSlashSweepProgress !== 'function'
    )
      return 0;
    return this.enemyAttackHandler.getSlashSweepProgress!();
  }

  get cooldown(): number {
    if (this.enemyAttackHandler) {
      if (this.enemyAttackHandler.cooldown != null) return this.enemyAttackHandler.cooldown;
      if (this.enemyAttackHandler.canAttack) return this.enemyAttackHandler.canAttack!() ? 0 : 0.1;
    }
    return 0;
  }

  get isLunging(): boolean {
    return !!this.enemyAttackHandler?.isLunging;
  }
}
