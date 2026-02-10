// Base Movement component - shared functionality for all entities
class Movement {
    constructor(speed) {
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
        this.attackTarget = null; // Reference to enemy entity to attack
        
        // Knockback properties
        this.isKnockedBack = false;
        this.knockbackVelocityX = 0;
        this.knockbackVelocityY = 0;
        this.knockbackDecay = 0.85; // Friction factor per frame (higher = less friction)
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        // Handle knockback (shared by all entities)
        if (this.isKnockedBack) {
            // Apply knockback velocity
            this.velocityX = this.knockbackVelocityX;
            this.velocityY = this.knockbackVelocityY;
            
            // Decay knockback over time
            this.knockbackVelocityX *= Math.pow(this.knockbackDecay, deltaTime * 60); // Normalize to 60fps
            this.knockbackVelocityY *= Math.pow(this.knockbackDecay, deltaTime * 60);
            
            // Stop knockback when velocity is very small
            const minVelocity = 5; // pixels per second
            if (Math.abs(this.knockbackVelocityX) < minVelocity && Math.abs(this.knockbackVelocityY) < minVelocity) {
                this.isKnockedBack = false;
                this.knockbackVelocityX = 0;
                this.knockbackVelocityY = 0;
            }
        } else {
            // Update speed based on blocking (shared)
            const combat = this.entity.getComponent(Combat);
            if (combat && combat.isBlocking) {
                this.speed = this.baseSpeed * 0.5; // 50% speed while blocking
            } else {
                this.speed = this.baseSpeed;
            }
        }

        // Let subclasses handle their specific movement logic
        this.updateMovement(deltaTime, systems);

        // Apply movement with collision check and obstacle avoidance (shared)
        this.applyMovement(deltaTime, systems);

        // Update facing angle (subclasses can override)
        this.updateFacingAngle(deltaTime, systems);
    }

