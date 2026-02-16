// Collision System
class CollisionSystem {
    constructor() {
        this.systems = null;
    }

    init(systems) {
        this.systems = systems;
    }

    checkEntityCollision(entity1, entity2) {
        const transform1 = entity1.getComponent(Transform);
        const transform2 = entity2.getComponent(Transform);
        
        if (!transform1 || !transform2) return false;
        
        return Utils.rectCollision(
            transform1.left, transform1.top, transform1.width, transform1.height,
            transform2.left, transform2.top, transform2.width, transform2.height
        );
    }

    checkEntityObstacleCollision(entity, obstacleManager) {
        const transform = entity.getComponent(Transform);
        if (!transform) return false;
        
        return !obstacleManager.canMoveTo(
            transform.x, transform.y,
            transform.width, transform.height
        );
    }
}

