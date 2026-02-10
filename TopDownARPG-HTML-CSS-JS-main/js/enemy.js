// Enemy character AI
class Enemy {
    constructor(x, y, type = 'goblin') {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        
        // Enemy type configurations
        const types = {
            goblin: {
                maxHealth: 30,
                speed: 40, // pixels per second 
                attackRange: 40,
                attackDamage: 5,
                detectionRange: 200,
                color: '#44aa44',
                attackCooldown: 1.0 // seconds 
            },
            skeleton: {
                maxHealth: 50,
                speed: 30, // pixels per second 
                attackRange: 50,
                attackDamage: 8,
                detectionRange: 250,
                color: '#cccccc',
                attackCooldown: 0.83 // seconds (was 50 frames)
            },
            greaterDemon: {
                maxHealth: 80,
                speed: 50, // pixels per second (slowed down)
                attackRange: 60,
                attackDamage: 12,
                detectionRange: 300,
                color: '#aa4444',
                attackCooldown: 0.67 // seconds (was 40 frames)
            }
        };
        
        const config = types[type] || types.goblin;
        this.type = type;
        this.maxHealth = config.maxHealth;
        this.health = config.maxHealth;
        this.speed = config.speed;
        this.attackRange = config.attackRange;
        this.attackDamage = config.attackDamage;
        this.detectionRange = config.detectionRange;
        this.color = config.color;
        this.maxAttackCooldown = config.attackCooldown;
        
        // Movement
        this.velocityX = 0;
        this.velocityY = 0;
        
        // Combat
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.isDead = false;
        
        // AI state
        this.state = 'idle'; // idle, chase, attack
        this.idleTimer = 0;
        this.wanderTargetX = x;
        this.wanderTargetY = y;
    }

    update(player, obstacleManager, worldWidth, worldHeight, deltaTime = 1/60) {
        if (this.isDead) return;

        // Update attack cooldown
        if (this.attackCooldown > 0) {
            this.attackCooldown = Math.max(0, this.attackCooldown - deltaTime);
        }

        // Calculate distance to player
        const distToPlayer = Utils.distance(this.x, this.y, player.x, player.y);

        // AI State machine
        if (distToPlayer < this.attackRange && this.attackCooldown === 0) {
            this.state = 'attack';
            this.attack(player);
        } else if (distToPlayer < this.detectionRange) {
            this.state = 'chase';
            this.chasePlayer(player, obstacleManager, worldWidth, worldHeight, deltaTime);
        } else {
            this.state = 'idle';
            this.wander(player, obstacleManager, worldWidth, worldHeight, deltaTime);
        }

        // Reset attacking flag
        if (this.isAttacking && this.attackCooldown < this.maxAttackCooldown - 0.17) {
            this.isAttacking = false;
        }
    }

    chasePlayer(player, obstacleManager, worldWidth, worldHeight, deltaTime) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const normalized = Utils.normalize(dx, dy);
        
        this.velocityX = normalized.x * this.speed * deltaTime;
        this.velocityY = normalized.y * this.speed * deltaTime;