    // Override in subclasses for specific movement behavior
    updateMovement(deltaTime, systems) {
        // Follow path if available
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const transform = this.entity.getComponent(Transform);
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
            // Move towards target (fallback)
            const transform = this.entity.getComponent(Transform);
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

    // Shared movement application logic
    applyMovement(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        const obstacleManager = systems ? systems.get('obstacles') : null;
        const entityManager = systems ? systems.get('entities') : null;
        const renderable = this.entity.getComponent(Renderable);
        const isPlayer = renderable && renderable.type === 'player';
        const allowSwampPools = isPlayer ? { allowSwampPools: true } : null;

        let vx = this.velocityX, vy = this.velocityY;
        if (obstacleManager && isPlayer) {
            const mul = obstacleManager.getSwampPoolSpeedMultiplier(transform.x, transform.y, transform.width, transform.height);
            vx *= mul;
            vy *= mul;
        }
        let newX = transform.x + vx * deltaTime;
        let newY = transform.y + vy * deltaTime;

        // Check for entity collisions (player-enemy collisions)
        const wouldCollideWithEntity = this.checkEntityCollision(
            newX, newY, transform.width, transform.height,
            entityManager, this.entity
        );

        // Check for obstacle collisions (player can pass through swamp pools)
        const wouldCollideWithObstacle = obstacleManager &&
            !obstacleManager.canMoveTo(newX, newY, transform.width, transform.height, allowSwampPools);

        if (wouldCollideWithEntity || wouldCollideWithObstacle) {
            // If knocked back and hitting obstacle, stop knockback immediately
            if (this.isKnockedBack && wouldCollideWithObstacle) {
                this.isKnockedBack = false;
                this.knockbackVelocityX = 0;
                this.knockbackVelocityY = 0;
                this.velocityX = 0;
                this.velocityY = 0;
                transform.x = transform.x; // Stay in place
                transform.y = transform.y;
            } else {
                // Try moving only X
                const canMoveX = !this.checkEntityCollision(
                    newX, transform.y, transform.width, transform.height,
                    entityManager, this.entity
                ) && (!obstacleManager || obstacleManager.canMoveTo(newX, transform.y, transform.width, transform.height, allowSwampPools));

                if (canMoveX) {
                    transform.x = newX;
                }
                // Try moving only Y
                else {
                    const canMoveY = !this.checkEntityCollision(
                        transform.x, newY, transform.width, transform.height,
                        entityManager, this.entity
                    ) && (!obstacleManager || obstacleManager.canMoveTo(transform.x, newY, transform.width, transform.height, allowSwampPools));

                    if (canMoveY) {
                        transform.y = newY;
                    } else {
                        // Can't move, stop
                        // If knocked back, stop knockback
                        if (this.isKnockedBack) {
                            this.isKnockedBack = false;
                            this.knockbackVelocityX = 0;
                            this.knockbackVelocityY = 0;
                        }
                        this.velocityX = 0;
                        this.velocityY = 0;
                        // Don't cancel path immediately - might be temporary blockage
                        // Only cancel if stuck for multiple frames
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
            this.stuckTimer = 0; // Reset stuck timer when moving successfully
        }

        // Keep in bounds
        const worldConfig = GameConfig.world;
        transform.x = Utils.clamp(transform.x, 0, worldConfig.width);
        transform.y = Utils.clamp(transform.y, 0, worldConfig.height);
    }

    // Override in subclasses for specific facing angle behavior
    updateFacingAngle(deltaTime, systems) {
        // Default: face movement direction
        if (this.velocityX !== 0 || this.velocityY !== 0) {
            this.facingAngle = Utils.angleTo(0, 0, this.velocityX, this.velocityY);
        }
    }

    setVelocity(x, y) {
        // Don't override knockback with manual movement
        if (this.isKnockedBack) {
            return;
        }
        const normalized = Utils.normalize(x, y);
        this.velocityX = normalized.x * this.speed;
        this.velocityY = normalized.y * this.speed;
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.path = [];
        this.pathIndex = 0;
    }

    followPath(path) {
        if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
            this.targetX = null;
            this.targetY = null;
        }
    }

    cancelPath() {
        this.path = [];
        this.pathIndex = 0;
        this.targetX = null;
        this.targetY = null;
    }

    hasPath() {
        return this.path.length > 0 && this.pathIndex < this.path.length;
    }

    stop() {
        // Don't stop if being knocked back
        if (this.isKnockedBack) {
            return;
        }
        this.velocityX = 0;
        this.velocityY = 0;
        this.targetX = null;
        this.targetY = null;
        this.cancelPath();
        this.stuckTimer = 0;
        this.attackTarget = null;
    }

    applyKnockback(forceX, forceY, force = 200) {
        // Normalize direction and apply force
        const distance = Math.sqrt(forceX * forceX + forceY * forceY);
        if (distance > 0) {
            const normalizedX = forceX / distance;
            const normalizedY = forceY / distance;
            
            this.isKnockedBack = true;
            this.knockbackVelocityX = normalizedX * force;
            this.knockbackVelocityY = normalizedY * force;
            
            // Cancel any existing movement
            this.cancelPath();
            this.targetX = null;
            this.targetY = null;
        }
    }

    // Check if moving to a position would collide with another entity
    checkEntityCollision(testX, testY, width, height, entityManager, currentEntity) {
        if (!entityManager || !currentEntity) return false;

        // Determine if this is the player or an enemy
        const isPlayer = currentEntity.id === 'player';
        
        // Check if player is dodging (ignore enemy collisions during dodge)
        let isDodging = false;
        if (isPlayer) {
            const movement = currentEntity.getComponent(Movement);
            if (movement && movement.isDodging !== undefined) {
                isDodging = movement.isDodging;
            }
        }

        // Check collision with player (if this is an enemy)
        if (!isPlayer) {
            const player = entityManager.get('player');
            if (player) {
                const playerTransform = player.getComponent(Transform);
                const playerHealth = player.getComponent(Health);
                
                if (playerTransform && playerHealth && !playerHealth.isDead) {
                    if (Utils.rectCollision(
                        testX - width / 2, testY - height / 2, width, height,
                        playerTransform.left, playerTransform.top, 
                        playerTransform.width, playerTransform.height
                    )) {
                        return true;
                    }
                }
            }
        } else {
            // Check collision with all enemies (if this is the player)
            // Skip enemy collisions if player is dodging
            if (!isDodging) {
                const enemies = entityManager.getAll('enemy');
                if (enemies && enemies.length > 0) {
                    for (const enemy of enemies) {
                        const enemyTransform = enemy.getComponent(Transform);
                        const enemyHealth = enemy.getComponent(Health);
                        
                        if (enemyTransform && enemyHealth && !enemyHealth.isDead) {
                            if (Utils.rectCollision(
                                testX - width / 2, testY - height / 2, width, height,
                                enemyTransform.left, enemyTransform.top,
                                enemyTransform.width, enemyTransform.height
                            )) {
                                return true;
                            }
                        }
                    }
                }
            }
        }

        return false;
    }

    // Try to find a way around an obstacle by moving perpendicular
    tryObstacleAvoidance(x, y, velX, velY, width, height, obstacleManager) {
        if (!velX && !velY) return null;

        // Normalize velocity to get direction
        const normalized = Utils.normalize(velX, velY);
        const dirX = normalized.x;
        const dirY = normalized.y;

        // Try perpendicular directions (left and right relative to movement)
        const perp1X = -dirY;
        const perp1Y = dirX;
        const perp2X = dirY;
        const perp2Y = -dirX;

        // Try multiple avoidance angles
        const avoidanceAngles = [
            { x: perp1X, y: perp1Y }, // Perpendicular left
            { x: perp2X, y: perp2Y }, // Perpendicular right
            { x: dirX * 0.5 + perp1X * 0.5, y: dirY * 0.5 + perp1Y * 0.5 }, // Diagonal left
            { x: dirX * 0.5 + perp2X * 0.5, y: dirY * 0.5 + perp2Y * 0.5 }, // Diagonal right
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
