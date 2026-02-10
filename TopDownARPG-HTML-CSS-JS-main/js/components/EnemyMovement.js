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
        
        // Initialize attack dash properties (for demons using combo attacks)
        this.isAttackDashing = false;
        this.attackDashTimer = 0;
        this.attackDashDuration = 0;
        this.attackDashDirectionX = 0;
        this.attackDashDirectionY = 0;
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        // Handle attack dash (for demons using combo attacks) - highest priority
        if (this.isAttackDashing !== undefined && this.isAttackDashing) {
            this.attackDashTimer += deltaTime;
            
            // Get dash speed from weapon config or use default
            const combat = this.entity.getComponent(Combat);
            let dashSpeed = 300; // Default dash speed for enemies
            if (combat && combat.demonAttack) {
                // Demons use weapon combos - get dash speed from current attack
                const weapon = combat.demonAttack.weapon;
                if (weapon) {
                    const stageProps = weapon.getComboStageProperties(combat.demonAttack.comboStage);
                    if (stageProps && stageProps.dashSpeed) {
                        dashSpeed = stageProps.dashSpeed;
                    }
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
            
            // Skip normal movement logic during lunge - just apply movement
            this.applyMovement(deltaTime, systems);
            return;
        }

        // Call parent update for knockback and normal movement
        super.update(deltaTime, systems);
    }

    updateMovement(deltaTime, systems) {
        // Skip normal movement during attack dash, lunge, or knockback
        if ((this.isAttackDashing !== undefined && this.isAttackDashing) || 
            (this.hasLunge && this.isLunging) || 
            this.isKnockedBack) {
            return;
        }
        
        // Type-specific movement behaviors can be added here
        // For now, all types use standard path following
        this.updateTypeSpecificMovement(deltaTime, systems);
        
        // Call parent for path following
        super.updateMovement(deltaTime, systems);
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
        
        // Cancel any existing movement
        this.cancelPath();
    }
    
    endLunge() {
        if (!this.hasLunge) return;
        
        this.isLunging = false;
        this.velocityX = 0;
        this.velocityY = 0;
        this.lungeTraveled = 0;
        
        // Notify combat component that lunge ended (goblin-specific)
        const combat = this.entity.getComponent(Combat);
        if (combat && combat.goblinAttack) {
            combat.goblinAttack.endLunge();
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