        this.moveWithCollision(player, obstacleManager, worldWidth, worldHeight);
    }

    wander(player, obstacleManager, worldWidth, worldHeight, deltaTime) {
        this.idleTimer -= deltaTime;

        // Set new wander target
        if (this.idleTimer <= 0) {
            this.idleTimer = Utils.random(1, 3); // 1-3 seconds (was 60-180 frames)
            const wanderRadius = 100;
            this.wanderTargetX = this.x + Utils.random(-wanderRadius, wanderRadius);
            this.wanderTargetY = this.y + Utils.random(-wanderRadius, wanderRadius);
            
            // Clamp to world bounds
            this.wanderTargetX = Utils.clamp(this.wanderTargetX, 0, worldWidth);
            this.wanderTargetY = Utils.clamp(this.wanderTargetY, 0, worldHeight);
        }

        // Move towards wander target
        const dx = this.wanderTargetX - this.x;
        const dy = this.wanderTargetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            const normalized = Utils.normalize(dx, dy);
            this.velocityX = normalized.x * this.speed * 0.5 * deltaTime; // Slower when wandering
            this.velocityY = normalized.y * this.speed * 0.5 * deltaTime;
            this.moveWithCollision(player, obstacleManager, worldWidth, worldHeight);
        } else {
            this.velocityX = 0;
            this.velocityY = 0;
        }
    }

    moveWithCollision(player, obstacleManager, worldWidth, worldHeight) {
        let newX = this.x + this.velocityX;
        let newY = this.y + this.velocityY;

        // Check collision with player
        const wouldCollideWithPlayer = Utils.rectCollision(
            newX - this.width/2, newY - this.height/2, this.width, this.height,
            player.x - player.width/2, player.y - player.height/2, player.width, player.height
        );

        // Check collision with obstacles
        const wouldCollideWithObstacles = obstacleManager && !obstacleManager.canMoveTo(newX, newY, this.width, this.height);

        if (wouldCollideWithPlayer || wouldCollideWithObstacles) {
            // Try moving only X
            const canMoveX = !Utils.rectCollision(
                newX - this.width/2, this.y - this.height/2, this.width, this.height,
                player.x - player.width/2, player.y - player.height/2, player.width, player.height
            ) && (!obstacleManager || obstacleManager.canMoveTo(newX, this.y, this.width, this.height));

            if (canMoveX) {
                this.x = newX;
            }
            // Try moving only Y
            else {
                const canMoveY = !Utils.rectCollision(
                    this.x - this.width/2, newY - this.height/2, this.width, this.height,
                    player.x - player.width/2, player.y - player.height/2, player.width, player.height
                ) && (!obstacleManager || obstacleManager.canMoveTo(this.x, newY, this.width, this.height));

                if (canMoveY) {
                    this.y = newY;
                } else {
                    this.velocityX = 0;
                    this.velocityY = 0;
                }
            }
        } else {
            this.x = newX;
            this.y = newY;
        }

        // Keep in bounds
        this.x = Utils.clamp(this.x, 0, worldWidth);
        this.y = Utils.clamp(this.y, 0, worldHeight);
    }

    attack(player) {
        this.isAttacking = true;
        this.attackCooldown = this.maxAttackCooldown;
        
        // Deal damage to player
        player.takeDamage(this.attackDamage);
        
        this.velocityX = 0;
        this.velocityY = 0;
    }

    takeDamage(amount) {
        if (this.isDead) return;
        
        this.health -= amount;
        
        if (this.health <= 0) {
            this.health = 0;
            this.isDead = true;
        }
    }
}

// Manager for all enemies
class EnemyManager {
    constructor() {
        this.enemies = [];
        this.spawnTimer = 0; // in seconds
        this.maxEnemies = 20;
    }

    spawnEnemy(x, y, type = 'goblin') {
        const enemy = new Enemy(x, y, type);
        this.enemies.push(enemy);
        return enemy;
    }

    spawnEnemiesAroundPlayer(player, count, minDistance, maxDistance, worldWidth, worldHeight, obstacleManager) {
        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                const angle = Math.random() * Math.PI * 2;
                const distance = Utils.random(minDistance, maxDistance);
                x = player.x + Math.cos(angle) * distance;
                y = player.y + Math.sin(angle) * distance;
                attempts++;
            } while (
                (obstacleManager && !obstacleManager.canMoveTo(x, y, 25, 25)) &&
                attempts < maxAttempts
            );

            if (attempts < maxAttempts) {
                // Clamp to world bounds
                x = Utils.clamp(x, 0, worldWidth);
                y = Utils.clamp(y, 0, worldHeight);
                
                // Random enemy type
                const types = ['goblin', 'goblin', 'skeleton', 'greaterDemon'];
                const randomType = types[Utils.randomInt(0, types.length - 1)];
                
                this.spawnEnemy(x, y, randomType);
            }
        }
    }

    update(player, obstacleManager, worldWidth, worldHeight, deltaTime = 1/60) {
        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            if (enemy.isDead) {
                // Remove dead enemies after a delay
                this.enemies.splice(i, 1);
                continue;
            }
            
            enemy.update(player, obstacleManager, worldWidth, worldHeight, deltaTime);
        }

        // Auto-spawn enemies if below max
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0 && this.enemies.length < this.maxEnemies) {
            this.spawnTimer = 5; // Spawn every 5 seconds
            this.spawnEnemiesAroundPlayer(
                player, 
                1, 
                300, 
                500, 
                worldWidth, 
                worldHeight, 
                obstacleManager
            );
        }
    }

    // Check if player attack hits any enemies
    checkPlayerAttack(player) {
        // Only process damage once per attack
        if (!player.isAttacking || player.attackProcessed) return;

        const hitEnemies = [];
        for (const enemy of this.enemies) {
            if (enemy.isDead) continue;

            // Check if enemy is within attack range AND in front of player
            const dist = Utils.distance(player.x, player.y, enemy.x, enemy.y);
            if (dist < player.attackRange) {
                // Check if enemy is within the attack arc in front of player
                if (Utils.pointInArc(enemy.x, enemy.y, player.x, player.y, 
                                     player.facingAngle, player.attackArc, player.attackRange)) {
                    enemy.takeDamage(player.attackDamage);
                    hitEnemies.push(enemy);
                }
            }
        }
        
        // Mark attack as processed so damage isn't applied multiple times
        player.attackProcessed = true;
        return hitEnemies;
    }

    getAliveCount() {
        return this.enemies.filter(e => !e.isDead).length;
    }
}

