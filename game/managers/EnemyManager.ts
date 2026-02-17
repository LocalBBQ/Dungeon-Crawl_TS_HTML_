// Enemy Manager - manages enemy entities
import { Movement } from '../components/Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import type { GameConfigShape } from '../types/config.js';
import { Utils } from '../utils/Utils.ts';
import { Entity } from '../entities/Entity.ts';
import { StatusEffects } from '../components/StatusEffects.ts';
import { Transform } from '../components/Transform.ts';
import { Health } from '../components/Health.ts';
import { Rally } from '../components/Rally.ts';
import { AI } from '../components/AI.ts';
import { Combat } from '../components/Combat.ts';
import { EnemyMovement } from '../components/EnemyMovement.ts';
import { Renderable } from '../components/Renderable.ts';
import { Stamina } from '../components/Stamina.ts';
import { Sprite } from '../components/Sprite.ts';
import { Animation } from '../components/Animation.ts';
import { EventTypes } from '../core/EventTypes.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import { SceneTiles } from '../config/SceneTiles.ts';
import { PatrolBehavior } from '../behaviors/PatrolBehavior.ts';
import { CircularPatrolBehavior } from '../behaviors/CircularPatrolBehavior.ts';
import { GuardBehavior } from '../behaviors/GuardBehavior.ts';
import { SleepBehavior } from '../behaviors/SleepBehavior.ts';
import { PackFollowBehavior } from '../behaviors/PackFollowBehavior.ts';
import { WanderBehavior } from '../behaviors/WanderBehavior.ts';
import type { Quest } from '../types/quest.ts';
import type { PlayingStateShape } from '../state/PlayingState.js';
import { getPlayerArmorReduction } from '../armor/armorConfigs.js';

/** Base enemy type -> tier-2 variant (used when difficulty has enemyTier2Chance > 0). */
const TIER2_MAP: Record<string, string> = {
    goblin: 'goblinBrute',
    skeleton: 'skeletonVeteran',
};

interface EntityManagerLike {
    add(entity: Entity, group: string): void;
    remove(entityId: string): void;
}

interface ObstacleManagerLike {
    canMoveTo(x: number, y: number, w: number, h: number): boolean;
}

/** One deferred scene-tile spawn: spawn when player is within 2 tiles. Resolve entityManager/obstacleManager from systems at spawn time. */
interface PendingTileSpawn {
    centerX: number;
    centerY: number;
    tileSize: number;
    count: number;
    enemyTypes: string[] | null;
    effectivePackSize: { min: number; max: number };
    tilePackOptions: Record<string, unknown>;
}

export class EnemyManager {
    enemies: Entity[] = [];
    spawnTimer = 0;
    maxEnemies: number;
    systems: SystemManager | null = null;
    currentLevel = 1;
    enemiesSpawned = false;
    enemiesKilledThisLevel = 0;
    _packUpdateTick = 0;
    /** Scene-tile packs deferred until player is within 2 tiles; cleared on changeLevel, filled in spawnLevelEnemies. */
    pendingSceneTileSpawns: PendingTileSpawn[] = [];
    private config: GameConfigShape = GameConfig;
    private activeQuest: Quest | null = null;

    constructor() {
        this.maxEnemies = this.config.enemy.spawn.maxEnemies;
    }

    init(systems: SystemManager): void {
        this.systems = systems;
        const cfg = systems.get<GameConfigShape>('config');
        if (cfg) this.config = cfg;
        this.maxEnemies = this.config.enemy.spawn.maxEnemies;
    }

