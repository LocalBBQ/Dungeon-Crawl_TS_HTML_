// Base Movement component - shared functionality for all entities
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { Transform } from './Transform.ts';
import { Renderable } from './Renderable.ts';
import { Combat } from './Combat.ts';
import { StatusEffects } from './StatusEffects.ts';
import { Health } from './Health.ts';
import { Utils } from '../utils/Utils.ts';
import { GameConfig } from '../config/GameConfig.ts';

/** Entity with id and getComponent for movement/collision. */
interface MovementEntity {
  id: string;
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

/** Waypoint for path following. */
interface PathWaypoint {
  x: number;
  y: number;
}

/** Obstacle manager from systems. */
interface ObstacleManagerLike {
  canMoveTo(x: number, y: number, w: number, h: number, opts?: { allowSwampPools?: boolean } | null): boolean;
  getSwampPoolSpeedMultiplier(x: number, y: number, w: number, h: number): number;
}

/** Entity manager from systems. */
interface EntityManagerLike {
  get(id: string): MovementEntity | undefined;
  getAll(tag: string): MovementEntity[];
}

export class Movement implements Component {
  baseSpeed: number;
  speed: number;
  velocityX: number;
  velocityY: number;
  targetX: number | null;
  targetY: number | null;
  facingAngle: number;
  path: PathWaypoint[];
  pathIndex: number;
  entity: MovementEntity | null;
  stuckTimer: number;
  attackTarget: unknown;
  isKnockedBack: boolean;
  knockbackVelocityX: number;
  knockbackVelocityY: number;
  knockbackDecay: number;

  constructor(speed: number) {
    this.baseSpeed = speed;
    this.speed = speed;
    this.velocityX = 0;
    this.velocityY = 0;
    this.targetX = null;
    this.targetY = null;
    this.facingAngle = 0;
    this.path = [];
    this.pathIndex = 0;
    this.entity = null;
    this.stuckTimer = 0;
    this.attackTarget = null;
    this.isKnockedBack = false;
    this.knockbackVelocityX = 0;
    this.knockbackVelocityY = 0;
    this.knockbackDecay = 0.85;
  }

  update(deltaTime: number, systems?: SystemsMap): void {
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;

    if (this.isKnockedBack) {
      this.velocityX = this.knockbackVelocityX;
      this.velocityY = this.knockbackVelocityY;
      this.knockbackVelocityX *= Math.pow(this.knockbackDecay, deltaTime * 60);
      this.knockbackVelocityY *= Math.pow(this.knockbackDecay, deltaTime * 60);
      const minVelocity = 5;
      if (
        Math.abs(this.knockbackVelocityX) < minVelocity &&
        Math.abs(this.knockbackVelocityY) < minVelocity
      ) {
        this.isKnockedBack = false;
        this.knockbackVelocityX = 0;
        this.knockbackVelocityY = 0;
        this.velocityX = 0;
        this.velocityY = 0;
      }
    } else {
      const combat = this.entity!.getComponent(Combat);
      if (combat?.isBlocking) {
        this.speed = this.baseSpeed * 0.5;
      } else {
        this.speed = this.baseSpeed;
      }
      const statusEffects = this.entity!.getComponent(StatusEffects);
      if (statusEffects && performance.now() / 1000 < statusEffects.buffedUntil) {
        this.speed *= statusEffects.speedMultiplier ?? 1;
      }
      if (statusEffects?.packSpeedMultiplier != null && statusEffects.packSpeedMultiplier !== 1) {
        this.speed *= statusEffects.packSpeedMultiplier;
      }
    }

    this.updateMovement(deltaTime, systems);
    this.applyMovement(deltaTime, systems);
    this.updateFacingAngle(deltaTime, systems);
  }

