// Collision System
import { Transform } from '../components/Transform.ts';
import { Utils } from '../utils/Utils.ts';
import type { SystemManager } from '../core/SystemManager.ts';

interface EntityWithGetComponent {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

interface ObstacleManagerLike {
  canMoveTo(x: number, y: number, w: number, h: number): boolean;
}

export class CollisionSystem {
    systems: SystemManager | null;

    constructor() {
        this.systems = null;
    }

    init(systems: SystemManager): void {
        this.systems = systems;
    }

    checkEntityCollision(entity1: EntityWithGetComponent, entity2: EntityWithGetComponent): boolean {
        const transform1 = entity1.getComponent(Transform);
        const transform2 = entity2.getComponent(Transform);
        
        if (!transform1 || !transform2) return false;
        
        return Utils.rectCollision(
            transform1.left, transform1.top, transform1.width, transform1.height,
            transform2.left, transform2.top, transform2.width, transform2.height
        );
    }

    checkEntityObstacleCollision(entity: EntityWithGetComponent, obstacleManager: ObstacleManagerLike): boolean {
        const transform = entity.getComponent(Transform);
        if (!transform) return false;
        
        return !obstacleManager.canMoveTo(
            transform.x, transform.y,
            transform.width, transform.height
        );
    }
}

