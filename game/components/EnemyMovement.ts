// Enemy-specific movement component - type-aware for different enemy behaviors
import type { SystemsMap } from '../types/systems.js';
import { Movement } from './Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { Transform } from './Transform.ts';
import { StatusEffects } from './StatusEffects.ts';
import { Combat } from './Combat.ts';
import { Renderable } from './Renderable.ts';
import { AI } from './AI.ts';

interface LungeConfig {
  lungeSpeed?: number;
  lungeDistance?: number;
  hopBackChance?: number;
  hopBackDistance?: number;
  hopBackSpeed?: number;
  hopBackDelay?: number;
}

interface EnemyConfigWithLunge {
  lunge?: { enabled?: boolean } & LungeConfig;
}

interface EntityWithActive {
  active?: boolean;
  getComponent?(c: new (...args: unknown[]) => unknown): unknown;
}

export class EnemyMovement extends Movement {
  enemyType: string;
  hasLunge: boolean;
  isLunging: boolean;
  lungeStartX: number;
  lungeStartY: number;
  lungeTargetX: number;
  lungeTargetY: number;
  lungeSpeed: number;
  lungeDistance: number;
  lungeTraveled: number;
  lungeStuckFrames: number;
  isAttackDashing: boolean;
  attackDashTimer: number;
  attackDashDuration: number;
  attackDashDirectionX: number;
  attackDashDirectionY: number;
  /** When set (e.g. from weapon dash attack result), used instead of reading from weapon. */
  attackDashSpeed: number;
  isHoppingBack: boolean;
  hopBackDelayRemaining: number;
  hopBackTargetX: number;
  hopBackTargetY: number;
  hopBackSpeed: number;
  hopBackDistance: number;
  hopBackTraveled: number;

  constructor(speed: number, enemyType = 'goblin') {
    super(speed);
    this.enemyType = enemyType;
    const enemyConfig = (GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin) as EnemyConfigWithLunge;
    this.hasLunge = !!(enemyConfig.lunge && enemyConfig.lunge.enabled);
    this.isLunging = false;
    this.lungeStartX = 0;
    this.lungeStartY = 0;
    this.lungeTargetX = 0;
    this.lungeTargetY = 0;
    this.lungeSpeed = 0;
    this.lungeDistance = 0;
    this.lungeTraveled = 0;
    this.lungeStuckFrames = 0;
    this.isAttackDashing = false;
    this.attackDashTimer = 0;
    this.attackDashDuration = 0;
    this.attackDashDirectionX = 0;
    this.attackDashDirectionY = 0;
    this.attackDashSpeed = 0;
    this.isHoppingBack = false;
    this.hopBackDelayRemaining = 0;
    this.hopBackTargetX = 0;
    this.hopBackTargetY = 0;
    this.hopBackSpeed = 0;
    this.hopBackDistance = 0;
    this.hopBackTraveled = 0;
  }

