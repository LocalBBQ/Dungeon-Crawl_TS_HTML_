// Enemy Manager - manages enemy entities
class EnemyManager {
    constructor() {
        this.enemies = [];
        this.spawnTimer = 0;
        this.maxEnemies = GameConfig.enemy.spawn.maxEnemies;
        this.systems = null;
        this.currentLevel = 1;
        this.enemiesSpawned = false;
    }

    init(systems) {
        this.systems = systems;
    }

    spawnEnemy(x, y, type = 'goblin', entityManager, patrolConfig = null) {
        const config = GameConfig.enemy.types[type] || GameConfig.enemy.types.goblin;
        
        const enemy = new Entity(x, y, `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        
        const ai = new AI(config.detectionRange, config.attackRange, patrolConfig);
        ai.enemyType = type; // Store enemy type for lunge detection
        
        // Get sprite manager for sprite components
        const spriteManager = this.systems ? this.systems.get('sprites') : null;
        
        // Determine sprite path based on enemy type
        let spritePath = null;
        let spriteSheetKey = null;
        if (type === 'goblin' && spriteManager) {
            spritePath = 'assets/sprites/enemies/Goblin.png';
            const found = spriteManager.findSpriteSheetByPath(spritePath);
            spriteSheetKey = found ? found.key : spritePath;
        }
        
        enemy
            .addComponent(new Transform(x, y, 25, 25))
            .addComponent(new Health(config.maxHealth))
            .addComponent(new EnemyMovement(config.speed, type)) // Pass enemy type for type-specific behavior
            .addComponent(new Combat(config.attackRange, config.attackDamage, Math.PI / 2, config.attackCooldown, config.windUpTime || 0.5, false)) // isPlayer=false
            .addComponent(ai)
            .addComponent(new Renderable('enemy', { color: config.color }));
        
        // Add sprite components if sprite sheet is available
        if (spriteSheetKey && type === 'goblin') {
            const transform = enemy.getComponent(Transform);
            enemy
                .addComponent(new Sprite(spriteSheetKey, transform.width * 2, transform.height * 2))
                .addComponent(new Animation({
                    spriteSheetKey: spriteSheetKey,
                    defaultAnimation: 'idle',
                    animations: {
                        idle: {
                            row: 0, // Will be set dynamically based on direction
                            frames: [0], // First frame
                            frameDuration: 0.2
                        },
                        walkRight: {
                            row: 0,
                            frames: [0, 1, 2, 3],
                            frameDuration: 0.15
                        },
                        walkDown: {
                            row: 2,
                            frames: [0, 1, 2, 3],
                            frameDuration: 0.15
                        },
                        walkLeft: {
                            row: 1,
                            frames: [0, 1, 2, 3],
                            frameDuration: 0.15
                        },
                        walkUp: {
                            row: 3,
                            frames: [0, 1, 2, 3],
                            frameDuration: 0.15
                        },
                        walkBack: {
                            row: 4,
                            frames: [0, 1, 2, 3],
                            frameDuration: 0.15
                        }
                    }
                }));
        }
        
        // Store systems reference for components
        if (this.systems) {
            enemy.systems = this.systems;
        }
        
        this.enemies.push(enemy);
        
        if (entityManager) {
            entityManager.add(enemy, 'enemy');
        }
        
        return enemy;
    }

    // Spawn an enemy with patrol behavior (walks back and forth in a straight line)
    spawnPatrolEnemy(startX, startY, endX, endY, type = 'goblin', entityManager) {
        const patrolConfig = {
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            distance: Utils.distance(startX, startY, endX, endY)
        };
        
        // Spawn at the start position
        return this.spawnEnemy(startX, startY, type, entityManager, patrolConfig);
    }

    spawnEnemiesAroundPlayer(player, count, minDistance, maxDistance, worldWidth, worldHeight, obstacleManager, entityManager) {
        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) return;

        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                const angle = Math.random() * Math.PI * 2;
                const distance = Utils.random(minDistance, maxDistance);
                x = playerTransform.x + Math.cos(angle) * distance;
                y = playerTransform.y + Math.sin(angle) * distance;
                attempts++;
            } while (
                (obstacleManager && !obstacleManager.canMoveTo(x, y, 25, 25)) &&
                attempts < maxAttempts
            );

            if (attempts < maxAttempts) {
                x = Utils.clamp(x, 0, worldWidth);
                y = Utils.clamp(y, 0, worldHeight);
                
                const types = ['goblin', 'goblin', 'skeleton', 'demon'];
                const randomType = types[Utils.randomInt(0, types.length - 1)];
                
                this.spawnEnemy(x, y, randomType, entityManager);
            }
        }
    }

    // Spawn enemies for a specific level
    spawnLevelEnemies(level, entityManager, obstacleManager) {
        const levelConfig = GameConfig.levels[level];
        if (!levelConfig || !levelConfig.spawnZones) {
            console.warn(`No spawn zones defined for level ${level}`);
            return;
        }

        this.currentLevel = level;
        this.enemiesSpawned = true;

        for (const zone of levelConfig.spawnZones) {
            // Try to find a valid spawn position near the zone
            let x = zone.x;
            let y = zone.y;
            let attempts = 0;
            const maxAttempts = 20;
            const searchRadius = 50;

            // If the exact position is blocked, try nearby positions
            while (obstacleManager && !obstacleManager.canMoveTo(x, y, 25, 25) && attempts < maxAttempts) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Utils.random(10, searchRadius);
                x = zone.x + Math.cos(angle) * distance;
                y = zone.y + Math.sin(angle) * distance;
                
                // Clamp to world bounds
                const worldConfig = GameConfig.world;
                x = Utils.clamp(x, 0, worldConfig.width);
                y = Utils.clamp(y, 0, worldConfig.height);
                attempts++;
            }

            // Spawn the enemy if we found a valid position
            if (attempts < maxAttempts || !obstacleManager) {
                this.spawnEnemy(x, y, zone.type, entityManager);
            }
        }
    }

    update(deltaTime, systems) {
        const entityManager = systems.get('entities');
        const obstacleManager = systems.get('obstacles');
        
        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            const health = enemy.getComponent(Health);
            if (health && health.isDead) {
                if (entityManager) {
                    entityManager.remove(enemy.id);
                }
                this.enemies.splice(i, 1);
                continue;
            }
        }
    }

    checkPlayerAttack(player) {
        const combat = player.getComponent(Combat);
        const transform = player.getComponent(Transform);
        const movement = player.getComponent(Movement);
        
        if (!combat || !combat.isAttacking) {
            return [];
        }
        
        const hitEnemies = [];
        
        // Sensitivity buffers for more generous hit detection
        const rangeSensitivity = 30; // Extra 30 pixels of detection range
        const arcSensitivity = 0.3; // Extra ~17 degrees on each side
        
        // Check if this is a 360 attack (combo stage 3)
        const is360Attack = combat.comboStage === 3;
        
        for (const enemy of this.enemies) {
            const enemyHealth = enemy.getComponent(Health);
            const enemyTransform = enemy.getComponent(Transform);
            
            if (!enemyHealth || !enemyTransform || enemyHealth.isDead) continue;
            
            // Skip if this enemy was already hit in this attack (prevents multiple hits on same enemy)
            const alreadyHitEnemies = combat.isPlayer && combat.playerAttack ? combat.playerAttack.hitEnemies : new Set();
            if (alreadyHitEnemies.has(enemy.id)) continue;

            // Account for enemy hitbox size - use the larger dimension as radius
            const enemyHitboxRadius = Math.max(enemyTransform.width, enemyTransform.height) / 2;
            
            // Check distance to edge of enemy hitbox, not center
            const distToCenter = Utils.distance(transform.x, transform.y, enemyTransform.x, enemyTransform.y);
            const distToEdge = Math.max(0, distToCenter - enemyHitboxRadius);
            
            // Apply range sensitivity buffer
            if (distToEdge < combat.attackRange + rangeSensitivity) {
                let hitEnemy = false;
                
                if (is360Attack) {
                    // 360 attack hits everything in range, no arc check needed
                    hitEnemy = true;
                } else {
                    // Normal arc-based attack
                    const facingAngle = movement ? movement.facingAngle : 0;
                    
                    // Apply arc sensitivity buffer (wider angle tolerance)
                    const generousArc = combat.attackArc + arcSensitivity;
                    const generousRange = combat.attackRange + rangeSensitivity;
                    
                    hitEnemy = Utils.pointInArc(
                        enemyTransform.x, enemyTransform.y,
                        transform.x, transform.y,
                        facingAngle, generousArc, generousRange
                    );
                }
                
                if (hitEnemy) {
                    enemyHealth.takeDamage(combat.attackDamage);
                    hitEnemies.push(enemy);
                    
                    // Apply knockback to enemy
                    const enemyMovement = enemy.getComponent(Movement);
                    if (enemyMovement) {
                        // Calculate direction from player to enemy
                        const dx = enemyTransform.x - transform.x;
                        const dy = enemyTransform.y - transform.y;
                        const knockbackForce = GameConfig.player.knockback.force;
                        enemyMovement.applyKnockback(dx, dy, knockbackForce);
                    }
                    
                    // Mark this enemy as hit to prevent multiple hits
                    if (combat.isPlayer && combat.playerAttack) {
                        combat.playerAttack.markEnemyHit(enemy.id);
                    }
                }
            }
        }
        
        // Only mark as processed for non-extended attacks (stage 1 & 2)
        // Stage 3 continues checking during extended window
        if (combat.isPlayer && combat.playerAttack && combat.playerAttack.comboStage !== 3) {
            // Player attacks handle their own processing
        } else if (combat.enemyAttack) {
            combat.enemyAttack.attackProcessed = true;
        }
        
        return hitEnemies;
    }

    checkEnemyAttacks(player) {
        if (!player) return;

        const playerHealth = player.getComponent(Health);
        const playerTransform = player.getComponent(Transform);
        
        if (!playerHealth || !playerTransform || playerHealth.isDead) return;

        for (const enemy of this.enemies) {
            const enemyCombat = enemy.getComponent(Combat);
            const enemyTransform = enemy.getComponent(Transform);
            const enemyHealth = enemy.getComponent(Health);
            const enemyMovement = enemy.getComponent(Movement);
            
            if (!enemyCombat || !enemyTransform || !enemyHealth || enemyHealth.isDead) continue;
            
            // Get player combat component to check for blocking
            const playerCombat = player.getComponent(Combat);
            const playerMovement = player.getComponent(Movement);
            
            // Check for lunge attack collision (continuous check during lunge)
            // Only check lunge if enemy is actively lunging (movement-wise)
            if (enemyMovement && enemyMovement.isLunging && enemyCombat.isLunging) {
                const currentDist = Utils.distance(
                    enemyTransform.x, enemyTransform.y,
                    playerTransform.x, playerTransform.y
                );
                
                // Lunge attack: check if enemy is colliding with player during lunge
                const enemyRadius = enemyTransform.width / 2;
                const playerRadius = playerTransform.width / 2;
                // Add buffer for lunge attacks to account for player movement during lunge
                const lungeCollisionBuffer = 10; // Extra pixels for more forgiving collision
                const collisionDist = enemyRadius + playerRadius + lungeCollisionBuffer;
                
                if (currentDist < collisionDist && !enemyCombat.attackProcessed) {
                    // Deal lunge damage to player
                    const lungeDamage = enemyCombat.enemyAttack ? enemyCombat.enemyAttack.lungeDamage : enemyCombat.attackDamage;
                    
                    // Check if player is blocking and can block this attack
                    let finalDamage = lungeDamage;
                    let blocked = false;
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        // Calculate angle from player to enemy (direction attack is coming from)
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            // Check if player has enough stamina to block this attack
                            if (playerCombat.consumeBlockStamina()) {
                                // Block successful - reduce damage
                                finalDamage = lungeDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                            // If not enough stamina, block fails and full damage is dealt
                        }
                    }
                    
                    playerHealth.takeDamage(finalDamage, blocked);
                    
                    // Apply knockback to player (even when blocked)
                    if (playerMovement) {
                        // Get enemy type to determine knockback force
                        const ai = enemy.getComponent(AI);
                        const enemyType = ai ? ai.enemyType : 'goblin';
                        const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        
                        // Lunge attacks have stronger knockback (1.5x multiplier)
                        const lungeKnockbackForce = knockbackConfig.force * 1.5;
                        
                        // Calculate direction from enemy to player
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, lungeKnockbackForce);
                    }
                    
                    // Mark attack as processed to prevent multiple damage applications
                    if (enemyCombat.enemyAttack) {
                        enemyCombat.enemyAttack.attackProcessed = true;
                    }
                }
            }
            // Check if enemy attack has completed wind-up and is ready to hit (normal attacks)
            // Only process normal attacks if not currently lunging
            if ((!enemyMovement || !enemyMovement.isLunging) && enemyCombat.isAttacking && !enemyCombat.attackProcessed && !enemyCombat.isLunging) {
                const currentDist = Utils.distance(
                    enemyTransform.x, enemyTransform.y,
                    playerTransform.x, playerTransform.y
                );
                
                // Normal attack: check range
                if (currentDist < enemyCombat.attackRange) {
                    let finalDamage = enemyCombat.attackDamage;
                    let blocked = false;
                    
                    // Check if player is blocking and can block this attack
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        // Calculate angle from player to enemy (direction attack is coming from)
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            // Check if player has enough stamina to block this attack
                            if (playerCombat.consumeBlockStamina()) {
                                // Block successful - reduce damage
                                finalDamage = enemyCombat.attackDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                            // If not enough stamina, block fails and full damage is dealt
                        }
                    }
                    
                    // Deal damage to player
                    playerHealth.takeDamage(finalDamage, blocked);
                    
                    // Apply knockback to player (even when blocked)
                    if (playerMovement) {
                        // Get enemy type to determine knockback force
                        const ai = enemy.getComponent(AI);
                        const enemyType = ai ? ai.enemyType : 'goblin';
                        const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        
                        // Calculate direction from enemy to player
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, knockbackConfig.force);
                    }
                }
                
                // Mark attack as processed to prevent multiple damage applications
                if (enemyCombat.enemyAttack) {
                    enemyCombat.enemyAttack.attackProcessed = true;
                }
            }
        }
    }

    getAliveCount() {
        return this.enemies.filter(e => {
            const health = e.getComponent(Health);
            return health && !health.isDead;
        }).length;
    }

    // Change to a different level (clears current enemies and spawns new ones)
    changeLevel(level, entityManager, obstacleManager) {
        // Clear all current enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (entityManager) {
                entityManager.remove(enemy.id);
            }
        }
        this.enemies = [];
        
        // Spawn enemies for the new level
        this.spawnLevelEnemies(level, entityManager, obstacleManager);
    }

    getCurrentLevel() {
        return this.currentLevel;
    }
}

