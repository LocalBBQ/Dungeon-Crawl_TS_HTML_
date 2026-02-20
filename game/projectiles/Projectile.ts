// Projectile entity - represents a single projectile
import { Transform } from '../components/Transform.ts';
import { Health } from '../components/Health.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';

interface EntityWithComponents {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

interface ObstacleManagerLike {
  canMoveTo(x: number, y: number, w: number, h: number): boolean;
}

export class Projectile {
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  range: number;
  owner: unknown;
  ownerType: string;
  stunBuildup: number;
  distanceTraveled: number;
  width: number;
  height: number;
  active: boolean;
  color: string;
  /** If true, projectile continues after hitting (hits multiple enemies). */
  pierce: boolean;
  /** If > 0, applied to hit enemies as airborne duration in seconds. */
  airborneDuration: number;
  /** Enemy ids already hit (for pierce: don't hit same enemy twice). */
  hitEntityIds: Set<string>;

  constructor(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    range: number,
    owner: unknown,
    ownerType: 'player' | 'enemy' = 'player',
    stunBuildup = 0,
    pierce = false,
    airborneDuration = 0,
    width = 8,
    height = 8,
    color?: string
  ) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.range = range;
    this.owner = owner;
    this.ownerType = ownerType;
    this.stunBuildup = stunBuildup;
    this.distanceTraveled = 0;
    this.width = width;
    this.height = height;
    this.active = true;
    this.color = color ?? (ownerType === 'player' ? '#ffff00' : '#ff4444');
    this.pierce = pierce;
    this.airborneDuration = airborneDuration;
    this.hitEntityIds = new Set();
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    const dx = Math.cos(this.angle) * this.speed * deltaTime;
    const dy = Math.sin(this.angle) * this.speed * deltaTime;
    this.x += dx;
    this.y += dy;
    this.distanceTraveled += Math.sqrt(dx * dx + dy * dy);
    if (this.distanceTraveled >= this.range) this.active = false;
    const worldConfig = GameConfig.world;
    if (this.x < 0 || this.x > worldConfig.width || this.y < 0 || this.y > worldConfig.height) {
      this.active = false;
    }
  }

  checkCollision(entity: EntityWithComponents, entityId?: string): boolean {
    if (!this.active || !entity) return false;
    if (entity === this.owner) return false;
    if (entityId != null && this.hitEntityIds.has(entityId)) return false;
    const transform = entity.getComponent(Transform);
    const health = entity.getComponent(Health);
    if (!transform || !health || health.isDead) return false;
    return Utils.rectCollision(
      this.x - this.width / 2,
      this.y - this.height / 2,
      this.width,
      this.height,
      transform.left,
      transform.top,
      transform.width,
      transform.height
    );
  }

  checkObstacleCollision(obstacleManager: ObstacleManagerLike | null): boolean {
    if (!this.active || !obstacleManager) return false;
    return !obstacleManager.canMoveTo(this.x, this.y, this.width, this.height);
  }
}