  override update(deltaTime: number, systems?: SystemsMap): void {
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;

    const statusEffects = this.entity!.getComponent(StatusEffects);
    if (statusEffects?.isStunned) {
      this.velocityX = 0;
      this.velocityY = 0;
      return;
    }
    if (statusEffects?.isAirborne) {
      const air = statusEffects.getAirborneVelocity(transform.x, transform.y);
      this.velocityX = air.vx;
      this.velocityY = air.vy;
      this.applyMovement(deltaTime, systems);
      return;
    }

    if (this.hopBackDelayRemaining > 0) {
      this.hopBackDelayRemaining = Math.max(0, this.hopBackDelayRemaining - deltaTime);
      this.velocityX = 0;
      this.velocityY = 0;
      if (this.hopBackDelayRemaining <= 0) this.isHoppingBack = true;
      return;
    }

    if (this.isHoppingBack) {
      const dx = this.hopBackTargetX - transform.x;
      const dy = this.hopBackTargetY - transform.y;
      const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
      if (distanceToTarget > 0.1 && this.hopBackTraveled < this.hopBackDistance) {
        const normalized = Utils.normalize(dx, dy);
        const moveX = normalized.x * this.hopBackSpeed * deltaTime;
        const moveY = normalized.y * this.hopBackSpeed * deltaTime;
        this.hopBackTraveled += Math.sqrt(moveX * moveX + moveY * moveY);
        this.velocityX = normalized.x * this.hopBackSpeed;
        this.velocityY = normalized.y * this.hopBackSpeed;
        this.facingAngle = Math.atan2(normalized.y, normalized.x);
      } else {
        this.endHopBack();
      }
      this.applyMovement(deltaTime, systems);
      return;
    }

    if (this.isAttackDashing) {
      this.attackDashTimer += deltaTime;
      let dashSpeed = this.attackDashSpeed;
      if (dashSpeed <= 0) {
        const combat = this.entity!.getComponent(Combat);
        dashSpeed = 300;
        const handler = combat?.enemyAttackHandler as { getWeapon?(): { getComboStageProperties?(n: number): { dashSpeed?: number } | null }; comboStage?: number } | null;
        if (handler?.getWeapon) {
          const weapon = handler.getWeapon();
          const stageProps = weapon?.getComboStageProperties?.(handler.comboStage ?? 1);
          if (stageProps?.dashSpeed) dashSpeed = stageProps.dashSpeed;
        }
      }
      this.velocityX = this.attackDashDirectionX * dashSpeed;
      this.velocityY = this.attackDashDirectionY * dashSpeed;
      if (this.attackDashTimer >= this.attackDashDuration) {
        this.isAttackDashing = false;
        this.attackDashTimer = 0;
        this.attackDashSpeed = 0;
        this.velocityX = 0;
        this.velocityY = 0;
      }
      this.applyMovement(deltaTime, systems);
      this.updateFacingAngle(deltaTime, systems);
      return;
    }

    if (this.hasLunge && this.isLunging) {
      const prevX = transform.x;
      const prevY = transform.y;
      const dx = this.lungeTargetX - transform.x;
      const dy = this.lungeTargetY - transform.y;
      const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
      if (distanceToTarget > 0.1) {
        const normalized = Utils.normalize(dx, dy);
        this.velocityX = normalized.x * this.lungeSpeed;
        this.velocityY = normalized.y * this.lungeSpeed;
        this.facingAngle = Math.atan2(dy, dx);
        this.lungeTraveled = Math.sqrt(
          (transform.x - this.lungeStartX) ** 2 + (transform.y - this.lungeStartY) ** 2
        );
        if (distanceToTarget < 5 || this.lungeTraveled >= this.lungeDistance) this.endLunge();
      } else {
        this.endLunge();
      }
      this.applyMovement(deltaTime, systems);
      const moved = Math.sqrt((transform.x - prevX) ** 2 + (transform.y - prevY) ** 2);
      const expectedMin = this.lungeSpeed * deltaTime * 0.2;
      if (this.isLunging && moved < expectedMin && moved < 3) {
        this.lungeStuckFrames++;
        if (this.lungeStuckFrames >= 5) this.endLunge();
      } else {
        this.lungeStuckFrames = 0;
      }
      return;
    }

    super.update(deltaTime, systems);
  }

  override updateMovement(deltaTime: number, systems?: SystemsMap): void {
    if (
      this.hopBackDelayRemaining > 0 ||
      this.isHoppingBack ||
      this.isAttackDashing ||
      (this.hasLunge && this.isLunging) ||
      this.isKnockedBack
    ) {
      return;
    }
    this.updateTypeSpecificMovement(deltaTime, systems);
    super.updateMovement(deltaTime, systems);
    this.applySeparation(systems);
  }

