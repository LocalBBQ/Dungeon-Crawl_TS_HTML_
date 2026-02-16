// Main game class - orchestrates all systems
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
            
            // Core managers (systems will be created in initSystems)
            this.entities = new EntityManager();
            this.systems = null;
            
            // Initialize player projectile cooldown
            this.playerProjectileCooldown = 0;
            // Crossbow: reload progress 0–1 (1 = loaded); R starts reload (reloadInProgress); perfect-reload bonus for next shot
            this.crossbowReloadProgress = 1;
            this.crossbowReloadInProgress = false;
            this.crossbowPerfectReloadNext = false;
            // Portal state (spawns after enough kills; enter with E)
            this.portal = null;
            this.portalUseCooldown = 0;
            this.playerNearPortal = false;
            // Hub: level-select board and weapon chest (safe area, no enemies)
            this.board = null;
            this.boardOpen = false;
            this.boardUseCooldown = 0;
            this.playerNearBoard = false;
            this.chest = null;
            this.chestOpen = false;
            this.chestUseCooldown = 0;
            this.playerNearChest = false;
            this.hubSelectedLevel = 1;
            this.screenBeforePause = null; // 'playing' | 'hub' when in pause/settings, for resume
            // One weapon equipped at a time; switch only in sanctuary (hub board overlay)
            this.equippedWeaponKey = (GameConfig.player && GameConfig.player.defaultWeapon) ? GameConfig.player.defaultWeapon : 'swordAndShield';
            // Most recent enemy hit by player (for tooltip)
            this.lastHitEnemyId = null;
            // Gold (from gatherables; for future upgrades)
            this.gold = 0;
            // Kills this life (resets when player dies)
            this.killsThisLife = 0;
            // Set by GatherableManager each frame: true when player overlaps a gatherable (suppress attack on click)
            this.playerInGatherableRange = false;
            // Inventory/equipment panel (Tab to toggle)
            this.inventoryOpen = false;

            // Game-wide settings (toggled from pause/settings screen)
            this.settings = {
                musicEnabled: true,
                sfxEnabled: true,
                showMinimap: true,
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
                // Don't initialize entities yet - wait for title screen
                this.setupEventListeners();
                this.bindGlobalInputHandlers();
                this.bindCombatFeedbackListeners();

                this.running = true;
                this.lastTime = performance.now();
                
                console.log('Game initialized successfully');
                
                // Start with title screen
                this.screenManager.setScreen('title');
                this.updateUIVisibility(false);
                
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
        const worldConfig = GameConfig.world;
        const level1Config = GameConfig.levels && GameConfig.levels[1];
        const initialWorldWidth = (level1Config && level1Config.worldWidth != null) ? level1Config.worldWidth : worldConfig.width;
        const initialWorldHeight = (level1Config && level1Config.worldHeight != null) ? level1Config.worldHeight : worldConfig.height;
        this._currentWorldWidth = initialWorldWidth;
        this._currentWorldHeight = initialWorldHeight;

        // Create system manager if not already created
        if (!this.systems) {
            this.systems = new SystemManager();
        }

        // Register entities as a \"system\" so other systems can access it
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
            .register('gatherables', new GatherableManager(this));

        const obstacleManager = this.systems.get('obstacles');
        if (obstacleManager && obstacleManager.init) obstacleManager.init(this.systems);

        // Generate world before pathfinding (use level 1 config and dimensions)
        const level1Obstacles = level1Config && level1Config.obstacles ? level1Config.obstacles : GameConfig.obstacles;
        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
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
                GameConfig.pathfinding.cellSize
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
    }

    async loadPlayerSprites() {
        const spriteManager = this.systems.get('sprites');
        if (!spriteManager) return;

        // Load knight 8-direction sprite sheet (single frame per direction)
        // Auto-detect layout: horizontal strip (1 row × 8 cols) vs vertical (8 rows × 1 col)
        const loadedKnightSheets = {};
        let knightRows = 1, knightCols = 8, knightFrameWidth = 0, knightFrameHeight = 0;
        const knight8DirPath = 'assets/sprites/player/Knight_8_Direction.png';
        try {
            const knightImg = await spriteManager.loadSprite(knight8DirPath);
            const isHorizontalStrip = knightImg.width >= knightImg.height;
            knightRows = isHorizontalStrip ? 1 : 8;
            knightCols = isHorizontalStrip ? 8 : 1;
            knightFrameWidth = knightImg.width / knightCols;
            knightFrameHeight = knightImg.height / knightRows;
            await spriteManager.loadSpriteSheet(
                knight8DirPath,
                knightFrameWidth,
                knightFrameHeight,
                knightRows,
                knightCols
            );
            const knightSheetKey = `${knight8DirPath}_${knightFrameWidth}_${knightFrameHeight}_${knightRows}_${knightCols}`;
            loadedKnightSheets.idle = knightSheetKey;
            loadedKnightSheets._8DirLayout = isHorizontalStrip ? '1x8' : '8x1'; // for createPlayer
            console.log(`Loaded Knight_8_Direction: ${knightImg.width}x${knightImg.height}, frame ${knightFrameWidth}x${knightFrameHeight} (${knightRows} rows × ${knightCols})`);
        } catch (error) {
            console.warn('Failed to load Knight_8_Direction.png:', error);
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
        const registry = GameConfig.groundTextures || {};
        const pathsToLoad = new Set();
        const collect = (ground) => {
            if (!ground || !ground.texture) return;
            const path = registry[ground.texture] || ground.texture;
            if (path) pathsToLoad.add(path);
        };
        if (GameConfig.hub && GameConfig.hub.theme && GameConfig.hub.theme.ground) {
            collect(GameConfig.hub.theme.ground);
        }
        if (GameConfig.levels) {
            for (const key of Object.keys(GameConfig.levels)) {
                const level = GameConfig.levels[key];
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
        const levels = GameConfig.levels || {};
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
            const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
            const currentLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
            const levelKeys = GameConfig.levels ? Object.keys(GameConfig.levels).map(Number).filter(n => n > 0) : [1, 2, 3];
            const maxLevel = levelKeys.length ? Math.max(...levelKeys) : 3;
            this.portal = {
                x: portalConfig.x,
                y: portalConfig.y,
                width: portalConfig.width,
                height: portalConfig.height,
                spawned: false,
                targetLevel: Math.min(currentLevel + 1, maxLevel)
            };
        }
    }

    createPlayer(overrideStart = null) {
        const config = GameConfig.player;
        const x = overrideStart ? overrideStart.x : config.startX;
        const y = overrideStart ? overrideStart.y : config.startY;
        const player = new Entity(x, y, 'player');
        
        const spriteManager = this.systems.get('sprites');
        // Get loaded knight sprite sheet keys
        const knightSheets = spriteManager.knightSheets || {};
        const defaultSheetKey = knightSheets.idle || knightSheets.walk || null;
        
        // Build animation configuration with sprite sheet keys
        const animationConfig = {
            defaultSpriteSheetKey: defaultSheetKey,
            defaultAnimation: 'idle',
            animations: {}
        };
        
        // Configure each animation with its sprite sheet
        if (knightSheets.idle) {
            const idleSheet = spriteManager.getSpriteSheet(knightSheets.idle);
            if (idleSheet) {
                // 8-direction single-frame: same layout as Knight_8_D_Block (1 row × 8 cols or 8 rows × 1 col)
                const is8DirSingleFrame = (idleSheet.rows === 8 && idleSheet.cols === 1) || (idleSheet.rows === 1 && idleSheet.cols === 8);
                const useDirectionAsColumn = idleSheet.rows === 1 && idleSheet.cols === 8; // horizontal strip
                const idleFrames = is8DirSingleFrame
                    ? [0]
                    : Array.from({length: idleSheet.totalFrames || (idleSheet.rows * idleSheet.cols)}, (_, i) => i);
                animationConfig.animations.idle = {
                    spriteSheetKey: knightSheets.idle,
                    frames: idleFrames,
                    frameDuration: 0.15,
                    loop: true,
                    useDirection: is8DirSingleFrame,
                    useDirectionAsColumn
                };
            }
        }
        
        if (knightSheets.walk) {
            const walkSheet = spriteManager.getSpriteSheet(knightSheets.walk);
            if (walkSheet) {
                // Walk animation has 8 rows (directions) × 13 columns (frames per direction)
                // Create frames array for a single direction (13 frames: 0-12)
                // The row will be selected based on movement direction in RenderSystem
                const framesPerDirection = walkSheet.cols; // 13 frames per direction
                const walkFrames = Array.from({length: framesPerDirection}, (_, i) => i);
                animationConfig.animations.walk = {
                    spriteSheetKey: knightSheets.walk,
                    frames: walkFrames, // 0-12, will be used as column index
                    frameDuration: 0.1,
                    loop: true,
                    useDirection: true // Flag to indicate direction-based row selection
                };
            }
        }
        
        if (knightSheets.run) {
            const runSheet = spriteManager.getSpriteSheet(knightSheets.run);
            if (runSheet) {
                const totalFrames = runSheet.totalFrames || (runSheet.rows * runSheet.cols);
                const runFrames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.run = {
                    spriteSheetKey: knightSheets.run,
                    frames: runFrames,
                    frameDuration: 0.08,
                    loop: true
                };
            }
        }
        
        if (knightSheets.melee) {
            const meleeSheet = spriteManager.getSpriteSheet(knightSheets.melee);
            if (meleeSheet) {
                const is8DirSingleFrame = (meleeSheet.rows === 8 && meleeSheet.cols === 1) || (meleeSheet.rows === 1 && meleeSheet.cols === 8);
                const meleeUseDirectionAsColumn = meleeSheet.rows === 1 && meleeSheet.cols === 8;
                const meleeFrames = is8DirSingleFrame ? [0] : Array.from({length: meleeSheet.totalFrames || (meleeSheet.rows * meleeSheet.cols)}, (_, i) => i);
                animationConfig.animations.melee = {
                    spriteSheetKey: knightSheets.melee,
                    frames: meleeFrames,
                    frameDuration: 0.1,
                    loop: false,
                    useDirection: is8DirSingleFrame,
                    useDirectionAsColumn: meleeUseDirectionAsColumn
                };
            }
        }
        
        if (knightSheets.melee2) {
            const melee2Sheet = spriteManager.getSpriteSheet(knightSheets.melee2);
            if (melee2Sheet) {
                const is8DirSingleFrame = (melee2Sheet.rows === 8 && melee2Sheet.cols === 1) || (melee2Sheet.rows === 1 && melee2Sheet.cols === 8);
                const melee2UseDirectionAsColumn = melee2Sheet.rows === 1 && melee2Sheet.cols === 8;
                const melee2Frames = is8DirSingleFrame ? [0] : Array.from({length: melee2Sheet.totalFrames || (melee2Sheet.rows * melee2Sheet.cols)}, (_, i) => i);
                animationConfig.animations.melee2 = {
                    spriteSheetKey: knightSheets.melee2,
                    frames: melee2Frames,
                    frameDuration: 0.1,
                    loop: false,
                    useDirection: is8DirSingleFrame,
                    useDirectionAsColumn: melee2UseDirectionAsColumn
                };
            }
        }

        if (knightSheets.meleeChop) {
            const meleeChopSheet = spriteManager.getSpriteSheet(knightSheets.meleeChop);
            if (meleeChopSheet) {
                const is8DirSingleFrame = (meleeChopSheet.rows === 8 && meleeChopSheet.cols === 1) || (meleeChopSheet.rows === 1 && meleeChopSheet.cols === 8);
                const meleeChopUseDirectionAsColumn = meleeChopSheet.rows === 1 && meleeChopSheet.cols === 8;
                const meleeChopFrames = is8DirSingleFrame ? [0] : Array.from({length: meleeChopSheet.totalFrames || (meleeChopSheet.rows * meleeChopSheet.cols)}, (_, i) => i);
                animationConfig.animations.meleeChop = {
                    spriteSheetKey: knightSheets.meleeChop,
                    frames: meleeChopFrames,
                    frameDuration: 0.1,
                    loop: false,
                    useDirection: is8DirSingleFrame,
                    useDirectionAsColumn: meleeChopUseDirectionAsColumn
                };
            }
        }

        if (knightSheets.meleeSpin) {
            const meleeSpinSheet = spriteManager.getSpriteSheet(knightSheets.meleeSpin);
            if (meleeSpinSheet) {
                const totalFrames = meleeSpinSheet.totalFrames || (meleeSpinSheet.rows * meleeSpinSheet.cols);
                const meleeSpinFrames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.meleeSpin = {
                    spriteSheetKey: knightSheets.meleeSpin,
                    frames: meleeSpinFrames,
                    frameDuration: 0.08,
                    loop: false
                };
            }
        }
        
        if (knightSheets.block) {
            const blockSheet = spriteManager.getSpriteSheet(knightSheets.block);
            if (blockSheet) {
                const is8DirSingleFrame = (blockSheet.rows === 8 && blockSheet.cols === 1) || (blockSheet.rows === 1 && blockSheet.cols === 8);
                const blockUseDirectionAsColumn = blockSheet.rows === 1 && blockSheet.cols === 8;
                const blockFrames = is8DirSingleFrame ? [0] : Array.from({length: blockSheet.totalFrames || (blockSheet.rows * blockSheet.cols)}, (_, i) => i);
                animationConfig.animations.block = {
                    spriteSheetKey: knightSheets.block,
                    frames: blockFrames,
                    frameDuration: 0.15,
                    loop: true,
                    useDirection: is8DirSingleFrame,
                    useDirectionAsColumn: blockUseDirectionAsColumn
                };
            }
        }
        
        if (knightSheets.roll) {
            const rollSheet = spriteManager.getSpriteSheet(knightSheets.roll);
            if (rollSheet) {
                const totalFrames = rollSheet.totalFrames || (rollSheet.rows * rollSheet.cols);
                const rollFrames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.roll = {
                    spriteSheetKey: knightSheets.roll,
                    frames: rollFrames,
                    frameDuration: 0.08,
                    loop: false
                };
            }
        }
        
        if (knightSheets.takeDamage) {
            const takeDamageSheet = spriteManager.getSpriteSheet(knightSheets.takeDamage);
            if (takeDamageSheet) {
                const totalFrames = takeDamageSheet.totalFrames || (takeDamageSheet.rows * takeDamageSheet.cols);
                const takeDamageFrames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.takeDamage = {
                    spriteSheetKey: knightSheets.takeDamage,
                    frames: takeDamageFrames,
                    frameDuration: 0.1,
                    loop: false
                };
            }
        }
        
        // Player melee stats come only from the equipped weapon (no generic base values)
        const weapon = Weapons[this.equippedWeaponKey] || Weapons.swordAndShield;
        const firstStage = weapon.getComboStageProperties ? weapon.getComboStageProperties(1) : null;
        const initialRange = firstStage ? firstStage.range : weapon.baseRange;
        const initialDamage = firstStage ? firstStage.damage : weapon.baseDamage;
        const initialArc = firstStage ? firstStage.arc : Utils.degToRad(weapon.baseArcDegrees);
        const initialCooldown = weapon.cooldown != null ? weapon.cooldown : 0.25;

        player
            .addComponent(new Transform(x, y, config.width, config.height))
            .addComponent(new Health(config.maxHealth))
            .addComponent(new StatusEffects(true))
            .addComponent(new Stamina(config.maxStamina, config.staminaRegen))
            .addComponent(new PlayerHealing())
            .addComponent(new PlayerMovement(config.speed))
            .addComponent(new Combat(initialRange, initialDamage, initialArc, initialCooldown, 0, true, weapon))
            .addComponent(new Renderable('player', { color: config.color }))
            .addComponent(new Sprite(defaultSheetKey, config.width * 3, config.height * 3))
            .addComponent(new Animation(animationConfig));
        
        // Set up player-specific behavior via controller
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

            if (this.screenManager.isScreen('title')) {
                if (this.screenManager.checkButtonClick(x, y, 'title')) {
                    this.screenManager.selectedStartLevel = 0;
                    this.startGame();
                }
            } else if (this.screenManager.isScreen('hub') && this.chestOpen) {
                const weaponKey = this.screenManager.getWeaponChestWeaponAt(x, y);
                if (weaponKey !== null) {
                    this.equippedWeaponKey = weaponKey;
                    const player = this.entities.get('player');
                    if (player && Weapons[weaponKey]) {
                        const combat = player.getComponent(Combat);
                        if (combat && combat.isPlayer) {
                            combat.stopBlocking();
                            combat.setWeapon(Weapons[weaponKey]);
                        }
                    }
                } else if (this.screenManager.getWeaponChestBackAt(x, y)) {
                    this.chestOpen = false;
                    this.chestUseCooldown = 0; // allow opening again immediately
                }
            } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                const levelAt = this.screenManager.getLevelSelectAt(x, y);
                if (levelAt !== null) {
                    this.hubSelectedLevel = levelAt;
                } else {
                    const btn = this.screenManager.getHubBoardButtonAt(x, y);
                    if (btn === 'start') {
                        this.boardOpen = false;
                        this.screenManager.selectedStartLevel = this.hubSelectedLevel;
                        this.startGame();
                    } else if (btn === 'back') {
                        this.boardOpen = false;
                    }
                }
            } else if (this.screenManager.isScreen('death')) {
                if (this.screenManager.checkButtonClick(x, y, 'death')) {
                    this.returnToSanctuaryOnDeath();
                }
            } else if (this.screenManager.isScreen('pause')) {
                const pauseBtn = this.screenManager.getPauseButtonAt(x, y);
                if (pauseBtn === 'resume') {
                    this.screenManager.setScreen(this.screenBeforePause || 'playing');
                } else if (pauseBtn === 'quit') {
                    this.quitToMainMenu();
                } else if (pauseBtn === 'settings') {
                    this.screenManager.setScreen('settings');
                } else if (pauseBtn === 'help') {
                    this.screenManager.setScreen('help');
                }
            } else if (this.screenManager.isScreen('help')) {
                if (this.screenManager.getHelpBackButtonAt(x, y)) {
                    this.screenManager.setScreen('pause');
                }
            } else if (this.screenManager.isScreen('settings')) {
                const item = this.screenManager.getSettingsItemAt(x, y, this.settings);
                if (item === 'music') {
                    this.settings.musicEnabled = !this.settings.musicEnabled;
                } else if (item === 'sfx') {
                    this.settings.sfxEnabled = !this.settings.sfxEnabled;
                } else if (item === 'minimap') {
                    this.settings.showMinimap = !this.settings.showMinimap;
                } else if (item === 'characterSprites') {
                    this.settings.useCharacterSprites = !this.settings.useCharacterSprites;
                } else if (item === 'environmentSprites') {
                    this.settings.useEnvironmentSprites = !this.settings.useEnvironmentSprites;
                } else if (item === 'playerHitboxIndicators') {
                    this.settings.showPlayerHitboxIndicators = !this.settings.showPlayerHitboxIndicators;
                } else if (item === 'enemyHitboxIndicators') {
                    this.settings.showEnemyHitboxIndicators = !this.settings.showEnemyHitboxIndicators;
                } else if (item === 'enemyStaminaBars') {
                    this.settings.showEnemyStaminaBars = !this.settings.showEnemyStaminaBars;
                } else if (item === 'playerHealthBarAlways') {
                    this.settings.showPlayerHealthBarAlways = !this.settings.showPlayerHealthBarAlways;
                } else if (item === 'enemyHealthBars') {
                    this.settings.showEnemyHealthBars = !this.settings.showEnemyHealthBars;
                } else if (item === 'controls') {
                    this.screenManager.setScreen('settings-controls');
                } else if (item === 'back') {
                    this.screenManager.setScreen('pause');
                }
            } else if (this.screenManager.isScreen('settings-controls')) {
                const item = this.screenManager.getControlsItemAt(x, y);
                if (item === 'back') {
                    this.screenManager.setScreen('settings');
                }
            }
        });
    }

    bindGlobalInputHandlers() {
        const inputSystem = this.systems ? this.systems.get('input') : null;
        if (!inputSystem || !this.systems || !this.systems.eventBus) {
            return;
        }

        // Handle global key commands: start game, restart, pause, and settings screen
        this.systems.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            const isStartKey = key === ' ' || key === 'enter';
            const isEscapeKey = key === 'escape' || key === 'esc';

            // Tab: toggle inventory/equipment (only when playing or in hub)
            if (key === 'tab') {
                if (this.screenManager.isScreen('playing') || this.screenManager.isScreen('hub')) {
                    this.inventoryOpen = !this.inventoryOpen;
                    this.setInventoryPanelVisible(this.inventoryOpen);
                    if (this.inventoryOpen) this.refreshInventoryPanel();
                }
                return;
            }

            if (isStartKey) {
                if (this.screenManager.isScreen('title')) {
                    this.screenManager.selectedStartLevel = 0;
                    this.startGame();
                } else if (this.screenManager.isScreen('death')) {
                    this.returnToSanctuaryOnDeath();
                } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                    this.boardOpen = false;
                    this.screenManager.selectedStartLevel = this.hubSelectedLevel;
                    this.startGame();
                }
            } else if (isEscapeKey) {
                // Close inventory first if open, then other overlays/pause
                if (this.inventoryOpen) {
                    this.inventoryOpen = false;
                    this.setInventoryPanelVisible(false);
                    return;
                }
                // Toggle pause when in-game or in sanctuary (hub), or close overlays
                if (this.screenManager.isScreen('playing')) {
                    this.screenBeforePause = 'playing';
                    this.screenManager.setScreen('pause');
                } else if (this.screenManager.isScreen('pause')) {
                    this.screenManager.setScreen(this.screenBeforePause || 'playing');
                } else if (this.screenManager.isScreen('settings')) {
                    this.screenManager.setScreen('pause');
                } else if (this.screenManager.isScreen('settings-controls')) {
                    this.screenManager.setScreen('settings');
                } else if (this.screenManager.isScreen('help')) {
                    this.screenManager.setScreen('pause');
                } else if (this.screenManager.isScreen('hub')) {
                    if (this.chestOpen) {
                        this.chestOpen = false;
                        this.chestUseCooldown = 0; // allow opening again immediately
                    } else if (this.boardOpen) {
                        this.boardOpen = false;
                    } else {
                        this.screenBeforePause = 'hub';
                        this.screenManager.setScreen('pause');
                    }
                }
            }
        });
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
                    this.lastHitEnemyId = data.entityId;
                }
            });
        }

        this.systems.eventBus.on(EventTypes.PLAYER_KILLED_ENEMY, () => {
            this.killsThisLife++;
        });
    }

    clearAllEntitiesAndProjectiles() {
        this.lastHitEnemyId = null;
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
            const hubLevel = GameConfig.levels && GameConfig.levels[0];
            if (hubLevel && hubLevel.walls) {
                for (const w of hubLevel.walls) {
                    obstacleManager.addObstacle(w.x, w.y, w.width, w.height, 'wall', null, { color: '#4a3020' });
                }
            }
            return;
        }

        const worldConfig = GameConfig.world;
        const levelConfig = GameConfig.levels && GameConfig.levels[level];
        const levelObstacles = levelConfig && levelConfig.obstacles
            ? levelConfig.obstacles
            : GameConfig.obstacles;
        const worldWidth = (levelConfig && levelConfig.worldWidth != null) ? levelConfig.worldWidth : worldConfig.width;
        const worldHeight = (levelConfig && levelConfig.worldHeight != null) ? levelConfig.worldHeight : worldConfig.height;

        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
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
        const worldConfig = GameConfig.world;
        const levels = GameConfig.levels || {};
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
            this.portal = null;
            this.board = hubLevel.board ? { ...hubLevel.board } : null;
            this.boardOpen = false;
            this.boardUseCooldown = 0;
            this.playerNearBoard = false;
            this.chest = hubLevel.weaponChest ? { ...hubLevel.weaponChest } : null;
            this.chestOpen = false;
            this.chestUseCooldown = 0;
            this.playerNearChest = false;
            this.hubSelectedLevel = 1;
            this.screenManager.setScreen('hub');
        } else {
            this.screenManager.setScreen('playing');
        }
        this.updateUIVisibility(true);
    }
    
    restartGame() {
        const worldConfig = GameConfig.world;

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
    
    updateUIVisibility(visible) {
        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.style.display = visible ? 'flex' : 'none';
        }
        if (!visible) {
            this.inventoryOpen = false;
            this.setInventoryPanelVisible(false);
        }
    }

    handleCameraZoom() {
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');
        if (!inputSystem || !cameraSystem) return;

        const wheelDelta = inputSystem.getWheelDelta();
        if (wheelDelta === 0) return;

        const zoomChange = wheelDelta > 0 ? -GameConfig.camera.zoomSpeed : GameConfig.camera.zoomSpeed;
        const newZoom = cameraSystem.targetZoom + zoomChange;
        cameraSystem.setZoom(newZoom, inputSystem.mouseX, inputSystem.mouseY, this.canvas.width, this.canvas.height);
    }

    updatePortal(deltaTime, player) {
        if (!this.portal) return;

        // Cooldown before the portal can be used again
        if (this.portalUseCooldown > 0) {
            this.portalUseCooldown = Math.max(0, this.portalUseCooldown - deltaTime);
        }

        const enemyManager = this.systems.get('enemies');
        if (!enemyManager) {
            this.playerNearPortal = false;
            return;
        }

        const currentLevel = enemyManager.getCurrentLevel();
        const levelConfig = GameConfig.levels[currentLevel];
        const nextLevel = currentLevel + 1;
        const nextLevelExists = GameConfig.levels[nextLevel];
        const killsRequired = (levelConfig && levelConfig.killsToUnlockPortal != null) ? levelConfig.killsToUnlockPortal : 999;
        const kills = enemyManager.getEnemiesKilledThisLevel();

        this.portal.targetLevel = nextLevel;
        // Spawn when objective complete so player can go to next level or return to Sanctuary
        this.portal.spawned = kills >= killsRequired;
        this.portal.hasNextLevel = !!nextLevelExists;

        if (!this.portal.spawned || !player) {
            this.playerNearPortal = false;
            return;
        }

        const transform = player.getComponent(Transform);
        if (!transform) {
            this.playerNearPortal = false;
            return;
        }

        // Check if player is near/overlapping portal
        const overlap = Utils.rectCollision(
            transform.left, transform.top, transform.width, transform.height,
            this.portal.x, this.portal.y, this.portal.width, this.portal.height
        );
        this.playerNearPortal = overlap;

        if (!overlap || this.portalUseCooldown > 0) {
            return;
        }

        const inputSystem = this.systems.get('input');
        if (!inputSystem) return;

        // B: return to Sanctuary (hub)
        if (inputSystem.isKeyPressed('b')) {
            this.screenManager.selectedStartLevel = 0;
            this.startGame();
            this.portalUseCooldown = 1.5;
            return;
        }

        // E: enter portal to next level
        if (inputSystem.isKeyPressed('e') && nextLevelExists) {
            const obstacleManager = this.systems.get('obstacles');
            const worldConfig = GameConfig.world;
            const nextLevelConfig = GameConfig.levels[nextLevel];
            const nextWorldWidth = (nextLevelConfig && nextLevelConfig.worldWidth != null) ? nextLevelConfig.worldWidth : worldConfig.width;
            const nextWorldHeight = (nextLevelConfig && nextLevelConfig.worldHeight != null) ? nextLevelConfig.worldHeight : worldConfig.height;
            const nextObstacles = nextLevelConfig.obstacles;
            obstacleManager.clearWorld();
            obstacleManager.generateWorld(nextWorldWidth, nextWorldHeight, nextObstacles, {
                x: this.portal.x + this.portal.width / 2,
                y: this.portal.y + this.portal.height / 2,
                radius: 120
            });
            this._currentWorldWidth = nextWorldWidth;
            this._currentWorldHeight = nextWorldHeight;
            const cameraSystem = this.systems.get('camera');
            const pathfindingSystem = this.systems.get('pathfinding');
            if (cameraSystem && cameraSystem.setWorldBounds) cameraSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            if (pathfindingSystem && pathfindingSystem.setWorldBounds) pathfindingSystem.setWorldBounds(nextWorldWidth, nextWorldHeight);
            const playerSpawnForLevel = transform ? { x: transform.x, y: transform.y } : null;
            enemyManager.changeLevel(nextLevel, this.entities, obstacleManager, playerSpawnForLevel);
            this.portalUseCooldown = 1.5; // Prevent double-trigger
        }
    }

    updateHub(deltaTime) {
        // Decrement cooldowns even when overlay is open so reopening works after closing
        if (this.boardUseCooldown > 0) {
            this.boardUseCooldown = Math.max(0, this.boardUseCooldown - deltaTime);
        }
        if (this.chestUseCooldown > 0) {
            this.chestUseCooldown = Math.max(0, this.chestUseCooldown - deltaTime);
        }
        if (this.boardOpen || this.chestOpen) return; // modal overlay; only clicks matter

        this.handleCameraZoom();

        // Crossbow reload and state sync (so reload UI shows in sanctuary)
        const player = this.entities.get('player');
        if (player) {
            const combat = player.getComponent(Combat);
            const weapon = combat && combat.playerAttack ? combat.playerAttack.weapon : null;
            const isCrossbow = weapon && weapon.isRanged === true;
            const crossbowConfig = GameConfig.player.crossbow;
            if (isCrossbow && crossbowConfig && this.crossbowReloadInProgress && this.crossbowReloadProgress < 1) {
                this.crossbowReloadProgress = Math.min(1, this.crossbowReloadProgress + deltaTime / crossbowConfig.reloadTime);
                if (this.crossbowReloadProgress >= 1) this.crossbowReloadInProgress = false;
            }
            if (combat && !isCrossbow) {
                this.crossbowReloadProgress = 1;
                this.crossbowReloadInProgress = false;
                this.crossbowPerfectReloadNext = false;
            }
            if (isCrossbow) {
                player.crossbowReloadProgress = this.crossbowReloadProgress;
                player.crossbowReloadInProgress = this.crossbowReloadInProgress;
            }
        }

        this.systems.update(deltaTime);
        this.entities.update(deltaTime, this.systems);

        const cameraSystem = this.systems.get('camera');
        const inputSystem = this.systems.get('input');
        if (player) {
            const transform = player.getComponent(Transform);
            if (transform && cameraSystem) {
                cameraSystem.follow(transform, this.canvas.width, this.canvas.height);
            }
        }
        if (player && this.board) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    this.board.x, this.board.y, this.board.width, this.board.height
                );
                this.playerNearBoard = overlap;
                if (overlap && this.boardUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    this.boardOpen = true;
                    this.boardUseCooldown = 0.4;
                }
            } else {
                this.playerNearBoard = false;
            }
        } else {
            this.playerNearBoard = false;
        }
        if (player && this.chest) {
            const transform = player.getComponent(Transform);
            if (transform) {
                const overlap = Utils.rectCollision(
                    transform.left, transform.top, transform.width, transform.height,
                    this.chest.x, this.chest.y, this.chest.width, this.chest.height
                );
                this.playerNearChest = overlap;
                if (overlap && this.chestUseCooldown <= 0 && inputSystem && inputSystem.isKeyPressed('e')) {
                    this.chestOpen = true;
                    this.chestUseCooldown = 0.4;
                }
            } else {
                this.playerNearChest = false;
            }
        } else {
            this.playerNearChest = false;
        }

        // Keep UI (health/stamina bars) in sync while in the hub/sanctuary
        // so these values are not visually tied to combat levels only.
        if (player) {
            this.updateUI(player);
        }
    }

    update(deltaTime) {
        if (this.screenManager.currentScreen === 'hub') {
            this.updateHub(deltaTime);
            return;
        }
        // Only update game logic if playing (not title, death, or pause)
        if (this.screenManager.currentScreen !== 'playing') {
            return;
        }

        // Handle camera zoom with mouse wheel
        this.handleCameraZoom();

        // Update player projectile cooldown
        if (this.playerProjectileCooldown > 0) {
            this.playerProjectileCooldown = Math.max(0, this.playerProjectileCooldown - deltaTime);
        }

        // Update crossbow reload (only when R has been pressed to begin reload)
        const player = this.entities.get('player');
        const combat = player ? player.getComponent(Combat) : null;
        const weapon = combat && combat.playerAttack ? combat.playerAttack.weapon : null;
        const isCrossbow = weapon && weapon.isRanged === true;
        const crossbowConfig = GameConfig.player.crossbow;
        if (isCrossbow && crossbowConfig && this.crossbowReloadInProgress && this.crossbowReloadProgress < 1) {
            this.crossbowReloadProgress = Math.min(1, this.crossbowReloadProgress + deltaTime / crossbowConfig.reloadTime);
            if (this.crossbowReloadProgress >= 1) this.crossbowReloadInProgress = false;
        }
        if (player && combat && !isCrossbow) {
            this.crossbowReloadProgress = 1;
            this.crossbowReloadInProgress = false;
            this.crossbowPerfectReloadNext = false;
        }
        // Expose crossbow state on player for rendering (reload bar under floating health bar)
        if (player && isCrossbow) {
            player.crossbowReloadProgress = this.crossbowReloadProgress;
            player.crossbowReloadInProgress = this.crossbowReloadInProgress;
        }

        // Update all systems
        this.systems.update(deltaTime);
        
        // Update damage numbers
        const damageNumberManager = this.systems.get('damageNumbers');
        if (damageNumberManager) {
            damageNumberManager.update(deltaTime);
        }
        
        // Update projectiles
        const projectileManager = this.systems.get('projectiles');
        if (projectileManager) {
            projectileManager.update(deltaTime, this.systems);
        }

        const hazardManager = this.systems.get('hazards');
        if (hazardManager && hazardManager.updateFlamePillars) {
            hazardManager.updateFlamePillars(deltaTime, this.systems);
        }
        
        // Update health orbs
        const healthOrbManager = this.systems.get('healthOrbs');
        if (healthOrbManager) {
            healthOrbManager.update(deltaTime, this.systems);
        }
        const gatherableManager = this.systems.get('gatherables');
        if (gatherableManager) {
            gatherableManager.update(deltaTime, this.systems);
        }
        
        // Update all entities
        this.entities.update(deltaTime, this.systems);
        
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
                this.killsThisLife = 0; // reset for next life
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

        // Portal: update spawned state and handle E to enter
        this.updatePortal(deltaTime, player);
        
        // Update UI
        this.updateUI(player);
    }

    updateUI(player) {
        if (!player) return;
        if (this.inventoryOpen) this.refreshInventoryPanel();

        const health = player.getComponent(Health);
        const stamina = player.getComponent(Stamina);
        const combat = player.getComponent(Combat);

        if (health) {
            const healthPercent = health.percent * 100;
            const healthFillEl = document.getElementById('health-orb-fill');
            if (healthFillEl) healthFillEl.style.height = healthPercent + '%';
            const healthTextEl = document.getElementById('health-text');
            if (healthTextEl) healthTextEl.textContent =
                Math.floor(health.currentHealth) + '/' + health.maxHealth;
        }

        if (stamina) {
            const staminaPercent = stamina.percent * 100;
            const staminaFillEl = document.getElementById('stamina-orb-fill');
            if (staminaFillEl) staminaFillEl.style.height = staminaPercent + '%';
            document.getElementById('stamina-text').textContent =
                Math.floor(stamina.currentStamina) + '/' + stamina.maxStamina;
            const staminaOrbEl = document.getElementById('stamina-orb');
            if (staminaOrbEl) {
                if (combat && combat.dashAttackFlashUntil > Date.now()) {
                    staminaOrbEl.classList.add('stamina-pulse');
                } else {
                    staminaOrbEl.classList.remove('stamina-pulse');
                }
            }
        }

        const healing = player.getComponent(PlayerHealing);
        const healChargesEl = document.getElementById('heal-charges');
        if (healing && healChargesEl) {
            healChargesEl.textContent = healing.charges + '/' + healing.maxCharges;
        }

        // Stun buildup bar (under SP): always show fill by percent
        const statusEffects = player.getComponent(StatusEffects);
        const stunBarEl = document.getElementById('stun-bar');
        if (statusEffects && stunBarEl) {
            const pct = Math.min(100, statusEffects.stunMeterPercent * 100);
            stunBarEl.style.width = pct + '%';
        }

        // Stun duration bar: only visible after the player has been stunned (while isStunned)
        const stunDurationRow = document.getElementById('stun-duration-row');
        const stunDurationBar = document.getElementById('stun-duration-bar');
        if (statusEffects && stunDurationRow && stunDurationBar) {
            if (statusEffects.isStunned) {
                stunDurationRow.style.display = '';
                const remain = statusEffects.stunDurationPercentRemaining * 100;
                stunDurationBar.style.width = remain + '%';
            } else {
                stunDurationRow.style.display = 'none';
            }
        }
    }

    setInventoryPanelVisible(visible) {
        const el = document.getElementById('inventory-screen');
        if (el) el.classList.toggle('hidden', !visible);
    }

    refreshInventoryPanel() {
        const player = this.entities.get('player');
        if (!player) return;
        const health = player.getComponent(Health);
        const stamina = player.getComponent(Stamina);
        const combat = player.getComponent(Combat);
        const healing = player.getComponent(PlayerHealing);

        const healthEl = document.getElementById('inventory-stat-health');
        const staminaEl = document.getElementById('inventory-stat-stamina');
        const healthBarEl = document.getElementById('inventory-bar-health');
        const staminaBarEl = document.getElementById('inventory-bar-stamina');
        const damageEl = document.getElementById('inventory-stat-damage');
        const weaponEl = document.getElementById('inventory-equip-weapon');
        const healChargesEl = document.getElementById('inventory-stat-heal');
        const killsEl = document.getElementById('inventory-stat-kills');
        if (healthEl && health) healthEl.textContent = Math.floor(health.currentHealth) + ' / ' + health.maxHealth;
        if (staminaEl && stamina) staminaEl.textContent = Math.floor(stamina.currentStamina) + ' / ' + stamina.maxStamina;
        if (healthBarEl && health) healthBarEl.style.width = (health.percent * 100) + '%';
        if (staminaBarEl && stamina) staminaBarEl.style.width = (stamina.percent * 100) + '%';
        if (healChargesEl && healing) healChargesEl.textContent = healing.charges + ' / ' + healing.maxCharges;
        if (damageEl && combat && combat.attackHandler) {
            const dmg = combat.attackHandler.attackDamage != null ? Math.floor(combat.attackHandler.attackDamage) : '—';
            damageEl.textContent = String(dmg);
        }
        if (weaponEl) weaponEl.textContent = this.getWeaponDisplayName(this.equippedWeaponKey);
        if (killsEl) killsEl.textContent = String(this.killsThisLife);

        this.drawInventoryPlayerPortrait();
    }

    /** Draw front-facing player sprite into the inventory portrait canvas. */
    drawInventoryPlayerPortrait() {
        const canvas = document.getElementById('inventory-player-portrait');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const spriteManager = this.systems && this.systems.get('sprites');
        if (!spriteManager) return;
        const knightSheets = spriteManager.knightSheets || {};
        const idleKey = knightSheets.idle || knightSheets.walk || null;
        if (!idleKey) return;
        const sheet = spriteManager.getSpriteSheet(idleKey);
        if (!sheet || !sheet.image) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const frontFrameCol = 0;
        const frontFrameRow = 0;
        const frameCoords = SpriteUtils.getFrameCoords(sheet, frontFrameRow, frontFrameCol);
        if (!frameCoords || frameCoords.sourceWidth <= 0 || frameCoords.sourceHeight <= 0) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
            sheet.image,
            frameCoords.sourceX, frameCoords.sourceY, frameCoords.sourceWidth, frameCoords.sourceHeight,
            0, 0, w, h
        );
    }

    getWeaponDisplayName(key) {
        if (!key) return '—';
        const names = {
            swordAndShield: 'Sword & Shield',
            greatsword: 'Greatsword',
            mace: 'Mace',
            dagger: 'Dagger',
            crossbow: 'Crossbow'
        };
        return names[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
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

    render() {
        try {
            if (this.screenManager.isScreen('title') || this.screenManager.isScreen('death')) {
                this.screenManager.render(this.settings);
                return;
            }

            const renderSystem = this.systems.get('render');
            const cameraSystem = this.systems.get('camera');
            const obstacleManager = this.systems.get('obstacles');
            const worldConfig = GameConfig.world;

            if (!renderSystem || !cameraSystem) {
                console.error('Missing render or camera system');
                return;
            }

            const inHubContext = this.screenManager.isScreen('hub') ||
                ((this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings') || this.screenManager.isScreen('settings-controls')) && this.screenBeforePause === 'hub');
            if (inHubContext) {
                const hubConfig = GameConfig.hub;
                try {
                    renderSystem.clear();
                    renderSystem.renderWorld(cameraSystem, obstacleManager, 0, hubConfig.width, hubConfig.height);
                    if (this.board) {
                        renderSystem.renderBoard(this.board, cameraSystem);
                        if (this.playerNearBoard) {
                            renderSystem.renderBoardInteractionPrompt(this.board, cameraSystem, true);
                        }
                    }
                    if (this.chest) {
                        renderSystem.renderChest(this.chest, cameraSystem);
                        if (this.playerNearChest) {
                            renderSystem.renderChestInteractionPrompt(this.chest, cameraSystem, true);
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
                    if (this.boardOpen) {
                        this.screenManager.renderHubBoardOverlay(this.hubSelectedLevel);
                    }
                    if (this.chestOpen) {
                        this.screenManager.renderWeaponChestOverlay(this.equippedWeaponKey);
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
                if (this.portal) {
                    renderSystem.renderPortal(this.portal, cameraSystem);
                    if (this.playerNearPortal) {
                        renderSystem.renderPortalInteractionPrompt(this.portal, cameraSystem, this.playerNearPortal);
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
                    renderSystem.renderMinimap(cameraSystem, this.entities, w, h, this.portal, currentLevel);
                }
                if (this.screenManager.isScreen('playing')) {
                    const inputSystem = this.systems.get('input');
                    const hoveredEnemy = inputSystem ? this.getEnemyAtScreenPoint(inputSystem.mouseX, inputSystem.mouseY) : null;
                    const lastHitEntity = this.lastHitEnemyId ? this.entities.get(this.lastHitEnemyId) : null;
                    const lastHitValid = lastHitEntity && lastHitEntity.getComponent(Renderable)?.type === 'enemy' && lastHitEntity.getComponent(Health) && !lastHitEntity.getComponent(Health).isDead;
                    const tooltipEnemy = hoveredEnemy || (lastHitValid ? lastHitEntity : null);
                    if (tooltipEnemy) {
                        const ai = tooltipEnemy.getComponent(AI);
                        const statusEffects = tooltipEnemy.getComponent(StatusEffects);
                        const health = tooltipEnemy.getComponent(Health);
                        const displayName = this.getEnemyDisplayName(ai ? ai.enemyType : null);
                        const packModifiers = GameConfig.packModifiers || {};
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

