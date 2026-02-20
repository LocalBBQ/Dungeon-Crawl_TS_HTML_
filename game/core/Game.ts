// Main game class - orchestrates all systems
import '../bootstrap.ts';

import { EntityManager } from '../managers/EntityManager.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { DELVE_LEVEL, DRAGON_ARENA_LEVEL } from '../config/questConfig.ts';
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
import { GoldPickupManager } from '../managers/GoldPickupManager.ts';
import { WeaponPickupManager } from '../managers/WeaponPickupManager.ts';
import { WhetstonePickupManager } from '../managers/WhetstonePickupManager.ts';
import { RenderSystem } from '../systems/RenderSystem.ts';
import { Entity } from '../entities/Entity.ts';
import { Transform } from '../components/Transform.ts';
import { Health } from '../components/Health.ts';
import { Rally } from '../components/Rally.ts';
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
import { getEffectiveWeapon } from '../weapons/resolveEffectiveWeapon.js';
import { getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import type { GameRef, GameConfigShape } from '../types/index.js';
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
import { createPlayer as createPlayerEntity } from './PlayerFactory.js';
import { ScreenController } from './ScreenController.js';
import { PlayingStateController } from './PlayingStateController.js';
import { HUDController } from '../ui/HUDController.js';
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
    type DragState,
    type ArmorTooltipHover
} from '../ui/InventoryChestCanvas.js';
import {
    renderRerollOverlay,
    getRerollOverlayLayout,
    hitTestRerollOverlay
} from '../ui/RerollOverlay.js';
import { hitTestMinimapZoomButtons, MINIMAP_ZOOM_MIN, MINIMAP_ZOOM_MAX, MINIMAP_ZOOM_STEP } from '../systems/renderers/MinimapRenderer.ts';
import { rerollEnchantSlot, moveToRerollSlot, moveFromRerollSlotTo, addWeaponToInventory, addWhetstoneToInventory, useWhetstoneOnWeapon } from '../state/InventoryActions.js';

/** When the pointer hovers a weapon slot in chest or inventory (canvas UI), used to draw tooltip. */
export interface WeaponTooltipHover {
    weaponKey: string;
    x: number;
    y: number;
    durability?: number;
    prefixId?: string;
    suffixId?: string;
}

