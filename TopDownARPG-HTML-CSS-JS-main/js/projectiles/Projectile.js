// Projectile entity - represents a single projectile
class Projectile {
    constructor(x, y, angle, speed, damage, range, owner, ownerType = 'player') {
        this.x = x;
        this.y = y;
        this.angle = angle; // Direction in radians
        this.speed = speed; // Pixels per second
        this.damage = damage;
        this.range = range; // Maximum distance projectile can travel
        this.owner = owner; // Reference to entity that fired this
        this.ownerType = ownerType; // 'player' or 'enemy'
        this.distanceTraveled = 0;
        this.width = 8;
        this.height = 8;
        this.active = true;
        this.color = ownerType === 'player' ? '#ffff00' : '#ff4444'; // Yellow for player, red for enemy
    }

    update(deltaTime) {
        if (!this.active) return;

        // Move projectile
        const dx = Math.cos(this.angle) * this.speed * deltaTime;
        const dy = Math.sin(this.angle) * this.speed * deltaTime;
        
        this.x += dx;
        this.y += dy;
        
        // Track distance traveled
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.distanceTraveled += distance;
        
        // Deactivate if traveled max range
        if (this.distanceTraveled >= this.range) {
            this.active = false;
        }
        
        // Keep in world bounds
        const worldConfig = GameConfig.world;
        if (this.x < 0 || this.x > worldConfig.width || 
            this.y < 0 || this.y > worldConfig.height) {
            this.active = false;
        }
    }

    // Check collision with an entity
    checkCollision(entity) {
        if (!this.active || !entity) return false;
        
        // Don't collide with owner
        if (entity === this.owner) return false;
        
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        
        if (!transform || !health || health.isDead) return false;
        
        // Check if projectile is within entity bounds
        const projectileLeft = this.x - this.width / 2;
        const projectileRight = this.x + this.width / 2;
        const projectileTop = this.y - this.height / 2;
        const projectileBottom = this.y + this.height / 2;
        
        return Utils.rectCollision(
            projectileLeft, projectileTop, this.width, this.height,
            transform.left, transform.top, transform.width, transform.height
        );
    }

    // Check collision with obstacles
    checkObstacleCollision(obstacleManager) {
        if (!this.active || !obstacleManager) return false;
        
        return !obstacleManager.canMoveTo(this.x, this.y, this.width, this.height);
    }
}

