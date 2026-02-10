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
            
            // Initialize systems
            this.systems = new SystemManager();
            this.entities = new EntityManager();
            
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
            
            // Initialize screen manager
            this.screenManager = null; // Will be initialized after canvas setup
            
            this.setupCanvas();
            // Initialize systems asynchronously (loads sprites)
            this.initializeSystems().then(() => {
                // Don't initialize entities yet - wait for title screen
                this.setupEventListeners();
                
                this.running = true;
                this.lastTime = performance.now();
                
                console.log('Game initialized successfully');
                
                // Start with title screen
                this.screenManager.setScreen('title');
                this.updateUIVisibility(false);
                
                // Set up space key handler after input system is ready
                const inputSystem = this.systems.get('input');
                if (inputSystem && this.systems.eventBus) {
                    this.systems.eventBus.on('input:keydown', (key) => {
                        const isStartKey = key === ' ' || key === 'enter';
                        if (isStartKey) {
                            if (this.screenManager.isScreen('title')) {
                                this.startHub();
                            } else if (this.screenManager.isScreen('death')) {
                                this.restartGame();
                            } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                                this.boardOpen = false;
                                this.screenManager.selectedStartLevel = this.hubSelectedLevel;
                                this.startGame();
                            }
                        } else if (key === 'escape') {
                            if (this.screenManager.isScreen('playing')) {
                                this.screenManager.setScreen('pause');
                            } else if (this.screenManager.isScreen('pause')) {
                                this.screenManager.setScreen('playing');
                            } else if (this.screenManager.isScreen('hub') && this.boardOpen) {
                                this.boardOpen = false;
                            }
                        }
                    });
                }
                
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

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Initialize screen manager after canvas is set up
        this.screenManager = new ScreenManager(this.canvas, this.ctx);
    }

    async initializeSystems() {
        const worldConfig = GameConfig.world;
        
        // Register entities as a "system" so other systems can access it
        this.systems.register('entities', this.entities);
        
        // Register sprite manager first
        const spriteManager = new SpriteManager();
        this.systems.register('sprites', spriteManager);
        
        // Register systems in order
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
        
        // Now register pathfinding (needs obstacles)
        this.systems
            .register('pathfinding', new PathfindingSystem(
                obstacleManager,
                worldConfig.width,
                worldConfig.height,
                GameConfig.pathfinding.cellSize
            ))
            .register('enemies', new EnemyManager())
            .register('damageNumbers', new DamageNumberManager())
            .register('projectiles', new ProjectileManager())
            .register('healthOrbs', new HealthOrbManager())
            .register('render', new RenderSystem(this.canvas, this.ctx));
        
        // Initialize render system with systems reference
        const renderSystem = this.systems.get('render');
        if (renderSystem && renderSystem.init) {
            renderSystem.init(this.systems);
        }
        
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
            console.log(`Loaded Knight_8_Direction: ${knightImg.width}x${knightImg.height}, frame ${knightFrameWidth}x${knightFrameHeight} (${knightRows} rows × ${knightCols} cols)`);
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

        // Load optional knight animation sprite sheets (horizontal strips) from alternate path
        const spriteBasePath = 'assets/sprites/player/2D HD Character Knight/Spritesheets/With shadows/';
        const knightAnimations = {
            walk: 'Walk.png',
            run: 'Run.png',
            melee: 'Melee.png',
            melee2: 'Melee2.png',
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
        this.systems.eventBus.on('damage:taken', (data) => {
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
                const totalFrames = meleeSheet.totalFrames || (meleeSheet.rows * meleeSheet.cols);
                const meleeFrames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.melee = {
                    spriteSheetKey: knightSheets.melee,
                    frames: meleeFrames,
                    frameDuration: 0.1,
                    loop: false
                };
            }
        }
        
        if (knightSheets.melee2) {
            const melee2Sheet = spriteManager.getSpriteSheet(knightSheets.melee2);
            if (melee2Sheet) {
                const totalFrames = melee2Sheet.totalFrames || (melee2Sheet.rows * melee2Sheet.cols);
                const melee2Frames = Array.from({length: totalFrames}, (_, i) => i);
                animationConfig.animations.melee2 = {
                    spriteSheetKey: knightSheets.melee2,
                    frames: melee2Frames,
                    frameDuration: 0.1,
                    loop: false
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
        
        // Set up player-specific behavior
        this.setupPlayerBehavior(player);
        
        return player;
    }

    setupPlayerBehavior(player) {
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');
        const pathfindingSystem = this.systems.get('pathfinding');
        
        // Track charge state
        let isChargingAttack = false;
        let chargeTargetX = 0;
        let chargeTargetY = 0;
        
        // Handle mouse down - Start charging attack
        this.systems.eventBus.on('input:mousedown', (data) => {
            const transform = player.getComponent(Transform);
            const combat = player.getComponent(Combat);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            
            // Can't charge while blocking or already attacking
            if (combat && (combat.isBlocking || combat.isAttacking)) {
                return;
            }
            
            // Start charging
            isChargingAttack = true;
            chargeTargetX = worldPos.x;
            chargeTargetY = worldPos.y;
        });
        
        // Handle mouse up - Release attack (normal or charged)
        this.systems.eventBus.on('input:mouseup', (data) => {
            const transform = player.getComponent(Transform);
            const movement = player.getComponent(Movement);
            const combat = player.getComponent(Combat);
            const stamina = player.getComponent(Stamina);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            
            // Can't attack while blocking
            if (combat && combat.isBlocking) {
                isChargingAttack = false;
                return;
            }
            
            // If we were charging, use the charge duration
            const chargeDuration = isChargingAttack ? data.chargeDuration : 0;
            isChargingAttack = false;
            
            // Face the cursor direction
            if (movement && transform) {
                movement.facingAngle = Utils.angleTo(
                    transform.x, transform.y,
                    worldPos.x, worldPos.y
                );
            }
            
            // Perform attack with charge duration
            if (combat && stamina && combat.isPlayer && combat.playerAttack) {
                const nextStage = combat.playerAttack.comboStage < combat.playerAttack.weapon.maxComboStage 
                    ? combat.playerAttack.comboStage + 1 : 1;
                const stageProps = combat.playerAttack.weapon.getComboStageProperties(nextStage);
                
                // Calculate stamina cost (will be adjusted in startAttack if charged)
                const baseStaminaCost = stageProps ? stageProps.staminaCost : 10;
                const chargedAttackConfig = GameConfig.player.chargedAttack;
                let staminaCost = baseStaminaCost;
                
                if (chargeDuration >= chargedAttackConfig.minChargeTime) {
                    const chargeMultiplier = Math.min(1.0, (chargeDuration - chargedAttackConfig.minChargeTime) / 
                        (chargedAttackConfig.maxChargeTime - chargedAttackConfig.minChargeTime));
                    staminaCost = baseStaminaCost * (1.0 + (chargedAttackConfig.staminaCostMultiplier - 1.0) * chargeMultiplier);
                }
                
                if (stageProps && stamina.currentStamina >= staminaCost) {
                    stamina.currentStamina -= staminaCost;
                    const attackData = combat.attack(worldPos.x, worldPos.y, chargeDuration);
                    if (attackData) {
                        // Attack started successfully
                    }
                }
            }
        });
        
        // Handle right click - Block (buffer input if attacking so block starts when attack ends)
        this.systems.eventBus.on('input:rightclick', (data) => {
            const combat = player.getComponent(Combat);
            const movement = player.getComponent(Movement);
            const transform = player.getComponent(Transform);
            const cameraSystem = this.systems.get('camera');
            
            if (!combat || !combat.isPlayer) return;
            
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            const facingAngle = transform ? Utils.angleTo(transform.x, transform.y, worldPos.x, worldPos.y) : 0;
            
            if (combat.isAttacking) {
                // Buffer block input to apply as soon as attack ends
                combat.blockInputBuffered = true;
                combat.blockInputBufferedFacingAngle = facingAngle;
            } else {
                combat.blockInputBuffered = false;
                combat.blockInputBufferedFacingAngle = null;
                if (movement && transform) {
                    movement.facingAngle = facingAngle;
                }
                combat.startBlocking();
            }
        });
        
        // Handle right click release - Stop blocking
        this.systems.eventBus.on('input:rightclickup', (data) => {
            const combat = player.getComponent(Combat);
            if (combat && combat.isPlayer) {
                combat.stopBlocking();
            }
        });
        
        // Handle projectile shooting (R key)
        this.systems.eventBus.on('input:keydown', (key) => {
            if (key === 'r' || key === 'R') {
                const transform = player.getComponent(Transform);
                const movement = player.getComponent(Movement);
                const stamina = player.getComponent(Stamina);
                const projectileManager = this.systems.get('projectiles');
                
                if (transform && movement && stamina && projectileManager) {
                    const projectileConfig = GameConfig.player.projectile;
                    if (!projectileConfig || !projectileConfig.enabled) return;

                    // Check cooldown and stamina
                    if (this.playerProjectileCooldown <= 0 && stamina.currentStamina >= projectileConfig.staminaCost) {
                        // Get target direction (cursor position)
                        const worldPos = cameraSystem.screenToWorld(inputSystem.mouseX, inputSystem.mouseY);
                        const angle = Utils.angleTo(transform.x, transform.y, worldPos.x, worldPos.y);
                        
                        // Create projectile
                        projectileManager.createProjectile(
                            transform.x,
                            transform.y,
                            angle,
                            projectileConfig.speed,
                            projectileConfig.damage,
                            projectileConfig.range,
                            player,
                            'player'
                        );
                        
                        // Consume stamina and set cooldown
                        stamina.currentStamina -= projectileConfig.staminaCost;
                        this.playerProjectileCooldown = projectileConfig.cooldown;
                    }
                }
            }
        });
        
        // Handle dodge roll (Space key)
        this.systems.eventBus.on('input:keydown', (key) => {
            if (key === ' ') {
                const movement = player.getComponent(Movement);
                const stamina = player.getComponent(Stamina);
                
                if (movement && stamina && stamina.currentStamina >= GameConfig.player.dodge.staminaCost) {
                    // Get current movement direction
                    let dodgeX = 0;
                    let dodgeY = 0;
                    
                    if (inputSystem.isKeyPressed('w')) dodgeY -= 1;
                    if (inputSystem.isKeyPressed('s')) dodgeY += 1;
                    if (inputSystem.isKeyPressed('a')) dodgeX -= 1;
                    if (inputSystem.isKeyPressed('d')) dodgeX += 1;
                    
                    // Perform dodge and consume stamina
                    if (movement.performDodge(dodgeX, dodgeY)) {
                        stamina.currentStamina -= GameConfig.player.dodge.staminaCost;
                    }
                }
            }
        });
        
        // Handle sprint (Shift key)
        this.systems.eventBus.on('input:keydown', (key) => {
            if (key === 'shift') {
                const movement = player.getComponent(Movement);
                const stamina = player.getComponent(Stamina);
                if (movement && stamina && stamina.currentStamina > 0) {
                    movement.setSprinting(true);
                    
                    // If already moving with WASD, update velocity with sprint speed
                    let moveX = 0;
                    let moveY = 0;
                    if (inputSystem.isKeyPressed('w')) moveY -= 1;
                    if (inputSystem.isKeyPressed('s')) moveY += 1;
                    if (inputSystem.isKeyPressed('a')) moveX -= 1;
                    if (inputSystem.isKeyPressed('d')) moveX += 1;
                    
                    if (moveX !== 0 || moveY !== 0) {
                        movement.setVelocity(moveX, moveY);
                    }
                }
            }
        });
        
        this.systems.eventBus.on('input:keyup', (key) => {
            if (key === 'shift') {
                const movement = player.getComponent(Movement);
                
                // Always stop sprinting on release
                if (movement) {
                    movement.setSprinting(false);
                    
                    // If still moving with WASD, update velocity back to normal speed
                    let moveX = 0;
                    let moveY = 0;
                    if (inputSystem.isKeyPressed('w')) moveY -= 1;
                    if (inputSystem.isKeyPressed('s')) moveY += 1;
                    if (inputSystem.isKeyPressed('a')) moveX -= 1;
                    if (inputSystem.isKeyPressed('d')) moveX += 1;
                    
                    if (moveX !== 0 || moveY !== 0) {
                        movement.setVelocity(moveX, moveY);
                    }
                }
            }
        });

        // TEMPORARY: weapon switch for testing (1 = sword & shield, 2 = greatsword) - remove when proper weapon UI exists
        this.systems.eventBus.on('input:keydown', (key) => {
            const combat = player.getComponent(Combat);
            if (!combat || !combat.isPlayer) return;
            if (key === '1' && Weapons.swordAndShield) {
                combat.stopBlocking();
                combat.setWeapon(Weapons.swordAndShield);
            } else if (key === '2' && Weapons.greatsword) {
                combat.stopBlocking();
                combat.setWeapon(Weapons.greatsword);
            } else if (key === '3' && Weapons.broadsword) {
                combat.stopBlocking();
                combat.setWeapon(Weapons.broadsword);
            }
        });

        // Handle WASD movement
        this.systems.eventBus.on('input:keydown', (key) => {
            const movement = player.getComponent(Movement);
            if (movement && ['w', 'a', 's', 'd'].includes(key)) {
                // Don't allow movement input while knocked back
                if (movement.isKnockedBack) {
                    return;
                }
                movement.cancelPath();
                movement.clearAttackTarget(); // Clear attack target when manually moving
                
                // Set velocity based on keys
                let moveX = 0;
                let moveY = 0;
                if (inputSystem.isKeyPressed('w')) moveY -= 1;
                if (inputSystem.isKeyPressed('s')) moveY += 1;
                if (inputSystem.isKeyPressed('a')) moveX -= 1;
                if (inputSystem.isKeyPressed('d')) moveX += 1;
                
                if (moveX !== 0 || moveY !== 0) {
                    movement.setVelocity(moveX, moveY);
                }
            }
        });
        
        // Handle key release
        this.systems.eventBus.on('input:keyup', (key) => {
            const movement = player.getComponent(Movement);
            if (movement && ['w', 'a', 's', 'd'].includes(key)) {
                // Don't allow movement input while knocked back
                if (movement.isKnockedBack) {
                    return;
                }
                // Check if no movement keys are pressed
                if (!inputSystem.isKeyPressed('w') && !inputSystem.isKeyPressed('s') &&
                    !inputSystem.isKeyPressed('a') && !inputSystem.isKeyPressed('d')) {
                    movement.stop();
                } else {
                    // Recalculate velocity
                    let moveX = 0;
                    let moveY = 0;
                    if (inputSystem.isKeyPressed('w')) moveY -= 1;
                    if (inputSystem.isKeyPressed('s')) moveY += 1;
                    if (inputSystem.isKeyPressed('a')) moveX -= 1;
                    if (inputSystem.isKeyPressed('d')) moveX += 1;
                    movement.setVelocity(moveX, moveY);
                }
            }
        });
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
                const levelAt = this.screenManager.getLevelSelectAt(x, y);
                if (levelAt !== null) {
                    this.screenManager.selectedStartLevel = levelAt;
                } else if (this.screenManager.checkButtonClick(x, y, 'title')) {
                    this.startHub();
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
                }
            }
        });
    }

    quitToMainMenu() {
        const allEntities = this.entities.getAll();
        for (const entity of allEntities) {
            this.entities.remove(entity.id);
        }
        const projectileManager = this.systems.get('projectiles');
        if (projectileManager) projectileManager.projectiles = [];
        const enemyManager = this.systems.get('enemies');
        if (enemyManager && enemyManager.clearFlamePillars) enemyManager.clearFlamePillars();
        const damageNumberManager = this.systems.get('damageNumbers');
        if (damageNumberManager) damageNumberManager.numbers = [];
        const healthOrbManager = this.systems.get('healthOrbs');
        if (healthOrbManager) healthOrbManager.clear();
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

        const allEntities = this.entities.getAll();
        for (const entity of allEntities) {
            this.entities.remove(entity.id);
        }
        const projectileManager = this.systems.get('projectiles');
        if (projectileManager) projectileManager.projectiles = [];

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
        const worldConfig = GameConfig.world;
        const obstacleManager = this.systems.get('obstacles');
        const enemyManager = this.systems.get('enemies');
        const cameraSystem = this.systems.get('camera');
        if (cameraSystem) cameraSystem.setWorldBounds(worldConfig.width, worldConfig.height);

        obstacleManager.clearWorld();
        const levelConfig = GameConfig.levels && GameConfig.levels[selectedLevel] && GameConfig.levels[selectedLevel].obstacles
            ? GameConfig.levels[selectedLevel].obstacles
            : GameConfig.obstacles;
        const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
        obstacleManager.generateWorld(worldConfig.width, worldConfig.height, levelConfig, {
            x: portalConfig.x + portalConfig.width / 2,
            y: portalConfig.y + portalConfig.height / 2,
            radius: 120
        });

        if (enemyManager) {
            enemyManager.enemies = [];
            enemyManager.enemiesSpawned = false;
            enemyManager.currentLevel = selectedLevel;
            enemyManager.enemiesKilledThisLevel = 0;
            if (enemyManager.clearFlamePillars) enemyManager.clearFlamePillars();
        }

        this.initializeEntities();
        this.screenManager.setScreen('playing');
        this.updateUIVisibility(true);
    }
    
    restartGame() {
        const worldConfig = GameConfig.world;
        const enemyManager = this.systems.get('enemies');
        const obstacleManager = this.systems.get('obstacles');

        // Reset enemy manager to level 1: kill count and level so spawns match stage
        if (enemyManager) {
            enemyManager.enemies = [];
            enemyManager.enemiesSpawned = false;
            enemyManager.currentLevel = 1;
            enemyManager.enemiesKilledThisLevel = 0;
        }

        // Regenerate level 1 world so environment matches stage (Village Outskirts)
        if (obstacleManager) {
            obstacleManager.clearWorld();
            const level1Obstacles = GameConfig.levels && GameConfig.levels[1] && GameConfig.levels[1].obstacles
                ? GameConfig.levels[1].obstacles
                : GameConfig.obstacles;
            const portalConfig = GameConfig.portal || { x: 2400, y: 1400, width: 80, height: 80 };
            obstacleManager.generateWorld(worldConfig.width, worldConfig.height, level1Obstacles, {
                x: portalConfig.x + portalConfig.width / 2,
                y: portalConfig.y + portalConfig.height / 2,
                radius: 120
            });
        }

        // Clear all entities (player will be recreated in initializeEntities)
        const allEntities = this.entities.getAll();
        for (const entity of allEntities) {
            this.entities.remove(entity.id);
        }

        // Clear projectiles
        const projectileManager = this.systems.get('projectiles');
        if (projectileManager) {
            projectileManager.projectiles = [];
        }
        const enemyManagerClear = this.systems.get('enemies');
        if (enemyManagerClear && enemyManagerClear.clearFlamePillars) enemyManagerClear.clearFlamePillars();

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

    updateHub(deltaTime) {
        if (this.boardOpen) return; // modal overlay; only clicks matter

        if (this.boardUseCooldown > 0) {
            this.boardUseCooldown = Math.max(0, this.boardUseCooldown - deltaTime);
        }

        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');
        const wheelDelta = inputSystem.getWheelDelta();
        if (wheelDelta !== 0) {
            const zoomChange = wheelDelta > 0 ? -GameConfig.camera.zoomSpeed : GameConfig.camera.zoomSpeed;
            const newZoom = cameraSystem.targetZoom + zoomChange;
            cameraSystem.setZoom(newZoom, inputSystem.mouseX, inputSystem.mouseY, this.canvas.width, this.canvas.height);
        }

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
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');
        const wheelDelta = inputSystem.getWheelDelta();
        
        if (wheelDelta !== 0) {
            const zoomChange = wheelDelta > 0 ? -GameConfig.camera.zoomSpeed : GameConfig.camera.zoomSpeed;
            const newZoom = cameraSystem.targetZoom + zoomChange;
            cameraSystem.setZoom(newZoom, inputSystem.mouseX, inputSystem.mouseY, this.canvas.width, this.canvas.height);
        }

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

        const enemyManagerForPillars = this.systems.get('enemies');
        if (enemyManagerForPillars && enemyManagerForPillars.updateFlamePillars) {
            enemyManagerForPillars.updateFlamePillars(deltaTime, this.systems);
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
        if (this.portal && this.portalUseCooldown > 0) {
            this.portalUseCooldown = Math.max(0, this.portalUseCooldown - deltaTime);
        }
        const enemyManager = this.systems.get('enemies');
        if (this.portal && enemyManager) {
            const currentLevel = enemyManager.getCurrentLevel();
            const levelConfig = GameConfig.levels[currentLevel];
            const nextLevel = currentLevel + 1;
            const nextLevelExists = GameConfig.levels[nextLevel];
            const killsRequired = (levelConfig && levelConfig.killsToUnlockPortal != null) ? levelConfig.killsToUnlockPortal : 999;
            const kills = enemyManager.getEnemiesKilledThisLevel();
            this.portal.targetLevel = nextLevel;
            this.portal.spawned = nextLevelExists && kills >= killsRequired;

            if (this.portal.spawned && player) {
                const transform = player.getComponent(Transform);
                if (transform) {
                    // Check if player is near/overlapping portal
                    const overlap = Utils.rectCollision(
                        transform.left, transform.top, transform.width, transform.height,
                        this.portal.x, this.portal.y, this.portal.width, this.portal.height
                    );
                    this.playerNearPortal = overlap;
                    
                    // Handle E key press to enter portal
                    if (overlap && this.portalUseCooldown <= 0) {
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
                } else {
                    this.playerNearPortal = false;
                }
            } else {
                this.playerNearPortal = false;
            }
        }
        
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
                this.screenManager.render();
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
                renderSystem.renderMinimap(cameraSystem, this.entities, hubConfig.width, hubConfig.height, null, 0);
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
            const enemyManagerRender = this.systems.get('enemies');
            if (enemyManagerRender && enemyManagerRender.renderFlamePillars) {
                enemyManagerRender.renderFlamePillars(this.ctx, cameraSystem);
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
            
            renderSystem.renderMinimap(cameraSystem, this.entities, worldConfig.width, worldConfig.height, this.portal, currentLevel);

            if (this.screenManager.isScreen('pause')) {
                this.screenManager.render();
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