    spawnEnemy(
        x: number,
        y: number,
        type: string = 'goblin',
        entityManager?: EntityManagerLike | null,
        patrolConfig: unknown = null,
        packModifierOverride: string | null = null,
        packHasNoModifier = false,
        roamConfig: { centerX: number; centerY: number; radius: number } | null = null,
        idleBehavior: string | null = null,
        idleBehaviorConfig: unknown = null
    ): Entity {
        const config = this.config.enemy.types[type] || this.config.enemy.types.goblin;
        
        const enemy = new Entity(x, y, `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        
        const AIClass = AI;
        const ai = new AIClass(config.detectionRange, config.attackRange, patrolConfig);
        ai.enemyType = type; // Store enemy type for lunge detection
        // Bandits are faster; use a larger chase offset so they spread around the player instead of clumping
        if (type === 'bandit' || type === 'banditDagger') {
            (ai as { _chaseOffsetDist: number })._chaseOffsetDist = 55 + Math.random() * 65; // 55..120 px
        }
        if (roamConfig && typeof roamConfig.centerX === 'number' && typeof roamConfig.centerY === 'number' && typeof roamConfig.radius === 'number' && roamConfig.radius > 0) {
            ai.roamCenterX = roamConfig.centerX;
            ai.roamCenterY = roamConfig.centerY;
            ai.roamRadius = roamConfig.radius;
        }
        if (idleBehavior != null) ai.idleBehavior = idleBehavior;
        if (idleBehaviorConfig != null) ai.idleBehaviorConfig = idleBehaviorConfig;
        
        // Pack modifier: only when this spawn is from a pack that rolled a modifier (modifierChance in config)
        const validOverride = packModifierOverride != null && this.config.packModifiers && this.config.packModifiers[packModifierOverride];
        ai.packModifierName = (!packHasNoModifier && validOverride) ? packModifierOverride : null;
        const packDef = ai.packModifierName && this.config.packModifiers ? this.config.packModifiers[ai.packModifierName] : null;
        const healthMult = (packDef && packDef.healthMultiplier != null) ? packDef.healthMultiplier : 1;
        const maxHealth = config.maxHealth * healthMult;

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
        
        const size = type === 'trainingDummy' ? 32 : (type === 'greaterDemon' ? 38 : (type === 'goblinChieftain' ? 34 : (type === 'bandit' || type === 'banditDagger' ? 31 : 25)));
        enemy
            .addComponent(new Transform(x, y, size, size))
            .addComponent(new Health(maxHealth))
            .addComponent(new StatusEffects(false))
            .addComponent(new EnemyMovement(config.moveSpeed != null ? config.moveSpeed : config.speed, type)) // Pass enemy type for type-specific behavior
            .addComponent(new Combat(config.attackRange, config.attackDamage, Utils.degToRad(config.attackArcDegrees ?? 90), config.attackCooldown, config.windUpTime || 0.5, false, null, type)) // isPlayer=false, weapon=null, enemyType=type
            .addComponent(ai)
            .addComponent(new Renderable('enemy', { color: config.color }));

        // Stamina for enemies that define it (e.g. goblins: back off when exhausted until 50% recovered)
        if (config.maxStamina != null && config.maxStamina > 0) {
            const regen = config.staminaRegen != null ? config.staminaRegen : 5;
            enemy.addComponent(new Stamina(config.maxStamina, regen));
        }
        
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
        const tileSize = this.config.world.tileSize;
        let numPacks = Math.floor(worldWidth * worldHeight * packDensity / (tileSize * tileSize));
        const usePatrol = options && options.patrol === true;
        const packSpread = options && options.packSpread && typeof options.packSpread.min === 'number' && typeof options.packSpread.max === 'number' ? options.packSpread : null;
        const packCountVariance = typeof (options && options.packCountVariance) === 'number' ? Math.max(0, Math.min(1, options.packCountVariance)) : 0;
        const minPackDistance = typeof (options && options.minPackDistance) === 'number' && options.minPackDistance > 0 ? options.minPackDistance : 0;

        if (packCountVariance > 0) {
            const factor = 1 - packCountVariance + Math.random() * 2 * packCountVariance;
            numPacks = Math.max(1, Math.floor(numPacks * factor));
        }

        // Exclude area: use actual player spawn when provided so packs don't land on spawn; otherwise world center
        const excludeArea = playerSpawn && typeof playerSpawn.x === 'number' && typeof playerSpawn.y === 'number'
            ? { x: playerSpawn.x, y: playerSpawn.y, radius: 300 }
            : { x: worldWidth / 2, y: worldHeight / 2, radius: 200 };

        const placedPackCenters = [];
        let packsPlaced = 0;
        let attempts = 0;
        const maxAttempts = numPacks * 4;

        while (packsPlaced < numPacks && attempts < maxAttempts) {
            attempts++;

            const packCenterX = Utils.randomInt(0, worldWidth);
            const packCenterY = Utils.randomInt(0, worldHeight);

            const distFromCenter = Utils.distance(packCenterX, packCenterY, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }

            if (minPackDistance > 0) {
                let tooClose = false;
                for (const c of placedPackCenters) {
                    if (Utils.distance(packCenterX, packCenterY, c.x, c.y) < minPackDistance) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;
            }

            const packRadius = packSpread
                ? packSpread.min + Math.random() * (packSpread.max - packSpread.min)
                : 35;

            const patrolConfig = usePatrol
                ? PatrolBehavior.createPatrolConfigForPack(packCenterX, packCenterY, packRadius)
                : null;

            let idleBehavior = (options && options.idleBehavior) || null;
            let idleBehaviorConfig = (options && options.idleBehaviorConfig) || null;
            if (idleBehavior && !idleBehaviorConfig) {
                if (idleBehavior === 'guard') {
                    idleBehaviorConfig = GuardBehavior.createGuardConfig(packCenterX, packCenterY, packRadius);
                } else if (idleBehavior === 'circularPatrol') {
                    idleBehaviorConfig = CircularPatrolBehavior.createCircularPatrolConfig(packCenterX, packCenterY, packRadius);
                } else if (idleBehavior === 'sleep') {
                    idleBehaviorConfig = SleepBehavior.createSleepConfig(packRadius * 2);
                } else if (idleBehavior === 'packFollow') {
                    idleBehaviorConfig = PackFollowBehavior.createPackFollowConfig(packCenterX, packCenterY, packRadius);
                } else if (idleBehavior === 'patrol') {
                    idleBehavior = null;
                    idleBehaviorConfig = null;
                }
            }
            if (idleBehavior === 'patrol' || (!idleBehavior && usePatrol)) {
                idleBehavior = null;
                idleBehaviorConfig = null;
            }

            const packConfig = this.config.enemy.pack || {};
            const modifierChance = typeof packConfig.modifierChance === 'number' ? packConfig.modifierChance : 0.5;
            const allModifierNames = Object.keys(this.config.packModifiers || {});
            const packGetsModifier = allModifierNames.length > 0 && Math.random() < modifierChance;
            const packModifier = packGetsModifier ? allModifierNames[Utils.randomInt(0, allModifierNames.length - 1)] : null;
            const packHasNoModifier = !packGetsModifier;

            // One type per pack so bandit packs and goblin packs stay separate (no mixed packs)
            const types = enemyTypes && enemyTypes.length > 0 ? enemyTypes : ['goblin', 'goblin', 'skeleton', 'greaterDemon'];
            const packType = types[Utils.randomInt(0, types.length - 1)];
            const resolvedType = this.resolvePackType(packType);
            // Fewer bandits per pack (they're stronger than goblins)
            const banditPackSize = packType === 'bandit' || packType === 'banditDagger';
            const enemiesInPack = banditPackSize
                ? Utils.randomInt(1, Math.min(2, packSize.max))
                : Utils.randomInt(packSize.min, packSize.max);

            let enemiesSpawnedInPack = 0;
            const packMaxAttempts = enemiesInPack * 5;
            let packAttempts = 0;

            while (enemiesSpawnedInPack < enemiesInPack && packAttempts < packMaxAttempts) {
                packAttempts++;

                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * packRadius;
                const x = packCenterX + Math.cos(angle) * distance;
                const y = packCenterY + Math.sin(angle) * distance;

                const clampedX = Utils.clamp(x, 0, worldWidth);
                const clampedY = Utils.clamp(y, 0, worldHeight);

                const roamConfig = { centerX: packCenterX, centerY: packCenterY, radius: packRadius };
                const finalIdleConfig = (idleBehavior === 'packFollow')
                    ? PackFollowBehavior.createPackFollowConfig(packCenterX, packCenterY, packRadius, { offsetAngle: Math.random() * Math.PI * 2 })
                    : idleBehaviorConfig;
                if (!obstacleManager || obstacleManager.canMoveTo(clampedX, clampedY, 25, 25)) {
                    this.spawnEnemy(clampedX, clampedY, resolvedType, entityManager, patrolConfig, packModifier, packHasNoModifier, roamConfig, idleBehavior, finalIdleConfig);
                    enemiesSpawnedInPack++;
                }
            }

            if (enemiesSpawnedInPack > 0) {
                packsPlaced++;
                placedPackCenters.push({ x: packCenterX, y: packCenterY });
            }
        }
    }

    /**
     * Spawn a single pack at a given center (for scene-tile spawn hints).
     * @param {Object} [options] - Optional. { patrol: true } to give this pack a shared patrol path.
     */
        spawnPackAt(centerX, centerY, radius, packSize, entityManager, obstacleManager, enemyTypes, options = null) {
        // One type per pack so bandit packs and goblin packs stay separate (no mixed packs)
        const types = enemyTypes && enemyTypes.length > 0 ? enemyTypes : ['goblin'];
        const packType = types[Utils.randomInt(0, types.length - 1)];
        const resolvedType = this.resolvePackType(packType);
        // Fewer bandits per pack (they're stronger than goblins)
        const banditPack = packType === 'bandit' || packType === 'banditDagger';
        const size = banditPack
            ? Utils.randomInt(1, 2)
            : (typeof packSize === 'object'
                ? Utils.randomInt(packSize.min || 2, packSize.max || 4)
                : Math.max(1, packSize));
        const packSpread = options && options.packSpread && typeof options.packSpread.min === 'number' && typeof options.packSpread.max === 'number' ? options.packSpread : null;
        const packRadius = packSpread
            ? packSpread.min + Math.random() * (packSpread.max - packSpread.min)
            : Math.min(radius, 80);
        const usePatrol = options && options.patrol === true;
        const patrolConfig = usePatrol
            ? PatrolBehavior.createPatrolConfigForPack(centerX, centerY, packRadius)
            : null;
        const packConfig = this.config.enemy.pack || {};
        const modifierChance = typeof packConfig.modifierChance === 'number' ? packConfig.modifierChance : 0.5;
        const allModifierNames = Object.keys(this.config.packModifiers || {});
        const packGetsModifier = allModifierNames.length > 0 && Math.random() < modifierChance;
        const packModifier = packGetsModifier ? allModifierNames[Utils.randomInt(0, allModifierNames.length - 1)] : null;
        const packHasNoModifier = !packGetsModifier;
        let spawned = 0;
        const maxAttempts = size * 8;
        const wanderRadius = options && (options.wanderRadius != null) ? options.wanderRadius : packRadius;
        const roamConfig = { centerX: centerX, centerY: centerY, radius: wanderRadius };
        const idleBehavior = (options && options.idleBehavior != null) ? options.idleBehavior : null;
        const idleBehaviorConfig = (options && options.idleBehaviorConfig != null) ? options.idleBehaviorConfig : null;
        for (let a = 0; a < maxAttempts && spawned < size; a++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * packRadius;
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            if (!obstacleManager || obstacleManager.canMoveTo(x, y, 25, 25)) {
                this.spawnEnemy(x, y, resolvedType, entityManager, patrolConfig, packModifier, packHasNoModifier, roamConfig, idleBehavior, idleBehaviorConfig);
                spawned++;
            }
        }
    }

    // Spawn enemies for a specific level using pack spawning + optional scene-tile spawn hints
    spawnLevelEnemies(
        level: number,
        entityManager: EntityManagerLike | null,
        obstacleManager: ObstacleManagerLike | null,
        playerSpawn: { x: number; y: number } | null = null
    ): void {
        const levelConfig = this.config.levels[level];
        if (!levelConfig || !levelConfig.packSpawn) {
            console.warn(`No packSpawn config for level ${level}`);
            return;
        }

        this.currentLevel = level;
        this.enemiesSpawned = true;

        const worldConfig = this.config.world;
        const worldWidth = (levelConfig.worldWidth != null) ? levelConfig.worldWidth : worldConfig.width;
        const worldHeight = (levelConfig.worldHeight != null) ? levelConfig.worldHeight : worldConfig.height;
        const packConfig = levelConfig.packSpawn;
        const enemyTypes = levelConfig.enemyTypes || null;
        const diff = this.activeQuest?.difficulty;
        const density = (packConfig.density ?? 0.008) * (diff?.packDensityMultiplier ?? 1);
        const basePackSize = packConfig.packSize ?? { min: 2, max: 5 };
        const packSizeBonus = Math.max(0, diff?.packSizeBonus ?? 0);
        const effectivePackSize = {
            min: basePackSize.min,
            max: Math.min(10, basePackSize.max + packSizeBonus),
        };
        const packOptions = {
            patrol: !!packConfig.patrol,
            packSpread: packConfig.packSpread || null,
            packCountVariance: packConfig.packCountVariance,
            minPackDistance: packConfig.minPackDistance,
            idleBehavior: packConfig.idleBehavior || null,
            idleBehaviorConfig: packConfig.idleBehaviorConfig || null
        };
        this.generateEnemyPacks(
            worldWidth,
            worldHeight,
            density,
            effectivePackSize,
            entityManager,
            obstacleManager,
            enemyTypes,
            packOptions,
            playerSpawn
        );

        const SPAWN_EXCLUDE_RADIUS = 300;

        // Scene-tile spawn hints: defer until player is within 2 tiles (see update())
        const obstacles = levelConfig.obstacles || {};
        if (obstacles.useSceneTiles && obstacleManager && typeof obstacleManager.getLastPlacedTiles === 'function') {
            const placed = obstacleManager.getLastPlacedTiles();
            const tileSizeDefault = SceneTiles.defaultTileSize;
            for (const cell of placed) {
                const tile = SceneTiles.getTile(cell.tileId);
                if (!tile || !tile.spawn || tile.spawn.type !== 'pack') continue;
                const tileSize = cell.tileSize != null ? cell.tileSize : tileSizeDefault;
                const centerX = cell.originX + tileSize / 2;
                const centerY = cell.originY + tileSize / 2;
                if (playerSpawn && typeof playerSpawn.x === 'number' && typeof playerSpawn.y === 'number') {
                    if (Utils.distance(centerX, centerY, playerSpawn.x, playerSpawn.y) < SPAWN_EXCLUDE_RADIUS) continue;
                }
                const count = (tile.spawn.count != null && tile.spawn.count > 0) ? tile.spawn.count : 1;
                const tileWanderRadius = tileSize * 0.45;
                const tilePackOptions: Record<string, unknown> = {
                    patrol: !!packConfig.patrol,
                    packSpread: packConfig.packSpread || null,
                    wanderRadius: tileWanderRadius,
                    idleBehavior: 'wander' as const,
                    idleBehaviorConfig: WanderBehavior.createWanderConfig(centerX, centerY, tileWanderRadius)
                };
                const tileEnemyTypes = (tile.spawn.enemyTypes && tile.spawn.enemyTypes.length > 0) ? tile.spawn.enemyTypes : enemyTypes;
                this.pendingSceneTileSpawns.push({
                    centerX,
                    centerY,
                    tileSize,
                    count,
                    enemyTypes: tileEnemyTypes,
                    effectivePackSize,
                    tilePackOptions
                });
            }
        }
    }

    update(deltaTime: number, systems: SystemManager | null): void {
        const entityManager = systems.get('entities');
        const obstacleManager = systems.get('obstacles');
        const packConfig = this.config.enemy.pack || { radius: 180, minAllies: 2 };
        const packRadius = packConfig.radius;
        const minAllies = packConfig.minAllies;
        const packModifiers = this.config.packModifiers || {};

        // Spawn deferred scene-tile packs when player is within 2 tiles (ease: max 1–2 tiles per frame)
        const SPAWN_TILES_AWAY = 2;
        const MAX_TILE_SPAWNS_PER_FRAME = 2;
        const levelConfig = this.config.levels[this.currentLevel] as { obstacles?: { sceneTileLayout?: { tileSize?: number } } } | undefined;
        const sceneTileSize = levelConfig?.obstacles?.sceneTileLayout?.tileSize ?? SceneTiles.defaultTileSize;
        const playerEntity = systems?.get('entities')?.get('player');
        const playerTransform = playerEntity?.getComponent(Transform);
        if (playerTransform && entityManager && obstacleManager && this.pendingSceneTileSpawns.length > 0) {
            const playerTileCol = Math.floor(playerTransform.x / sceneTileSize);
            const playerTileRow = Math.floor(playerTransform.y / sceneTileSize);
            const inRange: PendingTileSpawn[] = [];
            for (const p of this.pendingSceneTileSpawns) {
                const tileCol = Math.floor(p.centerX / sceneTileSize);
                const tileRow = Math.floor(p.centerY / sceneTileSize);
                const distTiles = Math.max(Math.abs(playerTileCol - tileCol), Math.abs(playerTileRow - tileRow));
                if (distTiles <= SPAWN_TILES_AWAY) inRange.push(p);
            }
            // Closer tiles first
            inRange.sort((a, b) => {
                const da = Math.max(Math.abs(playerTileCol - Math.floor(a.centerX / sceneTileSize)), Math.abs(playerTileRow - Math.floor(a.centerY / sceneTileSize)));
                const db = Math.max(Math.abs(playerTileCol - Math.floor(b.centerX / sceneTileSize)), Math.abs(playerTileRow - Math.floor(b.centerY / sceneTileSize)));
                return da - db;
            });
            const toSpawn = inRange.slice(0, MAX_TILE_SPAWNS_PER_FRAME);
            for (const p of toSpawn) {
                for (let i = 0; i < p.count; i++) {
                    this.spawnPackAt(
                        p.centerX, p.centerY,
                        p.tileSize * 0.35,
                        p.effectivePackSize,
                        entityManager,
                        obstacleManager,
                        p.enemyTypes,
                        p.tilePackOptions
                    );
                }
                this.pendingSceneTileSpawns = this.pendingSceneTileSpawns.filter((x) => x !== p);
            }
        }

        // Run pack detection only every 2 frames (saves significant CPU on level 2+ with many enemies)
        const runPackThisFrame = this._packUpdateTick === 0;
        this._packUpdateTick = (this._packUpdateTick + 1) % 2;

        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            const health = enemy.getComponent(Health);
            if (health && health.isDead) {
                const ai = enemy.getComponent(AI);
                // Training dummy: reset health instead of dying (no gold, no kill count, stay in hub)
                if (ai?.enemyType === 'trainingDummy') {
                    health.currentHealth = health.maxHealth;
                    continue;
                }
                this.enemiesKilledThisLevel++;
                let goldDrop = 0;
                const transform = enemy.getComponent(Transform);
                if (ai?.enemyType) {
                    const typeConfig = this.config.enemy.types[ai.enemyType] as { goldDrop?: number } | undefined;
                    goldDrop = typeConfig?.goldDrop ?? 0;
                }
                if (goldDrop > 0 && transform && this.systems) {
                    const goldPickupManager = this.systems.get<{ spawn(x: number, y: number, amount: number): void }>('goldPickups');
                    if (goldPickupManager) {
                        const cx = transform.x + transform.width / 2;
                        const cy = transform.y + transform.height / 2;
                        goldPickupManager.spawn(cx, cy, goldDrop);
                    }
                }
                if (this.systems && this.systems.eventBus) {
                    this.systems.eventBus.emit(EventTypes.PLAYER_KILLED_ENEMY, {});
                }
                if (entityManager) {
                    entityManager.remove(enemy.id);
                }
                this.enemies.splice(i, 1);
                continue;
            }

            // Pack modifier: count same-type allies in radius; apply or clear pack buff
            if (runPackThisFrame) {
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
                        statusEffects.setPackBuff(modifierName, stats);
                    } else {
                        statusEffects.clearPackBuff();
                    }
                } else if (statusEffects && statusEffects.packModifierName) {
                    statusEffects.clearPackBuff();
                }
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
                    // Rally: heal player from rally pool when dealing damage (e.g. 50% of damage dealt, capped by pool)
                    const rally = player.getComponent(Rally);
                    if (rally && rally.rallyPool > 0) {
                        const healAmount = rally.consumeForHeal(combat.attackDamage * 0.5);
                        const playerHealth = player.getComponent(Health);
                        if (playerHealth && healAmount > 0) playerHealth.heal(healAmount);
                    }
                    if (this.systems && this.systems.eventBus) {
                        this.systems.eventBus.emit(EventTypes.PLAYER_HIT_ENEMY, { killed: died });
                    }
                    hitEnemies.push(enemy);
                    
                    // Apply knockback to enemy (stage/weapon config or player default)
                    const enemyMovement = enemy.getComponent(Movement);
                    if (enemyMovement) {
                        const dx = enemyTransform.x - transform.x;
                        const dy = enemyTransform.y - transform.y;
                        const knockbackForce = combat.currentAttackKnockbackForce ?? this.config.player.knockback.force;
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
                const enemyConfig = this.config.enemy.types[enemyType] || this.config.enemy.types.goblin;
                const baseBuffer = 10; // Extra pixels for more forgiving collision
                const hitBonus = (enemyConfig.lunge && enemyConfig.lunge.hitRadiusBonus) || 0;
                const collisionDist = enemyRadius + playerRadius + baseBuffer + hitBonus;
                
                if (currentDist < collisionDist && !enemyCombat.attackProcessed) {
                    const h = enemyCombat.enemyAttackHandler;
                    const lungeDamage = h && h.lungeDamage != null ? h.lungeDamage : enemyCombat.attackDamage;
                    let finalDamage = lungeDamage;
                    const attackerStatusLunge = enemy.getComponent(StatusEffects);
                    if (attackerStatusLunge && attackerStatusLunge.packDamageMultiplier != null) finalDamage *= attackerStatusLunge.packDamageMultiplier;
                    let blocked = false;
                    let parried = false;
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            if (playerCombat.isInParryWindow() && playerCombat.getParryRallyPercent() > 0) {
                                const rallyAmount = finalDamage * playerCombat.getParryRallyPercent();
                                const rally = player.getComponent(Rally);
                                if (rally) rally.addToPool(rallyAmount);
                                playerCombat.applyParry(rallyAmount, 220);
                                finalDamage = 0;
                                blocked = true;
                                parried = true;
                            } else if (playerCombat.consumeBlockStamina()) {
                                finalDamage = lungeDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                        }
                    }
                    const ps = this.systems?.get<PlayingStateShape>('playingState');
                    if (ps) finalDamage *= Math.max(0, 1 - getPlayerArmorReduction(ps));
                    playerHealth.takeDamage(finalDamage, blocked, parried);
                    const playerStatus = player.getComponent(StatusEffects);
                    if (playerStatus) {
                        let baseStun = enemyConfig.stunBuildupPerHit ?? 0;
                        const packStunMult = attackerStatusLunge && attackerStatusLunge.packStunBuildupMultiplier != null ? attackerStatusLunge.packStunBuildupMultiplier : 1;
                        baseStun *= packStunMult;
                        const mult = blocked ? (this.config.player.stun?.blockedMultiplier ?? 0.5) : 1;
                        playerStatus.addStunBuildup(baseStun * mult);
                    }
                    if (playerMovement && !blocked) {
                        const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                        const lungeKnockbackForce = enemyConfig.lunge?.knockback?.force ?? knockbackConfig.force;
                        const dx = playerTransform.x - enemyTransform.x;
                        const dy = playerTransform.y - enemyTransform.y;
                        playerMovement.applyKnockback(dx, dy, lungeKnockbackForce);
                    }
                    if (h) {
                        h.markEnemyHit('player'); // single hit per lunge; Combat.attackProcessed reads this
                    }
                }
            }
            // Check if enemy attack has completed wind-up and is ready to hit (normal attacks)
            // Only process normal attacks if not currently lunging
            if ((!enemyMovement || !enemyMovement.isLunging) && enemyCombat.isAttacking && !enemyCombat.attackProcessed && !enemyCombat.isLunging) {
                const h = enemyCombat.enemyAttackHandler;
                const useReleasePhase = h && h.hasChargeRelease && h.hasChargeRelease();
                // AOE in front (e.g. chieftain club slam): circle centered in front of enemy
                const aoeInFront = enemyCombat.currentAttackAoeInFront && enemyCombat.currentAttackAoeRadius > 0;
                let inRange;
                let inArc;
                let inHitWindow = true;
                const rangeSensitivity = 30;
                const arcSensitivity = 0.3;
                if (aoeInFront && enemyMovement) {
                    const slamX = enemyTransform.x + Math.cos(enemyMovement.facingAngle) * (enemyCombat.currentAttackAoeOffset || 0);
                    const slamY = enemyTransform.y + Math.sin(enemyMovement.facingAngle) * (enemyCombat.currentAttackAoeOffset || 0);
                    const distToSlam = Utils.distance(playerTransform.x, playerTransform.y, slamX, slamY);
                    inRange = distToSlam <= enemyCombat.currentAttackAoeRadius;
                    inArc = true;
                } else {
                    // Same rules as player dagger: distance to edge of target, full cone (arc + range) with sensitivity, hit window 0.25–0.75
                    const currentDist = Utils.distance(
                        enemyTransform.x, enemyTransform.y,
                        playerTransform.x, playerTransform.y
                    );
                    const playerHitboxRadius = Math.max(playerTransform.width, playerTransform.height) / 2;
                    const distToEdge = Math.max(0, currentDist - playerHitboxRadius);
                    const generousRange = enemyCombat.attackRange + rangeSensitivity;
                    inRange = distToEdge < generousRange;
                    const useArcCheck = enemyMovement && !enemyCombat.currentAttackIsCircular;
                    if (useArcCheck) {
                        const arcCenter = enemyMovement.facingAngle + (enemyCombat.attackArcOffset ?? 0);
                        const generousArc = enemyCombat.attackArc + arcSensitivity;
                        const useSlashSweep = h && typeof h.getSlashSweepProgress === 'function';
                        if (useSlashSweep) {
                            const sweepProgress = h.getSlashSweepProgress();
                            inHitWindow = sweepProgress >= 0.25 && sweepProgress <= 0.75;
                            inArc = inHitWindow && Utils.pointInArc(playerTransform.x, playerTransform.y, enemyTransform.x, enemyTransform.y, arcCenter, generousArc, generousRange);
                        } else {
                            inArc = Utils.pointInArc(playerTransform.x, playerTransform.y, enemyTransform.x, enemyTransform.y, arcCenter, generousArc, generousRange);
                        }
                    } else {
                        inArc = inRange;
                    }
                }
                const releasePhaseOk = !useReleasePhase || (h && h.isInReleasePhase);
                if (inRange && inArc && inHitWindow && releasePhaseOk) {
                    let finalDamage = enemyCombat.attackDamage;
                    const attackerStatus = enemy.getComponent(StatusEffects);
                    if (attackerStatus && (performance.now() / 1000) < attackerStatus.buffedUntil) {
                        finalDamage *= (attackerStatus.damageMultiplier || 1);
                    }
                    if (attackerStatus && attackerStatus.packDamageMultiplier != null) finalDamage *= attackerStatus.packDamageMultiplier;
                    let blocked = false;
                    let parried = false;

                    // Check if player is blocking and can block this attack (or parry within window)
                    if (playerCombat && playerCombat.isBlocking && playerMovement) {
                        const attackAngle = Utils.angleTo(
                            playerTransform.x, playerTransform.y,
                            enemyTransform.x, enemyTransform.y
                        );
                        if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                            if (playerCombat.isInParryWindow() && playerCombat.getParryRallyPercent() > 0) {
                                const rallyAmount = finalDamage * playerCombat.getParryRallyPercent();
                                const rally = player.getComponent(Rally);
                                if (rally) rally.addToPool(rallyAmount);
                                playerCombat.applyParry(rallyAmount, 220);
                                finalDamage = 0;
                                blocked = true;
                                parried = true;
                            } else if (playerCombat.consumeBlockStamina()) {
                                finalDamage = enemyCombat.attackDamage * (1 - playerCombat.blockDamageReduction);
                                blocked = true;
                            }
                        }
                    }

                    const ps = this.systems?.get<PlayingStateShape>('playingState');
                    if (ps) finalDamage *= Math.max(0, 1 - getPlayerArmorReduction(ps));
                    const ai = enemy.getComponent(AI);
                    playerHealth.takeDamage(finalDamage, blocked, parried);
                    const enemyTypeForStun = ai ? ai.enemyType : 'goblin';
                    const enemyConfigForStun = this.config.enemy.types[enemyTypeForStun] || this.config.enemy.types.goblin;
                    const playerStatus = player.getComponent(StatusEffects);
                    if (playerStatus) {
                        let baseStun = enemyCombat.currentAttackStunBuildup || (enemyConfigForStun.stunBuildupPerHit ?? 0);
                        if (attackerStatus && attackerStatus.packStunBuildupMultiplier != null) baseStun *= attackerStatus.packStunBuildupMultiplier;
                        const mult = blocked ? (this.config.player.stun?.blockedMultiplier ?? 0.5) : 1;
                        playerStatus.addStunBuildup(baseStun * mult);
                    }

                    // Apply knockback even when blocked (blocking reduces damage/stun but not push)
                    if (playerMovement) {
                        const knockbackConfig = enemyConfigForStun.knockback || { force: 160, decay: 0.88 };
                        const baseForce = enemyCombat.currentAttackKnockbackForce ?? knockbackConfig.force;
                        // AOE-in-front: knockback away from slam center; otherwise away from enemy
                        let dx, dy;
                        if (aoeInFront && enemyMovement && enemyCombat.currentAttackAoeRadius > 0) {
                            const slamX = enemyTransform.x + Math.cos(enemyMovement.facingAngle) * (enemyCombat.currentAttackAoeOffset || 0);
                            const slamY = enemyTransform.y + Math.sin(enemyMovement.facingAngle) * (enemyCombat.currentAttackAoeOffset || 0);
                            dx = playerTransform.x - slamX;
                            dy = playerTransform.y - slamY;
                        } else {
                            dx = playerTransform.x - enemyTransform.x;
                            dy = playerTransform.y - enemyTransform.y;
                        }
                        playerMovement.applyKnockback(dx, dy, baseForce);
                    }

                    if (h) {
                        h.markEnemyHit('player'); // single hit per attack; Combat.attackProcessed reads this
                    }
                }
            }
        }
    }

    getAliveCount(): number {
        return this.enemies.filter(e => {
            const health = e.getComponent(Health);
            return health && !health.isDead;
        }).length;
    }

    // Change to a different level (clears current enemies and spawns new ones)
    changeLevel(
        level: number,
        entityManager: EntityManagerLike | null,
        obstacleManager: ObstacleManagerLike | null,
        playerSpawn: { x: number; y: number } | null = null
    ): void {
        this.pendingSceneTileSpawns = [];
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

    getCurrentLevel(): number {
        return this.currentLevel;
    }

    getEnemiesKilledThisLevel(): number {
        return this.enemiesKilledThisLevel;
    }

    setActiveQuest(quest: Quest | null): void {
        this.activeQuest = quest;
    }

    /** Resolve pack type: optionally substitute tier-2 variant when difficulty has enemyTier2Chance. */
    private resolvePackType(baseType: string): string {
        const diff = this.activeQuest?.difficulty;
        if (!diff || !(diff.enemyTier2Chance > 0)) return baseType;
        const tier2 = TIER2_MAP[baseType];
        if (!tier2) return baseType;
        return Math.random() < diff.enemyTier2Chance ? tier2 : baseType;
    }
}

