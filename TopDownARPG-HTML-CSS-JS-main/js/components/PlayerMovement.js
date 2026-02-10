// Player-specific movement component
class PlayerMovement extends Movement {
    constructor(speed) {
        super(speed);
        
        // Player-specific properties
        this.isSprinting = false;
        this.sprintMultiplier = GameConfig.player.sprint.multiplier;
        this.sprintStaminaCost = GameConfig.player.sprint.staminaCost;
        
        // Dodge roll properties
        this.isDodging = false;
        this.dodgeTimer = 0;
        this.dodgeDuration = GameConfig.player.dodge.duration;
        this.dodgeSpeed = GameConfig.player.dodge.speed;
        this.dodgeDirectionX = 0;
        this.dodgeDirectionY = 0;
        this.dodgeCooldown = 0;
        this.maxDodgeCooldown = GameConfig.player.dodge.cooldown;
        
        // Attack dash properties (for combo 3)
        this.isAttackDashing = false;
        this.attackDashTimer = 0;
        this.attackDashDuration = 0;
        this.attackDashSpeed = 450; // pixels per second
        this.attackDashDirectionX = 0;
        this.attackDashDirectionY = 0;
    }

    update(deltaTime, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform) return;

        // Update dodge cooldown
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown = Math.max(0, this.dodgeCooldown - deltaTime);
        }

        // Handle attack dash (combo 3) - highest priority
        if (this.isAttackDashing) {
            this.attackDashTimer += deltaTime;
            
            // Override velocity with dash movement
            this.velocityX = this.attackDashDirectionX * this.attackDashSpeed;
            this.velocityY = this.attackDashDirectionY * this.attackDashSpeed;
            
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
        }
        // Handle dodge roll
        else if (this.isDodging) {
            this.dodgeTimer += deltaTime;
            
            // Update invincibility
            const health = this.entity.getComponent(Health);
            if (health) {
                health.isInvincible = true;
            }
            
            // Override velocity with dodge movement
            this.velocityX = this.dodgeDirectionX * this.dodgeSpeed;
            this.velocityY = this.dodgeDirectionY * this.dodgeSpeed;
            
            // End dodge after duration
            if (this.dodgeTimer >= this.dodgeDuration) {
                this.isDodging = false;
                this.dodgeTimer = 0;
                
                // Remove invincibility
                if (health) {
                    health.isInvincible = false;
                }
                
                // Check if movement keys are still pressed and restore movement
                const inputSystem = systems ? systems.get('input') : null;
                if (inputSystem) {
                    let moveX = 0;
                    let moveY = 0;
                    if (inputSystem.isKeyPressed('w')) moveY -= 1;
                    if (inputSystem.isKeyPressed('s')) moveY += 1;
                    if (inputSystem.isKeyPressed('a')) moveX -= 1;
                    if (inputSystem.isKeyPressed('d')) moveX += 1;
                    
                    if (moveX !== 0 || moveY !== 0) {
                        // Continue movement after dodge
                        const normalized = Utils.normalize(moveX, moveY);
                        this.velocityX = normalized.x * this.speed;
                        this.velocityY = normalized.y * this.speed;
                    } else {
                        // No keys pressed, stop
                        this.velocityX = 0;
                        this.velocityY = 0;
                    }
                } else {
                    // Fallback if input system not available
                    this.velocityX = 0;
                    this.velocityY = 0;
                }
            }
            
            // Apply movement for dodge
            this.applyMovement(deltaTime, systems);
            this.updateFacingAngle(deltaTime, systems);
        }
        // Handle knockback or normal movement
        else {
            // Handle knockback first (parent handles this)
            if (this.isKnockedBack) {
                // Apply knockback velocity
                this.velocityX = this.knockbackVelocityX;
                this.velocityY = this.knockbackVelocityY;
                
                // Decay knockback over time
                this.knockbackVelocityX *= Math.pow(this.knockbackDecay, deltaTime * 60);
                this.knockbackVelocityY *= Math.pow(this.knockbackDecay, deltaTime * 60);
                
                // Stop knockback when velocity is very small
                const minVelocity = 5;
                if (Math.abs(this.knockbackVelocityX) < minVelocity && Math.abs(this.knockbackVelocityY) < minVelocity) {
                    this.isKnockedBack = false;
                    this.knockbackVelocityX = 0;
                    this.knockbackVelocityY = 0;
                    // Resume movement from currently held keys so player doesn't have to re-press
                    const inputSystem = systems ? systems.get('input') : null;
                    if (inputSystem) {
                        let moveX = 0;
                        let moveY = 0;
                        if (inputSystem.isKeyPressed('w')) moveY -= 1;
                        if (inputSystem.isKeyPressed('s')) moveY += 1;
                        if (inputSystem.isKeyPressed('a')) moveX -= 1;
                        if (inputSystem.isKeyPressed('d')) moveX += 1;
                        if (moveX !== 0 || moveY !== 0) {
                            const normalized = Utils.normalize(moveX, moveY);
                            this.velocityX = normalized.x * this.speed;
                            this.velocityY = normalized.y * this.speed;
                        }
                    }
                }
            } else {
                // Handle blocking - reduce speed while blocking
                const combat = this.entity.getComponent(Combat);
                if (combat && combat.isBlocking) {
                    this.speed = this.baseSpeed * 0.5; // 50% speed while blocking
                }
                // Handle sprinting - set speed first, then check stamina after movement is updated
                else {
                    const stamina = this.entity.getComponent(Stamina);
                    if (this.isSprinting && stamina) {
                        // Set sprint speed (will be used by updateMovement)
                        this.speed = this.baseSpeed * this.sprintMultiplier;
                    } else if (!this.isSprinting) {
                        this.speed = this.baseSpeed;
                    }
                }
            }
            
            // Now call parent for movement logic (updateMovement, applyMovement, updateFacingAngle)
            // But we've already handled speed setting above
            this.updateMovement(deltaTime, systems);
            
            // Check stamina drain for sprinting after movement is updated
            // Only drain stamina if actually moving (velocity is non-zero)
            if (!this.isDodging && !this.isAttackDashing && !this.isKnockedBack) {
                const stamina = this.entity.getComponent(Stamina);
                const combat = this.entity.getComponent(Combat);
                if (this.isSprinting && stamina && (!combat || !combat.isBlocking)) {
                    // Check if player is actually moving (has non-zero velocity)
                    const isMoving = Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1;
                    
                    // Only drain stamina if actually moving
                    if (isMoving) {
                        const staminaNeeded = this.sprintStaminaCost * deltaTime;
                        if (stamina.currentStamina > staminaNeeded) {
                            stamina.currentStamina -= staminaNeeded;
                        } else {
                            // Not enough stamina, stop sprinting
                            this.isSprinting = false;
                            this.speed = this.baseSpeed;
                        }
                    }
                }
            }
            
            this.applyMovement(deltaTime, systems);
            this.updateFacingAngle(deltaTime, systems);
        }
    }

    updateMovement(deltaTime, systems) {
        // Skip normal movement during dodge, attack dash, or knockback
        if (this.isDodging || this.isAttackDashing || this.isKnockedBack) {
            return;
        }
        
        // Call parent for path following
        super.updateMovement(deltaTime, systems);
    }

    updateFacingAngle(deltaTime, systems) {
        // Player always faces cursor
        if (systems) {
            const inputSystem = systems.get('input');
            const cameraSystem = systems.get('camera');
            const transform = this.entity.getComponent(Transform);
            
            if (inputSystem && cameraSystem && transform) {
                const mouseWorldX = cameraSystem.toWorldX(inputSystem.mouseX);
                const mouseWorldY = cameraSystem.toWorldY(inputSystem.mouseY);
                this.facingAngle = Utils.angleTo(
                    transform.x, transform.y,
                    mouseWorldX, mouseWorldY
                );
            }
        }
    }

    setSprinting(isSprinting) {
        this.isSprinting = isSprinting;
        if (isSprinting) {
            this.speed = this.baseSpeed * this.sprintMultiplier;
        } else {
            this.speed = this.baseSpeed;
        }
    }

    performDodge(directionX, directionY) {
        // Can't dodge if already dodging or on cooldown
        if (this.isDodging || this.dodgeCooldown > 0) {
            return false;
        }
        
        // Normalize direction
        const normalized = Utils.normalize(directionX, directionY);
        if (normalized.x === 0 && normalized.y === 0) {
            // If no direction, dodge in facing direction
            this.dodgeDirectionX = Math.cos(this.facingAngle);
            this.dodgeDirectionY = Math.sin(this.facingAngle);
        } else {
            this.dodgeDirectionX = normalized.x;
            this.dodgeDirectionY = normalized.y;
        }
        
        // Start dodge
        this.isDodging = true;
        this.dodgeTimer = 0;
        this.dodgeCooldown = this.maxDodgeCooldown;
        
        // Cancel paths and attack targets
        this.cancelPath();
        this.clearAttackTarget();
        
        return true;
    }

    startAttackDash(directionX, directionY, duration) {
        // Set dash direction
        this.attackDashDirectionX = directionX;
        this.attackDashDirectionY = directionY;
        this.attackDashDuration = duration;
        this.attackDashTimer = 0;
        this.isAttackDashing = true;
        
        return true;
    }

    setAttackTarget(enemy) {
        this.attackTarget = enemy;
    }

    clearAttackTarget() {
        this.attackTarget = null;
    }
}