  updateMovement(deltaTime: number, systems?: SystemsMap): void {
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const transform = this.entity!.getComponent(Transform);
      if (!transform) return;
      const waypoint = this.path[this.pathIndex];
      const dx = waypoint.x - transform.x;
      const dy = waypoint.y - transform.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 10) {
        this.pathIndex++;
      } else {
        const normalized = Utils.normalize(dx, dy);
        this.velocityX = normalized.x * this.speed;
        this.velocityY = normalized.y * this.speed;
      }
    } else if (this.targetX !== null && this.targetY !== null) {
      const transform = this.entity!.getComponent(Transform);
      if (!transform) return;
      const dx = this.targetX - transform.x;
      const dy = this.targetY - transform.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 5) {
        const normalized = Utils.normalize(dx, dy);
        this.velocityX = normalized.x * this.speed;
        this.velocityY = normalized.y * this.speed;
      } else {
        this.targetX = null;
        this.targetY = null;
        this.velocityX = 0;
        this.velocityY = 0;
      }
    }
  }

  applyMovement(deltaTime: number, systems?: SystemsMap): void {
    const transform = this.entity!.getComponent(Transform);
    if (!transform) return;

    const obstacleManager = systems?.get?.('obstacles') as ObstacleManagerLike | null | undefined;
    const entityManager = systems?.get?.('entities') as EntityManagerLike | null | undefined;
    const renderable = this.entity!.getComponent(Renderable);
    const isPlayer = renderable?.type === 'player';
    const allowSwampPools = isPlayer ? { allowSwampPools: true } : null;

    let vx = this.velocityX;
    let vy = this.velocityY;
    if (obstacleManager && isPlayer) {
      const mul = obstacleManager.getSwampPoolSpeedMultiplier(
        transform.x,
        transform.y,
        transform.width,
        transform.height
      );
      vx *= mul;
      vy *= mul;
    }
    const newX = transform.x + vx * deltaTime;
    const newY = transform.y + vy * deltaTime;

    const wouldCollideWithEntity = this.checkEntityCollision(
      newX,
      newY,
      transform.width,
      transform.height,
      entityManager,
      this.entity
    );
    const wouldCollideWithObstacle =
      obstacleManager &&
      !obstacleManager.canMoveTo(newX, newY, transform.width, transform.height, allowSwampPools);

    if (wouldCollideWithEntity || wouldCollideWithObstacle) {
      if (this.isKnockedBack && wouldCollideWithObstacle) {
        this.isKnockedBack = false;
        this.knockbackVelocityX = 0;
        this.knockbackVelocityY = 0;
        this.velocityX = 0;
        this.velocityY = 0;
      } else {
        const canMoveX =
          !this.checkEntityCollision(
            newX,
            transform.y,
            transform.width,
            transform.height,
            entityManager,
            this.entity
          ) &&
          (!obstacleManager ||
            obstacleManager.canMoveTo(
              newX,
              transform.y,
              transform.width,
              transform.height,
              allowSwampPools
            ));

        if (canMoveX) {
          transform.x = newX;
        } else {
          const canMoveY =
            !this.checkEntityCollision(
              transform.x,
              newY,
              transform.width,
              transform.height,
              entityManager,
              this.entity
            ) &&
            (!obstacleManager ||
              obstacleManager.canMoveTo(
                transform.x,
                newY,
                transform.width,
                transform.height,
                allowSwampPools
              ));

          if (canMoveY) {
            transform.y = newY;
          } else {
            if (this.isKnockedBack) {
              this.isKnockedBack = false;
              this.knockbackVelocityX = 0;
              this.knockbackVelocityY = 0;
            }
            this.velocityX = 0;
            this.velocityY = 0;
            if (!this.stuckTimer) this.stuckTimer = 0;
            this.stuckTimer++;
            if (this.stuckTimer > 10) {
              this.cancelPath();
              this.stuckTimer = 0;
            }
          }
        }
      }
    } else {
      transform.x = newX;
      transform.y = newY;
      this.stuckTimer = 0;
    }

    const worldConfig = GameConfig.world;
    transform.x = Utils.clamp(transform.x, 0, worldConfig.width);
    transform.y = Utils.clamp(transform.y, 0, worldConfig.height);
  }

  updateFacingAngle(_deltaTime: number, _systems?: SystemsMap): void {
    if (this.isKnockedBack) return;
    if (this.velocityX !== 0 || this.velocityY !== 0) {
      this.facingAngle = Utils.angleTo(0, 0, this.velocityX, this.velocityY);
    }
  }

  setVelocity(x: number, y: number): void {
    if (this.isKnockedBack) return;
    const normalized = Utils.normalize(x, y);
    this.velocityX = normalized.x * this.speed;
    this.velocityY = normalized.y * this.speed;
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.path = [];
    this.pathIndex = 0;
  }

  followPath(path: PathWaypoint[]): void {
    if (path?.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      this.targetX = null;
      this.targetY = null;
    }
  }

  cancelPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.targetX = null;
    this.targetY = null;
  }

  hasPath(): boolean {
    return this.path.length > 0 && this.pathIndex < this.path.length;
  }

  stop(): void {
    if (this.isKnockedBack) return;
    this.velocityX = 0;
    this.velocityY = 0;
    this.targetX = null;
    this.targetY = null;
    this.cancelPath();
    this.stuckTimer = 0;
    this.attackTarget = null;
  }

  applyKnockback(forceX: number, forceY: number, force = 200): void {
    let effectiveForce = force;
    const statusEffects = this.entity ? this.entity.getComponent(StatusEffects) : null;
    if (statusEffects) {
      let resist = statusEffects.knockbackResist ?? 0;
      if (statusEffects.packKnockbackResist != null) resist += statusEffects.packKnockbackResist;
      resist = Math.max(0, Math.min(1, resist));
      effectiveForce = force * (1 - resist);
    }
    if (effectiveForce <= 0) return;

    const distance = Math.sqrt(forceX * forceX + forceY * forceY);
    if (distance > 0) {
      const normalizedX = forceX / distance;
      const normalizedY = forceY / distance;
      this.isKnockedBack = true;
      this.knockbackVelocityX = normalizedX * effectiveForce;
      this.knockbackVelocityY = normalizedY * effectiveForce;
      this.cancelPath();
      this.targetX = null;
      this.targetY = null;
    }
  }

  checkEntityCollision(
    testX: number,
    testY: number,
    width: number,
    height: number,
    entityManager: EntityManagerLike | null | undefined,
    currentEntity: MovementEntity | null
  ): boolean {
    if (!entityManager || !currentEntity) return false;

    const isPlayer = currentEntity.id === 'player';
    let isDodging = false;
    if (isPlayer) {
      const movement = currentEntity.getComponent(Movement);
      const pm = movement as Movement & { isDodging?: boolean } | null;
      if (pm?.isDodging !== undefined) isDodging = pm.isDodging;
    }

    const buffer =
      (GameConfig as { entityCollision?: { buffer?: number } }).entityCollision?.buffer ?? 0;
    const half = buffer / 2;

    if (!isPlayer) {
      const player = entityManager.get('player');
      if (player) {
        const playerTransform = player.getComponent(Transform);
        const playerHealth = player.getComponent(Health);
        if (playerTransform && playerHealth && !playerHealth.isDead) {
          const otherLeft = playerTransform.left - half;
          const otherTop = playerTransform.top - half;
          const otherW = playerTransform.width + buffer;
          const otherH = playerTransform.height + buffer;
          if (
            Utils.rectCollision(
              testX - width / 2,
              testY - height / 2,
              width,
              height,
              otherLeft,
              otherTop,
              otherW,
              otherH
            )
          ) {
            return true;
          }
        }
      }
    } else {
      if (!isDodging) {
        const enemies = entityManager.getAll('enemy');
        if (enemies?.length) {
          for (const enemy of enemies) {
            const enemyTransform = enemy.getComponent(Transform);
            const enemyHealth = enemy.getComponent(Health);
            if (enemyTransform && enemyHealth && !enemyHealth.isDead) {
              const otherLeft = enemyTransform.left - half;
              const otherTop = enemyTransform.top - half;
              const otherW = enemyTransform.width + buffer;
              const otherH = enemyTransform.height + buffer;
              if (
                Utils.rectCollision(
                  testX - width / 2,
                  testY - height / 2,
                  width,
                  height,
                  otherLeft,
                  otherTop,
                  otherW,
                  otherH
                )
              ) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  tryObstacleAvoidance(
    x: number,
    y: number,
    velX: number,
    velY: number,
    width: number,
    height: number,
    obstacleManager: ObstacleManagerLike
  ): { x: number; y: number } | null {
    if (!velX && !velY) return null;
    const normalized = Utils.normalize(velX, velY);
    const dirX = normalized.x;
    const dirY = normalized.y;
    const perp1X = -dirY;
    const perp1Y = dirX;
    const perp2X = dirY;
    const perp2Y = -dirX;
    const avoidanceAngles = [
      { x: perp1X, y: perp1Y },
      { x: perp2X, y: perp2Y },
      { x: dirX * 0.5 + perp1X * 0.5, y: dirY * 0.5 + perp1Y * 0.5 },
      { x: dirX * 0.5 + perp2X * 0.5, y: dirY * 0.5 + perp2Y * 0.5 },
    ];
    const avoidanceDistance = this.speed * 2;
    for (const angle of avoidanceAngles) {
      const testX = x + angle.x * avoidanceDistance;
      const testY = y + angle.y * avoidanceDistance;
      if (obstacleManager.canMoveTo(testX, testY, width, height)) {
        return { x: testX, y: testY };
      }
    }
    return null;
  }
}
