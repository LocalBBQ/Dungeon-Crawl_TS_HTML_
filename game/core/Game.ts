// Main game class - orchestrates all systems
import '../bootstrap.js';

import { EntityManager } from '../managers/EntityManager.js';
import { GameConfig } from '../config/GameConfig.js';
import { DELVE_LEVEL, DRAGON_ARENA_LEVEL } from '../config/questConfig.js';
import { ScreenManager } from './ScreenManager.js';
import { SystemManager, type SystemLike } from './SystemManager.js';
import { SpriteManager } from '../managers/SpriteManager.js';
import { InputSystem } from '../systems/InputSystem.js';
import { CameraSystem } from '../systems/CameraSystem.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { ObstacleManager } from '../managers/ObstacleManager.js';
import { GatherableManager } from '../managers/GatherableManager.js';
import { PathfindingSystem } from '../systems/PathfindingSystem.js';
import { EnemyManager } from '../managers/EnemyManager.js';
import { HazardManager } from '../managers/HazardManager.js';
import { DamageNumberManager } from '../managers/DamageNumberManager.js';
import { ProjectileManager } from '../managers/ProjectileManager.js';
import { PickupManager } from '../managers/PickupManager.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { Entity } from '../entities/Entity.js';
import { Transform } from '../components/Transform.js';
import { Health } from '../components/Health.js';
import { Rally } from '../components/Rally.js';
import { StatusEffects } from '../components/StatusEffects.js';
import { Stamina } from '../components/Stamina.js';
import { PlayerHealing } from '../components/PlayerHealing.js';
import { PlayerMovement } from '../components/PlayerMovement.js';
import { Combat } from '../components/Combat.js';
import { Renderable } from '../components/Renderable.js';
import { Sprite } from '../components/Sprite.js';
import { Animation } from '../components/Animation.js';
import { PlayerInputController, type GameLike } from '../controllers/PlayerInputController.js';
import { InventoryChestUIController } from '../controllers/InventoryChestUIController.js';
import { EventTypes } from './EventTypes.js';
import { Movement } from '../components/Movement.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { getEffectiveWeapon } from '../weapons/resolveEffectiveWeapon.js';
import { getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import type { GameRef, GameConfigShape } from '../types/index.js';
import type { GameSystems } from '../types/systems.js';
import { PlayingState, INVENTORY_SLOT_COUNT, MAX_WEAPON_DURABILITY, MAX_ARMOR_DURABILITY } from '../state/PlayingState.js';
import {
    equipFromChest,
    equipFromChestToHand,
    equipFromInventory,
    putInChestFromEquipment,
    putInChestFromInventory,
    setInventorySlot,
    swapEquipmentWithEquipment,
    swapEquipmentWithInventory,
    swapInventorySlots,
    unequipToInventory
} from '../state/InventoryActions.js';
import { equipArmorFromInventory, unequipArmorToInventory, swapArmorWithInventory, swapArmorWithArmor, canEquipArmorInSlot } from '../state/ArmorActions.js';
import { getArmor, SHOP_ARMOR_ENTRIES } from '../armor/armorConfigs.js';
import { createPlayer as createPlayerEntity, type PlayerConfigLike, type SpriteManagerLike } from './PlayerFactory.js';
import { ScreenController } from './ScreenController.js';
import { PlayingStateController } from './PlayingStateController.js';
import { HUDController } from '../ui/HUDController.js';
import { updateCrossbowReload } from '../utils/crossbowReload.js';
import { AI } from '../components/AI.js';
import { renderQuestCompleteFlair } from '../ui/QuestCompleteFlair.js';
import {
    renderInventory,
    renderChest,
    renderShop,
    renderDragGhost,
    getInventoryLayout,
    getChestLayout,
    getShopLayout,
    hitTestInventory,
    hitTestChest,
    hitTestShop,
    createDragState,
    ensureInventoryInitialized,
    type DragState
} from '../ui/InventoryChestCanvas.js';
import {
    renderRerollOverlay,
    getRerollOverlayLayout,
    hitTestRerollOverlay
} from '../ui/RerollOverlay.js';
import { hitTestMinimapZoomButtons, MINIMAP_ZOOM_MIN, MINIMAP_ZOOM_MAX, MINIMAP_ZOOM_STEP } from '../systems/renderers/MinimapRenderer.js';
import { rerollEnchantSlot, moveToRerollSlot, moveFromRerollSlotTo, addWeaponToInventory, addWhetstoneToInventory, useWhetstoneOnWeapon } from '../state/InventoryActions.js';
import type { TooltipHover } from '../types/tooltip.js';

export type { TooltipHover };

class Game {
    canvas!: HTMLCanvasElement;
    ctx!: CanvasRenderingContext2D;
    entities!: EntityManager;
    systems: SystemManager | null = null;
    config!: GameConfigShape;
    playingState!: PlayingState;
    settings!: Record<string, unknown>;
    screenManager!: ScreenManager | null;
    hudController!: HUDController;
    playingStateController!: PlayingStateController;
    screenController!: ScreenController;
    playerInputController!: PlayerInputController;
    running = false;
    lastTime = 0;
    _currentWorldWidth = 0;
    _currentWorldHeight = 0;

    inventoryDragState!: DragState;
    /** Set when pointer is over a weapon or armor slot (chest/inventory); cleared when moving away or closing. */
    tooltipHover: TooltipHover = null;
    inventoryChestUIController!: InventoryChestUIController;

    /** Type-safe systems access; only use after systems are initialized. */
    private get systemsTyped(): GameSystems {
        return this.systems!.getTyped();
    }

    constructor() {
        try {
            this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
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

            const defaultWeapon = this.config.player?.defaultWeapon ?? 'sword_rusty';
            const defaultOffhand = this.config.player?.defaultOffhand ?? 'none';
            this.playingState = new PlayingState(defaultWeapon, defaultOffhand);
            this.inventoryDragState = createDragState();

            // Game-wide settings (toggled from pause/settings screen)
            this.settings = {
                musicEnabled: true,
                sfxEnabled: true,
                showMinimap: true,
                minimapZoom: 1,
                useCharacterSprites: false,  // Player + enemies use sprite sheets vs procedural canvas knight
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
                this.inventoryChestUIController = new InventoryChestUIController({
                    playingState: this.playingState,
                    canvas: this.canvas,
                    settings: this.settings,
                    screenManager: this.screenManager,
                    inventoryDragState: this.inventoryDragState,
                    refreshInventoryPanel: () => this.refreshInventoryPanel(),
                    syncCombat: () => this.syncPlayerWeaponsFromState(),

                    setTooltipHover: (v) => { this.tooltipHover = v; },
                    setInventoryPanelVisible: (v) => this.hudController.setInventoryPanelVisible(v),
                });
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

    /** Timestamp until which Space/Enter dodge should be suppressed (e.g. after pressing Space to leave title/death). */
    suppressDodgeUntil = 0;

    /** Clear key/mouse state and cancel charge/movement so opening a menu doesn't cause accidental attack/move on close. */
    clearPlayerInputsForMenu(): void {
        const inputSystem = this.systems ? this.systemsTyped.input : undefined;
        if (inputSystem?.clearAllKeys) inputSystem.clearAllKeys();
        this.playerInputController?.cancelMenuInputs();
    }

    /** Sync player Combat component from playingState (mainhand/offhand). Used after equip/unequip from inventory or chest. */
    syncPlayerWeaponsFromState(): void {
        this.hudController?.syncPlayerWeaponsFromState?.();
    }

    get inventoryOpen() { return this.playingState.inventoryOpen; }
    set inventoryOpen(v) { this.playingState.inventoryOpen = v; }
    get chestOpen() { return this.playingState.chestOpen; }
    set chestOpen(v) { this.playingState.chestOpen = v; }
    get shopOpen() { return this.playingState.shopOpen; }
    set shopOpen(v) { this.playingState.shopOpen = v; }
    get boardOpen() { return this.playingState.boardOpen; }
    set boardOpen(v) { this.playingState.boardOpen = v; }
    /** True when the last mousedown was over inventory/chest/shop UI; attack/block should ignore that click. Cleared on matching mouseup. */
    private lastPointerDownConsumedByUI = false;
    get pointerDownConsumedByUI(): boolean { return this.lastPointerDownConsumedByUI; }
    clearPointerDownConsumedByUI(): void { this.lastPointerDownConsumedByUI = false; }
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
        
        // Initialize screen manager after canvas is set up (callback clears inputs when entering menu screens)
        this.screenManager = new ScreenManager(this.canvas, this.ctx, () => this.clearPlayerInputsForMenu());
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

        this.systems.register('playingState', this.playingState as unknown as SystemLike);

        this.systems.register('entities', this.entities);

        // Register sprite manager first
        const spriteManager = new SpriteManager();
        this.systems.register('sprites', spriteManager as unknown as SystemLike);

        // Register core systems in order (do not register Game as a system — SystemManager.update would call Game.update recursively)
        this.systems
            .register('input', new InputSystem(this.canvas))
            .register('camera', new CameraSystem(initialWorldWidth, initialWorldHeight))
            .register('collision', new CollisionSystem())
            .register('obstacles', new ObstacleManager())
            .register('gatherables', new GatherableManager(this.playingState));

        const obstacleManager = this.systemsTyped.obstacles;
        if (obstacleManager && obstacleManager.init) obstacleManager.init(this.systems!);

        // Generate world before pathfinding (use level 1 config and dimensions)
        const level1Obstacles = level1Config && level1Config.obstacles ? level1Config.obstacles : this.config.obstacles;
        obstacleManager.generateWorld(initialWorldWidth, initialWorldHeight, level1Obstacles as Record<string, unknown>, {
            x: initialWorldWidth / 2,
            y: initialWorldHeight / 2,
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
            .register('pickups', new PickupManager())
            .register('render', new RenderSystem(this.canvas, this.ctx));

        // Initialize render system with systems reference and game settings (needed for attack/hitbox rendering)
        const renderSystem = this.systemsTyped.render;
        if (renderSystem) {
            if (renderSystem.init) renderSystem.init(this.systems);
            renderSystem.settings = this.settings;
        }

        // Explicit update order: input first, then logic/managers, then entities, then render last
        this.systems.setUpdateOrder([
            'input', 'camera', 'collision', 'obstacles', 'gatherables', 'pathfinding',
            'enemies', 'hazards', 'damageNumbers', 'projectiles', 'pickups',
            'entities', 'render'
        ]);
    }

    async loadPlayerSprites() {
        const spriteManager = this.systemsTyped.sprites;
        if (!spriteManager) return;

        const loadedKnightSheets: Record<string, string | boolean> = {};
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
        const spriteManager = this.systemsTyped.sprites;
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
        const spriteManager = this.systemsTyped.sprites;
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
        const enemyManager = this.systemsTyped.enemies;
        const initialLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
        const levels = this.config.levels || {};
        const hubLevel = levels[0];
        const isHub = initialLevel === 0 && hubLevel;

        let playerStart = isHub ? hubLevel.playerStart : null;
        if (!isHub && levels[initialLevel] && levels[initialLevel].obstacles && (levels[initialLevel].obstacles as { useSceneTiles?: boolean }).useSceneTiles) {
            const obstacleManager = this.systemsTyped.obstacles;
            const suggested = obstacleManager && obstacleManager.getSuggestedPlayerStart ? obstacleManager.getSuggestedPlayerStart() : null;
            if (suggested) playerStart = suggested;
        }
        const player = this.createPlayer(playerStart);
        this.entities.add(player, 'player');

        if (isHub && (this.playingState.savedSanctuaryHealth != null || this.playingState.savedSanctuaryStamina != null)) {
            const health = player.getComponent(Health);
            const stamina = player.getComponent(Stamina);
            if (health != null && this.playingState.savedSanctuaryHealth != null) {
                health.currentHealth = Math.min(health.maxHealth, Math.max(0, this.playingState.savedSanctuaryHealth));
            }
            if (stamina != null && this.playingState.savedSanctuaryStamina != null) {
                stamina.currentStamina = Math.min(stamina.maxStamina, Math.max(0, this.playingState.savedSanctuaryStamina));
            }
            this.playingState.savedSanctuaryHealth = undefined;
            this.playingState.savedSanctuaryStamina = undefined;
        }

        const transform = player.getComponent(Transform);
        const cameraSystem = this.systemsTyped.camera;
        if (transform && cameraSystem) {
            const effectiveWidth = this.canvas.width / cameraSystem.zoom;
            const effectiveHeight = this.canvas.height / cameraSystem.zoom;
            cameraSystem.x = transform.x - effectiveWidth / 2;
            cameraSystem.y = transform.y - effectiveHeight / 2;
        }

        const obstacleManager = this.systemsTyped.obstacles;
        const playerSpawn = transform ? { x: transform.x, y: transform.y } : null;
        if (enemyManager && obstacleManager) {
            enemyManager.spawnLevelEnemies(initialLevel, this.entities, obstacleManager, playerSpawn);
        }
        if (isHub && hubLevel?.trainingDummy && enemyManager) {
            const td = hubLevel.trainingDummy;
            enemyManager.spawnEnemy(td.x, td.y, 'trainingDummy', this.entities);
        }

        if (!isHub) {
            const portalConfig = this.config.portal || { x: 2360, y: 2360, width: 80, height: 80 };
            const currentLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
            const levelConfigForWorld = this.config.levels && this.config.levels[currentLevel];
            const w = (levelConfigForWorld && levelConfigForWorld.worldWidth != null) ? levelConfigForWorld.worldWidth : this.config.world.width;
            const h = (levelConfigForWorld && levelConfigForWorld.worldHeight != null) ? levelConfigForWorld.worldHeight : this.config.world.height;
            const levelKeys = this.config.levels ? Object.keys(this.config.levels).map(Number).filter(n => n > 0) : [1, 2, 3];
            const maxLevel = levelKeys.length ? Math.max(...levelKeys) : 3;
            const isDelve = currentLevel === DELVE_LEVEL;
            const isDragonArena = currentLevel === DRAGON_ARENA_LEVEL;
            const portalTargetLevel = isDragonArena ? 0 : (isDelve ? DELVE_LEVEL : Math.min(currentLevel + 1, maxLevel));
            this.playingState.portal = {
                x: w / 2 - portalConfig.width / 2,
                y: h / 2 - portalConfig.height / 2,
                width: portalConfig.width,
                height: portalConfig.height,
                spawned: false,
                targetLevel: portalTargetLevel,
                hasNextLevel: isDelve || isDragonArena || currentLevel < maxLevel
            };
        }
    }

    createPlayer(overrideStart: { x: number; y: number } | null = null) {
        const spriteManager = this.systemsTyped.sprites;
        const player = createPlayerEntity(overrideStart, {
            spriteManager: spriteManager as SpriteManagerLike,
            equippedMainhandKey: this.playingState.equippedMainhandKey,
            equippedOffhandKey: this.playingState.equippedOffhandKey,
            playerConfig: { ...this.config.player, color: this.config.player.color ?? '#8b8b9a' } as PlayerConfigLike
        });
        if (!this.playerInputController) {
            this.playerInputController = new PlayerInputController(this as unknown as GameLike);
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
            const { x, y } = this.getCanvasCoords(e);
            if (this.handleInventoryChestClick(x, y, e)) {
                e.preventDefault();
                return;
            }
            if (this.handleMinimapZoomClick(x, y)) {
                e.preventDefault();
                return;
            }
            this.screenController.handleCanvasClick(x, y);
        });
        this.canvas.addEventListener('dblclick', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            if (this.handleInventoryChestDoubleClick(x, y)) e.preventDefault();
        });

        // Pointer events for inventory/chest drag-and-drop (skip drag when Ctrl held so ctrl+click only runs once)
        // Use capture so we run before InputSystem and can mark clicks on UI (so attack/block are not triggered)
        this.canvas.addEventListener('mousedown', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            this.lastPointerDownConsumedByUI = this.isPointerOverInventoryOrChestOrShopUI(x, y) ||
                (this.settings.showMinimap && hitTestMinimapZoomButtons(this.canvas.width, this.canvas.height, x, y) !== null);
            if (this.handleInventoryChestPointerDown(x, y, e.ctrlKey)) e.preventDefault();
        }, true);
        this.canvas.addEventListener('mousemove', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            this.handleInventoryChestPointerMove(x, y);
        });
        this.canvas.addEventListener('mouseup', (e) => {
            const { x, y } = this.getCanvasCoords(e);
            if (this.handleInventoryChestPointerUp(x, y)) e.preventDefault();
        });
    }

    bindGlobalInputHandlers() {
        if (!this.systems?.eventBus) return;
        this.screenController.bindGlobalKeys(this.systems.eventBus as { on(event: string, fn: (key: string) => void): void });
    }

    bindCombatFeedbackListeners() {
        if (!this.systems || !this.systems.eventBus) return;
        const cameraSystem = this.systemsTyped.camera;
        const damageNumberManager = this.systemsTyped.damageNumbers;

        // Register once so we don't get duplicate damage numbers when re-entering levels or restarting
        if (damageNumberManager) {
            this.systems.eventBus.onTyped(EventTypes.DAMAGE_TAKEN, (data) => {
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

        this.systems.eventBus.onTyped(EventTypes.PLAYER_KILLED_ENEMY, (payload) => {
            this.playingState.killsThisLife++;
            if (this.playingState.delveFloor > 0 && typeof payload.x === 'number' && typeof payload.y === 'number') {
                this.playingState.lastEnemyKillX = payload.x;
                this.playingState.lastEnemyKillY = payload.y;
            }
        });

        const pickupManager = this.systemsTyped.pickups;
        if (pickupManager) {
            pickupManager.onGoldCollected = (amount: number) => {
                let mult = this.playingState.questGoldMultiplier ?? 1;
                if (this.playingState.delveFloor > 0) {
                    mult *= 1 + (this.playingState.delveFloor - 1) * 0.2;
                }
                this.playingState.gold += amount * mult;
            };
            pickupManager.onWeaponCollected = (instance) => {
                addWeaponToInventory(this.playingState, instance);
                this.refreshInventoryPanel();
            };
            pickupManager.onWhetstoneCollected = () => {
                const added = addWhetstoneToInventory(this.playingState);
                if (added) this.refreshInventoryPanel();
                return added;
            };
        }

        this.systems.eventBus.onTyped(EventTypes.PLAYER_HIT_ENEMY, () => {
            const ps = this.playingState;
            if (ps.equippedMainhandDurability > 0) {
                ps.equippedMainhandDurability = Math.max(0, ps.equippedMainhandDurability - 1);
                if (ps.equippedMainhandDurability === 0 && ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') {
                    unequipToInventory(ps, 'mainhand', undefined, 0, () => this.syncPlayerWeaponsFromState());
                }
            }
        });

        this.systems.eventBus.onTyped(EventTypes.DAMAGE_TAKEN, (data) => {
            if (data.isPlayerDamage || !data.isBlocked) return;
            const ps = this.playingState;
            // Parry: rally already added in EnemyManager/ProjectileManager; don't consume offhand durability (greatsword has no offhand)
            if (data.isParry) return;
            if (ps.equippedOffhandDurability > 0) {
                ps.equippedOffhandDurability = Math.max(0, ps.equippedOffhandDurability - 1);
                if (ps.equippedOffhandDurability === 0 && ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none') {
                    unequipToInventory(ps, 'offhand', undefined, 0, () => this.syncPlayerWeaponsFromState());
                }
            }
            // Rally: when player has defender equipped, add blocked damage to rally pool
            if (ps.equippedOffhandKey?.startsWith('defender') && (data.damage ?? 0) > 0) {
                const player = this.entities.get('player');
                const rally = player?.getComponent(Rally);
                if (rally) rally.addToPool(data.damage!);
            }
        });

        // Armor durability: when player takes damage, decrement each equipped piece; unequip at 0 and put in bag
        this.systems.eventBus.onTyped(EventTypes.DAMAGE_TAKEN, (data) => {
            if (data.entityId !== 'player' || (data.damage ?? 0) <= 0) return;
            const ps = this.playingState;
            const decrement = Math.max(1, Math.floor((data.damage ?? 0) / 10));
            const putBrokenInInventory = (key: string): void => {
                if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return;
                const empty = ps.inventorySlots.findIndex((s) => s == null);
                if (empty >= 0) ps.inventorySlots[empty] = { key, durability: 0 };
            };

            if (ps.equippedArmorHeadKey && ps.equippedArmorHeadKey !== 'none' && ps.equippedArmorHeadDurability > 0) {
                ps.equippedArmorHeadDurability = Math.max(0, ps.equippedArmorHeadDurability - decrement);
                if (ps.equippedArmorHeadDurability === 0) {
                    const k = ps.equippedArmorHeadKey;
                    ps.equippedArmorHeadKey = 'none';
                    ps.equippedArmorHeadDurability = MAX_ARMOR_DURABILITY;
                    putBrokenInInventory(k);
                }
            }
            if (ps.equippedArmorChestKey && ps.equippedArmorChestKey !== 'none' && ps.equippedArmorChestDurability > 0) {
                ps.equippedArmorChestDurability = Math.max(0, ps.equippedArmorChestDurability - decrement);
                if (ps.equippedArmorChestDurability === 0) {
                    const k = ps.equippedArmorChestKey;
                    ps.equippedArmorChestKey = 'none';
                    ps.equippedArmorChestDurability = MAX_ARMOR_DURABILITY;
                    putBrokenInInventory(k);
                }
            }
            if (ps.equippedArmorHandsKey && ps.equippedArmorHandsKey !== 'none' && ps.equippedArmorHandsDurability > 0) {
                ps.equippedArmorHandsDurability = Math.max(0, ps.equippedArmorHandsDurability - decrement);
                if (ps.equippedArmorHandsDurability === 0) {
                    const k = ps.equippedArmorHandsKey;
                    ps.equippedArmorHandsKey = 'none';
                    ps.equippedArmorHandsDurability = MAX_ARMOR_DURABILITY;
                    putBrokenInInventory(k);
                }
            }
            if (ps.equippedArmorFeetKey && ps.equippedArmorFeetKey !== 'none' && ps.equippedArmorFeetDurability > 0) {
                ps.equippedArmorFeetDurability = Math.max(0, ps.equippedArmorFeetDurability - decrement);
                if (ps.equippedArmorFeetDurability === 0) {
                    const k = ps.equippedArmorFeetKey;
                    ps.equippedArmorFeetKey = 'none';
                    ps.equippedArmorFeetDurability = MAX_ARMOR_DURABILITY;
                    putBrokenInInventory(k);
                }
            }
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
        const projectileManager = this.systemsTyped.projectiles;
        if (projectileManager) {
            projectileManager.projectiles = [];
        }

        // Clear enemy-specific hazards (e.g. flame pillars)
        const hazardManager = this.systemsTyped.hazards;
        if (hazardManager && hazardManager.clearFlamePillars) {
            hazardManager.clearFlamePillars();
        }

        // Clear damage numbers
        const damageNumberManager = this.systemsTyped.damageNumbers;
        if (damageNumberManager) {
            damageNumberManager.damageNumbers = [];
        }

        // Clear all pickups (gold, weapon, whetstone, health orb)
        const pickupManager = this.systemsTyped.pickups;
        if (pickupManager) {
            pickupManager.clear();
        }
    }

    resetEnemyManager(level: number) {
        const enemyManager = this.systemsTyped.enemies;
        if (!enemyManager) return;

        enemyManager.enemies = [];
        enemyManager.enemiesSpawned = false;
        enemyManager.currentLevel = level;
        enemyManager.enemiesKilledThisLevel = 0;
        if ('pendingSceneTileSpawns' in enemyManager && Array.isArray(enemyManager.pendingSceneTileSpawns)) enemyManager.pendingSceneTileSpawns.length = 0;
        if ('pendingPackSpawns' in enemyManager && Array.isArray(enemyManager.pendingPackSpawns)) enemyManager.pendingPackSpawns.length = 0;

        const hazardManager = this.systemsTyped.hazards;
        if (hazardManager?.clearFlamePillars) {
            hazardManager.clearFlamePillars();
        }
    }

    regenerateWorldForLevel(level) {
        const obstacleManager = this.systemsTyped.obstacles;
        if (!obstacleManager) return;

        obstacleManager.clearWorld();

        if (level === 0) {
            const hubLevel = this.config.levels && this.config.levels[0];
            const hubConfig = this.config.hub;
            type FenceConfig = { originX: number; originY: number; width: number; height: number; spacing?: number; size?: number; gapSide?: string; gapWidth?: number; fenceColor?: string };
            type DecorationItem = { type: string; x: number; y: number; width?: number; height?: number };
            const rawFence = hubConfig?.fence ?? hubLevel?.fence;
            const fenceConfig: FenceConfig | undefined = rawFence as FenceConfig | undefined;
            if (fenceConfig && typeof obstacleManager.addRectPerimeterFence === 'function') {
                obstacleManager.addRectPerimeterFence(
                    fenceConfig.originX,
                    fenceConfig.originY,
                    fenceConfig.width,
                    fenceConfig.height,
                    {
                        spacing: fenceConfig.spacing,
                        size: fenceConfig.size,
                        gapSide: (fenceConfig.gapSide === 'top' || fenceConfig.gapSide === 'left' || fenceConfig.gapSide === 'right' ? fenceConfig.gapSide : 'bottom'),
                        gapWidth: fenceConfig.gapWidth,
                        fenceColor: fenceConfig.fenceColor,
                    }
                );
            } else if (hubLevel?.walls) {
                const wallColor = (hubLevel.wallColor ?? hubConfig?.wallColor) ?? '#6b5b4f';
                for (const w of hubLevel.walls) {
                    obstacleManager.addObstacle(w.x, w.y, w.width, w.height, 'wall', null, { color: wallColor });
                }
            }
            const rawDecorations = hubConfig?.decorations ?? hubLevel?.decorations;
            const decorations: DecorationItem[] | undefined = Array.isArray(rawDecorations) ? (rawDecorations as DecorationItem[]) : undefined;
            if (decorations?.length && obstacleManager.factory) {
                const factory = obstacleManager.factory;
                for (const d of decorations) {
                    const config = factory.getConfig(d.type);
                    const w = d.width ?? (config?.minSize != null && config?.maxSize != null ? (config.minSize + config.maxSize) / 2 : 40);
                    const h = d.height ?? w;
                    const spritePath = config?.defaultSpritePath ?? null;
                    const color = config?.color;
                    obstacleManager.addObstacle(d.x, d.y, w, h, d.type, spritePath, color ? { color } : null);
                }
            }
            return;
        }

        const worldConfig = this.config.world;
        const levelConfig = this.config.levels && this.config.levels[level];
        const levelObstacles = levelConfig && levelConfig.obstacles
            ? levelConfig.obstacles
            : this.config.obstacles;
        let worldWidth = (levelConfig && levelConfig.worldWidth != null) ? levelConfig.worldWidth : worldConfig.width;
        let worldHeight = (levelConfig && levelConfig.worldHeight != null) ? levelConfig.worldHeight : worldConfig.height;
        const levelObstaclesShape = levelConfig?.obstacles as { sceneTileLayout?: { cols?: number; rows?: number; tileSize?: number }; useSceneTiles?: boolean } | undefined;
        const sceneLayout = levelObstaclesShape?.sceneTileLayout;
        if (levelObstaclesShape?.useSceneTiles && sceneLayout && sceneLayout.cols === 1 && sceneLayout.rows === 1) {
            const tileSize = sceneLayout.tileSize ?? 1200;
            const padding = 200;
            worldWidth = tileSize + 2 * padding;
            worldHeight = tileSize + 2 * padding;
        }

        obstacleManager.generateWorld(worldWidth, worldHeight, levelObstacles as Record<string, unknown>, {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 120
        });
        const portalConfig = this.config.portal || { width: 80, height: 80 };
        if (this.playingState.portal) {
            this.playingState.portal.x = worldWidth / 2 - portalConfig.width / 2;
            this.playingState.portal.y = worldHeight / 2 - portalConfig.height / 2;
        }
        this._currentWorldWidth = worldWidth;
        this._currentWorldHeight = worldHeight;
        const cameraSystem = this.systemsTyped.camera;
        const pathfindingSystem = this.systemsTyped.pathfinding;
        if (cameraSystem && cameraSystem.setWorldBounds) cameraSystem.setWorldBounds(worldWidth, worldHeight);
        if (pathfindingSystem && pathfindingSystem.setWorldBounds) pathfindingSystem.setWorldBounds(worldWidth, worldHeight);
    }

    quitToMainMenu() {
        this.clearAllEntitiesAndProjectiles();
        this.screenManager.setScreen('title');
        this.updateUIVisibility(false);
    }

    startGame() {
        // Prevent Space/Enter used to leave title or death from triggering dodge on the same keydown
        this.suppressDodgeUntil = Date.now() + 150;
        const selectedLevel = this.screenManager.selectedStartLevel;
        const enemyManager = this.systemsTyped.enemies as { setActiveQuest?(quest: unknown): void; enemies: unknown[]; enemiesSpawned: boolean; currentLevel: number; enemiesKilledThisLevel: number; clearFlamePillars?(): void } | undefined;
        const cameraSystem = this.systemsTyped.camera;
        const worldConfig = this.config.world;
        const levels = this.config.levels || {};
        const hubLevel = levels[0];

        if (selectedLevel === 0 && this.screenManager.currentScreen === 'playing') {
            const player = this.entities.get('player');
            const health = player?.getComponent(Health);
            const stamina = player?.getComponent(Stamina);
            if (health != null) this.playingState.savedSanctuaryHealth = health.currentHealth;
            if (stamina != null) this.playingState.savedSanctuaryStamina = stamina.currentStamina;
        }

        this.clearAllEntitiesAndProjectiles();

        if (selectedLevel === 0 && hubLevel) {
            this.playingState.activeQuest = null;
            this.playingState.questGoldMultiplier = 1;
            this.playingState.delveFloor = 0;
            this.playingState.lastEnemyKillX = null;
            this.playingState.lastEnemyKillY = null;
            this.playingState.questCompleteFlairRemaining = 0;
            this.playingState.questCompleteFlairTriggered = false;
            if (enemyManager && enemyManager.setActiveQuest) enemyManager.setActiveQuest(null);
        } else {
            if (this.playingState.activeQuest?.questType === 'delve') {
                this.playingState.delveFloor = selectedLevel === DELVE_LEVEL ? (this.playingState.delveFloor || 1) : 1;
            }
            if (enemyManager && enemyManager.setActiveQuest) enemyManager.setActiveQuest(this.playingState.activeQuest ?? null);
        }

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
            this.playingState.boardUseCooldown = 0.6;
            this.playingState.playerNearBoard = false;
            this.playingState.chest = hubLevel.weaponChest ? { ...hubLevel.weaponChest } : null;
            this.playingState.chestOpen = false;
            this.playingState.chestUseCooldown = 0.6;
            this.tooltipHover = null;
            this.playingState.playerNearChest = false;
            this.playingState.shop = hubLevel.shopkeeper ? { ...hubLevel.shopkeeper } : null;
            this.playingState.shopOpen = false;
            this.playingState.shopUseCooldown = 0.6;
            this.playingState.playerNearShop = false;
            this.playingState.rerollStation = hubLevel.rerollStation ? { ...hubLevel.rerollStation } : null;
            this.playingState.rerollStationOpen = false;
            this.playingState.rerollStationUseCooldown = 0.6;
            this.playingState.playerNearRerollStation = false;
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
        const cameraSystem = this.systemsTyped.camera;
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
            this.tooltipHover = null;
            this.hudController.setInventoryPanelVisible(false);
        }
    }

    setCurrentWorldSize(width: number, height: number) {
        this._currentWorldWidth = width;
        this._currentWorldHeight = height;
    }

    handleCameraZoom() {
        const inputSystem = this.systemsTyped.input;
        const cameraSystem = this.systemsTyped.camera;
        if (!inputSystem || !cameraSystem) return;

        const wheelDelta = inputSystem.getWheelDelta();
        if (wheelDelta === 0) return;

        const zoomChange = wheelDelta > 0 ? -this.config.camera.zoomSpeed : this.config.camera.zoomSpeed;
        const newZoom = cameraSystem.targetZoom + zoomChange;
        cameraSystem.setZoom(newZoom, inputSystem.mouseX, inputSystem.mouseY, this.canvas.width, this.canvas.height);
    }

    update(deltaTime: number) {
        if (this.screenManager.currentScreen === 'hub') {
            if (this.playingState.shopOpen) {
                const inputSystem = this.systemsTyped.input as { getWheelDelta?(): number } | undefined;
                const wheelDelta = inputSystem?.getWheelDelta?.() ?? 0;
                if (wheelDelta !== 0) {
                    const layout = getShopLayout(
                        this.canvas,
                        this.playingState.shopScrollOffset,
                        this.playingState.shopExpandedWeapons,
                        this.playingState.shopExpandedArmor,
                        this.playingState.shopExpandedCategories,
                        this.playingState
                    );
                    const newOffset = this.playingState.shopScrollOffset + wheelDelta * 0.4;
                    this.playingState.shopScrollOffset = Math.max(0, Math.min(newOffset, layout.maxScrollOffset));
                }
            }
            this.playingStateController.updateHub(deltaTime);
            // updateHub already calls systems.update once; run combat so training dummy can be hit (no second systems.update or speed doubles)
            const player = this.entities.get('player');
            if (player) {
                const combat = player.getComponent(Combat);
                if (combat && combat.isPlayer && !combat.isAttacking && combat.attackInputBuffered) {
                    combat.tryFlushBufferedAttack();
                }
                const enemyManager = this.systemsTyped.enemies;
                if (enemyManager) {
                    enemyManager.checkPlayerAttack(player);
                    enemyManager.checkEnemyAttacks(player);
                }
                const healing = player.getComponent(PlayerHealing);
                if (healing) healing.update(deltaTime);
            }
            if (player) {
                const transform = player.getComponent(Transform);
                const cameraSystem = this.systemsTyped.camera;
                const movement = player.getComponent(Movement);
                if (transform && cameraSystem) {
                    const fastFollow = movement && (movement as { isAttackDashing?: boolean }).isAttackDashing === true;
                    cameraSystem.follow(transform, this.canvas.width, this.canvas.height, { fastFollow });
                }
            }
            this.hudController.update(this.entities.get('player'), undefined);
            return;
        }
        if (this.screenManager.currentScreen !== 'playing') {
            return;
        }

        this.handleCameraZoom();
        if (this.playingState.playerProjectileCooldown > 0) {
            this.playingState.playerProjectileCooldown = Math.max(0, this.playingState.playerProjectileCooldown - deltaTime);
        }
        const player = this.entities.get('player');
        const combat = player ? player.getComponent(Combat) : null;
        const weapon = combat && combat.playerAttack ? combat.playerAttack.weapon : null;
        const w = weapon as { isRanged?: boolean; isBow?: boolean } | null;
        const isCrossbow = w && w.isRanged === true && !w.isBow;
        updateCrossbowReload(deltaTime, this.playingState, player, this.config, !!isCrossbow);
        this.systems!.update(deltaTime);
        if (player) {
            const combatComp = player.getComponent(Combat);
            if (combatComp && combatComp.isPlayer && !combatComp.isAttacking && combatComp.attackInputBuffered) {
                combatComp.tryFlushBufferedAttack();
            }
            const enemyManager = this.systemsTyped.enemies;
            if (enemyManager) {
                enemyManager.checkPlayerAttack(player);
                enemyManager.checkEnemyAttacks(player);
            }
            const healing = player.getComponent(PlayerHealing);
            if (healing) healing.update(deltaTime);
            const health = player.getComponent(Health);
            if (health && health.isDead && this.screenManager.isScreen('playing')) {
                this.playingState.killsThisLife = 0;
                this.screenManager.setScreen('death');
                this.updateUIVisibility(false);
            }
        }
        if (player) {
            const transform = player.getComponent(Transform);
            const cameraSystem = this.systemsTyped.camera;
            const movement = player.getComponent(Movement);
            if (transform && cameraSystem) {
                const fastFollow = movement && (movement as { isAttackDashing?: boolean }).isAttackDashing === true;
                cameraSystem.follow(transform, this.canvas.width, this.canvas.height, { fastFollow });
            }
        }
        this.playingStateController.updatePortal(deltaTime, player);
        const currentLevel = this.systemsTyped.enemies?.getCurrentLevel();
        this.hudController.update(player, currentLevel);
    }

    setInventoryPanelVisible(visible: boolean) {
        this.hudController.setInventoryPanelVisible(visible);
    }

    refreshInventoryPanel() {
        this.hudController.refreshInventoryPanel();
    }

    /** Whetstones are used by dragging onto a weapon in the inventory UI. No-op when called via key. */
    useWhetstone(): void {
        // No-op: use by dragging whetstone onto weapon in inventory
    }

    /** True if (x,y) in canvas coords is over the inventory, chest, or shop UI (so attack/block should not fire). */
    private isPointerOverInventoryOrChestOrShopUI(x: number, y: number): boolean {
        return this.inventoryChestUIController.isPointerOverUI(x, y);
    }

    /** Handle Back/Close on inventory or chest canvas UI. Returns true if click was consumed. */
    handleInventoryChestClick(x: number, y: number, e?: MouseEvent): boolean {
        return this.inventoryChestUIController.handleClick(x, y, e);
    }

    private handleInventoryChestDoubleClick(x: number, y: number): boolean {
        return this.inventoryChestUIController.handleDoubleClick(x, y);
    }

    private getCanvasCoords(e: { clientX: number; clientY: number }): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const rw = rect.width || 1;
        const rh = rect.height || 1;
        const scaleX = this.canvas.width / rw;
        const scaleY = this.canvas.height / rh;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    /** Returns true if click was on minimap zoom +/- and was handled. */
    private handleMinimapZoomClick(x: number, y: number): boolean {
        return this.inventoryChestUIController.handleMinimapZoomClick(x, y);
    }

    handleInventoryChestPointerDown(x: number, y: number, ctrlKey = false): boolean {
        return this.inventoryChestUIController.handlePointerDown(x, y, ctrlKey);
    }

    handleInventoryChestPointerMove(x: number, y: number): void {
        this.inventoryChestUIController.handlePointerMove(x, y);
    }

    handleInventoryChestPointerUp(x: number, y: number): boolean {
        return this.inventoryChestUIController.handlePointerUp(x, y);
    }

    /** Get enemy entity at screen position (for hover tooltip). Returns null if none. */
    getEnemyAtScreenPoint(screenX, screenY) {
        const cameraSystem = this.systems && this.systemsTyped.camera;
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

            const renderSystem = this.systemsTyped.render;
            const cameraSystem = this.systemsTyped.camera;
            const obstacleManager = this.systemsTyped.obstacles;
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
                        renderSystem.renderBoard(this.playingState.board, cameraSystem, this.playingState.playerNearBoard);
                        if (this.playingState.playerNearBoard) {
                            renderSystem.renderBoardInteractionPrompt(this.playingState.board, cameraSystem, true);
                        }
                    }
                    if (this.playingState.chest) {
                        renderSystem.renderChest(this.playingState.chest, cameraSystem, this.playingState.playerNearChest);
                        if (this.playingState.playerNearChest) {
                            renderSystem.renderChestInteractionPrompt(this.playingState.chest, cameraSystem, true);
                        }
                    }
                    if (this.playingState.shop) {
                        renderSystem.renderShopkeeper(this.playingState.shop, cameraSystem, this.playingState.playerNearShop);
                    }
                    if (this.playingState.rerollStation) {
                        renderSystem.renderRerollStation(this.playingState.rerollStation, cameraSystem, this.playingState.playerNearRerollStation);
                    }
                    if (this.playingState.activeQuest && hubConfig.questPortal) {
                        const questPortal = {
                            ...hubConfig.questPortal,
                            spawned: true,
                            hasNextLevel: true,
                            targetLevel: this.playingState.activeQuest.level
                        };
                        renderSystem.renderPortal(questPortal, cameraSystem, this.playingState.playerNearQuestPortal, ['E — Enter quest'], false, this.playingState.questPortalChannelProgress);
                    }
                    const hubEntities = this.entities.getAll();
                    renderSystem.renderEntities(hubEntities, cameraSystem);
                    renderSystem.renderOverlay(this.ctx, cameraSystem);
                } finally {
                    // Always reset context and draw UI so minimap/level select work even if entity render threw
                    this.ctx.globalAlpha = 1;
                    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                    if (this.settings.showMinimap) {
                        renderSystem.renderMinimap(cameraSystem, this.entities, hubConfig.width, hubConfig.height, null, 0);
                    }
                    if (this.playingState.boardOpen) {
                        const levelNames: Record<number, string> = this.config.levels
                            ? Object.fromEntries(
                                Object.entries(this.config.levels).map(([k, v]) => [
                                    Number(k),
                                    (v as { name?: string }).name ?? 'Level ' + k
                                ])
                            ) : {};
                        this.screenManager.renderHubBoardOverlay(
                            this.playingState.questList,
                            this.playingState.hubSelectedQuestIndex,
                            levelNames,
                            this.playingState.gold ?? 0
                        );
                    }
                    if (this.playingState.chestOpen) {
                        renderChest(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.tooltipHover);
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.tooltipHover);
                    }
                    if (this.playingState.shopOpen) {
                        renderShop(this.ctx, this.canvas, this.playingState);
                    }
                    if (this.playingState.rerollStationOpen) {
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.tooltipHover, { includeChestInPanel: true });
                        renderRerollOverlay(this.ctx, this.canvas, this.playingState);
                    }
                    if (this.playingState.inventoryOpen) {
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.tooltipHover);
                    }
                    if (this.inventoryDragState.isDragging && (this.inventoryDragState.weaponKey || this.inventoryDragState.isWhetstone)) {
                        renderDragGhost(this.ctx, this.inventoryDragState);
                    }
                    this.hudController.setChestOverlayVisible(false);
                    if (this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings') || this.screenManager.isScreen('settings-controls')) {
                        this.screenManager.render(this.settings);
                    }
                }
                return;
            }

            this.hudController.setChestOverlayVisible(false);

            // Game world and entities (draw for both 'playing' and 'pause' so pause shows over frozen frame)
            const currentLevel = this.systemsTyped.enemies ? this.systemsTyped.enemies.getCurrentLevel() : 1;
            try {
                renderSystem.clear();
                renderSystem.renderWorld(cameraSystem, obstacleManager, currentLevel, null, null);
                if (this.playingState.portal) {
                    const isStairs = currentLevel === DELVE_LEVEL;
                    renderSystem.renderPortal(this.playingState.portal, cameraSystem, undefined, undefined, isStairs);
                    if (this.playingState.playerNearPortal) {
                        const delvePrompt = isStairs ? [this.playingState.portal!.hasNextLevel ? 'E Descend' : 'E Return to Sanctuary'] : undefined;
                        renderSystem.renderPortalInteractionPrompt(this.playingState.portal, cameraSystem, this.playingState.playerNearPortal, delvePrompt, isStairs, this.playingState.portalChannelProgress);
                    }
                }
                const gatherableManager = this.systemsTyped.gatherables;
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
                renderSystem.renderOverlay(this.ctx, cameraSystem);
                const hazardManager = this.systemsTyped.hazards;
                if (hazardManager && hazardManager.renderFlamePillars) {
                    hazardManager.renderFlamePillars(this.ctx, cameraSystem);
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
                if (this.screenManager.isScreen('playing') && this.playingState.questCompleteFlairRemaining > 0) {
                    renderQuestCompleteFlair(this.ctx, this.canvas, this.playingState.questCompleteFlairRemaining);
                }
                if (this.screenManager.isScreen('playing')) {
                    const inputSystem = this.systemsTyped.input;
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
                if (this.playingState.inventoryOpen) {
                    renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.tooltipHover);
                }
                if (this.inventoryDragState.isDragging && (this.inventoryDragState.weaponKey || this.inventoryDragState.isWhetstone)) {
                    renderDragGhost(this.ctx, this.inventoryDragState);
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