class Game {
    inventoryDragState!: DragState;
    /** Set when pointer is over a weapon slot (chest or inventory); cleared when moving away or closing. */
    weaponTooltipHover: WeaponTooltipHover | null = null;
    /** Set when pointer is over an armor slot (equipment or inventory); cleared when moving away or closing. */
    armorTooltipHover: ArmorTooltipHover | null = null;

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
        const inputSystem = this.systems?.get('input') as { clearAllKeys?: () => void } | undefined;
        if (inputSystem?.clearAllKeys) inputSystem.clearAllKeys();
        this.playerInputController?.cancelMenuInputs();
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
        obstacleManager.generateWorld(initialWorldWidth, initialWorldHeight, level1Obstacles, {
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
            .register('healthOrbs', new HealthOrbManager())
            .register('goldPickups', new GoldPickupManager())
            .register('weaponPickups', new WeaponPickupManager())
            .register('whetstonePickups', new WhetstonePickupManager())
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
            'enemies', 'hazards', 'damageNumbers', 'projectiles', 'healthOrbs', 'goldPickups', 'weaponPickups', 'whetstonePickups',
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
        const spriteManager = this.systems.get('sprites');
        const player = createPlayerEntity(overrideStart, {
            spriteManager,
            equippedMainhandKey: this.playingState.equippedMainhandKey,
            equippedOffhandKey: this.playingState.equippedOffhandKey,
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

        this.systems.eventBus.on(EventTypes.PLAYER_KILLED_ENEMY, (payload: { x?: number; y?: number } = {}) => {
            this.playingState.killsThisLife++;
            if (this.playingState.delveFloor > 0 && typeof payload.x === 'number' && typeof payload.y === 'number') {
                this.playingState.lastEnemyKillX = payload.x;
                this.playingState.lastEnemyKillY = payload.y;
            }
        });

        const goldPickupManager = this.systems.get<GoldPickupManager>('goldPickups');
        if (goldPickupManager) {
            goldPickupManager.onCollected = (amount: number) => {
                let mult = this.playingState.questGoldMultiplier ?? 1;
                if (this.playingState.delveFloor > 0) {
                    mult *= 1 + (this.playingState.delveFloor - 1) * 0.2;
                }
                this.playingState.gold += amount * mult;
            };
        }
        const weaponPickupManager = this.systems.get<WeaponPickupManager>('weaponPickups');
        if (weaponPickupManager) {
            weaponPickupManager.onCollected = (instance) => {
                addWeaponToInventory(this.playingState, instance);
                this.refreshInventoryPanel();
            };
        }
        const whetstonePickupManager = this.systems.get<WhetstonePickupManager>('whetstonePickups');
        if (whetstonePickupManager) {
            whetstonePickupManager.onCollected = () => {
                const added = addWhetstoneToInventory(this.playingState);
                if (added) this.refreshInventoryPanel();
                return added;
            };
        }

        this.systems.eventBus.on(EventTypes.PLAYER_HIT_ENEMY, () => {
            const ps = this.playingState;
            if (ps.equippedMainhandDurability > 0) {
                ps.equippedMainhandDurability = Math.max(0, ps.equippedMainhandDurability - 1);
                if (ps.equippedMainhandDurability === 0 && ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') {
                    unequipToInventory(ps, 'mainhand', undefined, 0, () => this.syncPlayerWeaponsFromState());
                }
            }
        });

        this.systems.eventBus.on(EventTypes.DAMAGE_TAKEN, (data: { isPlayerDamage?: boolean; isBlocked?: boolean; isParry?: boolean; damage?: number; entityId?: string }) => {
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
        this.systems.eventBus.on(EventTypes.DAMAGE_TAKEN, (data: { entityId?: string; damage?: number }) => {
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

        // Clear gold pickups
        const goldPickupManager = this.systems.get('goldPickups');
        if (goldPickupManager && goldPickupManager.clear) {
            goldPickupManager.clear();
        }
        // Clear weapon pickups
        const weaponPickupManager = this.systems.get('weaponPickups');
        if (weaponPickupManager && weaponPickupManager.clear) {
            weaponPickupManager.clear();
        }
        // Clear whetstone pickups
        const whetstonePickupManager = this.systems.get('whetstonePickups');
        if (whetstonePickupManager && whetstonePickupManager.clear) {
            whetstonePickupManager.clear();
        }
    }

    resetEnemyManager(level: number) {
        const enemyManager = this.systems.get('enemies');
        if (!enemyManager) return;

        enemyManager.enemies = [];
        enemyManager.enemiesSpawned = false;
        enemyManager.currentLevel = level;
        enemyManager.enemiesKilledThisLevel = 0;
        if ('pendingSceneTileSpawns' in enemyManager && Array.isArray(enemyManager.pendingSceneTileSpawns)) enemyManager.pendingSceneTileSpawns.length = 0;
        if ('pendingPackSpawns' in enemyManager && Array.isArray(enemyManager.pendingPackSpawns)) enemyManager.pendingPackSpawns.length = 0;

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
            const hubConfig = this.config.hub;
            const fenceConfig = hubConfig?.fence ?? hubLevel?.fence;
            if (fenceConfig && typeof obstacleManager.addRectPerimeterFence === 'function') {
                obstacleManager.addRectPerimeterFence(
                    fenceConfig.originX,
                    fenceConfig.originY,
                    fenceConfig.width,
                    fenceConfig.height,
                    {
                        spacing: fenceConfig.spacing,
                        size: fenceConfig.size,
                        gapSide: fenceConfig.gapSide ?? 'bottom',
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
            const decorations = hubConfig?.decorations ?? hubLevel?.decorations;
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
        const sceneLayout = levelConfig?.obstacles?.sceneTileLayout;
        if (levelConfig?.obstacles?.useSceneTiles && sceneLayout && sceneLayout.cols === 1 && sceneLayout.rows === 1) {
            const tileSize = sceneLayout.tileSize ?? 1200;
            const padding = 200;
            worldWidth = tileSize + 2 * padding;
            worldHeight = tileSize + 2 * padding;
        }

        obstacleManager.generateWorld(worldWidth, worldHeight, levelObstacles, {
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
        // Prevent Space/Enter used to leave title or death from triggering dodge on the same keydown
        this.suppressDodgeUntil = Date.now() + 150;
        const selectedLevel = this.screenManager.selectedStartLevel;
        const enemyManager = this.systems.get('enemies') as { setActiveQuest?(quest: unknown): void; enemies: unknown[]; enemiesSpawned: boolean; currentLevel: number; enemiesKilledThisLevel: number; clearFlamePillars?(): void } | undefined;
        const cameraSystem = this.systems.get('camera');
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
            this.weaponTooltipHover = null;
            this.armorTooltipHover = null;
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
            this.weaponTooltipHover = null;
            this.armorTooltipHover = null;
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
            if (this.playingState.shopOpen) {
                const inputSystem = this.systems.get('input') as { getWheelDelta?(): number } | undefined;
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
                const enemyManager = this.systems.get('enemies');
                if (enemyManager) {
                    enemyManager.checkPlayerAttack(player);
                    enemyManager.checkEnemyAttacks(player);
                }
                const healing = player.getComponent(PlayerHealing);
                if (healing) healing.update(deltaTime);
            }
            if (player) {
                const transform = player.getComponent(Transform);
                const cameraSystem = this.systems.get('camera');
                const movement = player.getComponent(Movement);
                if (transform && cameraSystem) {
                    const fastFollow = movement && movement.isAttackDashing === true;
                    cameraSystem.follow(transform, this.canvas.width, this.canvas.height, { fastFollow });
                }
            }
            this.hudController.update(this.entities.get('player'), undefined);
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
        const isCrossbow = weapon && weapon.isRanged === true && !(weapon as { isBow?: boolean }).isBow;
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
        const enemyManager = this.systems.get('enemies') as { getCurrentLevel(): number } | undefined;
        const currentLevel = enemyManager?.getCurrentLevel();
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
        if (this.playingState.chestOpen) return true; // chest uses full-screen overlay
        if (this.playingState.inventoryOpen) {
            const layout = getInventoryLayout(this.canvas);
            const p = layout.panel;
            if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
        }
        if (this.playingState.shopOpen) {
            const layout = getShopLayout(
                this.canvas,
                this.playingState.shopScrollOffset ?? 0,
                this.playingState.shopExpandedWeapons,
                this.playingState.shopExpandedArmor,
                this.playingState.shopExpandedCategories,
                this.playingState
            );
            const p = layout.panel;
            if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
        }
        return false;
    }

    /** Handle Back/Close on inventory or chest canvas UI. Returns true if click was consumed. */
    handleInventoryChestClick(x: number, y: number, e?: MouseEvent): boolean {
        if (this.playingState.rerollStationOpen) {
            const layout = getRerollOverlayLayout(this.canvas, this.playingState);
            const hit = hitTestRerollOverlay(x, y, this.playingState, layout);
            if (hit?.type === 'back') {
                this.playingState.rerollStationOpen = false;
                return true;
            }
            if (hit?.type === 'reroll' && this.playingState.rerollSlotItem?.key) {
                rerollEnchantSlot(this.playingState, hit.action);
                this.refreshInventoryPanel();
                return true;
            }
            if (hit) return true;
            ensureInventoryInitialized(this.playingState);
            const invLayoutR = getInventoryLayout(this.canvas, { includeChestGrid: true });
            const invHitR = hitTestInventory(x, y, this.playingState, invLayoutR, this.playingState.chestSlots ?? []);
            if (invHitR?.type === 'close') {
                this.playingState.rerollStationOpen = false;
                this.weaponTooltipHover = null;
                return true;
            }
        }
        // Ctrl+click: equip weapon from inventory/chest, or unequip/put in chest
        if (e?.ctrlKey && (this.playingState.inventoryOpen || this.playingState.chestOpen || this.playingState.rerollStationOpen)) {
            ensureInventoryInitialized(this.playingState);
            const ps = this.playingState;
            const sync = () => this.syncPlayerWeaponsFromState();
            const invLayout = this.playingState.rerollStationOpen
                ? getInventoryLayout(this.canvas, { includeChestGrid: true })
                : getInventoryLayout(this.canvas);
            const invHit = hitTestInventory(
                x,
                y,
                ps,
                invLayout,
                this.playingState.rerollStationOpen ? (ps.chestSlots ?? []) : undefined
            );
            if (invHit?.type === 'chest-slot' && invHit.key) {
                const slot = getEquipSlotForWeapon(invHit.key);
                const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                if (slotHasItem) {
                    unequipToInventory(ps, slot, undefined, undefined, sync);
                }
                equipFromChestToHand(ps, invHit.index, slot, sync);
                this.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'inventory-slot' && invHit.weaponKey && invHit.index >= 0) {
                const armorConfig = getArmor(invHit.weaponKey);
                if (armorConfig) {
                    const slotHasItem = (armorConfig.slot === 'head' ? ps.equippedArmorHeadKey : armorConfig.slot === 'chest' ? ps.equippedArmorChestKey : armorConfig.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                    if (slotHasItem) swapArmorWithInventory(ps, armorConfig.slot, invHit.index);
                    else equipArmorFromInventory(ps, invHit.index, armorConfig.slot);
                    this.refreshInventoryPanel();
                    return true;
                }
                const slot = getEquipSlotForWeapon(invHit.weaponKey);
                const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                if (slotHasItem) {
                    swapEquipmentWithInventory(ps, slot, invHit.index, sync);
                } else {
                    equipFromInventory(ps, invHit.index, slot, sync);
                }
                this.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'equipment') {
                const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
                if (key && key !== 'none') {
                    if (this.playingState.chestOpen || this.playingState.rerollStationOpen) {
                        putInChestFromEquipment(ps, invHit.slot, sync);
                    } else {
                        unequipToInventory(ps, invHit.slot, undefined, undefined, sync);
                    }
                    this.refreshInventoryPanel();
                    return true;
                }
            }
            if (invHit?.type === 'armor-equipment') {
                const key = invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey;
                if (key && key !== 'none') {
                    unequipArmorToInventory(ps, invHit.slot);
                    this.refreshInventoryPanel();
                    return true;
                }
            }
            if (this.playingState.chestOpen && !this.playingState.rerollStationOpen) {
                const layout = getChestLayout(this.canvas);
                const chestHit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
                if (chestHit?.type === 'weapon-slot' && chestHit.key) {
                    const slot = getEquipSlotForWeapon(chestHit.key);
                    const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) {
                        unequipToInventory(ps, slot, undefined, undefined, sync);
                    }
                    equipFromChestToHand(ps, chestHit.index, slot, sync);
                    this.refreshInventoryPanel();
                    return true;
                }
            }
        }
        if (this.playingState.shopOpen) {
            const layout = getShopLayout(
                this.canvas,
                this.playingState.shopScrollOffset,
                this.playingState.shopExpandedWeapons,
                this.playingState.shopExpandedArmor,
                this.playingState.shopExpandedCategories,
                this.playingState
            );
            const hit = hitTestShop(x, y, layout);
            if (hit?.type === 'back') {
                this.playingState.shopOpen = false;
                this.playingState.shopUseCooldown = 0.4;
                return true;
            }
            if (hit?.type === 'repair') {
                const gold = this.playingState.gold ?? 0;
                if (gold >= hit.cost) {
                    this.playingState.gold = gold - hit.cost;
                    if (hit.source === 'mainhand') {
                        this.playingState.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
                    } else if (hit.source === 'offhand') {
                        this.playingState.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
                    } else if (hit.source === 'inventory' && 'bagIndex' in hit) {
                        const slot = this.playingState.inventorySlots?.[hit.bagIndex];
                        if (slot) {
                            this.playingState.inventorySlots[hit.bagIndex] = { key: slot.key, durability: MAX_WEAPON_DURABILITY };
                        }
                    } else if (hit.source === 'armor' && 'armorSlot' in hit) {
                        const s = hit.armorSlot;
                        if (s === 'head') this.playingState.equippedArmorHeadDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'chest') this.playingState.equippedArmorChestDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'hands') this.playingState.equippedArmorHandsDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'feet') this.playingState.equippedArmorFeetDurability = MAX_ARMOR_DURABILITY;
                    } else if (hit.source === 'armor-bag' && 'armorBagIndex' in hit) {
                        const item = this.playingState.inventorySlots?.[hit.armorBagIndex];
                        if (item) {
                            this.playingState.inventorySlots![hit.armorBagIndex] = { key: item.key, durability: MAX_ARMOR_DURABILITY };
                        }
                    }
                    this.refreshInventoryPanel();
                }
                return true;
            }
            if (hit?.type === 'armor-item') {
                const gold = this.playingState.gold ?? 0;
                if (gold >= hit.price) {
                    ensureInventoryInitialized(this.playingState);
                    const empty = this.playingState.inventorySlots?.findIndex((s) => s == null) ?? -1;
                    if (empty >= 0) {
                        this.playingState.gold = gold - hit.price;
                        this.playingState.inventorySlots![empty] = { key: hit.armorKey, durability: MAX_ARMOR_DURABILITY };
                        this.refreshInventoryPanel();
                    }
                }
                return true;
            }
            if (hit?.type === 'dropdown') {
                const exp = this.playingState.shopExpandedWeapons ?? {};
                const wasExpanded = exp[hit.weaponKey] === true;
                this.playingState.shopExpandedWeapons = { ...exp, [hit.weaponKey]: !wasExpanded };
                return true;
            }
            if (hit?.type === 'armor-dropdown') {
                const exp = this.playingState.shopExpandedArmor ?? {};
                const wasExpanded = exp[hit.slot] === true;
                this.playingState.shopExpandedArmor = { ...exp, [hit.slot]: !wasExpanded };
                return true;
            }
            if (hit?.type === 'parent-category') {
                const exp = this.playingState.shopExpandedCategories ?? {};
                const wasExpanded = exp[hit.category] === true;
                this.playingState.shopExpandedCategories = { ...exp, [hit.category]: !wasExpanded };
                return true;
            }
            if (hit?.type === 'item') {
                const gold = this.playingState.gold ?? 0;
                if (gold >= hit.price) {
                    ensureInventoryInitialized(this.playingState);
                    const slots = this.playingState.inventorySlots;
                    const idx = slots.findIndex((s) => s == null);
                    if (idx >= 0) {
                        this.playingState.gold = gold - hit.price;
                        setInventorySlot(this.playingState, idx, { key: hit.weaponKey, durability: MAX_WEAPON_DURABILITY });
                        this.refreshInventoryPanel();
                    }
                }
            }
            return true;
        }
        if (this.playingState.inventoryOpen) {
            const layout = getInventoryLayout(this.canvas);
            const hit = hitTestInventory(x, y, this.playingState, layout);
            if (hit?.type === 'close') {
                this.playingState.inventoryOpen = false;
                this.weaponTooltipHover = null;
                this.armorTooltipHover = null;
                this.hudController.setInventoryPanelVisible(false);
                return true;
            }
        }
        if (this.playingState.chestOpen) {
            const invLayout = getInventoryLayout(this.canvas);
            const invHit = hitTestInventory(x, y, this.playingState, invLayout);
            if (invHit?.type === 'close') {
                this.playingState.chestOpen = false;
                this.playingState.chestUseCooldown = 0;
                this.weaponTooltipHover = null;
                this.armorTooltipHover = null;
                return true;
            }
            const layout = getChestLayout(this.canvas);
            const hit = hitTestChest(x, y, layout, this.playingState.chestSlots ?? []);
            if (hit?.type === 'back') {
                this.playingState.chestOpen = false;
                this.playingState.chestUseCooldown = 0;
                this.weaponTooltipHover = null;
                this.armorTooltipHover = null;
                return true;
            }
        }
        return false;
    }

    private syncPlayerWeaponsFromState(): void {
        const ps = this.playingState;
        const player = this.entities.get('player');
        if (!player) return;
        const combat = player.getComponent(Combat) as Combat | null;
        if (!combat || !combat.isPlayer) return;
        (combat as Combat & { stopBlocking?(): void }).stopBlocking?.();
        const mainhand = getEffectiveWeapon(
            ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none' ? ps.equippedMainhandKey : undefined,
            ps.equippedMainhandPrefixId,
            ps.equippedMainhandSuffixId
        );
        const offhand = getEffectiveWeapon(
            ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none' ? ps.equippedOffhandKey : undefined,
            ps.equippedOffhandPrefixId,
            ps.equippedOffhandSuffixId
        );
        (combat as Combat & { setWeapons(m: unknown, o?: unknown): void }).setWeapons(mainhand, offhand);
    }

    private handleInventoryChestDoubleClick(x: number, y: number): boolean {
        if (!this.playingState.inventoryOpen && !this.playingState.chestOpen) return false;
        ensureInventoryInitialized(this.playingState);
        const ps = this.playingState;
        const sync = () => this.syncPlayerWeaponsFromState();
        const layout = getInventoryLayout(this.canvas);
        const hit = hitTestInventory(x, y, ps, layout);
        if (hit?.type === 'inventory-slot' && hit.weaponKey && hit.index >= 0) {
            const slot = getEquipSlotForWeapon(hit.weaponKey);
            const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
            if (slotHasItem) {
                swapEquipmentWithInventory(ps, slot, hit.index, sync);
            } else {
                equipFromInventory(ps, hit.index, slot, sync);
            }
            this.refreshInventoryPanel();
            return true;
        }
        return false;
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
        if (!this.settings.showMinimap || !this.screenManager) return false;
        if (!this.screenManager.isScreen('playing') && !this.screenManager.isScreen('hub')) return false;
        const hit = hitTestMinimapZoomButtons(this.canvas.width, this.canvas.height, x, y);
        if (hit === 'minus') {
            const current = (this.settings.minimapZoom as number) ?? 1;
            this.settings.minimapZoom = Math.max(MINIMAP_ZOOM_MIN, current - MINIMAP_ZOOM_STEP);
            return true;
        }
        if (hit === 'plus') {
            const current = (this.settings.minimapZoom as number) ?? 1;
            this.settings.minimapZoom = Math.min(MINIMAP_ZOOM_MAX, current + MINIMAP_ZOOM_STEP);
            return true;
        }
        return false;
    }

    handleInventoryChestPointerDown(x: number, y: number, ctrlKey = false): boolean {
        if (!this.playingState.inventoryOpen && !this.playingState.chestOpen && !this.playingState.shopOpen && !this.playingState.rerollStationOpen) return false;
        if (ctrlKey) return false; // Let click handler do ctrl+click equip/unequip; avoid drag + click double-action
        ensureInventoryInitialized(this.playingState);
        const ds = this.inventoryDragState;
        if (this.playingState.rerollStationOpen && this.playingState.rerollSlotItem?.key) {
            const rerollLayout = getRerollOverlayLayout(this.canvas, this.playingState);
            const rerollHit = hitTestRerollOverlay(x, y, this.playingState, rerollLayout);
            if (rerollHit?.type === 'slot') {
                ds.isDragging = true;
                ds.weaponKey = this.playingState.rerollSlotItem.key;
                ds.durability = this.playingState.rerollSlotItem.durability;
                ds.sourceSlotIndex = 0;
                ds.sourceContext = 'rerollSlot';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        // Character sheet: when reroll open use combined layout (inventory + chest in panel)
        const invLayout = this.playingState.rerollStationOpen
            ? getInventoryLayout(this.canvas, { includeChestGrid: true })
            : getInventoryLayout(this.canvas);
        const invHit = hitTestInventory(
            x,
            y,
            this.playingState,
            invLayout,
            this.playingState.rerollStationOpen ? (this.playingState.chestSlots ?? []) : undefined
        );
        if (invHit?.type === 'chest-slot' && invHit.key) {
            ds.isDragging = true;
            ds.weaponKey = invHit.key;
            ds.sourceSlotIndex = invHit.index;
            ds.sourceContext = 'chest';
            ds.pointerX = x;
            ds.pointerY = y;
            return true;
        }
        if (invHit?.type === 'inventory-slot' && (invHit.weaponKey || invHit.itemType === 'whetstone')) {
            if (invHit.itemType === 'whetstone') {
                ds.isDragging = true;
                ds.sourceSlotIndex = invHit.index;
                ds.sourceContext = 'inventory';
                ds.weaponKey = '';
                ds.isWhetstone = true;
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
            const isArmor = !!getArmor(invHit.weaponKey!);
            ds.isDragging = true;
            ds.sourceSlotIndex = invHit.index;
            ds.sourceContext = 'inventory';
            ds.pointerX = x;
            ds.pointerY = y;
            if (isArmor) {
                ds.weaponKey = '';
                ds.armorKey = invHit.weaponKey!;
            } else {
                ds.weaponKey = invHit.weaponKey!;
                ds.armorKey = undefined;
                ds.durability = undefined;
            }
            return true;
        }
        if (invHit?.type === 'equipment') {
            const key = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandKey : this.playingState.equippedOffhandKey;
            if (key && key !== 'none') {
                ds.isDragging = true;
                ds.weaponKey = key;
                ds.durability = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandDurability : this.playingState.equippedOffhandDurability;
                ds.sourceSlotIndex = invHit.slot === 'mainhand' ? 0 : 1;
                ds.sourceContext = 'equipment';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        if (invHit?.type === 'armor-equipment') {
            const key = invHit.slot === 'head' ? this.playingState.equippedArmorHeadKey : invHit.slot === 'chest' ? this.playingState.equippedArmorChestKey : invHit.slot === 'hands' ? this.playingState.equippedArmorHandsKey : this.playingState.equippedArmorFeetKey;
            if (key && key !== 'none') {
                ds.isDragging = true;
                ds.weaponKey = '';
                ds.armorKey = key;
                ds.sourceArmorSlot = invHit.slot;
                ds.sourceContext = 'armor';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        if (this.playingState.chestOpen) {
            const layout = getChestLayout(this.canvas);
            const hit = hitTestChest(x, y, layout, this.playingState.chestSlots ?? []);
            if (hit?.type === 'weapon-slot' && hit.key) {
                ds.isDragging = true;
                ds.weaponKey = hit.key;
                ds.sourceSlotIndex = hit.index;
                ds.sourceContext = 'chest';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        return false;
    }

    handleInventoryChestPointerMove(x: number, y: number): void {
        const ds = this.inventoryDragState;
        if (ds.isDragging) {
            ds.pointerX = x;
            ds.pointerY = y;
            return;
        }
        this.updateWeaponTooltipHover(x, y);
    }

    private updateWeaponTooltipHover(x: number, y: number): void {
        if (this.playingState.inventoryOpen || this.playingState.chestOpen || this.playingState.rerollStationOpen) {
            ensureInventoryInitialized(this.playingState);
            const invLayout = this.playingState.rerollStationOpen
                ? getInventoryLayout(this.canvas, { includeChestGrid: true })
                : getInventoryLayout(this.canvas);
            const invHit = hitTestInventory(
                x,
                y,
                this.playingState,
                invLayout,
                this.playingState.rerollStationOpen ? (this.playingState.chestSlots ?? []) : undefined
            );
            if (invHit?.type === 'armor-equipment') {
                const key = invHit.slot === 'head' ? this.playingState.equippedArmorHeadKey : invHit.slot === 'chest' ? this.playingState.equippedArmorChestKey : invHit.slot === 'hands' ? this.playingState.equippedArmorHandsKey : this.playingState.equippedArmorFeetKey;
                const durability = invHit.slot === 'head' ? this.playingState.equippedArmorHeadDurability : invHit.slot === 'chest' ? this.playingState.equippedArmorChestDurability : invHit.slot === 'hands' ? this.playingState.equippedArmorHandsDurability : this.playingState.equippedArmorFeetDurability;
                if (key && key !== 'none') {
                    this.armorTooltipHover = { armorKey: key, x, y, durability };
                    this.weaponTooltipHover = null;
                    return;
                }
            }
            if (invHit?.type === 'chest-slot' && invHit.key) {
                const chestSlots = this.playingState.chestSlots ?? [];
                const instance = chestSlots[invHit.index];
                this.weaponTooltipHover = instance
                    ? {
                        weaponKey: invHit.key,
                        x,
                        y,
                        durability: instance.durability,
                        prefixId: instance.prefixId,
                        suffixId: instance.suffixId
                    }
                    : { weaponKey: invHit.key, x, y };
                return;
            }
            if (invHit?.type === 'inventory-slot' && invHit.weaponKey) {
                if (getArmor(invHit.weaponKey)) {
                    this.armorTooltipHover = { armorKey: invHit.weaponKey, x, y, durability: invHit.durability };
                    this.weaponTooltipHover = null;
                    return;
                }
                this.armorTooltipHover = null;
                this.weaponTooltipHover = {
                    weaponKey: invHit.weaponKey,
                    x,
                    y,
                    durability: invHit.durability,
                    prefixId: invHit.prefixId,
                    suffixId: invHit.suffixId
                };
                return;
            }
            if (invHit?.type === 'equipment') {
                const key = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandKey : this.playingState.equippedOffhandKey;
                if (key && key !== 'none') {
                    const prefixId = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandPrefixId : this.playingState.equippedOffhandPrefixId;
                    const suffixId = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandSuffixId : this.playingState.equippedOffhandSuffixId;
                    const durability = invHit.slot === 'mainhand' ? this.playingState.equippedMainhandDurability : this.playingState.equippedOffhandDurability;
                    this.armorTooltipHover = null;
                    this.weaponTooltipHover = { weaponKey: key, x, y, durability, prefixId, suffixId };
                    return;
                }
            }
        }
        if (this.playingState.chestOpen) {
            const layout = getChestLayout(this.canvas);
            const chestSlots = this.playingState.chestSlots ?? [];
            const hit = hitTestChest(x, y, layout, chestSlots);
            if (hit?.type === 'weapon-slot' && hit.key) {
                const instance = chestSlots[hit.index];
                this.armorTooltipHover = null;
                this.weaponTooltipHover = {
                    weaponKey: hit.key,
                    x,
                    y,
                    durability: instance?.durability,
                    prefixId: instance?.prefixId,
                    suffixId: instance?.suffixId
                };
                return;
            }
        }
        this.weaponTooltipHover = null;
        this.armorTooltipHover = null;
    }

    handleInventoryChestPointerUp(x: number, y: number): boolean {
        const ds = this.inventoryDragState;
        if (!ds.isDragging) return false;
        const weaponKey = ds.weaponKey;
        const armorKey = ds.armorKey;
        const sourceIndex = ds.sourceSlotIndex;
        const sourceContext = ds.sourceContext;
        const sourceArmorSlot = ds.sourceArmorSlot;
        const sourceArmorInvIndex = (ds.sourceContext === 'inventory' && ds.armorKey) ? ds.sourceSlotIndex : undefined;
        const dragDurability = ds.durability;
        const wasWhetstone = ds.isWhetstone === true;
        ds.isDragging = false;
        ds.weaponKey = '';
        ds.armorKey = undefined;
        ds.sourceArmorSlot = undefined;
        ds.durability = undefined;
        ds.sourceSlotIndex = -1;
        ds.isWhetstone = false;

        const ps = this.playingState;
        const sync = () => this.syncPlayerWeaponsFromState();
        if (!ps.inventorySlots || ps.inventorySlots.length < INVENTORY_SLOT_COUNT) {
            if (armorKey && (this.playingState.inventoryOpen || this.playingState.chestOpen)) {
                const invLayout = getInventoryLayout(this.canvas);
                const invHit = hitTestInventory(x, y, ps, invLayout);
                if (invHit?.type === 'armor-equipment' && sourceArmorSlot !== undefined && canEquipArmorInSlot(armorKey, invHit.slot)) {
                    swapArmorWithArmor(ps, sourceArmorSlot, invHit.slot);
                    this.refreshInventoryPanel();
                } else if (invHit?.type === 'armor-equipment' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex >= 0 && canEquipArmorInSlot(armorKey, invHit.slot)) {
                    const slotHasItem = (invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                    if (slotHasItem) swapArmorWithInventory(ps, invHit.slot, sourceArmorInvIndex);
                    else equipArmorFromInventory(ps, sourceArmorInvIndex, invHit.slot);
                    this.refreshInventoryPanel();
                } else if (invHit?.type === 'inventory-slot' && sourceArmorSlot !== undefined) {
                    unequipArmorToInventory(ps, sourceArmorSlot, invHit.index);
                    this.refreshInventoryPanel();
                } else if (invHit?.type === 'inventory-slot' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex !== invHit.index) {
                    swapInventorySlots(ps, sourceArmorInvIndex, invHit.index);
                    this.refreshInventoryPanel();
                }
            }
            return true;
        }

        if (this.playingState.rerollStationOpen) {
            const rerollLayout = getRerollOverlayLayout(this.canvas, ps);
            const s = rerollLayout.slot;
            const inRerollSlot = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
            if (inRerollSlot && sourceContext !== 'rerollSlot') {
                moveToRerollSlot(ps, sourceContext, sourceIndex, sync);
                this.refreshInventoryPanel();
                return true;
            }
        }

        // Character sheet: when reroll open use combined layout (inventory + chest in panel)
        if (this.playingState.inventoryOpen || this.playingState.chestOpen || this.playingState.rerollStationOpen) {
            const invLayout = this.playingState.rerollStationOpen
                ? getInventoryLayout(this.canvas, { includeChestGrid: true })
                : getInventoryLayout(this.canvas);
            const invHit = hitTestInventory(
                x,
                y,
                ps,
                invLayout,
                this.playingState.rerollStationOpen ? (ps.chestSlots ?? []) : undefined
            );
            // Whetstone: drag onto weapon (equipped or in bag) to repair
            if (wasWhetstone && sourceContext === 'inventory' && sourceIndex >= 0 && invHit) {
                if (invHit.type === 'equipment') {
                    const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
                    if (key && key !== 'none') {
                        if (useWhetstoneOnWeapon(ps, sourceIndex, invHit.slot)) {
                            this.refreshInventoryPanel();
                            return true;
                        }
                    }
                }
                if (invHit.type === 'inventory-slot' && invHit.weaponKey && invHit.itemType === 'weapon') {
                    if (useWhetstoneOnWeapon(ps, sourceIndex, { bagIndex: invHit.index })) {
                        this.refreshInventoryPanel();
                        return true;
                    }
                }
            }
            if (armorKey && invHit?.type === 'armor-equipment' && sourceArmorSlot !== undefined && canEquipArmorInSlot(armorKey, invHit.slot)) {
                swapArmorWithArmor(ps, sourceArmorSlot, invHit.slot);
                this.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'armor-equipment' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex >= 0 && canEquipArmorInSlot(armorKey, invHit.slot)) {
                const slotHasItem = (invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                if (slotHasItem) swapArmorWithInventory(ps, invHit.slot, sourceArmorInvIndex);
                else equipArmorFromInventory(ps, sourceArmorInvIndex, invHit.slot);
                this.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'inventory-slot' && sourceArmorSlot !== undefined) {
                unequipArmorToInventory(ps, sourceArmorSlot, invHit.index);
                this.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'inventory-slot' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex !== invHit.index) {
                swapInventorySlots(ps, sourceArmorInvIndex, invHit.index);
                this.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'chest-slot') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'chest', 0);
                    this.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) {
                    putInChestFromInventory(ps, sourceIndex);
                } else if (sourceContext === 'equipment') {
                    putInChestFromEquipment(ps, sourceIndex === 0 ? 'mainhand' : 'offhand', sync);
                }
                this.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'equipment') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'equipment', invHit.slot === 'mainhand' ? 0 : 1, sync);
                    this.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'equipment') {
                    swapEquipmentWithEquipment(ps, sync);
                } else if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) {
                    const slotHasItem = invHit.slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) {
                        swapEquipmentWithInventory(ps, invHit.slot, sourceIndex, sync);
                    } else {
                        equipFromInventory(ps, sourceIndex, invHit.slot, sync);
                    }
                } else if (sourceContext === 'chest' && sourceIndex >= 0 && sourceIndex < (ps.chestSlots?.length ?? 0)) {
                    const slotHasItem = invHit.slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) {
                        unequipToInventory(ps, invHit.slot, undefined, undefined, sync);
                    }
                    equipFromChestToHand(ps, sourceIndex, invHit.slot, sync);
                }
                return true;
            }
            if (invHit?.type === 'inventory-slot') {
                const targetIndex = invHit.index;
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'inventory', targetIndex);
                    this.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) {
                    swapInventorySlots(ps, sourceIndex, targetIndex);
                } else if (sourceContext === 'chest' && sourceIndex >= 0 && sourceIndex < (ps.chestSlots?.length ?? 0)) {
                    equipFromChest(ps, sourceIndex, targetIndex);
                } else if (sourceContext === 'equipment') {
                    const equipSlot = sourceIndex === 0 ? 'mainhand' : 'offhand';
                    unequipToInventory(ps, equipSlot, targetIndex, dragDurability, sync);
                }
                return true;
            }
        }

        // Chest overlay (center): drop on back or weapon grid when chest is open (not reroll; reroll uses panel chest)
        if (this.playingState.chestOpen) {
            const layout = getChestLayout(this.canvas);
            const hit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
            if (hit?.type === 'weapon-slot' || hit?.type === 'back') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'chest', 0);
                    this.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) {
                    putInChestFromInventory(ps, sourceIndex);
                } else if (sourceContext === 'equipment') {
                    putInChestFromEquipment(ps, sourceIndex === 0 ? 'mainhand' : 'offhand', sync);
                }
            }
        }
        return true;
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
                    const hubProjectileManager = this.systems.get('projectiles');
                    if (hubProjectileManager) {
                        hubProjectileManager.render(this.ctx, cameraSystem);
                    }
                    const damageNumberManager = this.systems.get('damageNumbers');
                    if (damageNumberManager) {
                        damageNumberManager.render(this.ctx, cameraSystem);
                    }
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
                        renderChest(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.weaponTooltipHover);
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.weaponTooltipHover, this.armorTooltipHover);
                    }
                    if (this.playingState.shopOpen) {
                        renderShop(this.ctx, this.canvas, this.playingState);
                    }
                    if (this.playingState.rerollStationOpen) {
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.weaponTooltipHover, this.armorTooltipHover, { includeChestInPanel: true });
                        renderRerollOverlay(this.ctx, this.canvas, this.playingState);
                    }
                    if (this.playingState.inventoryOpen) {
                        renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.weaponTooltipHover, this.armorTooltipHover);
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
            const currentLevel = this.systems.get('enemies') ? this.systems.get('enemies').getCurrentLevel() : 1;
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
                const goldPickupManager = this.systems.get('goldPickups');
                if (goldPickupManager && goldPickupManager.render) {
                    goldPickupManager.render(this.ctx, cameraSystem);
                }
                const weaponPickupManager = this.systems.get('weaponPickups');
                if (weaponPickupManager && weaponPickupManager.render) {
                    weaponPickupManager.render(this.ctx, cameraSystem);
                }
                const whetstonePickupManager = this.systems.get('whetstonePickups');
                if (whetstonePickupManager && whetstonePickupManager.render) {
                    whetstonePickupManager.render(this.ctx, cameraSystem);
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
                if (this.playingState.inventoryOpen) {
                    renderInventory(this.ctx, this.canvas, this.playingState, this.inventoryDragState, this.weaponTooltipHover, this.armorTooltipHover);
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