  applySeparation(systems?: SystemsMap): void {
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;
    const entityManager = systems?.get?.('entities');
    const getEntities = (entityManager as { getEntities?(): EntityWithActive[] })?.getEntities;
    const entities = getEntities ? getEntities.call(entityManager) : null;
    if (!entities?.length) return;

    const SEPARATION_RADIUS = 85;
    const BASE_SEPARATION_STRENGTH = 2.0;
    // Scale separation by speed so fast enemies (e.g. bandits) push apart more and don't clump
    const speedFactor = Math.min(2.5, Math.max(0.6, this.speed / 35));
    const SEPARATION_STRENGTH = BASE_SEPARATION_STRENGTH * speedFactor;
    let sx = 0, sy = 0;
    for (const e of entities) {
      if (e === this.entity || (e as EntityWithActive).active === false) continue;
      const r = (e as { getComponent(c: new (...args: unknown[]) => unknown): unknown }).getComponent?.(Renderable);
      if (!r || (r as Renderable).type !== 'enemy') continue;
      const t = (e as { getComponent(c: new (...args: unknown[]) => unknown): unknown }).getComponent?.(Transform);
      if (!t) continue;
      const tx = (t as Transform).x;
      const ty = (t as Transform).y;
      const dx = transform.x - tx;
      const dy = transform.y - ty;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1 || dist > SEPARATION_RADIUS) continue;
      const strength = (1 - dist / SEPARATION_RADIUS) * SEPARATION_STRENGTH;
      const inv = 1 / dist;
      sx += dx * inv * strength;
      sy += dy * inv * strength;
    }
    if (sx !== 0 || sy !== 0) {
      this.velocityX += sx;
      this.velocityY += sy;
      const mag = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
      if (mag > this.speed && mag > 0) {
        const scale = this.speed / mag;
        this.velocityX *= scale;
        this.velocityY *= scale;
      }
    }
  }

  updateTypeSpecificMovement(_deltaTime: number, _systems?: SystemsMap): void {}

  override updateFacingAngle(_deltaTime: number, _systems?: SystemsMap): void {
    if (this.isKnockedBack) return;
    if (this.velocityX !== 0 || this.velocityY !== 0) {
      this.facingAngle = Utils.angleTo(0, 0, this.velocityX, this.velocityY);
    }
  }

  startLunge(targetX: number, targetY: number, lungeConfig: LungeConfig): void {
    if (!this.hasLunge) return;
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;
    this.isLunging = true;
    this.lungeStartX = transform.x;
    this.lungeStartY = transform.y;
    this.lungeTargetX = targetX;
    this.lungeTargetY = targetY;
    this.lungeSpeed = lungeConfig.lungeSpeed ?? 300;
    this.lungeDistance = lungeConfig.lungeDistance ?? 120;
    this.lungeTraveled = 0;
    this.lungeStuckFrames = 0;
    this.cancelPath();
  }

  endLunge(): void {
    if (!this.hasLunge) return;
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;
    this.isLunging = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lungeTraveled = 0;

    const combat = this.entity!.getComponent(Combat);
    const handler = combat?.enemyAttackHandler as { endLunge?(m: number): void } | null;
    if (combat && handler?.endLunge) {
      handler.endLunge(combat.getPackCooldownMultiplier());
      combat._clearAttackState();
    }

    if (this.enemyType === 'goblin') {
      const enemyConfig = (GameConfig.enemy.types.goblin as EnemyConfigWithLunge) ?? {};
      const lungeConfig = enemyConfig.lunge;
      const chance = lungeConfig?.hopBackChance ?? 0;
      if (chance > 0 && Math.random() < chance) {
        const hopBackDistance = lungeConfig?.hopBackDistance ?? 60;
        const hopBackSpeed = lungeConfig?.hopBackSpeed ?? 140;
        const hopBackDelay = lungeConfig?.hopBackDelay ?? 0.75;
        const backDx = transform.x - this.lungeTargetX;
        const backDy = transform.y - this.lungeTargetY;
        const len = Math.sqrt(backDx * backDx + backDy * backDy) || 1;
        this.hopBackTargetX = transform.x + (backDx / len) * hopBackDistance;
        this.hopBackTargetY = transform.y + (backDy / len) * hopBackDistance;
        this.hopBackSpeed = hopBackSpeed;
        this.hopBackDistance = hopBackDistance;
        this.hopBackTraveled = 0;
        this.hopBackDelayRemaining = hopBackDelay;
        this.isHoppingBack = false;
        return;
      }
    }

    const ai = this.entity!.getComponent(AI) as { lungeCount?: number; maxLunges?: number; lungeCooldown?: number; lungeCooldownDuration?: number } | null;
    if (ai && (ai.lungeCount ?? 0) >= (ai.maxLunges ?? 0)) {
      ai.lungeCooldown = ai.lungeCooldownDuration;
      ai.lungeCount = 0;
    }
  }

  endHopBack(): void {
    this.isHoppingBack = false;
    this.hopBackDelayRemaining = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.hopBackTraveled = 0;
    const ai = this.entity!.getComponent(AI) as { lungeCount?: number; maxLunges?: number; lungeCooldown?: number; lungeCooldownDuration?: number } | null;
    if (ai && this.enemyType === 'goblin' && (ai.lungeCount ?? 0) >= (ai.maxLunges ?? 0)) {
      ai.lungeCooldown = ai.lungeCooldownDuration;
      ai.lungeCount = 0;
    }
  }

  startAttackDash(directionX: number, directionY: number, duration: number, speed?: number): boolean {
    this.attackDashDirectionX = directionX;
    this.attackDashDirectionY = directionY;
    this.attackDashDuration = duration;
    this.attackDashTimer = 0;
    this.attackDashSpeed = speed != null && speed > 0 ? speed : 0;
    this.isAttackDashing = true;
    return true;
  }
}
