// Handles all player-specific input bindings (mouse + keyboard)
// so that Game.js can focus on high-level orchestration.
class PlayerInputController {
    constructor(game) {
        this.game = game;
        this.systems = game.systems;
        this.eventBus = this.systems.eventBus;
        this.player = null;

        // Internal state
        this.isChargingAttack = false;
        this.chargeTargetX = 0;
        this.chargeTargetY = 0;

        this.bound = false;
    }

    setPlayer(player) {
        this.player = player;
    }

    bindAll() {
        if (this.bound) return;
        this.bound = true;

        this.bindAttackControls();
        this.bindBlockControls();
        this.bindProjectileControls();
        this.bindDodgeControls();
        this.bindSprintControls();
        this.bindWeaponSwitchControls();
        this.bindMovementControls();
    }

    bindAttackControls() {
        const cameraSystem = this.systems.get('camera');

        // Handle mouse down - Start charging attack
        this.eventBus.on(EventTypes.INPUT_MOUSEDOWN, (data) => {
            // Only allow attack input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;
            const player = this.player;
            if (!player || !cameraSystem) return;

            const transform = player.getComponent(Transform);
            const combat = player.getComponent(Combat);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            
            // Can't charge while blocking or already attacking
            if (combat && (combat.isBlocking || combat.isAttacking)) {
                return;
            }
            
            // Start charging
            this.isChargingAttack = true;
            this.chargeTargetX = worldPos.x;
            this.chargeTargetY = worldPos.y;
        });
        
        // Handle mouse up - Release attack (normal or charged)
        this.eventBus.on(EventTypes.INPUT_MOUSEUP, (data) => {
            // Only allow attack input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;
            const player = this.player;
            if (!player || !cameraSystem) return;

            const transform = player.getComponent(Transform);
            const movement = player.getComponent(Movement);
            const combat = player.getComponent(Combat);
            const stamina = player.getComponent(Stamina);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            
            // Can't attack while blocking
            if (combat && combat.isBlocking) {
                this.isChargingAttack = false;
                return;
            }
            
            // If we were charging, use the charge duration
            const chargeDuration = this.isChargingAttack ? data.chargeDuration : 0;
            this.isChargingAttack = false;
            
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
    }

    bindBlockControls() {
        // Handle right click - Block (buffer input if attacking so block starts when attack ends)
        this.eventBus.on(EventTypes.INPUT_RIGHTCLICK, (data) => {
            // Only allow block input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;
            const player = this.player;
            if (!player) return;

            const combat = player.getComponent(Combat);
            const movement = player.getComponent(Movement);
            const transform = player.getComponent(Transform);
            const cameraSystem = this.systems.get('camera');
            
            if (!combat || !combat.isPlayer || !cameraSystem) return;
            
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
        this.eventBus.on(EventTypes.INPUT_RIGHTCLICK_UP, () => {
            // Only allow block input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;
            const player = this.player;
            if (!player) return;

            const combat = player.getComponent(Combat);
            if (combat && combat.isPlayer) {
                combat.stopBlocking();
            }
        });
    }

    bindProjectileControls() {
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');

        // Handle projectile shooting (R key)
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (key !== 'r' && key !== 'R') return;

            // Only allow projectile input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem || !cameraSystem) return;

            const transform = player.getComponent(Transform);
            const movement = player.getComponent(Movement);
            const stamina = player.getComponent(Stamina);
            const projectileManager = this.systems.get('projectiles');
            
            if (transform && movement && stamina && projectileManager) {
                const projectileConfig = GameConfig.player.projectile;
                if (!projectileConfig || !projectileConfig.enabled) return;

                // Check cooldown and stamina
                if (this.game.playerProjectileCooldown <= 0 && stamina.currentStamina >= projectileConfig.staminaCost) {
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
                    this.game.playerProjectileCooldown = projectileConfig.cooldown;
                }
            }
        });
    }

    bindDodgeControls() {
        const inputSystem = this.systems.get('input');

        // Handle dodge roll (Space key)
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (key !== ' ') return;

            // Only allow dodge input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem) return;

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
        });
    }

    bindSprintControls() {
        const inputSystem = this.systems.get('input');

        // Handle sprint (Shift key down)
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (key !== 'shift') return;

            // Only allow sprint input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem) return;

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
        });
        
        // Handle sprint key release
        this.eventBus.on(EventTypes.INPUT_KEYUP, (key) => {
            if (key !== 'shift') return;

            // Only allow sprint input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem) return;

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
        });
    }

    bindWeaponSwitchControls() {
        // TEMPORARY: weapon switch for testing (1 = sword & shield, 2 = greatsword, 3 = broadsword)
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            // Only allow weapon switching while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;
            const player = this.player;
            if (!player) return;

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
    }

    bindMovementControls() {
        const inputSystem = this.systems.get('input');

        // Handle WASD movement
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (!['w', 'a', 's', 'd'].includes(key)) return;

            // Only allow movement input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const movement = player.getComponent(Movement);
            if (movement) {
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
        
        // Handle WASD key release
        this.eventBus.on(EventTypes.INPUT_KEYUP, (key) => {
            if (!['w', 'a', 's', 'd'].includes(key)) return;

            // Only allow movement input while actively playing
            if (!this.game.screenManager || !this.game.screenManager.isScreen('playing')) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const movement = player.getComponent(Movement);
            if (movement) {
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
}

