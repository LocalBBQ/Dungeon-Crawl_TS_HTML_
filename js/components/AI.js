// AI component for enemy behavior
class AI {
    constructor(detectionRange, attackRange, patrolConfig = null) {
        this.detectionRange = detectionRange;
        this.attackRange = attackRange;
        this.state = 'idle'; // idle, chase, attack, patrol, lunge, backOff
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
        this.lungeCooldown = 0; // Cooldown for lunge attacks (separate from normal attack cooldown)
        this.lungeCooldownDuration = 3.0; // 3 seconds cooldown
        this.lungeCount = 0; // Track number of lunges performed
        this.maxLunges = 2; // Number of lunges allowed before cooldown
        
        // Projectile attack properties
        this.projectileCooldown = 0;

        // Demon pillar-of-flame cast
        this.pillarFlameCooldown = 0;
        this.isCastingPillar = false;
        this.pillarCastTimer = 0;

        // Goblin Chieftain war cry (buff nearby goblins)
        this.warCryCooldown = 0;
        
        // Attack initiation tracking (prevents multiple attack calls in same frame)
        this.attackInitiatedThisFrame = false;
        
        // Patrol behavior
        this.patrolConfig = patrolConfig; // { startX, startY, endX, endY, distance }
        this.patrolTargetX = null;
        this.patrolTargetY = null;
        this.patrolDirection = 1; // 1 = going to end, -1 = going to start
        this.patrolReachedThreshold = 10; // Distance threshold to consider reached

        // Goblin stamina: back off when exhausted until 50% stamina recovered
        this.staminaExhausted = false;
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        const movement = this.entity.getComponent(Movement);
        const combat = this.entity.getComponent(Combat);
        const health = this.entity.getComponent(Health);
        
        if (!transform || !movement) return;
        if (health && health.isDead) return;

        const statusEffects = this.entity.getComponent(StatusEffects);
        if (statusEffects && statusEffects.isStunned) return;
        
        // Reset attack initiation flag at start of each frame
        this.attackInitiatedThisFrame = false;

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

        // Update lunge cooldown
        if (this.lungeCooldown > 0) {
            this.lungeCooldown = Math.max(0, this.lungeCooldown - deltaTime);
            // Reset lunge count when cooldown expires
            if (this.lungeCooldown === 0 && this.lungeCount > 0) {
                this.lungeCount = 0;
            }
        }
        
        // Update projectile cooldown
        if (this.projectileCooldown > 0) {
            this.projectileCooldown = Math.max(0, this.projectileCooldown - deltaTime);
        }

        if (this.pillarFlameCooldown > 0) {
            this.pillarFlameCooldown = Math.max(0, this.pillarFlameCooldown - deltaTime);
        }

        if (this.warCryCooldown > 0) {
            this.warCryCooldown = Math.max(0, this.warCryCooldown - deltaTime);
        }

        // Calculate distance to player
        const distToPlayer = Utils.distance(
            transform.x, transform.y,
            playerTransform.x, playerTransform.y
        );
        const effectiveDetectionRange = this.detectionRange * (statusEffects && statusEffects.packDetectionRangeMultiplier != null ? statusEffects.packDetectionRangeMultiplier : 1);

        // Goblin stamina: mark exhausted when stamina hits 0
        const stamina = this.entity.getComponent(Stamina);
        if (this.enemyType === 'goblin' && stamina && stamina.percent <= 0.1) {
            this.staminaExhausted = true;
        }

        // Get enemy config once (used for lunge, projectile, and pillar checks)
        const enemyConfig = this.enemyType ? GameConfig.enemy.types[this.enemyType] : null;
        const pillarConfig = this.enemyType === 'greaterDemon' && enemyConfig && enemyConfig.pillarFlame ? enemyConfig.pillarFlame : null;

        // Goblin Chieftain war cry: buff nearby goblins when in chase range and not attacking
        const warCryConfig = this.enemyType === 'goblinChieftain' && enemyConfig && enemyConfig.warCry ? enemyConfig.warCry : null;
        if (warCryConfig && warCryConfig.enabled && this.warCryCooldown === 0 && !combat.isAttacking) {
            const inChaseRange = distToPlayer < effectiveDetectionRange && distToPlayer > this.attackRange;
            if (inChaseRange) {
                const enemyManager = systems ? systems.get('enemies') : null;
                if (enemyManager && enemyManager.enemies) {
                    const radius = warCryConfig.radius || 180;
                    let buffedAny = false;
                    for (const other of enemyManager.enemies) {
                        if (other === this.entity) continue;
                        const otherAI = other.getComponent(AI);
                        const otherHealth = other.getComponent(Health);
                        const otherTransform = other.getComponent(Transform);
                        const otherStatus = other.getComponent(StatusEffects);
                        if (!otherAI || otherAI.enemyType !== 'goblin' || !otherHealth || otherHealth.isDead || !otherTransform || !otherStatus) continue;
                        const dist = Utils.distance(transform.x, transform.y, otherTransform.x, otherTransform.y);
                        if (dist <= radius) {
                            otherStatus.applyWarCryBuff(
                                warCryConfig.buffDuration || 5,
                                warCryConfig.speedMultiplier || 1.2,
                                warCryConfig.damageMultiplier || 1.2
                            );
                            buffedAny = true;
                        }
                    }
                    if (buffedAny) this.warCryCooldown = warCryConfig.cooldown || 12;
                }
            }
        }
        
        // Check for lunge attack (goblin and lesser demon)
        const isGoblin = this.enemyType === 'goblin';
        const hasLunge = enemyConfig && enemyConfig.lunge && enemyConfig.lunge.enabled;
        const lungeConfig = hasLunge && enemyConfig.lunge ? enemyConfig.lunge : null;
        // Can lunge if: lunge enabled in config, not on cooldown, haven't used all lunges, and not already charging
        const canLunge = hasLunge && lungeConfig && combat && 
                        this.lungeCooldown === 0 && 
                        this.lungeCount < this.maxLunges && 
                        !this.isChargingLunge;

        // AI State machine
        // Handle demon pillar-of-flame casting (pillarConfig already defined above)
        if (this.isCastingPillar && pillarConfig) {
            this.state = 'attack';
            movement.stop();
            this.pillarCastTimer -= deltaTime;
            const dx = playerTransform.x - transform.x;
            const dy = playerTransform.y - transform.y;
            if (dx !== 0 || dy !== 0) movement.facingAngle = Math.atan2(dy, dx);
            if (this.pillarCastTimer <= 0) {
                this.isCastingPillar = false;
                const hazardManager = systems ? systems.get('hazards') : null;
                if (hazardManager && hazardManager.createPillar) {
                    // Cast pillar near player, not directly on them (random offset of 30-80 pixels)
                    const offsetDistance = Utils.random(30, 80);
                    const offsetAngle = Math.random() * Math.PI * 2;
                    const pillarX = playerTransform.x + Math.cos(offsetAngle) * offsetDistance;
                    const pillarY = playerTransform.y + Math.sin(offsetAngle) * offsetDistance;
                    hazardManager.createPillar(pillarX, pillarY, pillarConfig);
                }
                this.pillarFlameCooldown = pillarConfig.cooldown;
            }
        }
        // Handle lunge charging
        else if (this.isChargingLunge) {
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
            
            // When charge completes, start lunge (lesser demon and any type with lunge config)
            if (this.lungeChargeTimer <= 0 && lungeConfig) {
                this.isChargingLunge = false;
                // Increment lunge count
                this.lungeCount++;
                // Start lunge attack (movement + combat handler)
                if (combat.enemyAttackHandler && combat.enemyAttackHandler.startLunge) {
                    combat.enemyAttackHandler.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
                }
                // Start lunge movement
                movement.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
                
                // If we've used all lunges, set cooldown (will be set again when lunge ends, but set it here too in case lunge is interrupted)
                if (this.lungeCount >= this.maxLunges) {
                    this.lungeCooldown = this.lungeCooldownDuration;
                }
            }
        }
        // Check if should start charging lunge
        else if (canLunge && distToPlayer <= lungeConfig.chargeRange && distToPlayer > this.attackRange) {
            // Goblin: 50% chance to lunge twice this cycle, 50% once (roll at start of cycle)
            if (isGoblin && this.lungeCount === 0) {
                this.maxLunges = Math.random() < 0.5 ? 1 : 2;
            }
            this.isChargingLunge = true;
            this.lungeChargeTimer = lungeConfig.chargeTime;
            this.lungeTargetX = playerTransform.x;
            this.lungeTargetY = playerTransform.y;
            this.state = 'lunge';
        }
        // Check for projectile attack (ranged enemies like skeleton)
        const projectileConfig = enemyConfig && enemyConfig.projectile ? enemyConfig.projectile : null;
        const canShootProjectile = projectileConfig && projectileConfig.enabled && 
                                   this.projectileCooldown === 0 && 
                                   distToPlayer <= projectileConfig.range && 
                                   distToPlayer > this.attackRange;
        
        if (canShootProjectile) {
            // Shoot projectile at player
            const projectileManager = systems ? systems.get('projectiles') : null;
            if (projectileManager) {
                const angle = Utils.angleTo(transform.x, transform.y, playerTransform.x, playerTransform.y);
                projectileManager.createProjectile(
                    transform.x,
                    transform.y,
                    angle,
                    projectileConfig.speed,
                    projectileConfig.damage,
                    projectileConfig.range,
                    this.entity,
                    'enemy',
                    projectileConfig.stunBuildup ?? 0
                );
                this.projectileCooldown = projectileConfig.cooldown;
                this.state = 'attack';
            }
        }
        // Demon: optionally start pillar-of-flame (prioritize melee; occasionally cast at melee or at medium range)
        if (pillarConfig && this.pillarFlameCooldown === 0 && !this.isCastingPillar && !combat.isAttacking) {
            const inMeleeRange = distToPlayer < this.attackRange;
            const inPillarRange = distToPlayer <= pillarConfig.pillarRange && distToPlayer > this.attackRange;
            const canClaw = combat && combat.enemyAttackHandler && combat.enemyAttackHandler.canAttack && combat.enemyAttackHandler.canAttack();
            if (inPillarRange && Math.random() < 0.2) {
                // 20% chance when in range so pillars don't spam
                this.isCastingPillar = true;
                this.pillarCastTimer = pillarConfig.castDelay;
                this.attackInitiatedThisFrame = true;
            } else if (inMeleeRange && canClaw && !this.attackInitiatedThisFrame && Math.random() < 0.05) {
                // Rare chance to cast from melee instead of claw
                this.isCastingPillar = true;
                this.pillarCastTimer = pillarConfig.castDelay;
                this.attackInitiatedThisFrame = true;
            }
        }
        // Normal attack (melee) - use handler capabilities
        const canMelee = combat && combat.enemyAttackHandler && combat.enemyAttackHandler.canMeleeAttack && combat.enemyAttackHandler.canMeleeAttack();
        const isSkeleton = this.enemyType === 'skeleton';

        if (!isSkeleton && !this.isCastingPillar && canMelee) {
            const canAttack = combat && !this.attackInitiatedThisFrame && combat.enemyAttackHandler && combat.enemyAttackHandler.canAttack && combat.enemyAttackHandler.canAttack();
            
            const meleeRange = (combat && combat.attackRange != null && combat.attackRange > 0) ? combat.attackRange : this.attackRange;
            if (distToPlayer < meleeRange && canAttack && !combat.isLunging) {
                this.state = 'attack';
                movement.stop();
                // comboAndCharge (e.g. bandit mace): pass chargeDuration like player input — 0 = light combo, else charged heavy
                let chargeDuration = 0;
                const handler = combat.enemyAttackHandler;
                if (handler && handler.behaviorType === 'comboAndCharge' && handler.weapon) {
                    const w = handler.weapon;
                    const chargeConfig = w.chargeAttack;
                    if (chargeConfig && chargeConfig.minChargeTime != null) {
                        const roll = Math.random();
                        if (roll < 0.35) {
                            chargeDuration = chargeConfig.minChargeTime + Math.random() * ((chargeConfig.maxChargeTime || 2) - chargeConfig.minChargeTime) * 0.6;
                        }
                    }
                }
                const attackResult = combat.attack(playerTransform.x, playerTransform.y, chargeDuration);
                if (attackResult) {
                    this.attackInitiatedThisFrame = true;
                }
            }
        }
        
        if (combat && (combat.isAttacking || combat.isWindingUp || combat.isLunging)) {
            // During attack, wind-up, or lunge, keep stopped
            this.state = combat.isLunging ? 'lunge' : 'attack';
            if (combat.isLunging) {
                // Movement is handled by lunge
            } else {
                movement.stop();
                // During wind-up: face the player (aim). During slash: keep facing locked so the swipe commits like the player's dagger.
                if (combat.isWindingUp) {
                    const dx = playerTransform.x - transform.x;
                    const dy = playerTransform.y - transform.y;
                    if (dx !== 0 || dy !== 0) {
                        movement.facingAngle = Math.atan2(dy, dx);
                    }
                }
            }
        } else if (this.staminaExhausted && this.enemyType === 'goblin' && stamina && distToPlayer < effectiveDetectionRange) {
            // Back off until 50% stamina recovered
            this.state = 'backOff';
            if (stamina.percent >= 0.5) {
                this.staminaExhausted = false;
            } else {
                this.backOffFromPlayer(playerTransform, movement, systems);
            }
        } else if (distToPlayer < effectiveDetectionRange) {
            // Chase player (this includes when lunge is on cooldown)
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

    /** Move away from player (goblin back off when stamina exhausted until 50% recovered). */
    backOffFromPlayer(playerTransform, movement, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform || !movement) return;
        const dx = transform.x - playerTransform.x;
        const dy = transform.y - playerTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) {
            movement.stop();
            return;
        }
        if (movement.cancelPath) movement.cancelPath();
        movement.setVelocity(dx, dy);
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
            const wanderRadius = 40;
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

if (typeof window !== 'undefined') {
    window.AI = AI;
}
