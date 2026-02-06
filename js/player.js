// Player character
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.speed = 60; // pixels per second (slowed down for better gameplay)
        
        // Stats
        this.maxHealth = 100;
        this.health = 100;
        this.maxStamina = 50;
        this.stamina = 50;
        this.staminaRegen = 6; // per second (was 0.1 per frame at 60fps = 6 per second)
        
        // Movement
        this.velocityX = 0;
        this.velocityY = 0;
        this.targetX = null;
        this.targetY = null;
        this.facingAngle = 0; // Angle in radians (0 = right, PI/2 = down, -PI/2 = up)
        
        // Combat
        this.attackRange = 100;
        this.attackDamage = 15;
        this.attackArc = Math.PI / 3; // 60 degree arc for attacks
        this.isAttacking = false;
        this.attackProcessed = false; // Track if attack damage has been applied
        this.attackCooldown = 0; // in seconds
        this.maxAttackCooldown = 0.5; // 0.5 seconds (was 30 frames at 60fps)
    }

    update(input, camera, canvas, obstacleManager = null, deltaTime = 1/60) {
        // Regenerate stamina
        if (this.stamina < this.maxStamina) {
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegen * deltaTime);
        }

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        }

        // Mouse click movement
        if (input.mouseClicked) {
            this.targetX = camera.toWorldX(input.mouseX);
            this.targetY = camera.toWorldY(input.mouseY);
            input.clearClick();
        }

        // WASD movement (overrides click movement)
        let moveX = 0;
        let moveY = 0;

        if (input.isKeyPressed('w')) moveY -= 1;
        if (input.isKeyPressed('s')) moveY += 1;
        if (input.isKeyPressed('a')) moveX -= 1;
        if (input.isKeyPressed('d')) moveX += 1;

        if (moveX !== 0 || moveY !== 0) {
            // Cancel target if manually moving
            this.targetX = null;
            this.targetY = null;

            // Normalize diagonal movement
            const normalized = Utils.normalize(moveX, moveY);
            this.velocityX = normalized.x * this.speed * deltaTime;
            this.velocityY = normalized.y * this.speed * deltaTime;
            
            // Update facing direction based on movement
            this.facingAngle = Utils.angleTo(0, 0, moveX, moveY);
        } else if (this.targetX !== null && this.targetY !== null) {
            // Move towards target
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
                const normalized = Utils.normalize(dx, dy);
                this.velocityX = normalized.x * this.speed * deltaTime;
                this.velocityY = normalized.y * this.speed * deltaTime;
                
                // Update facing direction towards target
                this.facingAngle = Utils.angleTo(this.x, this.y, this.targetX, this.targetY);
            } else {
                // Reached target
                this.targetX = null;
                this.targetY = null;
                this.velocityX = 0;
                this.velocityY = 0;
            }
        } else {
            // Not moving - face towards mouse cursor
            const mouseWorldX = camera.toWorldX(input.mouseX);
            const mouseWorldY = camera.toWorldY(input.mouseY);
            this.facingAngle = Utils.angleTo(this.x, this.y, mouseWorldX, mouseWorldY);
            
            this.velocityX = 0;
            this.velocityY = 0;
        }

        // Calculate desired position
        let newX = this.x + this.velocityX;
        let newY = this.y + this.velocityY;

        // Check collision before moving with obstacle avoidance
        if (obstacleManager && !obstacleManager.canMoveTo(newX, newY, this.width, this.height)) {
            // Try moving only X
            if (obstacleManager.canMoveTo(newX, this.y, this.width, this.height)) {
                this.x = newX;
            }
            // Try moving only Y
            else if (obstacleManager.canMoveTo(this.x, newY, this.width, this.height)) {
                this.y = newY;
            }
            // Try obstacle avoidance - slide along obstacle
            else {
                const avoidanceResult = this.tryObstacleAvoidance(
                    this.x, this.y,
                    this.velocityX, this.velocityY,
                    this.width, this.height,
                    obstacleManager
                );
                
                if (avoidanceResult) {
                    // Adjust velocity to match avoidance direction before moving
                    const dx = avoidanceResult.x - this.x;
                    const dy = avoidanceResult.y - this.y;
                    if (dx !== 0 || dy !== 0) {
                        const normalized = Utils.normalize(dx, dy);
                        this.velocityX = normalized.x * this.speed * 0.7 * deltaTime;
                        this.velocityY = normalized.y * this.speed * 0.7 * deltaTime;
                    }
                    this.x = avoidanceResult.x;
                    this.y = avoidanceResult.y;
                } else {
                    // Can't move, stop
                    this.velocityX = 0;
                    this.velocityY = 0;
                    this.targetX = null;
                    this.targetY = null;
                }
            }
        } else {
            // No collision, move normally
            this.x = newX;
            this.y = newY;
        }

        // Keep player in bounds
        this.x = Utils.clamp(this.x, 0, camera.worldWidth);
        this.y = Utils.clamp(this.y, 0, camera.worldHeight);

        // Space bar attack - only if player has a facing direction (has moved or mouse is available)
        if (input.isKeyPressed(' ') && this.attackCooldown === 0) {
            // Only allow attack if we have a valid facing direction
            // This ensures the player has moved or mouse is available
            this.attack();
        }
    }

    attack() {
        this.isAttacking = true;
        this.attackProcessed = false; // Reset flag for new attack
        this.attackCooldown = this.maxAttackCooldown;
        
        // Use stamina
        if (this.stamina >= 5) {
            this.stamina -= 5;
        }
        
        setTimeout(() => {
            this.isAttacking = false;
            this.attackProcessed = false; // Reset flag when attack ends
        }, 200);
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    updateUI() {
        // Update health bar
        const healthPercent = (this.health / this.maxHealth) * 100;
        document.getElementById('health-bar').style.width = healthPercent + '%';
        document.getElementById('health-text').textContent = 
            Math.floor(this.health) + '/' + this.maxHealth;

        // Update stamina bar
        const staminaPercent = (this.stamina / this.maxStamina) * 100;
        document.getElementById('stamina-bar').style.width = staminaPercent + '%';
        document.getElementById('stamina-text').textContent = 
            Math.floor(this.stamina) + '/' + this.maxStamina;
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

        const avoidanceDistance = 3; // Fixed pixel distance for avoidance checks

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

