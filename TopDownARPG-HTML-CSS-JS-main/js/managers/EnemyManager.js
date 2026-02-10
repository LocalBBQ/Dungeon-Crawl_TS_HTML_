// Enemy Manager - manages enemy entities
class EnemyManager {
    constructor() {
        this.enemies = [];
        this.spawnTimer = 0;
        this.maxEnemies = GameConfig.enemy.spawn.maxEnemies;
        this.systems = null;
        this.currentLevel = 1;
        this.enemiesSpawned = false;
        this.enemiesKilledThisLevel = 0;
    }

    init(systems) {
        this.systems = systems;
    }

    spawnEnemy(x, y, type = 'goblin', entityManager, patrolConfig = null) {
        const config = GameConfig.enemy.types[type] || GameConfig.enemy.types.goblin;
        
        const enemy = new Entity(x, y, `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        
        const AIClass = typeof AI !== 'undefined' ? AI : (typeof window !== 'undefined' ? window.AI : null);
        if (!AIClass) throw new Error('AI component (AI.js) must load before EnemyManager. Check script order in index.html.');
        const ai = new AIClass(config.detectionRange, config.attackRange, patrolConfig);
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
        
        const size = type === 'greaterDemon' ? 38 : 25;
        enemy
            .addComponent(new Transform(x, y, size, size))
            .addComponent(new Health(config.maxHealth))
            .addComponent(new EnemyMovement(config.speed, type)) // Pass enemy type for type-specific behavior
            .addComponent(new Combat(config.attackRange, config.attackDamage, Utils.degToRad(config.attackArcDegrees ?? 90), config.attackCooldown, config.windUpTime || 0.5, false, null, type)) // isPlayer=false, weapon=null, enemyType=type
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

    generateEnemyPacks(worldWidth, worldHeight, packDensity = 0.008, packSize = { min: 2, max: 5 }, entityManager, obstacleManager, enemyTypes = null) {
        const tileSize = GameConfig.world.tileSize;
        const numPacks = Math.floor(worldWidth * worldHeight * packDensity / (tileSize * tileSize));

        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 200 // Same exclusion zone as rocks/trees
        };

        let packsPlaced = 0;
        let attempts = 0;
        const maxAttempts = numPacks * 3;

        while (packsPlaced < numPacks && attempts < maxAttempts) {
            attempts++;

            const packCenterX = Utils.randomInt(0, worldWidth);
            const packCenterY = Utils.randomInt(0, worldHeight);

            const distFromCenter = Utils.distance(packCenterX, packCenterY, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }

            const enemiesInPack = Utils.randomInt(packSize.min, packSize.max);
            const packRadius = 35; // How spread out enemies are within a pack

            let enemiesSpawnedInPack = 0;
            const packMaxAttempts = enemiesInPack * 5;
            let packAttempts = 0;

            while (enemiesSpawnedInPack < enemiesInPack && packAttempts < packMaxAttempts) {
                packAttempts++;

                const angle = Math.random() * Math.PI * 2;
                const distance = Utils.random(0, packRadius);
                const x = packCenterX + Math.cos(angle) * distance;
                const y = packCenterY + Math.sin(angle) * distance;

                const clampedX = Utils.clamp(x, 0, worldWidth);
                const clampedY = Utils.clamp(y, 0, worldHeight);

                if (!obstacleManager || obstacleManager.canMoveTo(clampedX, clampedY, 25, 25)) {
                    const types = enemyTypes && enemyTypes.length > 0 ? enemyTypes : ['goblin', 'goblin', 'skeleton', 'greaterDemon'];
                    const randomType = types[Utils.randomInt(0, types.length - 1)];
                    this.spawnEnemy(clampedX, clampedY, randomType, entityManager);
                    enemiesSpawnedInPack++;
                }
            }

            if (enemiesSpawnedInPack > 0) {
                packsPlaced++;
            }
        }
    }

    // Spawn enemies for a specific level using pack spawning
    spawnLevelEnemies(level, entityManager, obstacleManager) {
        const levelConfig = GameConfig.levels[level];
        if (!levelConfig || !levelConfig.packSpawn) {
            console.warn(`No packSpawn config for level ${level}`);
            return;
        }

        this.currentLevel = level;
        this.enemiesSpawned = true;

        const worldConfig = GameConfig.world;
        const packConfig = levelConfig.packSpawn;
        const enemyTypes = levelConfig.enemyTypes || null;
        this.generateEnemyPacks(
            worldConfig.width,
            worldConfig.height,
            packConfig.density,
            packConfig.packSize,
            entityManager,
            obstacleManager,
            enemyTypes
        );
    }

    update(deltaTime, systems) {
        const entityManager = systems.get('entities');
        const obstacleManager = systems.get('obstacles');
        
        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            const health = enemy.getComponent(Health);
            if (health && health.isDead) {
                this.enemiesKilledThisLevel++;
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
        
        // Check if this is a 360/circular attack (shape-based, not stage index)
        const is360Attack = combat.currentAttackIsCircular;
        
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
                    const died = enemyHealth.takeDamage(combat.attackDamage);
                    if (died && this.systems) {
                        const dropChance = GameConfig.player.healthOrbDropChance ?? 0.25;
                        if (Math.random() < dropChance) {
                            const healthOrbManager = this.systems.get('healthOrbs');
                            if (healthOrbManager) {
                                healthOrbManager.createOrb(enemyTransform.x, enemyTransform.y);
                            }
                        }
                    }
                    hitEnemies.push(enemy);
                    
                    // Apply knockback to enemy (stage/weapon config or player default)
                    const enemyMovement = enemy.getComponent(Movement);
                    if (enemyMovement) {
                        const dx = enemyTransform.x - transform.x;
                        const dy = enemyTransform.y - transform.y;
                        const knockbackForce = combat.currentAttackKnockbackForce ?? GameConfig.player.knockback.force;
                        enemyMovement.applyKnockback(dx, dy, knockbackForce);
                    }
                    
                    // Mark this enemy as hit to prevent multiple hits
                    if (combat.isPlayer && combat.playerAttack) {
                        combat.playerAttack.markEnemyHit(enemy.id);
                    }
                }
            }
        }
        
        // Only mark as processed for non-extended attacks
        // Circular attacks continue checking during extended window
        if (combat.isPlayer && combat.playerAttack && !combat.currentAttackIsCircular) {
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
                    // Lunge damage: goblin uses goblinAttack.lungeDamage, others use enemyAttack or config
                    const lungeDamage = enemyCombat.goblinAttack
                        ? enemyCombat.goblinAttack.lungeDamage
                        : (enemyCombat.enemyAttack ? enemyCombat.enemyAttack.lungeDamage : enemyCombat.attackDamage);
                    let finalDamage = lungeDamage;
                    let blocked = false;
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            if (playerCombat.consumeBlockStamina()) {
                                finalDamage = lungeDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                        }
                    }
                    playerHealth.takeDamage(finalDamage, blocked);
                    if (playerMovement) {
                        const ai = enemy.getComponent(AI);
                        const enemyType = ai ? ai.enemyType : 'goblin';
                        const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        const lungeKnockbackForce = enemyConfig.lunge?.knockback?.force ?? knockbackConfig.force;
                        const knockbackForce = blocked ? lungeKnockbackForce * 0.5 : lungeKnockbackForce;
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, knockbackForce);
                    }
                    if (enemyCombat.goblinAttack) {
                        enemyCombat.goblinAttack.attackProcessed = true;
                    } else if (enemyCombat.enemyAttack) {
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
                // Demon uses arc from combo stage; others use distance only
                const isDemon = enemyCombat.demonAttack != null;
                const inRange = currentDist < enemyCombat.attackRange;
                const inArc = isDemon && enemyMovement
                    ? Utils.pointInArc(playerTransform.x, playerTransform.y, enemyTransform.x, enemyTransform.y, enemyMovement.facingAngle, enemyCombat.attackArc, enemyCombat.attackRange)
                    : inRange;
                // Demon claw only hits during the release phase (after charge-up)
                const demonCanHit = !isDemon || enemyCombat.demonAttack.isInReleasePhase;
                if (inRange && inArc && demonCanHit) {
                    let finalDamage = enemyCombat.attackDamage;
                    let blocked = false;

                    // Check if player is blocking and can block this attack
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            if (playerCombat.consumeBlockStamina()) {
                                finalDamage = enemyCombat.attackDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                        }
                    }

                    playerHealth.takeDamage(finalDamage, blocked);

                    // Always apply knockback: full when not blocked, half when blocked
                    if (playerMovement) {
                        const ai = enemy.getComponent(AI);
                        const enemyType = ai ? ai.enemyType : 'goblin';
                        const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        const baseForce = knockbackConfig.force;
                        const knockbackForce = blocked ? baseForce * 0.5 : baseForce;
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, knockbackForce);
                    }

                    if (enemyCombat.demonAttack) {
                        enemyCombat.demonAttack.markEnemyHit('player');
                    } else if (enemyCombat.enemyAttack) {
                        enemyCombat.enemyAttack.attackProcessed = true;
                    }
                }
                // Mark attack processed so this branch runs once per attack (for non-demon)
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
        this.enemiesKilledThisLevel = 0;
        const hazardManager = this.systems ? this.systems.get('hazards') : null;
        if (hazardManager && hazardManager.clearFlamePillars) {
            hazardManager.clearFlamePillars();
        }
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

    getEnemiesKilledThisLevel() {
        return this.enemiesKilledThisLevel;
    }
}

