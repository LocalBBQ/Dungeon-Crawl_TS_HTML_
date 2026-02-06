// AI component for enemy behavior
class AI {
    constructor(detectionRange, attackRange, patrolConfig = null) {
        this.detectionRange = detectionRange;
        this.attackRange = attackRange;
        this.state = 'idle'; // idle, chase, attack, patrol, lunge
        this.idleTimer = 0;
        this.wanderTargetX = 0;
        this.wanderTargetY = 0;
        this.pathUpdateTimer = 0;
        this.pathUpdateInterval = 30;
        this.entity = null;
        this.enemyType = null; // Will be set by EnemyManager
        
        // Lunge attack properties
        this.isChargingLunge = false;
        this.lungeChargeTimer = 0;
        this.lungeTargetX = 0;
        this.lungeTargetY = 0;
        
        // Patrol behavior
        this.patrolConfig = patrolConfig; // { startX, startY, endX, endY, distance }
        this.patrolTargetX = null;
        this.patrolTargetY = null;
        this.patrolDirection = 1; // 1 = going to end, -1 = going to start
        this.patrolReachedThreshold = 10; // Distance threshold to consider reached
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        const movement = this.entity.getComponent(Movement);
        const combat = this.entity.getComponent(Combat);
        const health = this.entity.getComponent(Health);
        
        if (!transform || !movement) return;
        if (health && health.isDead) return;

        // Get player
        const entityManager = systems ? systems.get('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        if (!player) return;

        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) return;

        // Don't perform AI actions while being knocked back
        if (movement && movement.isKnockedBack) {
            return;
        }

        // Calculate distance to player
        const distToPlayer = Utils.distance(
            transform.x, transform.y,
            playerTransform.x, playerTransform.y
        );

        // Check for lunge attack (goblin-specific)
        const enemyConfig = this.enemyType ? GameConfig.enemy.types[this.enemyType] : null;
        const lungeConfig = enemyConfig && enemyConfig.lunge ? enemyConfig.lunge : null;
        const canLunge = lungeConfig && lungeConfig.enabled && combat && combat.cooldown === 0 && !this.isChargingLunge;

        // AI State machine
        // Handle lunge charging
        if (this.isChargingLunge) {
            this.state = 'lunge';
            movement.stop();
            this.lungeChargeTimer -= deltaTime;
            
            // Update target to player's current position (track player during charge)
            this.lungeTargetX = playerTransform.x;
            this.lungeTargetY = playerTransform.y;
            
            // Face the player during charge
            const dx = this.lungeTargetX - transform.x;
            const dy = this.lungeTargetY - transform.y;
            if (dx !== 0 || dy !== 0) {
                movement.facingAngle = Math.atan2(dy, dx);
            }
            
            // When charge completes, start lunge
            if (this.lungeChargeTimer <= 0 && lungeConfig) {
                this.isChargingLunge = false;
                // Start lunge attack
                if (combat.enemyAttack) {
                    combat.enemyAttack.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
                }
                // Start lunge movement
                movement.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
            }
        }
        // Check if should start charging lunge
        else if (canLunge && distToPlayer <= lungeConfig.chargeRange && distToPlayer > this.attackRange) {
            this.isChargingLunge = true;
            this.lungeChargeTimer = lungeConfig.chargeTime;
            this.lungeTargetX = playerTransform.x;
            this.lungeTargetY = playerTransform.y;
            this.state = 'lunge';
        }
        // Normal attack
        else if (distToPlayer < this.attackRange && combat && combat.cooldown === 0 && !combat.isWindingUp && !combat.isLunging) {
            this.state = 'attack';
            movement.stop();
            // Pass player position for wind-up tracking
            combat.attack(playerTransform.x, playerTransform.y);
        } else if (combat && (combat.isWindingUp || combat.isLunging)) {
            // During wind-up or lunge, keep stopped and facing the player
            this.state = combat.isLunging ? 'lunge' : 'attack';
            if (combat.isLunging) {
                // Movement is handled by lunge
            } else {
                movement.stop();
            }
        } else if (distToPlayer < this.detectionRange) {
            this.state = 'chase';
            this.chasePlayer(playerTransform, movement, systems);
        } else if (this.patrolConfig) {
            // Use patrol behavior if configured
            this.state = 'patrol';
            this.patrol(transform, movement, systems);
        } else {
            this.state = 'idle';
            this.wander(transform, movement, systems);
        }
    }

