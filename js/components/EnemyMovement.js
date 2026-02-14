// Enemy-specific movement component - type-aware for different enemy behaviors
class EnemyMovement extends Movement {
    constructor(speed, enemyType = 'goblin') {
        super(speed);
        
        this.enemyType = enemyType;
        const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
        
        // Check if this enemy type supports lunge attacks
        this.hasLunge = enemyConfig.lunge && enemyConfig.lunge.enabled;
        
        // Always initialize lunge properties (even if not used) for consistency
        // This prevents undefined errors when checking isLunging on non-lunge enemies
        this.isLunging = false;
        this.lungeStartX = 0;
        this.lungeStartY = 0;
        this.lungeTargetX = 0;
        this.lungeTargetY = 0;
        this.lungeSpeed = 0;
        this.lungeDistance = 0;
        this.lungeTraveled = 0;
        this.lungeStuckFrames = 0; // Frames with no progress (blocked) – end lunge if too many
        
        // Initialize attack dash properties (for demons using combo attacks)
        this.isAttackDashing = false;
        this.attackDashTimer = 0;
        this.attackDashDuration = 0;
        this.attackDashDirectionX = 0;
        this.attackDashDirectionY = 0;

        // Hop-back after lunge (goblin only)
        this.isHoppingBack = false;
        this.hopBackDelayRemaining = 0; // Countdown before hop back starts (seconds)
        this.hopBackTargetX = 0;
        this.hopBackTargetY = 0;
        this.hopBackSpeed = 0;
        this.hopBackDistance = 0;
        this.hopBackTraveled = 0;
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        const statusEffects = this.entity.getComponent(StatusEffects);
        if (statusEffects && statusEffects.isStunned) {
            this.velocityX = 0;
            this.velocityY = 0;
            return;
        }

        // Handle hop-back delay (goblin only) - wait before starting hop
        if (this.hopBackDelayRemaining > 0) {
            this.hopBackDelayRemaining = Math.max(0, this.hopBackDelayRemaining - deltaTime);
            this.velocityX = 0;
            this.velocityY = 0;
            if (this.hopBackDelayRemaining <= 0) {
                this.isHoppingBack = true;
            }
            return;
        }

        // Handle hop-back after lunge (goblin only) - highest priority
        if (this.isHoppingBack) {
            const dx = this.hopBackTargetX - transform.x;
            const dy = this.hopBackTargetY - transform.y;
            const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

            if (distanceToTarget > 0.1 && this.hopBackTraveled < this.hopBackDistance) {
                const normalized = Utils.normalize(dx, dy);
                const moveX = normalized.x * this.hopBackSpeed * deltaTime;
                const moveY = normalized.y * this.hopBackSpeed * deltaTime;
                const step = Math.sqrt(moveX * moveX + moveY * moveY);
                this.hopBackTraveled += step;
                this.velocityX = normalized.x * this.hopBackSpeed;
                this.velocityY = normalized.y * this.hopBackSpeed;
                this.facingAngle = Math.atan2(normalized.y, normalized.x);
            } else {
                this.endHopBack();
            }
            this.applyMovement(deltaTime, systems);
            return;
        }

        // Handle attack dash (for demons using combo attacks) - highest priority
        if (this.isAttackDashing !== undefined && this.isAttackDashing) {
            this.attackDashTimer += deltaTime;
            
            // Get dash speed from weapon config or use default
            const combat = this.entity.getComponent(Combat);
            let dashSpeed = 300; // Default dash speed for enemies
            if (combat && combat.enemyAttackHandler && combat.enemyAttackHandler.getWeapon) {
                const weapon = combat.enemyAttackHandler.getWeapon();
                if (weapon && weapon.getComboStageProperties) {
                    const stageProps = weapon.getComboStageProperties(combat.enemyAttackHandler.comboStage || 1);
                    if (stageProps && stageProps.dashSpeed) dashSpeed = stageProps.dashSpeed;
                }
            }
            
            // Override velocity with dash movement
            this.velocityX = this.attackDashDirectionX * dashSpeed;
            this.velocityY = this.attackDashDirectionY * dashSpeed;
            
            // End dash after duration
            if (this.attackDashTimer >= this.attackDashDuration) {
                this.isAttackDashing = false;
                this.attackDashTimer = 0;
                this.velocityX = 0;
                this.velocityY = 0;
            }
            
            // Apply movement for attack dash
            this.applyMovement(deltaTime, systems);
            this.updateFacingAngle(deltaTime, systems);
            return;
        }

        // Handle enemy lunge - highest priority (only for types that support it)
        if (this.hasLunge && this.isLunging) {
            const prevX = transform.x;
            const prevY = transform.y;
            const dx = this.lungeTargetX - transform.x;
            const dy = this.lungeTargetY - transform.y;
            const distanceToTarget = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate direction
            if (distanceToTarget > 0.1) {
                const normalized = Utils.normalize(dx, dy);
                this.velocityX = normalized.x * this.lungeSpeed;
                this.velocityY = normalized.y * this.lungeSpeed;
                
                // Update facing angle
                this.facingAngle = Math.atan2(dy, dx);
                
                // Track distance traveled
                const distanceTraveled = Math.sqrt(
                    (transform.x - this.lungeStartX) ** 2 + 
                    (transform.y - this.lungeStartY) ** 2
                );
                this.lungeTraveled = distanceTraveled;
                
                // End lunge if reached target or max distance
                if (distanceToTarget < 5 || distanceTraveled >= this.lungeDistance) {
                    this.endLunge();
                }
            } else {
                this.endLunge();
            }
            
            // Apply movement (may be blocked by obstacles)
            this.applyMovement(deltaTime, systems);
            
            // If blocked: barely moved despite trying – end lunge after a few frames to avoid freezing
            const moved = Math.sqrt((transform.x - prevX) ** 2 + (transform.y - prevY) ** 2);
            const expectedMin = this.lungeSpeed * deltaTime * 0.2; // At least 20% of expected movement
            if (this.isLunging && moved < expectedMin && moved < 3) {
                this.lungeStuckFrames++;
                if (this.lungeStuckFrames >= 5) {
                    this.endLunge();
                }
            } else {
                this.lungeStuckFrames = 0;
            }
            return;
        }

        // Call parent update for knockback and normal movement
        super.update(deltaTime, systems);
    }

