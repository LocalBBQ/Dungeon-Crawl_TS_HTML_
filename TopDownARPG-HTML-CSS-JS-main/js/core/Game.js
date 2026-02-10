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
            // Portal state (spawns after enough kills; enter with E)
            this.portal = null;
            this.portalUseCooldown = 0;
            this.playerNearPortal = false;
            // Hub: level-select board (safe area, no enemies)
            this.board = null;
            this.boardOpen = false;
            this.boardUseCooldown = 0;
            this.playerNearBoard = false;
            this.hubSelectedLevel = 1;

            // Game-wide settings (toggled from pause/settings screen)
            this.settings = {
                musicEnabled: true,
                sfxEnabled: true,
                showMinimap: true,
                useCharacterSprites: true,   // Player + enemies use sprite sheets vs procedural canvas knight
                useEnvironmentSprites: true  // Trees/rocks/houses etc use sprite images vs procedural shapes
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
    }

    initSystems() {
        const worldConfig = GameConfig.world;

        // Create system manager if not already created
        if (!this.systems) {
            this.systems = new SystemManager();
        }

        // Register entities as a \"system\" so other systems can access it
        this.systems.register('entities', this.entities);

        // Register sprite manager first
        const spriteManager = new SpriteManager();
        this.systems.register('sprites', spriteManager);

        // Register core systems in order
        this.systems
            .register('input', new InputSystem(this.canvas))
            .register('camera', new CameraSystem(worldConfig.width, worldConfig.height))
            .register('collision', new CollisionSystem())
            .register('obstacles', new ObstacleManager());

        // Generate world before pathfinding
        const obstacleManager = this.systems.get('obstacles');
        const level1Config = GameConfig.levels && GameConfig.levels[1] && GameConfig.levels[1].obstacles
            ? GameConfig.levels[1].obstacles
            : GameConfig.obstacles;
        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        obstacleManager.generateWorld(worldConfig.width, worldConfig.height, level1Config, {
            x: portalConfig.x + portalConfig.width / 2,
            y: portalConfig.y + portalConfig.height / 2,
            radius: 120
        });

        // Now register systems that depend on obstacles
        this.systems
            .register('pathfinding', new PathfindingSystem(
                obstacleManager,
                worldConfig.width,
                worldConfig.height,
                GameConfig.pathfinding.cellSize
            ))
            .register('enemies', new EnemyManager())
            .register('hazards', new HazardManager())
            .register('damageNumbers', new DamageNumberManager())
            .register('projectiles', new ProjectileManager())
            .register('healthOrbs', new HealthOrbManager())
            .register('render', new RenderSystem(this.canvas, this.ctx));

        // Initialize render system with systems reference
        const renderSystem = this.systems.get('render');
        if (renderSystem && renderSystem.init) {
            renderSystem.init(this.systems);
            // Expose live settings so render system can respect sprite toggles
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

        // Load goblin sprite sheet
        try {
            const goblinSpritePath = 'assets/sprites/enemies/Goblin.png';
            const goblinRows = 5;
            const goblinCols = 4;
            
            // Load the image first to get dimensions
            const goblinImg = await spriteManager.loadSprite(goblinSpritePath);
            
            // Calculate frame dimensions from image size
            // Use exact division to avoid rounding errors that cause bleeding
            const goblinFrameWidth = goblinImg.width / goblinCols;
            const goblinFrameHeight = goblinImg.height / goblinRows;
            
            console.log(`Goblin sprite sheet dimensions: ${goblinImg.width}x${goblinImg.height}`);
            console.log(`Goblin frame dimensions: ${goblinFrameWidth}x${goblinFrameHeight} (${goblinRows} rows x ${goblinCols} cols)`);
            
            await spriteManager.loadSpriteSheet(
                goblinSpritePath,
                goblinFrameWidth,
                goblinFrameHeight,
                goblinRows,
                goblinCols
            );
            console.log('Goblin sprite sheet loaded successfully');
        } catch (error) {
            console.warn('Failed to load goblin sprite sheet:', error);
            console.log('Goblins will use fallback rendering');
        }
    }

    initializeEntities() {
        // Create player
        const player = this.createPlayer();
        this.entities.add(player, 'player');
        
        // Initialize camera position to player position
        const transform = player.getComponent(Transform);
        const cameraSystem = this.systems.get('camera');
        if (transform && cameraSystem) {
            const effectiveWidth = this.canvas.width / cameraSystem.zoom;
            const effectiveHeight = this.canvas.height / cameraSystem.zoom;
            cameraSystem.x = transform.x - effectiveWidth / 2;
            cameraSystem.y = transform.y - effectiveHeight / 2;
        }
        
        // Set up damage number event listener
        const damageNumberManager = this.systems.get('damageNumbers');
        this.systems.eventBus.on(EventTypes.DAMAGE_TAKEN, (data) => {
            damageNumberManager.createDamageNumber(
                data.x,
                data.y,
                data.damage,
                data.isPlayerDamage,
                data.isBlocked
            );
        });
        
        // Spawn enemies based on level (set by startGame when starting from title)
        const enemyManager = this.systems.get('enemies');
        const obstacleManager = this.systems.get('obstacles');
        const initialLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;

        if (enemyManager && obstacleManager) {
            enemyManager.spawnLevelEnemies(initialLevel, this.entities, obstacleManager);
        }

        // Portal: same position every level; spawns when kills >= level's killsToUnlockPortal
        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        const currentLevel = enemyManager ? enemyManager.getCurrentLevel() : 1;
        const maxLevel = GameConfig.levels ? Math.max(...Object.keys(GameConfig.levels).map(Number)) : 3;
        this.portal = {
            x: portalConfig.x,
            y: portalConfig.y,
            width: portalConfig.width,
            height: portalConfig.height,
            spawned: false,
            targetLevel: Math.min(currentLevel + 1, maxLevel)
        };
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
        
        player
            .addComponent(new Transform(x, y, config.width, config.height))
            .addComponent(new Health(config.maxHealth))
            .addComponent(new Stamina(config.maxStamina, config.staminaRegen))
            .addComponent(new PlayerMovement(config.speed))
            .addComponent(new Combat(config.attackRange, config.attackDamage, Utils.degToRad(config.attackArcDegrees), config.attackCooldown, 0, true, Weapons[config.defaultWeapon] || Weapons.sword)) // isPlayer=true, weapon from config
            .addComponent(new Renderable('player', { color: config.color }))
            .addComponent(new Sprite(defaultSheetKey, config.width * 4, config.height * 4))
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
                    // From the title screen, go straight into the game (level 1 by default)
                    this.startGame();
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
                    this.restartGame();
                }
            } else if (this.screenManager.isScreen('pause')) {
                const pauseBtn = this.screenManager.getPauseButtonAt(x, y);
                if (pauseBtn === 'resume') {
                    this.screenManager.setScreen('playing');
                } else if (pauseBtn === 'quit') {
                    this.quitToMainMenu();
                } else if (pauseBtn === 'settings') {
                    this.screenManager.setScreen('settings');
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
                } else if (item === 'back') {
                    // Return to pause menu
                    this.screenManager.setScreen('pause');
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

            if (isStartKey) {
                if (this.screenManager.isScreen('title')) {
                    // From the title screen, start the game directly
                    this.startGame();
                } else if (this.screenManager.isScreen('death')) {
                    this.restartGame();
                } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                    this.boardOpen = false;
                    this.screenManager.selectedStartLevel = this.hubSelectedLevel;
                    this.startGame();
                }
            } else if (isEscapeKey) {
                // Toggle pause when in-game, or close overlays
                if (this.screenManager.isScreen('playing')) {
                    this.screenManager.setScreen('pause');
                } else if (this.screenManager.isScreen('pause')) {
                    this.screenManager.setScreen('playing');
                } else if (this.screenManager.isScreen('settings')) {
                    // From settings, go back to pause
                    this.screenManager.setScreen('pause');
                } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                    this.boardOpen = false;
                }
            }
        });
    }

    clearAllEntitiesAndProjectiles() {
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
        const worldConfig = GameConfig.world;
        const obstacleManager = this.systems.get('obstacles');
        if (!obstacleManager) return;

        obstacleManager.clearWorld();

        const levelObstacles = GameConfig.levels && GameConfig.levels[level] && GameConfig.levels[level].obstacles
            ? GameConfig.levels[level].obstacles
            : GameConfig.obstacles;

        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        obstacleManager.generateWorld(worldConfig.width, worldConfig.height, levelObstacles, {
            x: portalConfig.x + portalConfig.width / 2,
            y: portalConfig.y + portalConfig.height / 2,
            radius: 120
        });
    }

    quitToMainMenu() {
        this.clearAllEntitiesAndProjectiles();
        this.screenManager.setScreen('title');
        this.updateUIVisibility(false);
    }

    startHub() {
        const hubConfig = GameConfig.hub;
        const obstacleManager = this.systems.get('obstacles');
        const enemyManager = this.systems.get('enemies');

        obstacleManager.clearWorld();
        for (const w of hubConfig.walls) {
            obstacleManager.addObstacle(w.x, w.y, w.width, w.height, 'wall', null, { color: '#4a3020' });
        }

        if (enemyManager) {
            enemyManager.enemies = [];
            enemyManager.enemiesSpawned = false;
        }

        // Clear any remaining entities/projectiles/damage numbers/orbs
        this.clearAllEntitiesAndProjectiles();

        const player = this.createPlayer(hubConfig.playerStart);
        this.entities.add(player, 'player');

        const cameraSystem = this.systems.get('camera');
        cameraSystem.setWorldBounds(1e7, 1e7);
        const transform = player.getComponent(Transform);
        if (transform && cameraSystem) {
            const effectiveWidth = this.canvas.width / cameraSystem.zoom;
            const effectiveHeight = this.canvas.height / cameraSystem.zoom;
            cameraSystem.x = transform.x - effectiveWidth / 2;
            cameraSystem.y = transform.y - effectiveHeight / 2;
        }

        this.portal = null;
        this.board = { ...hubConfig.board };
        this.boardOpen = false;
        this.boardUseCooldown = 0;
        this.playerNearBoard = false;
        this.hubSelectedLevel = 1;

        this.screenManager.setScreen('hub');
        this.updateUIVisibility(true);
    }
    
    startGame() {
        const selectedLevel = this.screenManager.selectedStartLevel;
        const enemyManager = this.systems.get('enemies');
        const cameraSystem = this.systems.get('camera');
        const worldConfig = GameConfig.world;
        if (cameraSystem) {
            cameraSystem.setWorldBounds(worldConfig.width, worldConfig.height);
        }

        // Regenerate world and reset enemies for the selected level
        this.regenerateWorldForLevel(selectedLevel);
        this.resetEnemyManager(selectedLevel);

        this.initializeEntities();
        this.screenManager.setScreen('playing');
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
    
    updateUIVisibility(visible) {
        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.style.display = visible ? 'block' : 'none';
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
        this.portal.spawned = nextLevelExists && kills >= killsRequired;

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

        // Handle E key press to enter portal
        const inputSystem = this.systems.get('input');
        if (inputSystem && inputSystem.isKeyPressed('e') && nextLevelExists) {
            const obstacleManager = this.systems.get('obstacles');
            const worldConfig = GameConfig.world;
            const nextObstacles = GameConfig.levels[nextLevel].obstacles;
            obstacleManager.clearWorld();
            obstacleManager.generateWorld(worldConfig.width, worldConfig.height, nextObstacles, {
                x: this.portal.x + this.portal.width / 2,
                y: this.portal.y + this.portal.height / 2,
                radius: 120
            });
            enemyManager.changeLevel(nextLevel, this.entities, obstacleManager);
            this.portalUseCooldown = 1.5; // Prevent double-trigger
        }
    }

    updateHub(deltaTime) {
        if (this.boardOpen) return; // modal overlay; only clicks matter

        if (this.boardUseCooldown > 0) {
            this.boardUseCooldown = Math.max(0, this.boardUseCooldown - deltaTime);
        }

        // Handle camera zoom while in the hub
        this.handleCameraZoom();

        this.systems.update(deltaTime);
        this.entities.update(deltaTime, this.systems);

        const player = this.entities.get('player');
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
                if (overlap && this.boardUseCooldown <= 0 && inputSystem.isKeyPressed('e')) {
                    this.boardOpen = true;
                    this.boardUseCooldown = 0.4;
                }
            } else {
                this.playerNearBoard = false;
            }
        } else {
            this.playerNearBoard = false;
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
        
        // Update all entities
        this.entities.update(deltaTime, this.systems);
        
        // Handle player attacks
        const player = this.entities.get('player');
        if (player) {
            const enemyManager = this.systems.get('enemies');
            
            // Check if player attacks hit any enemies
            enemyManager.checkPlayerAttack(player);
            
            // Handle enemy attacks on player
            enemyManager.checkEnemyAttacks(player);
            
            // Check for player death
            const health = player.getComponent(Health);
            if (health && health.isDead && this.screenManager.isScreen('playing')) {
                this.screenManager.setScreen('death');
                this.updateUIVisibility(false);
            }
        }
        
        // Update camera to follow player
        if (player) {
            const transform = player.getComponent(Transform);
            const cameraSystem = this.systems.get('camera');
            if (transform && cameraSystem) {
                cameraSystem.follow(transform, this.canvas.width, this.canvas.height);
            }
        }

        // Portal: update spawned state and handle E to enter
        this.updatePortal(deltaTime, player);
        
        // Update UI
        this.updateUI(player);
    }

    updateUI(player) {
        if (!player) return;
        
        const health = player.getComponent(Health);
        const stamina = player.getComponent(Stamina);
        
        if (health) {
            const healthPercent = health.percent * 100;
            document.getElementById('health-bar').style.width = healthPercent + '%';
            document.getElementById('health-text').textContent = 
                Math.floor(health.currentHealth) + '/' + health.maxHealth;
        }
        
        if (stamina) {
            const staminaPercent = stamina.percent * 100;
            document.getElementById('stamina-bar').style.width = staminaPercent + '%';
            document.getElementById('stamina-text').textContent = 
                Math.floor(stamina.currentStamina) + '/' + stamina.maxStamina;
        }

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

            if (this.screenManager.isScreen('hub')) {
                const hubConfig = GameConfig.hub;
                renderSystem.clear();
                renderSystem.renderWorld(cameraSystem, obstacleManager, 0, hubConfig.width, hubConfig.height);
                if (this.board) {
                    renderSystem.renderBoard(this.board, cameraSystem);
                    if (this.playerNearBoard) {
                        renderSystem.renderBoardInteractionPrompt(this.board, cameraSystem, true);
                    }
                }
                const hubEntities = this.entities.getAll();
                renderSystem.renderEntities(hubEntities, cameraSystem);
                if (this.settings.showMinimap) {
                    renderSystem.renderMinimap(cameraSystem, this.entities, hubConfig.width, hubConfig.height, null, 0);
                }
                if (this.boardOpen) {
                    this.screenManager.renderHubBoardOverlay(this.hubSelectedLevel);
                }
                return;
            }

            // Game world and entities (draw for both 'playing' and 'pause' so pause shows over frozen frame)
            renderSystem.clear();
            const currentLevel = this.systems.get('enemies') ? this.systems.get('enemies').getCurrentLevel() : 1;
            renderSystem.renderWorld(cameraSystem, obstacleManager, currentLevel);
            if (this.portal) {
                renderSystem.renderPortal(this.portal, cameraSystem);
                if (this.playerNearPortal) {
                    renderSystem.renderPortalInteractionPrompt(this.portal, cameraSystem, this.playerNearPortal);
                }
            }
            const entities = this.entities.getAll();
            if (entities.length === 0) {
                console.warn('No entities to render');
            }
            renderSystem.renderEntities(entities, cameraSystem);
            
            // Render projectiles (after entities, before damage numbers)
            const projectileManager = this.systems.get('projectiles');
            if (projectileManager) {
                projectileManager.render(this.ctx, cameraSystem);
            }
            const hazardManager = this.systems.get('hazards');
            if (hazardManager && hazardManager.renderFlamePillars) {
                hazardManager.renderFlamePillars(this.ctx, cameraSystem);
            }
            
            // Render damage numbers (after entities so they appear on top)
            const damageNumberManager = this.systems.get('damageNumbers');
            if (damageNumberManager) {
                damageNumberManager.render(this.ctx, cameraSystem);
            }
            
            // Render health orbs
            const healthOrbManager = this.systems.get('healthOrbs');
            if (healthOrbManager) {
                healthOrbManager.render(this.ctx, cameraSystem);
            }
            
            if (this.settings.showMinimap) {
                renderSystem.renderMinimap(cameraSystem, this.entities, worldConfig.width, worldConfig.height, this.portal, currentLevel);
            }

            if (this.screenManager.isScreen('pause') || this.screenManager.isScreen('settings')) {
                this.screenManager.render(this.settings);
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

