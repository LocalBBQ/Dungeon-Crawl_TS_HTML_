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

    spawnEnemy(x, y, type = 'goblin', entityManager, patrolConfig = null, packModifierOverride = null) {
        const config = GameConfig.enemy.types[type] || GameConfig.enemy.types.goblin;
        
        const enemy = new Entity(x, y, `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        
        const AIClass = typeof AI !== 'undefined' ? AI : (typeof window !== 'undefined' ? window.AI : null);
        if (!AIClass) throw new Error('AI component (AI.js) must load before EnemyManager. Check script order in index.html.');
        const ai = new AIClass(config.detectionRange, config.attackRange, patrolConfig);
        ai.enemyType = type; // Store enemy type for lunge detection
        // Pack modifier: use pack-assigned modifier when provided, otherwise random from pool
        if (packModifierOverride != null && GameConfig.packModifiers && GameConfig.packModifiers[packModifierOverride]) {
            ai.packModifierName = packModifierOverride;
        } else {
            const allModifierNames = Object.keys(GameConfig.packModifiers || {});
            ai.packModifierName = allModifierNames.length > 0
                ? allModifierNames[Utils.randomInt(0, allModifierNames.length - 1)]
                : null;
        }
        
        // Get sprite manager for sprite components
        const spriteManager = this.systems ? this.systems.get('sprites') : null;
        
        // Determine sprite path/sheet based on enemy type (prefer 8-direction goblin sheet when available)
        let spritePath = null;
        let spriteSheetKey = null;
        let useGoblin8D = false;
        if (type === 'goblin' && spriteManager) {
            if (spriteManager.goblin8DSheetKey) {
                spriteSheetKey = spriteManager.goblin8DSheetKey;
                useGoblin8D = true;
            } else {
                spritePath = 'assets/sprites/enemies/Goblin.png';
                const found = spriteManager.findSpriteSheetByPath(spritePath);
                spriteSheetKey = found ? found.key : spritePath;
            }
        }
        
        const size = type === 'greaterDemon' ? 38 : (type === 'goblinChieftain' ? 34 : 25);
        enemy
            .addComponent(new Transform(x, y, size, size))
            .addComponent(new Health(config.maxHealth))
            .addComponent(new StatusEffects(false))
            .addComponent(new EnemyMovement(config.speed, type)) // Pass enemy type for type-specific behavior
            .addComponent(new Combat(config.attackRange, config.attackDamage, Utils.degToRad(config.attackArcDegrees ?? 90), config.attackCooldown, config.windUpTime || 0.5, false, null, type)) // isPlayer=false, weapon=null, enemyType=type
            .addComponent(ai)
            .addComponent(new Renderable('enemy', { color: config.color }));
        
        const statusEffects = enemy.getComponent(StatusEffects);
        if (statusEffects) statusEffects.knockbackResist = config.knockbackResist ?? 0;
        
        // Add sprite components if sprite sheet is available
        if (spriteSheetKey && type === 'goblin') {
            const transform = enemy.getComponent(Transform);
            const lungeSheetKey = spriteManager.goblin8DLungeSheetKey || null;
            const animConfig = useGoblin8D
                ? {
                    spriteSheetKey: spriteSheetKey,
                    defaultAnimation: 'idle',
                    animations: (() => {
                        const anims = {
                            idle: {
                                frames: [0],
                                frameDuration: 0.2,
                                useDirection: true,
                                useDirectionAsColumn: true
                            }
                        };
                        if (lungeSheetKey) {
                            anims.lunge = {
                                spriteSheetKey: lungeSheetKey,
                                frames: [0],
                                frameDuration: 0.2,
                                useDirection: true,
                                useDirectionAsColumn: true
                            };
                        }
                        return anims;
                    })()
                }
                : {
                    spriteSheetKey: spriteSheetKey,
                    defaultAnimation: 'idle',
                    animations: {
                        idle: { row: 0, frames: [0], frameDuration: 0.2 },
                        walkRight: { row: 0, frames: [0, 1, 2, 3], frameDuration: 0.15 },
                        walkDown: { row: 2, frames: [0, 1, 2, 3], frameDuration: 0.15 },
                        walkLeft: { row: 1, frames: [0, 1, 2, 3], frameDuration: 0.15 },
                        walkUp: { row: 3, frames: [0, 1, 2, 3], frameDuration: 0.15 },
                        walkBack: { row: 4, frames: [0, 1, 2, 3], frameDuration: 0.15 }
                    }
                };
            enemy
                .addComponent(new Sprite(spriteSheetKey, transform.width * 2, transform.height * 2))
                .addComponent(new Animation(animConfig));
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

    generateEnemyPacks(worldWidth, worldHeight, packDensity = 0.008, packSize = { min: 2, max: 5 }, entityManager, obstacleManager, enemyTypes = null, options = null, playerSpawn = null) {
        const tileSize = GameConfig.world.tileSize;
        const numPacks = Math.floor(worldWidth * worldHeight * packDensity / (tileSize * tileSize));
        const usePatrol = options && options.patrol === true;

        // Exclude area: use actual player spawn when provided so packs don't land on spawn; otherwise world center
        const excludeArea = playerSpawn && typeof playerSpawn.x === 'number' && typeof playerSpawn.y === 'number'
            ? { x: playerSpawn.x, y: playerSpawn.y, radius: 300 }
            : { x: worldWidth / 2, y: worldHeight / 2, radius: 200 };

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

            const patrolConfig = usePatrol && typeof PatrolBehavior !== 'undefined'
                ? PatrolBehavior.createPatrolConfigForPack(packCenterX, packCenterY, packRadius)
                : null;

            // One modifier per pack, chosen from the full pool
            const allModifierNames = Object.keys(GameConfig.packModifiers || {});
            const packModifier = allModifierNames.length > 0
                ? allModifierNames[Utils.randomInt(0, allModifierNames.length - 1)]
                : null;

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
                    this.spawnEnemy(clampedX, clampedY, randomType, entityManager, patrolConfig, packModifier);
                    enemiesSpawnedInPack++;
                }
            }

            if (enemiesSpawnedInPack > 0) {
                packsPlaced++;
            }
        }
    }

    /**
     * Spawn a single pack at a given center (for scene-tile spawn hints).
     * @param {Object} [options] - Optional. { patrol: true } to give this pack a shared patrol path.
     */
    spawnPackAt(centerX, centerY, radius, packSize, entityManager, obstacleManager, enemyTypes, options = null) {
        const size = typeof packSize === 'object'
            ? Utils.randomInt(packSize.min || 2, packSize.max || 4)
            : Math.max(1, packSize);
        const packRadius = Math.min(radius, 80);
        const usePatrol = options && options.patrol === true;
        const patrolConfig = usePatrol && typeof PatrolBehavior !== 'undefined'
            ? PatrolBehavior.createPatrolConfigForPack(centerX, centerY, packRadius)
            : null;
        const allModifierNames = Object.keys(GameConfig.packModifiers || {});
        const packModifier = allModifierNames.length > 0
            ? allModifierNames[Utils.randomInt(0, allModifierNames.length - 1)]
            : null;
        let spawned = 0;
        const maxAttempts = size * 8;
        for (let a = 0; a < maxAttempts && spawned < size; a++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Utils.random(0, packRadius);
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            if (!obstacleManager || obstacleManager.canMoveTo(x, y, 25, 25)) {
                const types = enemyTypes && enemyTypes.length > 0 ? enemyTypes : ['goblin'];
                const type = types[Utils.randomInt(0, types.length - 1)];
                this.spawnEnemy(x, y, type, entityManager, patrolConfig, packModifier);
                spawned++;
            }
        }
    }

    // Spawn enemies for a specific level using pack spawning + optional scene-tile spawn hints
    spawnLevelEnemies(level, entityManager, obstacleManager, playerSpawn = null) {
        const levelConfig = GameConfig.levels[level];
        if (!levelConfig || !levelConfig.packSpawn) {
            console.warn(`No packSpawn config for level ${level}`);
            return;
        }

        this.currentLevel = level;
        this.enemiesSpawned = true;

        const worldConfig = GameConfig.world;
        const worldWidth = (levelConfig.worldWidth != null) ? levelConfig.worldWidth : worldConfig.width;
        const worldHeight = (levelConfig.worldHeight != null) ? levelConfig.worldHeight : worldConfig.height;
        const packConfig = levelConfig.packSpawn;
        const enemyTypes = levelConfig.enemyTypes || null;
        const packOptions = packConfig.patrol ? { patrol: true } : null;
        this.generateEnemyPacks(
            worldWidth,
            worldHeight,
            packConfig.density,
            packConfig.packSize,
            entityManager,
            obstacleManager,
            enemyTypes,
            packOptions,
            playerSpawn
        );

        const SPAWN_EXCLUDE_RADIUS = 300;

        // Scene-tile spawn hints: extra packs on tiles that define spawn (e.g. goblinCamp, banditAmbush)
        const obstacles = levelConfig.obstacles || {};
        if (obstacles.useSceneTiles && obstacleManager && typeof obstacleManager.getLastPlacedTiles === 'function') {
            const placed = obstacleManager.getLastPlacedTiles();
            const tileSizeDefault = typeof SceneTiles !== 'undefined' ? SceneTiles.defaultTileSize : 800;
            for (const cell of placed) {
                const tile = typeof SceneTiles !== 'undefined' && SceneTiles.getTile ? SceneTiles.getTile(cell.tileId) : null;
                if (!tile || !tile.spawn || tile.spawn.type !== 'pack') continue;
                const tileSize = cell.tileSize != null ? cell.tileSize : tileSizeDefault;
                const centerX = cell.originX + tileSize / 2;
                const centerY = cell.originY + tileSize / 2;
                if (playerSpawn && typeof playerSpawn.x === 'number' && typeof playerSpawn.y === 'number') {
                    if (Utils.distance(centerX, centerY, playerSpawn.x, playerSpawn.y) < SPAWN_EXCLUDE_RADIUS) continue;
                }
                const count = (tile.spawn.count != null && tile.spawn.count > 0) ? tile.spawn.count : 1;
                const packOptions = packConfig.patrol ? { patrol: true } : null;
                for (let i = 0; i < count; i++) {
                    this.spawnPackAt(
                        centerX, centerY,
                        tileSize * 0.35,
                        packConfig.packSize,
                        entityManager,
                        obstacleManager,
                        enemyTypes,
                        packOptions
                    );
                }
            }
        }
    }

    update(deltaTime, systems) {
        const entityManager = systems.get('entities');
        const obstacleManager = systems.get('obstacles');
        const packConfig = GameConfig.enemy.pack || { radius: 180, minAllies: 2 };
        const packRadius = packConfig.radius;
        const minAllies = packConfig.minAllies;
        const packModifiers = GameConfig.packModifiers || {};

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

            // Pack modifier: count same-type allies in radius; apply or clear pack buff
            const ai = enemy.getComponent(AI);
            const statusEffects = enemy.getComponent(StatusEffects);
            const transform = enemy.getComponent(Transform);
            const modifierName = ai && ai.packModifierName ? ai.packModifierName : null;
            if (modifierName && statusEffects && transform && packModifiers[modifierName]) {
                let sameTypeCount = 0;
                for (const other of this.enemies) {
                    if (other === enemy) continue;
                    const otherHealth = other.getComponent(Health);
                    if (otherHealth && otherHealth.isDead) continue;
                    const otherAI = other.getComponent(AI);
                    const otherTransform = other.getComponent(Transform);
                    if (!otherAI || otherAI.enemyType !== ai.enemyType || !otherTransform) continue;
                    const dist = Utils.distance(transform.x, transform.y, otherTransform.x, otherTransform.y);
                    if (dist <= packRadius) sameTypeCount++;
                }
                if (sameTypeCount >= minAllies) {
                    const def = packModifiers[modifierName];
                    const stats = {
                        speedMultiplier: def.speedMultiplier,
                        damageMultiplier: def.damageMultiplier,
                        knockbackResist: def.knockbackResist,
                        attackCooldownMultiplier: def.attackCooldownMultiplier,
                        stunBuildupPerHitMultiplier: def.stunBuildupPerHitMultiplier,
                        detectionRangeMultiplier: def.detectionRangeMultiplier
                    };
                    if (modifierName === 'frenzied' && def.speedPerAlly != null) {
                        stats.speedMultiplier = 1 + sameTypeCount * (def.speedPerAlly || 0);
                    }
                    statusEffects.setPackBuff(modifierName, stats);
                } else {
                    statusEffects.clearPackBuff();
                }
            } else if (statusEffects && statusEffects.packModifierName) {
                statusEffects.clearPackBuff();
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
        
        // For non-circular attacks: only apply damage during a single "hit window" in the middle of the swing (avoids double application)
        const is360Attack = combat.currentAttackIsCircular;
        if (!is360Attack) {
            const duration = combat.attackDuration > 0 ? combat.attackDuration : 0.001;
            const timer = combat.attackTimer != null ? combat.attackTimer : 0;
            const progress = timer / duration;
            const hitWindowStart = 0.25;
            const hitWindowEnd = 0.75;
            if (progress < hitWindowStart || progress > hitWindowEnd) {
                return [];
            }
        }
        
        const hitEnemies = [];
        
        // Sensitivity buffers for more generous hit detection
        const rangeSensitivity = 30; // Extra 30 pixels of detection range
        const arcSensitivity = 0.3; // Extra ~17 degrees on each side
        
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
                } else if (combat.currentAttackIsThrust) {
                    // Thrust: rectangle thrust forward from player (e.g. stab)
                    const facingAngle = movement ? movement.facingAngle : 0;
                    const thrustLength = combat.attackRange + rangeSensitivity;
                    const thrustHalfWidth = (combat.currentAttackThrustWidth || 40) / 2 + rangeSensitivity * 0.5;
                    hitEnemy = Utils.pointInThrustRect(
                        enemyTransform.x, enemyTransform.y,
                        transform.x, transform.y,
                        facingAngle, thrustLength, thrustHalfWidth
                    );
                } else {
                    // Normal arc-based attack (arcOffset shifts cone left/right for alternating slashes)
                    const facingAngle = movement ? movement.facingAngle : 0;
                    const arcCenter = facingAngle + (combat.attackArcOffset ?? 0);
                    
                    // Apply arc sensitivity buffer (wider angle tolerance)
                    const generousArc = combat.attackArc + arcSensitivity;
                    const generousRange = combat.attackRange + rangeSensitivity;
                    
                    hitEnemy = Utils.pointInArc(
                        enemyTransform.x, enemyTransform.y,
                        transform.x, transform.y,
                        arcCenter, generousArc, generousRange
                    );
                }
                
                if (hitEnemy) {
                    // Mark immediately so we never apply damage twice (same frame or re-entry)
                    if (combat.isPlayer && combat.playerAttack) {
                        combat.playerAttack.markEnemyHit(enemy.id);
                    }
                    const died = enemyHealth.takeDamage(combat.attackDamage);
                    const enemyStatus = enemy.getComponent(StatusEffects);
                    if (enemyStatus) enemyStatus.addStunBuildup(combat.currentAttackStunBuildup || 0);
                    if (this.systems && this.systems.eventBus) {
                        this.systems.eventBus.emit(EventTypes.PLAYER_HIT_ENEMY, { killed: died });
                    }
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
                const ai = enemy.getComponent(AI);
                const enemyType = ai ? ai.enemyType : 'goblin';
                const enemyConfig = GameConfig.enemy.types[enemyType] || GameConfig.enemy.types.goblin;
                const baseBuffer = 10; // Extra pixels for more forgiving collision
                const hitBonus = (enemyConfig.lunge && enemyConfig.lunge.hitRadiusBonus) || 0;
                const collisionDist = enemyRadius + playerRadius + baseBuffer + hitBonus;
                
                if (currentDist < collisionDist && !enemyCombat.attackProcessed) {
                    // Lunge damage: goblin uses goblinAttack.lungeDamage, others use enemyAttack or config
                    const lungeDamage = enemyCombat.goblinAttack
                        ? enemyCombat.goblinAttack.lungeDamage
                        : (enemyCombat.enemyAttack ? enemyCombat.enemyAttack.lungeDamage : enemyCombat.attackDamage);
                    let finalDamage = lungeDamage;
                    const attackerStatusLunge = enemy.getComponent(StatusEffects);
                    if (attackerStatusLunge && attackerStatusLunge.packDamageMultiplier != null) finalDamage *= attackerStatusLunge.packDamageMultiplier;
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
                    const playerStatus = player.getComponent(StatusEffects);
                    if (playerStatus) {
                        let baseStun = enemyConfig.stunBuildupPerHit ?? 0;
                        const packStunMult = attackerStatusLunge && attackerStatusLunge.packStunBuildupMultiplier != null ? attackerStatusLunge.packStunBuildupMultiplier : 1;
                        baseStun *= packStunMult;
                        const mult = blocked ? (GameConfig.player.stun?.blockedMultiplier ?? 0.5) : 1;
                        playerStatus.addStunBuildup(baseStun * mult);
                    }
                    if (playerMovement && !blocked) {
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        const lungeKnockbackForce = enemyConfig.lunge?.knockback?.force ?? knockbackConfig.force;
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, lungeKnockbackForce);
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
                // Demon and chieftain use arc and release phase; others use distance only
                const isDemon = enemyCombat.demonAttack != null;
                const isChieftain = enemyCombat.chieftainAttack != null;
                const inRange = currentDist < enemyCombat.attackRange;
                const inArc = (isDemon || isChieftain) && enemyMovement
                    ? Utils.pointInArc(playerTransform.x, playerTransform.y, enemyTransform.x, enemyTransform.y, enemyMovement.facingAngle, enemyCombat.attackArc, enemyCombat.attackRange)
                    : inRange;
                const demonCanHit = !isDemon || enemyCombat.demonAttack.isInReleasePhase;
                const chieftainCanHit = !isChieftain || enemyCombat.chieftainAttack.isInReleasePhase;
                if (inRange && inArc && demonCanHit && chieftainCanHit) {
                    let finalDamage = enemyCombat.attackDamage;
                    const attackerStatus = enemy.getComponent(StatusEffects);
                    if (attackerStatus && (performance.now() / 1000) < attackerStatus.buffedUntil) {
                        finalDamage *= (attackerStatus.damageMultiplier || 1);
                    }
                    if (attackerStatus && attackerStatus.packDamageMultiplier != null) finalDamage *= attackerStatus.packDamageMultiplier;
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
                    const ai = enemy.getComponent(AI);
                    const enemyTypeForStun = ai ? ai.enemyType : 'goblin';
                    const enemyConfigForStun = GameConfig.enemy.types[enemyTypeForStun] || GameConfig.enemy.types.goblin;
                    const playerStatus = player.getComponent(StatusEffects);
                    if (playerStatus) {
                        let baseStun = enemyConfigForStun.stunBuildupPerHit ?? 0;
                        if (attackerStatus && attackerStatus.packStunBuildupMultiplier != null) baseStun *= attackerStatus.packStunBuildupMultiplier;
                        const mult = blocked ? (GameConfig.player.stun?.blockedMultiplier ?? 0.5) : 1;
                        playerStatus.addStunBuildup(baseStun * mult);
                    }

                    // Apply knockback only when not blocked (blocking stops push entirely)
                    if (playerMovement && !blocked) {
                        const knockbackConfig = enemyConfigForStun.knockback || { force: 160, decay: 0.88 };
                        const baseForce = enemyCombat.currentAttackKnockbackForce ?? knockbackConfig.force;
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, baseForce);
                    }

                    if (enemyCombat.demonAttack) {
                        enemyCombat.demonAttack.markEnemyHit('player');
                    } else if (enemyCombat.chieftainAttack) {
                        enemyCombat.chieftainAttack.markEnemyHit('player');
                    } else if (enemyCombat.goblinAttack) {
                        enemyCombat.goblinAttack.attackProcessed = true;
                    } else if (enemyCombat.enemyAttack) {
                        enemyCombat.enemyAttack.attackProcessed = true;
                    }
                }
                // Mark attack processed so this branch runs once per attack (for non-demon, non-chieftain)
                if (enemyCombat.goblinAttack) {
                    enemyCombat.goblinAttack.attackProcessed = true;
                } else if (enemyCombat.enemyAttack) {
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
    changeLevel(level, entityManager, obstacleManager, playerSpawn = null) {
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
        
        // Spawn enemies for the new level (exclude area around player spawn)
        this.spawnLevelEnemies(level, entityManager, obstacleManager, playerSpawn);
    }

    getCurrentLevel() {
        return this.currentLevel;
    }

    getEnemiesKilledThisLevel() {
        return this.enemiesKilledThisLevel;
    }
}