    chasePlayer(playerTransform, movement, systems) {
        this.pathUpdateTimer--;
        
        const pathfinding = systems.get('pathfinding');
        const transform = this.entity.getComponent(Transform);
        const obstacleManager = systems.get('obstacles');
        
        if (pathfinding && movement) {
            if (!movement.hasPath() || this.pathUpdateTimer <= 0) {
                const path = pathfinding.findPath(
                    transform.x, transform.y,
                    playerTransform.x, playerTransform.y,
                    transform.width, transform.height
                );
                if (path && path.length > 0) {
                    movement.followPath(path);
                } else {
                    // Pathfinding failed - try to find a nearby valid position and move towards player
                    this.handlePathfindingFailure(transform, playerTransform, movement, obstacleManager);
                }
                this.pathUpdateTimer = this.pathUpdateInterval;
            }
        } else if (movement) {
            // Fallback to direct movement with obstacle awareness
            const dx = playerTransform.x - transform.x;
            const dy = playerTransform.y - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                // Move towards player - obstacle avoidance will handle collisions
                movement.setVelocity(dx, dy);
            }
        }
    }

    handlePathfindingFailure(transform, playerTransform, movement, obstacleManager) {
        if (!obstacleManager) {
            // No obstacle manager, just move directly
            const dx = playerTransform.x - transform.x;
            const dy = playerTransform.y - transform.y;
            movement.setVelocity(dx, dy);
            return;
        }

        // Try to find a direction towards player that's not blocked
        const dx = playerTransform.x - transform.x;
        const dy = playerTransform.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
            movement.stop();
            return;
        }

        // Try moving in the general direction of the player
        // The Movement component's obstacle avoidance will handle getting around obstacles
        movement.setVelocity(dx, dy);
    }

    wander(transform, movement, systems) {
        this.idleTimer--;

        if (this.idleTimer <= 0) {
            this.idleTimer = Utils.randomInt(60, 180);
            const wanderRadius = 100;
            this.wanderTargetX = transform.x + Utils.random(-wanderRadius, wanderRadius);
            this.wanderTargetY = transform.y + Utils.random(-wanderRadius, wanderRadius);
            
            const worldConfig = GameConfig.world;
            this.wanderTargetX = Utils.clamp(this.wanderTargetX, 0, worldConfig.width);
            this.wanderTargetY = Utils.clamp(this.wanderTargetY, 0, worldConfig.height);
            
            const pathfinding = systems.get('pathfinding');
            if (pathfinding && movement) {
                const path = pathfinding.findPath(
                    transform.x, transform.y,
                    this.wanderTargetX, this.wanderTargetY,
                    transform.width, transform.height
                );
                if (path && path.length > 0) {
                    movement.followPath(path);
                } else {
                    // Pathfinding failed, just set target and let movement handle it
                    movement.setTarget(this.wanderTargetX, this.wanderTargetY);
                }
            }
        }

        if (movement && !movement.hasPath()) {
            const dx = this.wanderTargetX - transform.x;
            const dy = this.wanderTargetY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                const originalSpeed = movement.speed;
                movement.speed = originalSpeed * 0.5; // Slower when wandering
                movement.setVelocity(dx, dy);
                movement.speed = originalSpeed; // Restore speed
            } else {
                movement.stop();
            }
        }
    }

    patrol(transform, movement, systems) {
        if (!this.patrolConfig) return;

        // Initialize patrol targets if not set
        if (this.patrolTargetX === null || this.patrolTargetY === null) {
            // Start by going to the end point
            this.patrolTargetX = this.patrolConfig.endX;
            this.patrolTargetY = this.patrolConfig.endY;
            this.patrolDirection = 1;
        }

        // Calculate distance to current patrol target
        const dx = this.patrolTargetX - transform.x;
        const dy = this.patrolTargetY - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if reached the current patrol target
        if (dist < this.patrolReachedThreshold) {
            // Switch direction and set new target
            this.patrolDirection *= -1;
            if (this.patrolDirection === 1) {
                // Going to end point
                this.patrolTargetX = this.patrolConfig.endX;
                this.patrolTargetY = this.patrolConfig.endY;
            } else {
                // Going to start point
                this.patrolTargetX = this.patrolConfig.startX;
                this.patrolTargetY = this.patrolConfig.startY;
            }
        }

        // Move towards current patrol target
        if (movement) {
            const newDx = this.patrolTargetX - transform.x;
            const newDy = this.patrolTargetY - transform.y;
            const newDist = Math.sqrt(newDx * newDx + newDy * newDy);

            if (newDist > this.patrolReachedThreshold) {
                // Use direct movement for straight line patrol
                movement.setVelocity(newDx, newDy);
            } else {
                // Close enough, stop briefly before turning around
                movement.stop();
            }
        }
    }
}

