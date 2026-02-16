// Main game class - orchestrates all systems
import '../bootstrap.ts';

import { EntityManager } from '../managers/EntityManager.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { ScreenManager } from './ScreenManager.ts';
import { SystemManager, type SystemLike } from './SystemManager.ts';
import { SpriteManager } from '../managers/SpriteManager.ts';
import { InputSystem } from '../systems/InputSystem.ts';
import { CameraSystem } from '../systems/CameraSystem.ts';
import { CollisionSystem } from '../systems/CollisionSystem.ts';
import { ObstacleManager } from '../managers/ObstacleManager.ts';
import { GatherableManager } from '../managers/GatherableManager.ts';
import { PathfindingSystem } from '../systems/PathfindingSystem.ts';
import { EnemyManager } from '../managers/EnemyManager.ts';
import { HazardManager } from '../managers/HazardManager.ts';
import { DamageNumberManager } from '../managers/DamageNumberManager.ts';
import { ProjectileManager } from '../managers/ProjectileManager.ts';
import { HealthOrbManager } from '../managers/HealthOrbManager.ts';
import { RenderSystem } from '../systems/RenderSystem.ts';
import { Entity } from '../entities/Entity.ts';
import { Transform } from '../components/Transform.ts';
import { Health } from '../components/Health.ts';
import { StatusEffects } from '../components/StatusEffects.ts';
import { Stamina } from '../components/Stamina.ts';
import { PlayerHealing } from '../components/PlayerHealing.ts';
import { PlayerMovement } from '../components/PlayerMovement.ts';
import { Combat } from '../components/Combat.ts';
import { Renderable } from '../components/Renderable.ts';
import { Sprite } from '../components/Sprite.ts';
import { Animation } from '../components/Animation.ts';
import { PlayerInputController } from '../controllers/PlayerInputController.ts';
import { EventTypes } from './EventTypes.ts';
import { Movement } from '../components/Movement.ts';
import { Weapons } from '../weapons/WeaponsRegistry.ts';
import type { GameRef, GameConfigShape } from '../types/index.js';
import { PlayingState } from '../state/PlayingState.js';
import { createPlayer as createPlayerEntity } from './PlayerFactory.js';
import { ScreenController } from './ScreenController.js';
import { PlayingStateController } from './PlayingStateController.js';
import { HUDController } from '../ui/HUDController.js';
import { AI } from '../components/AI.js';

class Game {
    constructor() {
        try {
            this.canvas = document.getElementById('gameCanvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found');
            }
            
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Could not get 2d context');
            }
            
            this.entities = new EntityManager();
            this.systems = null;
            this.config = GameConfig;

            const defaultWeapon = (this.config.player && this.config.player.defaultWeapon) ? this.config.player.defaultWeapon : 'swordAndShield';
            this.playingState = new PlayingState(defaultWeapon);

            // Game-wide settings (toggled from pause/settings screen)
            this.settings = {
                musicEnabled: true,
                sfxEnabled: true,
                showMinimap: true,
                useCharacterSprites: true,   // Player + enemies use sprite sheets vs procedural canvas knight
                useEnvironmentSprites: false, // Trees/rocks/houses etc use sprite images vs procedural shapes
                showPlayerHitboxIndicators: true,  // Player attack arc, thrust rect
                showEnemyHitboxIndicators: true,   // Enemy cones, wind-up, attack indicator, lunge telegraph
                showEnemyStaminaBars: false,      // Enemy stamina bars (e.g. goblins)
                showPlayerHealthBarAlways: true,  // Floating health (and stamina) bar above player
                showEnemyHealthBars: true         // Floating health bars above all enemies
            };
            
            // Initialize screen manager
            this.screenManager = null; // Will be initialized after canvas setup
            