    updateMovement(deltaTime, systems) {
        // Skip normal movement during hop-back delay, hop-back, attack dash, lunge, or knockback
        if (this.hopBackDelayRemaining > 0 || this.isHoppingBack ||
            (this.isAttackDashing !== undefined && this.isAttackDashing) || 
            (this.hasLunge && this.isLunging) || 
            this.isKnockedBack) {
            return;
        }
        
        // Type-specific movement behaviors can be added here
        this.updateTypeSpecificMovement(deltaTime, systems);
        
        // Call parent for path following
        super.updateMovement(deltaTime, systems);

        // Separation: steer away from nearby enemies so they don't cluster
        this.applySeparation(systems);
    }

    /** Steer away from nearby enemies to keep packs dispersed; cap speed after blending. */
    applySeparation(systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;
        const entityManager = systems && systems.get ? systems.get('entities') : null;
        const entities = entityManager && typeof entityManager.getEntities === 'function' ? entityManager.getEntities() : null;
        if (!entities || !entities.length) return;

        const SEPARATION_RADIUS = 85;
        const SEPARATION_STRENGTH = 2.0;
        let sx = 0, sy = 0;
        for (const e of entities) {
            if (e === this.entity || !e.active) continue;
            const r = e.getComponent && e.getComponent(Renderable);
            if (!r || r.type !== 'enemy') continue;
            const t = e.getComponent && e.getComponent(Transform);
            if (!t) continue;
            const dx = transform.x - t.x;
            const dy = transform.y - t.y;
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
    
    // Override in subclasses or extend here for type-specific movement behaviors
    updateTypeSpecificMovement(deltaTime, systems) {
        // Example: Different enemy types could have different movement patterns
        // - Skeletons: slower, more methodical
        // - Demons: faster, more aggressive
        // - Goblins: erratic, quick bursts
        // Currently all use standard pathfinding
    }

    updateFacingAngle(deltaTime, systems) {
        // Don't change facing during knockback – stay facing the direction they were before being hit
        if (this.isKnockedBack) return;
        // Enemies face their movement direction
        if (this.velocityX !== 0 || this.velocityY !== 0) {
            this.facingAngle = Utils.angleTo(0, 0, this.velocityX, this.velocityY);
        }
    }

    startLunge(targetX, targetY, lungeConfig) {
        if (!this.hasLunge) {
            console.warn(`Enemy type ${this.enemyType} does not support lunge attacks`);
            return;
        }
        
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;
        
        this.isLunging = true;
        this.lungeStartX = transform.x;
        this.lungeStartY = transform.y;
        this.lungeTargetX = targetX;
        this.lungeTargetY = targetY;
        this.lungeSpeed = lungeConfig.lungeSpeed || 300;
        this.lungeDistance = lungeConfig.lungeDistance || 120;
        this.lungeTraveled = 0;
        this.lungeStuckFrames = 0;
        
        // Cancel any existing movement
        this.cancelPath();
    }
    
    endLunge() {
        if (!this.hasLunge) return;
        
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        this.isLunging = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.lungeTraveled = 0;
        
        // Notify combat component that lunge ended (goblin/bandit dagger/etc.)
        const combat = this.entity.getComponent(Combat);
        if (combat && combat.enemyAttackHandler && combat.enemyAttackHandler.endLunge) {
            combat.enemyAttackHandler.endLunge(combat.getPackCooldownMultiplier());
            combat._clearAttackState();
        }
        
        // Goblin: 50% chance to hop back after lunge
        if (this.enemyType === 'goblin') {
            const enemyConfig = GameConfig.enemy.types.goblin;
            const lungeConfig = enemyConfig && enemyConfig.lunge;
            const chance = (lungeConfig && lungeConfig.hopBackChance) || 0;
            if (chance > 0 && Math.random() < chance) {
                const hopBackDistance = (lungeConfig && lungeConfig.hopBackDistance) || 60;
                const hopBackSpeed = (lungeConfig && lungeConfig.hopBackSpeed) || 140;
                const hopBackDelay = (lungeConfig && lungeConfig.hopBackDelay) != null ? lungeConfig.hopBackDelay : 0.75;
                const backDx = transform.x - this.lungeTargetX;
                const backDy = transform.y - this.lungeTargetY;
                const len = Math.sqrt(backDx * backDx + backDy * backDy) || 1;
                const nx = backDx / len;
                const ny = backDy / len;
                this.hopBackTargetX = transform.x + nx * hopBackDistance;
                this.hopBackTargetY = transform.y + ny * hopBackDistance;
                this.hopBackSpeed = hopBackSpeed;
                this.hopBackDistance = hopBackDistance;
                this.hopBackTraveled = 0;
                this.hopBackDelayRemaining = hopBackDelay;
                this.isHoppingBack = false;
                return;
            }
        }
        
        // Notify AI component - set cooldown if we've used all lunges
        const ai = this.entity.getComponent(AI);
        if (ai) {
            // If we've used all allowed lunges, set cooldown and reset counter
            if (ai.lungeCount >= ai.maxLunges) {
                ai.lungeCooldown = ai.lungeCooldownDuration;
                ai.lungeCount = 0; // Reset counter for next cooldown cycle
            }
        }
    }
    
    endHopBack() {
        this.isHoppingBack = false;
        this.hopBackDelayRemaining = 0;
        this.velocityX = 0;
        this.velocityY = 0;
        this.hopBackTraveled = 0;
        // Notify AI (e.g. cooldown) if we didn't do it in endLunge because we hopped
        const ai = this.entity.getComponent(AI);
        if (ai && this.enemyType === 'goblin') {
            if (ai.lungeCount >= ai.maxLunges) {
                ai.lungeCooldown = ai.lungeCooldownDuration;
                ai.lungeCount = 0;
            }
        }
    }
    
    // Attack dash support for demons (who use player-style combo attacks)
    startAttackDash(directionX, directionY, duration) {
        // Initialize attack dash properties if not already present
        if (this.attackDashDirectionX === undefined) {
            this.attackDashDirectionX = 0;
            this.attackDashDirectionY = 0;
            this.attackDashDuration = 0;
            this.attackDashTimer = 0;
            this.isAttackDashing = false;
        }
        
        // Set dash direction
        this.attackDashDirectionX = directionX;
        this.attackDashDirectionY = directionY;
        this.attackDashDuration = duration;
        this.attackDashTimer = 0;
        this.isAttackDashing = true;
        
        return true;
    }
}