            // Size canvas and create screen manager
            this.initCanvas();
            // Initialize systems asynchronously (loads sprites)
            this.initializeSystems().then(() => {
                // Controllers (order: HUD first so Game can delegate setInventoryPanelVisible/refreshInventoryPanel to it)
                this.hudController = new HUDController({
                    playingState: this.playingState,
                    systems: this.systems,
                    entities: this.entities
                });
                this.playingStateController = new PlayingStateController(this);
                this.screenController = new ScreenController(this);
                this.setupEventListeners();
                this.bindGlobalInputHandlers();
                this.bindCombatFeedbackListeners();

                this.running = true;
                this.lastTime = performance.now();
                
                console.log('Game initialized successfully');
                
                // Start with title screen and draw it once immediately (before game loop)
                this.screenManager.setScreen('title');
                this.updateUIVisibility(false);
                this.renderTitleOrDeathScreen();
                this.start();
            }).catch((error) => {
                console.error('Game initialization error:', error);
                alert('Game failed to initialize: ' + error.message);
            });
            
        } catch (error) {
            console.error('Game initialization error:', error);
            alert('Game failed to initialize: ' + error.message);
        }
    }

    get inventoryOpen() { return this.playingState.inventoryOpen; }
    set inventoryOpen(v) { this.playingState.inventoryOpen = v; }
    get chestOpen() { return this.playingState.chestOpen; }
    set chestOpen(v) { this.playingState.chestOpen = v; }
    get boardOpen() { return this.playingState.boardOpen; }
    set boardOpen(v) { this.playingState.boardOpen = v; }
    get playerInGatherableRange() { return this.playingState.playerInGatherableRange; }
    set playerInGatherableRange(v) { this.playingState.playerInGatherableRange = v; }
    get crossbowReloadProgress() { return this.playingState.crossbowReloadProgress; }
    set crossbowReloadProgress(v) { this.playingState.crossbowReloadProgress = v; }
    get crossbowReloadInProgress() { return this.playingState.crossbowReloadInProgress; }
    set crossbowReloadInProgress(v) { this.playingState.crossbowReloadInProgress = v; }
    get crossbowPerfectReloadNext() { return this.playingState.crossbowPerfectReloadNext; }
    set crossbowPerfectReloadNext(v) { this.playingState.crossbowPerfectReloadNext = v; }
    get playerProjectileCooldown() { return this.playingState.playerProjectileCooldown; }
    set playerProjectileCooldown(v) { this.playingState.playerProjectileCooldown = v; }
    get gold() { return this.playingState.gold; }
    set gold(v) { this.playingState.gold = v; }

    initCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Initialize screen manager after canvas is set up
        this.screenManager = new ScreenManager(this.canvas, this.ctx);
    }

    async initializeSystems() {
        // Register systems and core managers, then load assets
        this.initSystems();
        await this.loadPlayerSprites();
        await this.loadEnemySprites();
        await this.loadGroundTextures();
    }

    initSystems() {
        const worldConfig = this.config.world;
        const level1Config = this.config.levels && this.config.levels[1];
        const initialWorldWidth = (level1Config && level1Config.worldWidth != null) ? level1Config.worldWidth : worldConfig.width;
        const initialWorldHeight = (level1Config && level1Config.worldHeight != null) ? level1Config.worldHeight : worldConfig.height;
        this._currentWorldWidth = initialWorldWidth;
        this._currentWorldHeight = initialWorldHeight;

        if (!this.systems) {
            this.systems = new SystemManager();
        }

        this.systems.register('config', this.config as unknown as SystemLike);

        this.systems.register('entities', this.entities);

        // Register sprite manager first
        const spriteManager = new SpriteManager();
        this.systems.register('sprites', spriteManager);

        // Register core systems in order (do not register Game as a system — SystemManager.update would call Game.update recursively)
        this.systems
            .register('input', new InputSystem(this.canvas))
            .register('camera', new CameraSystem(initialWorldWidth, initialWorldHeight))
            .register('collision', new CollisionSystem())
            .register('obstacles', new ObstacleManager())
            .register('gatherables', new GatherableManager(this.playingState));

        const obstacleManager = this.systems.get('obstacles');
        if (obstacleManager && obstacleManager.init) obstacleManager.init(this.systems);

        // Generate world before pathfinding (use level 1 config and dimensions)
        const level1Obstacles = level1Config && level1Config.obstacles ? level1Config.obstacles : this.config.obstacles;
        const portalConfig = this.config.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        obstacleManager.generateWorld(initialWorldWidth, initialWorldHeight, level1Obstacles, {
            x: portalConfig.x + portalConfig.width / 2,
            y: portalConfig.y + portalConfig.height / 2,
            radius: 120
        });

        // Now register systems that depend on obstacles
        this.systems
            .register('pathfinding', new PathfindingSystem(
                obstacleManager,
                initialWorldWidth,
                initialWorldHeight,
                this.config.pathfinding.cellSize
            ))
            .register('enemies', new EnemyManager())
            .register('hazards', new HazardManager())
            .register('damageNumbers', new DamageNumberManager())
            .register('projectiles', new ProjectileManager())
            .register('healthOrbs', new HealthOrbManager())
            .register('render', new RenderSystem(this.canvas, this.ctx));

        // Initialize render system with systems reference and game settings (needed for attack/hitbox rendering)
        const renderSystem = this.systems.get('render');
        if (renderSystem) {
            if (renderSystem.init) renderSystem.init(this.systems);
            renderSystem.settings = this.settings;
        }

        // Explicit update order: input first, then logic/managers, then entities, then render last
        this.systems.setUpdateOrder([
            'input', 'camera', 'collision', 'obstacles', 'gatherables', 'pathfinding',
            'enemies', 'hazards', 'damageNumbers', 'projectiles', 'healthOrbs',
            'entities', 'render'
        ]);
    }

    async loadPlayerSprites() {
        const spriteManager = this.systems.get('sprites');
        if (!spriteManager) return;

        const loadedKnightSheets = {};
        let knightRows = 1, knightCols = 8, knightFrameWidth = 0, knightFrameHeight = 0;

        // Directory-based Idle (Player/Idle/E_Idle, N_Idle, ... with sprite0.png, sprite1.png, ...)
        const playerIdleBasePath = 'assets/sprites/Player/Idle';
        const multiDirIdle = await spriteManager.loadMultiDirFrames(playerIdleBasePath, 'Idle');
        if (multiDirIdle) {
            const idleKey = `${playerIdleBasePath}_Idle_multidir`;
            loadedKnightSheets.idle = idleKey;
            loadedKnightSheets._idleMultiDir = true;
            const firstImg = multiDirIdle.directions[0]?.[0];
            if (firstImg) {
                knightFrameWidth = firstImg.naturalWidth || firstImg.width;
                knightFrameHeight = firstImg.naturalHeight || firstImg.height;
            }
        }

        // Load knight 8-direction block sprite sheet — use same frame size and layout as idle so one frame per direction
        const knightBlockPath = 'assets/sprites/player/Knight_8_D_Block.png';
        if (knightFrameWidth > 0 && knightFrameHeight > 0) {
            try {
                await spriteManager.loadSprite(knightBlockPath);
                await spriteManager.loadSpriteSheet(
                    knightBlockPath,
                    knightFrameWidth,
                    knightFrameHeight,
                    knightRows,
                    knightCols
                );
                const blockSheetKey = `${knightBlockPath}_${knightFrameWidth}_${knightFrameHeight}_${knightRows}_${knightCols}`;
                loadedKnightSheets.block = blockSheetKey;
                console.log(`Loaded Knight_8_D_Block: same frame size as idle (${knightFrameWidth}x${knightFrameHeight}, ${knightRows}×${knightCols})`);
            } catch (error) {
                console.warn('Failed to load Knight_8_D_Block.png:', error);
            }
        }

        // Load knight 8-direction attack sprite sheet — same frame size and layout as idle (Knight_8_Direction.png)
        const knightAttk1Path = 'assets/sprites/player/Knight_8_D_Attk1.png';
        if (knightFrameWidth > 0 && knightFrameHeight > 0) {
            try {
                await spriteManager.loadSprite(knightAttk1Path);
                await spriteManager.loadSpriteSheet(
                    knightAttk1Path,
                    knightFrameWidth,
                    knightFrameHeight,
                    knightRows,
                    knightCols
                );
                const attk1SheetKey = `${knightAttk1Path}_${knightFrameWidth}_${knightFrameHeight}_${knightRows}_${knightCols}`;
                loadedKnightSheets.melee = attk1SheetKey;
                console.log(`Loaded Knight_8_D_Attk1: same frame size as idle (${knightFrameWidth}x${knightFrameHeight}, ${knightRows}×${knightCols})`);
            } catch (error) {
                console.warn('Failed to load Knight_8_D_Attk1.png:', error);
            }
        }

        // Load knight attack 2 (second combo hit) — same frame size and layout as idle (Knight_8_Direction.png)
        const knightAttk2Path = 'assets/sprites/player/Knight_8_D_Attk2.png';
        if (knightFrameWidth > 0 && knightFrameHeight > 0) {
            try {
                await spriteManager.loadSprite(knightAttk2Path);
                await spriteManager.loadSpriteSheet(
                    knightAttk2Path,
                    knightFrameWidth,
                    knightFrameHeight,
                    knightRows,
                    knightCols
                );
                const attk2SheetKey = `${knightAttk2Path}_${knightFrameWidth}_${knightFrameHeight}_${knightRows}_${knightCols}`;
                loadedKnightSheets.melee2 = attk2SheetKey;
                console.log(`Loaded Knight_8_D_Attk2: same frame size as idle (${knightFrameWidth}x${knightFrameHeight}, ${knightRows}×${knightCols})`);
            } catch (error) {
                console.warn('Failed to load Knight_8_D_Attk2.png:', error);
            }
        }

        // Load knight 8-direction overhead chop (greatsword) — same frame size and layout as idle (e.g. 1×8 or 8×1)
        const knightChopPath = 'assets/sprites/player/Knight_8_D_Chop.png';
        if (knightFrameWidth > 0 && knightFrameHeight > 0) {
            try {
                await spriteManager.loadSprite(knightChopPath);
                await spriteManager.loadSpriteSheet(
                    knightChopPath,
                    knightFrameWidth,
                    knightFrameHeight,
                    knightRows,
                    knightCols
                );
                const chopSheetKey = `${knightChopPath}_${knightFrameWidth}_${knightFrameHeight}_${knightRows}_${knightCols}`;
                loadedKnightSheets.meleeChop = chopSheetKey;
                console.log(`Loaded Knight_8_D_Chop: same frame size as idle (${knightFrameWidth}x${knightFrameHeight}, ${knightRows}×${knightCols})`);
            } catch (error) {
                console.warn('Failed to load Knight_8_D_Chop.png:', error);
            }
        }

        // Load optional knight animation sprite sheets (horizontal strips) from alternate path
        const spriteBasePath = 'assets/sprites/player/2D HD Character Knight/Spritesheets/With shadows/';
        const knightAnimations = {
            walk: 'Walk.png',
            run: 'Run.png',
            meleeSpin: 'MeleeSpin.png',
            roll: 'Rolling.png',
            takeDamage: 'TakeDamage.png'
        };

        for (const [animName, fileName] of Object.entries(knightAnimations)) {
            try {
                const spritePath = spriteBasePath + fileName;
                let sheet, key;
                
                // Walk.png has 8 rows × 13 columns (8 directions, 13 frames each)
                if (animName === 'walk') {
                    const walkImg = await spriteManager.loadSprite(spritePath);
                    const walkFrameWidth = walkImg.width / 13;  // 13 columns
                    const walkFrameHeight = walkImg.height / 8; // 8 rows
                    sheet = await spriteManager.loadSpriteSheet(
                        spritePath,
                        walkFrameWidth,
                        walkFrameHeight,
                        8,  // rows
                        13  // cols
                    );
                    key = `${spritePath}_${walkFrameWidth}_${walkFrameHeight}_8_13`;
                    console.log(`Loaded ${animName} sprite sheet: ${sheet.rows} rows × ${sheet.cols} cols = ${sheet.totalFrames} frames`);
                } else {
                    // Other animations use horizontal sprite sheets (auto-detect)
                    sheet = await spriteManager.loadHorizontalSpriteSheet(spritePath);
                    key = `${spritePath}_horizontal`;
                    console.log(`Loaded ${animName} sprite sheet: ${sheet.cols} frames`);
                }
                
                loadedKnightSheets[animName] = key;
            } catch (error) {
                console.warn(`Failed to load ${animName} sprite sheet:`, error);
            }
        }
        
        // Store loaded sheets for later use
        spriteManager.knightSheets = loadedKnightSheets;
    }

    async loadEnemySprites() {
        const spriteManager = this.systems.get('sprites');
        if (!spriteManager) return;

        // Load goblin 8-direction sprite sheet (Goblin_8D.png: 1 row × 8 cols, one frame per direction)
        try {
            const goblin8DPath = 'assets/sprites/enemies/Goblin_8D.png';
            const goblin8DRows = 1;
            const goblin8DCols = 8;
            const goblin8DImg = await spriteManager.loadSprite(goblin8DPath);
            const goblin8DFrameWidth = goblin8DImg.width / goblin8DCols;
            const goblin8DFrameHeight = goblin8DImg.height / goblin8DRows;
            await spriteManager.loadSpriteSheet(
                goblin8DPath,
                goblin8DFrameWidth,
                goblin8DFrameHeight,
                goblin8DRows,
                goblin8DCols
            );
            const goblin8DKey = spriteManager.findSpriteSheetByPath(goblin8DPath);
            spriteManager.goblin8DSheetKey = goblin8DKey ? goblin8DKey.key : null;
            console.log('Goblin 8-direction sprite sheet (Goblin_8D.png) loaded successfully');
        } catch (error) {
            console.warn('Failed to load Goblin_8D.png:', error);
            spriteManager.goblin8DSheetKey = null;
        }

        // Load goblin 8-direction lunge sprite sheet (Goblin_8D_Lunge.png: 1 row × 8 cols)
        try {
            const goblin8DLungePath = 'assets/sprites/enemies/Goblin_8D_Lunge.png';
            const goblin8DLungeRows = 1;
            const goblin8DLungeCols = 8;
            const goblin8DLungeImg = await spriteManager.loadSprite(goblin8DLungePath);
            const goblin8DLungeFrameWidth = goblin8DLungeImg.width / goblin8DLungeCols;
            const goblin8DLungeFrameHeight = goblin8DLungeImg.height / goblin8DLungeRows;
            await spriteManager.loadSpriteSheet(
                goblin8DLungePath,
                goblin8DLungeFrameWidth,
                goblin8DLungeFrameHeight,
                goblin8DLungeRows,
                goblin8DLungeCols
            );
            const goblin8DLungeKey = spriteManager.findSpriteSheetByPath(goblin8DLungePath);
            spriteManager.goblin8DLungeSheetKey = goblin8DLungeKey ? goblin8DLungeKey.key : null;
            console.log('Goblin 8-direction lunge sprite sheet (Goblin_8D_Lunge.png) loaded successfully');
        } catch (error) {
            console.warn('Failed to load Goblin_8D_Lunge.png:', error);
            spriteManager.goblin8DLungeSheetKey = null;
        }

        // Fallback goblin sprite sheet (5×4) when 8D lunge sheet is not used
        try {
            const goblinSpritePath = 'assets/sprites/enemies/Goblin.png';
            const goblinRows = 5;
            const goblinCols = 4;
            const goblinImg = await spriteManager.loadSprite(goblinSpritePath);
            const goblinFrameWidth = goblinImg.width / goblinCols;
            const goblinFrameHeight = goblinImg.height / goblinRows;
            await spriteManager.loadSpriteSheet(
                goblinSpritePath,
                goblinFrameWidth,
                goblinFrameHeight,
                goblinRows,
                goblinCols
            );
            console.log('Goblin sprite sheet (Goblin.png) loaded as fallback');
        } catch (error) {
            console.warn('Failed to load goblin sprite sheet:', error);
        }
    }

    async loadGroundTextures() {
        const spriteManager = this.systems.get('sprites');
        if (!spriteManager || !spriteManager.loadGroundTexture) return;
        const registry = this.config.groundTextures || {};
        const pathsToLoad = new Set();
        const collect = (ground) => {
            if (!ground || !ground.texture) return;
            const path = registry[ground.texture] || ground.texture;
            if (path) pathsToLoad.add(path);
        };
        if (this.config.hub && this.config.hub.theme && this.config.hub.theme.ground) {
            collect(this.config.hub.theme.ground);
        }
        if (this.config.levels) {
            for (const key of Object.keys(this.config.levels)) {
                const level = this.config.levels[key];
                if (level && level.theme && level.theme.ground) collect(level.theme.ground);
            }
        }
        for (const path of pathsToLoad) {
            try {
                await spriteManager.loadGroundTexture(path);
            } catch (e) {
                console.warn('Failed to load ground texture:', path, e);
            }
        }
    }

    initializeEntities() {
        const enemyManager = this.systems.get('enemies');
        const initialLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
        const levels = this.config.levels || {};
        const hubLevel = levels[0];
        const isHub = initialLevel === 0 && hubLevel;

        let playerStart = isHub ? hubLevel.playerStart : null;
        if (!isHub && levels[initialLevel] && levels[initialLevel].obstacles && levels[initialLevel].obstacles.useSceneTiles) {
            const obstacleManager = this.systems.get('obstacles');
            const suggested = obstacleManager && obstacleManager.getSuggestedPlayerStart ? obstacleManager.getSuggestedPlayerStart() : null;
            if (suggested) playerStart = suggested;
        }
        const player = this.createPlayer(playerStart);
        this.entities.add(player, 'player');

        const transform = player.getComponent(Transform);
        const cameraSystem = this.systems.get('camera');
        if (transform && cameraSystem) {
            const effectiveWidth = this.canvas.width / cameraSystem.zoom;
            const effectiveHeight = this.canvas.height / cameraSystem.zoom;
            cameraSystem.x = transform.x - effectiveWidth / 2;
            cameraSystem.y = transform.y - effectiveHeight / 2;
        }

        const obstacleManager = this.systems.get('obstacles');
        const playerSpawn = transform ? { x: transform.x, y: transform.y } : null;
        if (enemyManager && obstacleManager) {
            enemyManager.spawnLevelEnemies(initialLevel, this.entities, obstacleManager, playerSpawn);
        }

        if (!isHub) {
            const portalConfig = this.config.portal || { x: 2400, y: 1400, width: 80, height: 80 };
            const currentLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
            const levelKeys = this.config.levels ? Object.keys(this.config.levels).map(Number).filter(n => n > 0) : [1, 2, 3];
            const maxLevel = levelKeys.length ? Math.max(...levelKeys) : 3;
            this.playingState.portal = {
                x: portalConfig.x,
                y: portalConfig.y,
                width: portalConfig.width,
                height: portalConfig.height,
                spawned: false,
                targetLevel: Math.min(currentLevel + 1, maxLevel)
            };
        }
    }

    createPlayer(overrideStart: { x: number; y: number } | null = null) {
        const spriteManager = this.systems.get('sprites');
        const player = createPlayerEntity(overrideStart, {
            spriteManager,
            equippedWeaponKey: this.playingState.equippedWeaponKey,
            playerConfig: this.config.player
        });
        if (!this.playerInputController) {
            this.playerInputController = new PlayerInputController(this);
            this.playerInputController.setPlayer(player);
            this.playerInputController.bindAll();
        } else {
            this.playerInputController.setPlayer(player);
        }
        return player;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        });
        
        // Handle screen button clicks (scale to canvas buffer coords for correct hit-testing)
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            this.screenController.handleCanvasClick(x, y);
        });
    }

    bindGlobalInputHandlers() {
        if (!this.systems?.eventBus) return;
        this.screenController.bindGlobalKeys(this.systems.eventBus);
    }

    bindCombatFeedbackListeners() {
        if (!this.systems || !this.systems.eventBus) return;
        const cameraSystem = this.systems.get('camera');
        const damageNumberManager = this.systems.get('damageNumbers');

        // Register once so we don't get duplicate damage numbers when re-entering levels or restarting
        if (damageNumberManager) {
            this.systems.eventBus.on(EventTypes.DAMAGE_TAKEN, (data) => {
                damageNumberManager.createDamageNumber(
                    data.x,
                    data.y,
                    data.damage,
                    data.isPlayerDamage,
                    data.isBlocked
                );
                if (data.isPlayerDamage && data.entityId) {
                    this.playingState.lastHitEnemyId = data.entityId;
                }
            });
        }

        this.systems.eventBus.on(EventTypes.PLAYER_KILLED_ENEMY, () => {
            this.playingState.killsThisLife++;
        });
    }

    clearAllEntitiesAndProjectiles() {
        this.playingState.lastHitEnemyId = null;
        // Clear all entities
        const allEntities = this.entities.getAll();
        for (const entity of allEntities) {
            this.entities.remove(entity.id);
        }

        // Clear projectiles
        const projectileManager = this.systems.get('projectiles');
        if (projectileManager) {
            projectileManager.projectiles = [];
        }

        // Clear enemy-specific hazards (e.g. flame pillars)
        const hazardManager = this.systems.get('hazards');
        if (hazardManager && hazardManager.clearFlamePillars) {
            hazardManager.clearFlamePillars();
        }

        // Clear damage numbers
        const damageNumberManager = this.systems.get('damageNumbers');
        if (damageNumberManager) {
            damageNumberManager.numbers = [];
        }

        // Clear health orbs
        const healthOrbManager = this.systems.get('healthOrbs');
        if (healthOrbManager) {
            healthOrbManager.clear();
        }
    }

    resetEnemyManager(level) {
        const enemyManager = this.systems.get('enemies');
        if (!enemyManager) return;

        enemyManager.enemies = [];
        enemyManager.enemiesSpawned = false;
        enemyManager.currentLevel = level;
        enemyManager.enemiesKilledThisLevel = 0;

        if (enemyManager.clearFlamePillars) {
            enemyManager.clearFlamePillars();
        }
    }

    regenerateWorldForLevel(level) {
        const obstacleManager = this.systems.get('obstacles');
        if (!obstacleManager) return;

        obstacleManager.clearWorld();

        if (level === 0) {
            const hubLevel = this.config.levels && this.config.levels[0];
            if (hubLevel && hubLevel.walls) {
                for (const w of hubLevel.walls) {
                    obstacleManager.addObstacle(w.x, w.y, w.width, w.height, 'wall', null, { color: '#4a3020' });
                }
            }
            return;
        }

        const worldConfig = this.config.world;
        const levelConfig = this.config.levels && this.config.levels[level];
        const levelObstacles = levelConfig && levelConfig.obstacles
            ? levelConfig.obstacles
            : this.config.obstacles;
        const worldWidth = (levelConfig && levelConfig.worldWidth != null) ? levelConfig.worldWidth : worldConfig.width;
        const worldHeight = (levelConfig && levelConfig.worldHeight != null) ? levelConfig.worldHeight : worldConfig.height;

        const portalConfig = this.config.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        obstacleManager.generateWorld(worldWidth, worldHeight, levelObstacles, {
            x: portalConfig.x + portalConfig.width / 2,
            y: portalConfig.y + portalConfig.height / 2,
            radius: 120
        });
        this._currentWorldWidth = worldWidth;
        this._currentWorldHeight = worldHeight;
        const cameraSystem = this.systems.get('camera');
        const pathfindingSystem = this.systems.get('pathfinding');
        if (cameraSystem && cameraSystem.setWorldBounds) cameraSystem.setWorldBounds(worldWidth, worldHeight);
        if (pathfindingSystem && pathfindingSystem.setWorldBounds) pathfindingSystem.setWorldBounds(worldWidth, worldHeight);
    }

    quitToMainMenu() {
        this.clearAllEntitiesAndProjectiles();
        this.screenManager.setScreen('title');
        this.updateUIVisibility(false);
    }

    startGame() {
        const selectedLevel = this.screenManager.selectedStartLevel;
        const enemyManager = this.systems.get('enemies');
        const cameraSystem = this.systems.get('camera');
        const worldConfig = this.config.world;
        const levels = this.config.levels || {};
        const hubLevel = levels[0];

        this.clearAllEntitiesAndProjectiles();

        if (cameraSystem) {
            if (selectedLevel === 0 && hubLevel) {
                cameraSystem.setWorldBounds(hubLevel.width, hubLevel.height);
                // Center sanctuary in the canvas (avoid top-left load)
                const effectiveW = this.canvas.width / cameraSystem.zoom;
                const effectiveH = this.canvas.height / cameraSystem.zoom;
                cameraSystem.x = Math.max(0, Math.min(hubLevel.width - effectiveW, hubLevel.width / 2 - effectiveW / 2));
                cameraSystem.y = Math.max(0, Math.min(hubLevel.height - effectiveH, hubLevel.height / 2 - effectiveH / 2));
            } else {
                cameraSystem.setWorldBounds(worldConfig.width, worldConfig.height);
            }
        }

        this.regenerateWorldForLevel(selectedLevel);
        this.resetEnemyManager(selectedLevel);
        this.initializeEntities();

        if (selectedLevel === 0 && hubLevel) {
            this.playingState.portal = null;
            this.playingState.board = hubLevel.board ? { ...hubLevel.board } : null;
            this.playingState.boardOpen = false;
            this.playingState.boardUseCooldown = 0;
            this.playingState.playerNearBoard = false;
            this.playingState.chest = hubLevel.weaponChest ? { ...hubLevel.weaponChest } : null;
            this.playingState.chestOpen = false;
            this.playingState.chestUseCooldown = 0;
            this.playingState.playerNearChest = false;
            this.playingState.hubSelectedLevel = 1;
            this.screenManager.setScreen('hub');
        } else {
            this.screenManager.setScreen('playing');
        }
        this.updateUIVisibility(true);
    }
    
    restartGame() {
        const worldConfig = this.config.world;

        // Reset enemies and world back to level 1
        this.resetEnemyManager(1);
        this.regenerateWorldForLevel(1);

        // Clear all runtime entities and transient effects
        this.clearAllEntitiesAndProjectiles();

        // Reset camera
        const cameraSystem = this.systems.get('camera');
        if (cameraSystem) {
            cameraSystem.setZoom(1.0, this.canvas.width / 2, this.canvas.height / 2, this.canvas.width, this.canvas.height);
        }

        // Reinitialize entities (player + level 1 enemy spawns + portal)
        this.initializeEntities();
        this.screenManager.setScreen('playing');
        this.updateUIVisibility(true);
    }

    /** On death: return to Sanctuary (hub) with full health; player can then select level again. */
    returnToSanctuaryOnDeath() {
        this.screenManager.selectedStartLevel = 0;
        this.startGame();
    }
    
    updateUIVisibility(visible: boolean) {
        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.style.display = visible ? 'flex' : 'none';
        }
        if (!visible) {
            this.playingState.inventoryOpen = false;
            this.hudController.setInventoryPanelVisible(false);
        }
    }

    setCurrentWorldSize(width: number, height: number) {
        this._currentWorldWidth = width;
        this._currentWorldHeight = height;
    }

    handleCameraZoom() {
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');
        if (!inputSystem || !cameraSystem) return;

        const wheelDelta = inputSystem.getWheelDelta();
        if (wheelDelta === 0) return;

        const zoomChange = wheelDelta > 0 ? -this.config.camera.zoomSpeed : this.config.camera.zoomSpeed;
        const newZoom = cameraSystem.targetZoom + zoomChange;
        cameraSystem.setZoom(newZoom, inputSystem.mouseX, inputSystem.mouseY, this.canvas.width, this.canvas.height);
    }

    update(deltaTime: number) {
        if (this.screenManager.currentScreen === 'hub') {
            this.playingStateController.updateHub(deltaTime);
            this.hudController.update(this.entities.get('player'));
            return;
        }
        if (this.screenManager.currentScreen !== 'playing') {
            return;
        }

        // Handle camera zoom with mouse wheel
        this.handleCameraZoom();

        // Update player projectile cooldown
        if (this.playingState.playerProjectileCooldown > 0) {
            this.playingState.playerProjectileCooldown = Math.max(0, this.playingState.playerProjectileCooldown - deltaTime);
        }

        // Update crossbow reload (only when R has been pressed to begin reload)
        const player = this.entities.get('player');
        const combat = player ? player.getComponent(Combat) : null;
        const weapon = combat && combat.playerAttack ? combat.playerAttack.weapon : null;
        const isCrossbow = weapon && weapon.isRanged === true;
        const crossbowConfig = this.config.player.crossbow;
        if (isCrossbow && crossbowConfig && this.playingState.crossbowReloadInProgress && this.playingState.crossbowReloadProgress < 1) {
            this.playingState.crossbowReloadProgress = Math.min(1, this.playingState.crossbowReloadProgress + deltaTime / crossbowConfig.reloadTime);
            if (this.playingState.crossbowReloadProgress >= 1) this.playingState.crossbowReloadInProgress = false;
        }
        if (player && combat && !isCrossbow) {
            this.playingState.crossbowReloadProgress = 1;
            this.playingState.crossbowReloadInProgress = false;
            this.playingState.crossbowPerfectReloadNext = false;
        }
        // Expose crossbow state on player for rendering (reload bar under floating health bar)
        if (player && isCrossbow) {
            player.crossbowReloadProgress = this.playingState.crossbowReloadProgress;
            player.crossbowReloadInProgress = this.playingState.crossbowReloadInProgress;
        }

        // Update all systems (single tick; includes entities, damageNumbers, projectiles, hazards, healthOrbs, gatherables)
        this.systems.update(deltaTime);
        
        // Handle player attacks
        if (player) {
            const combat = player.getComponent(Combat);
            // Flush buffered attack same frame attack ends (no setTimeout delay)
            if (combat && combat.isPlayer && !combat.isAttacking && combat.attackInputBuffered) {
                combat.tryFlushBufferedAttack();
            }
            const enemyManager = this.systems.get('enemies');
            
            // Check if player attacks hit any enemies
            enemyManager.checkPlayerAttack(player);
            
            // Handle enemy attacks on player
            enemyManager.checkEnemyAttacks(player);
            
            // Update player healing (drinking/regen timers, charge regen)
            const healing = player.getComponent(PlayerHealing);
            if (healing) healing.update(deltaTime);

            // Check for player death
            const health = player.getComponent(Health);
            if (health && health.isDead && this.screenManager.isScreen('playing')) {
                this.playingState.killsThisLife = 0; // reset for next life
                this.screenManager.setScreen('death');
                this.updateUIVisibility(false);
            }
        }
        
        // Update camera to follow player (faster follow during attack dash so spin doesn't make player leave frame)
        if (player) {
            const transform = player.getComponent(Transform);
            const cameraSystem = this.systems.get('camera');
            const movement = player.getComponent(Movement);
            if (transform && cameraSystem) {
                const fastFollow = movement && movement.isAttackDashing === true;
                cameraSystem.follow(transform, this.canvas.width, this.canvas.height, { fastFollow });
            }
        }

        this.playingStateController.updatePortal(deltaTime, player);
        this.hudController.update(player);
    }

    setInventoryPanelVisible(visible: boolean) {
        this.hudController.setInventoryPanelVisible(visible);
    }

    refreshInventoryPanel() {
        this.hudController.refreshInventoryPanel();
    }

    /** Get enemy entity at screen position (for hover tooltip). Returns null if none. */
    getEnemyAtScreenPoint(screenX, screenY) {
        const cameraSystem = this.systems && this.systems.get('camera');
        if (!cameraSystem) return null;
        const { x: wx, y: wy } = cameraSystem.screenToWorld(screenX, screenY);
        for (const entity of this.entities.getAll()) {
            const renderable = entity.getComponent(Renderable);
            const health = entity.getComponent(Health);
            if (!renderable || renderable.type !== 'enemy' || !health || health.isDead) continue;
            const transform = entity.getComponent(Transform);
            if (!transform) continue;
            if (wx >= transform.left && wx <= transform.right && wy >= transform.top && wy <= transform.bottom) {
                return entity;
            }
        }
        return null;
    }

    /** Format enemy type key as display name (e.g. goblinChieftain -> Goblin Chieftain). */
    getEnemyDisplayName(enemyTypeKey) {
        if (!enemyTypeKey) return 'Enemy';
        const displayNames = { banditDagger: 'Bandit' };
        if (displayNames[enemyTypeKey]) return displayNames[enemyTypeKey];
        const withSpaces = enemyTypeKey
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/_/g, ' ');
        return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
    }

    /** Draw only the title or death screen (shared path). Call once after setScreen('title') or from render(). */
    renderTitleOrDeathScreen() {
        if (!this.screenManager?.isScreen('title') && !this.screenManager?.isScreen('death')) return;
        if (!this.ctx || !this.canvas) return;
        if (!this.canvas.width || !this.canvas.height) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#0a0806';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.screenManager.render(this.settings);
    }

    render() {
        try {
            if (this.screenManager.isScreen('title') || this.screenManager.isScreen('death')) {
                this.renderTitleOrDeathScreen();
                return;
            }

            const renderSystem = this.systems.get('render');
            const cameraSystem = this.systems.get('camera');
            const obstacleManager = this.systems.get('obstacles');
            const worldConfig = this.config.world;

            if (!renderSystem || !cameraSystem) {
                console.error('Missing render or camera system');
                return;
            }

            const inHubContext = this.screenManager.isScreen('hub') ||
                ((this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings') || this.screenManager.isScreen('settings-controls')) && this.playingState.screenBeforePause === 'hub');
            if (inHubContext) {
                const hubConfig = this.config.hub;
                try {
                    renderSystem.clear();
                    renderSystem.renderWorld(cameraSystem, obstacleManager, 0, hubConfig.width, hubConfig.height);
                    if (this.playingState.board) {
                        renderSystem.renderBoard(this.playingState.board, cameraSystem);
                        if (this.playingState.playerNearBoard) {
                            renderSystem.renderBoardInteractionPrompt(this.playingState.board, cameraSystem, true);
                        }
                    }
                    if (this.playingState.chest) {
                        renderSystem.renderChest(this.playingState.chest, cameraSystem);
                        if (this.playingState.playerNearChest) {
                            renderSystem.renderChestInteractionPrompt(this.playingState.chest, cameraSystem, true);
                        }
                    }
                    const hubEntities = this.entities.getAll();
                    renderSystem.renderEntities(hubEntities, cameraSystem);
                } finally {
                    // Always reset context and draw UI so minimap/level select work even if entity render threw
                    this.ctx.globalAlpha = 1;
                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                    if (this.settings.showMinimap) {
                        renderSystem.renderMinimap(cameraSystem, this.entities, hubConfig.width, hubConfig.height, null, 0);
                    }
                    if (this.playingState.boardOpen) {
                        this.screenManager.renderHubBoardOverlay(this.playingState.hubSelectedLevel);
                    }
                    if (this.playingState.chestOpen) {
                        this.screenManager.renderWeaponChestOverlay(this.playingState.equippedWeaponKey);
                    }
                    if (this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings') || this.screenManager.isScreen('settings-controls')) {
                        this.screenManager.render(this.settings);
                    }
                }
                return;
            }

            // Game world and entities (draw for both 'playing' and 'pause' so pause shows over frozen frame)
            const currentLevel = this.systems.get('enemies') ? this.systems.get('enemies').getCurrentLevel() : 1;
            try {
                renderSystem.clear();
                renderSystem.renderWorld(cameraSystem, obstacleManager, currentLevel, null, null);
                if (this.playingState.portal) {
                    renderSystem.renderPortal(this.playingState.portal, cameraSystem);
                    if (this.playingState.playerNearPortal) {
                        renderSystem.renderPortalInteractionPrompt(this.playingState.portal, cameraSystem, this.playingState.playerNearPortal);
                    }
                }
                const gatherableManager = this.systems.get('gatherables');
                if (gatherableManager) {
                    gatherableManager.render(this.ctx, cameraSystem);
                }
                const entities = this.entities.getAll();
                if (entities.length === 0) {
                    console.warn('No entities to render');
                }
                renderSystem.renderEntities(entities, cameraSystem, obstacleManager, currentLevel);
                if (gatherableManager) {
                    const playerEntity = this.entities.get('player');
                    if (playerEntity) {
                        gatherableManager.renderInteractPrompt(this.ctx, cameraSystem, playerEntity);
                        gatherableManager.renderGatherRing(this.ctx, cameraSystem, playerEntity);
                    }
                }
                const projectileManager = this.systems.get('projectiles');
                if (projectileManager) {
                    projectileManager.render(this.ctx, cameraSystem);
                }
                const hazardManager = this.systems.get('hazards');
                if (hazardManager && hazardManager.renderFlamePillars) {
                    hazardManager.renderFlamePillars(this.ctx, cameraSystem);
                }
                const damageNumberManager = this.systems.get('damageNumbers');
                if (damageNumberManager) {
                    damageNumberManager.render(this.ctx, cameraSystem);
                }
                const healthOrbManager = this.systems.get('healthOrbs');
                if (healthOrbManager) {
                    healthOrbManager.render(this.ctx, cameraSystem);
                }
            } finally {
                // Always reset context and draw UI so minimap/pause work even if entity render threw
                this.ctx.globalAlpha = 1;
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                if (this.settings.showMinimap) {
                    const w = this._currentWorldWidth != null ? this._currentWorldWidth : worldConfig.width;
                    const h = this._currentWorldHeight != null ? this._currentWorldHeight : worldConfig.height;
                    renderSystem.renderMinimap(cameraSystem, this.entities, w, h, this.playingState.portal, currentLevel);
                }
                if (this.screenManager.isScreen('playing')) {
                    const inputSystem = this.systems.get('input');
                    const hoveredEnemy = inputSystem ? this.getEnemyAtScreenPoint(inputSystem.mouseX, inputSystem.mouseY) : null;
                    const lastHitEntity = this.playingState.lastHitEnemyId ? this.entities.get(this.playingState.lastHitEnemyId) : null;
                    const lastHitValid = lastHitEntity && lastHitEntity.getComponent(Renderable)?.type === 'enemy' && lastHitEntity.getComponent(Health) && !lastHitEntity.getComponent(Health).isDead;
                    const tooltipEnemy = hoveredEnemy || (lastHitValid ? lastHitEntity : null);
                    if (tooltipEnemy) {
                        const ai = tooltipEnemy.getComponent(AI);
                        const statusEffects = tooltipEnemy.getComponent(StatusEffects);
                        const health = tooltipEnemy.getComponent(Health);
                        const displayName = this.getEnemyDisplayName(ai ? ai.enemyType : null);
                        const packModifiers = this.config.packModifiers || {};
                        const rawMod = (statusEffects && statusEffects.packModifierName) || (ai && ai.packModifierName);
                        const modifierName = (rawMod && typeof rawMod === 'string' && rawMod.trim() && packModifiers[rawMod.trim()])
                            ? rawMod.trim() : null;
                        const modDef = modifierName ? packModifiers[modifierName] : null;
                        const modifierDesc = modifierName && modDef ? this.screenManager.getPackModifierDescription(modifierName, modDef) : '';
                        this.screenManager.renderEnemyTooltip(displayName, modifierName, modifierDesc, health ? health.percent : null);
                    }
                }
                if (this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings') || this.screenManager.isScreen('settings-controls') || this.screenManager.isScreen('help')) {
                    this.screenManager.render(this.settings);
                }
            }
        } catch (error) {
            console.error('Render error:', error);
        }
    }

    gameLoop() {
        if (!this.running) return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    }

    start() {
        this.gameLoop();
    }

    stop() {
        this.running = false;
    }
}

export { Game };

