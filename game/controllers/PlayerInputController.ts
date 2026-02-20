// Handles all player-specific input bindings (mouse + keyboard)
import { Movement } from '../components/Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { Transform } from '../components/Transform.ts';
import { StatusEffects } from '../components/StatusEffects.ts';
import { PlayerHealing } from '../components/PlayerHealing.ts';
import { Combat } from '../components/Combat.ts';
import { Stamina } from '../components/Stamina.ts';
import { EventTypes } from '../core/EventTypes.ts';
import { getBowChargeLevel, getBowShotLevelEffect } from '../weapons/bowShotEffects.ts';
import type { EntityShape } from '../types/entity.ts';
import type { SystemManager } from '../core/SystemManager.ts';

export interface GameLike {
    systems: SystemManager;
    screenManager?: { isScreen(name: string): boolean };
    inventoryOpen?: boolean;
    chestOpen?: boolean;
    boardOpen?: boolean;
    shopOpen?: boolean;
    playerInGatherableRange?: boolean;
    gold?: number;
    pointerDownConsumedByUI?: boolean;
    clearPointerDownConsumedByUI?(): void;
    /** When set, dodge (Space) is ignored until this timestamp (used after title/death transition). */
    suppressDodgeUntil?: number;
    [key: string]: unknown;
}

export class PlayerInputController {
    game: GameLike;
    systems: SystemManager;
    eventBus: { on(name: string, fn: (data?: unknown) => void): void };
    player: EntityShape | null;
    isChargingAttack: boolean;
    chargeTargetX: number;
    chargeTargetY: number;
    attackPressId: number;
    processedReleaseForPressId: number;
    chargeStartTime?: number;
    bound: boolean;

    constructor(game: GameLike) {
        this.game = game;
        this.systems = game.systems;
        this.eventBus = this.systems.eventBus;
        this.player = null;

        // Internal state
        this.isChargingAttack = false;
        this.chargeTargetX = 0;
        this.chargeTargetY = 0;
        /** One release per press: ignore duplicate/delayed mouseup that would send 0-charge (slash). */
        this.attackPressId = 0;
        this.processedReleaseForPressId = -1;

        this.bound = false;
    }

    setPlayer(player: EntityShape | null): void {
        this.player = player;
    }

    /** Cancel charge/movement state when a menu is opened so the player doesn't attack or move on close. */
    cancelMenuInputs(): void {
        this.isChargingAttack = false;
        this.chargeStartTime = 0;
        // Mark current press as already processed so its release (in-menu or after) never triggers an attack
        this.processedReleaseForPressId = this.attackPressId;
        const player = this.player;
        if (player) {
            const movement = player.getComponent(Movement);
            if (movement) {
                movement.stop();
                const m = movement as Movement & { setSprinting?(v: boolean): void };
                if (m.setSprinting) m.setSprinting(false);
            }
            const combat = player.getComponent(Combat);
            if (combat && combat.isPlayer) {
                combat.attackInputBuffered = null;
            }
        }
    }

    bindAll(): void {
        if (this.bound) return;
        this.bound = true;

        this.bindAttackControls();
        this.bindBlockControls();
        this.bindHealControls();
        this.bindProjectileControls();
        this.bindDodgeControls();
        this.bindSprintControls();
        this.bindWeaponSwitchControls();
        this.bindMovementControls();
    }

    bindHealControls() {
        const inputSystem = this.systems.get('input');

        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (key !== 'q' && key !== 'Q') return;
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;
            const player = this.player;
            if (!player || !inputSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const healing = player.getComponent(PlayerHealing);
            if (healing) healing.startDrinking();
        });
    }

    bindAttackControls() {
        const cameraSystem = this.systems.get('camera');

        // Handle mouse down - Start charging attack
        this.eventBus.on(EventTypes.INPUT_MOUSEDOWN, (data) => {
            // Only allow attack input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;
            // Click was on inventory/chest/shop UI (e.g. weapon slot) — do not start attack
            if (this.game.pointerDownConsumedByUI) return;
            const player = this.player;
            if (!player || !cameraSystem) return;
            // In range of a gatherable: click starts gather, don't start attack
            if (this.game.playerInGatherableRange) return;

            const combat = player.getComponent(Combat);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);
            
            // Can't act while stunned
            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;
            // Can't charge while blocking or healing
            const healing = player.getComponent(PlayerHealing);
            if (healing && healing.isHealing) return;
            if (combat && combat.isBlocking) return;
            // During an attack: register a new press so the next release is accepted and can buffer; still record charge start so release can compute charge duration
            if (combat && combat.isAttacking) {
                this.attackPressId = (this.attackPressId || 0) + 1;
                this.chargeStartTime = performance.now();
                return;
            }
            
            // Start charging (increment press id so we accept exactly one release for this press).
            this.attackPressId = (this.attackPressId || 0) + 1;
            this.isChargingAttack = true;
            this.chargeStartTime = performance.now();
            this.chargeTargetX = worldPos.x;
            this.chargeTargetY = worldPos.y;
        });
        
        // Handle mouse up - Release attack (normal or charged)
        this.eventBus.on(EventTypes.INPUT_MOUSEUP, (data) => {
            // Only allow attack input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;
            // Click was on inventory/chest/shop UI — do not release attack; clear flag
            if (this.game.pointerDownConsumedByUI) {
                this.game.clearPointerDownConsumedByUI?.();
                return;
            }
            const player = this.player;
            if (!player || !cameraSystem) return;

            const transform = player.getComponent(Transform);
            const movement = player.getComponent(Movement);
            const combat = player.getComponent(Combat);
            const stamina = player.getComponent(Stamina);
            const worldPos = cameraSystem.screenToWorld(data.x, data.y);

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const healing = player.getComponent(PlayerHealing);
            if (healing && healing.isHealing) {
                this.isChargingAttack = false;
                return;
            }
            
            // While blocking: left-click = shield bash (if weapon has it), else ignore
            if (combat && combat.isBlocking) {
                this.isChargingAttack = false;
                const blockConfig = combat._getBlockConfig ? combat._getBlockConfig() : null;
                if (blockConfig && blockConfig.shieldBash) {
                    if (movement && transform) {
                        movement.facingAngle = Utils.angleTo(
                            transform.x, transform.y,
                            worldPos.x, worldPos.y
                        );
                    }
                    if (stamina && stamina.currentStamina >= blockConfig.shieldBash.staminaCost) {
                        combat.shieldBash(this.systems, worldPos.x, worldPos.y);
                    }
                }
                return;
            }
            
            // Ignore duplicate release (e.g. canvas + window both emit INPUT_MOUSEUP for one release)
            if (this.processedReleaseForPressId === this.attackPressId) return;
            
            // Use payload charge when present; else if we were charging use our own charge duration (second event often has payload 0)
            let chargeDuration = (data.chargeDuration != null && data.chargeDuration > 0)
                ? data.chargeDuration
                : (this.isChargingAttack ? data.chargeDuration : 0);
            const hadChargeStartTime = this.chargeStartTime != null && this.chargeStartTime > 0;
            if (chargeDuration === 0 && hadChargeStartTime) {
                chargeDuration = (performance.now() - this.chargeStartTime) / 1000;
            }
            this.chargeStartTime = 0;
            this.isChargingAttack = false;
            
            // Face the cursor direction
            if (movement && transform) {
                movement.facingAngle = Utils.angleTo(
                    transform.x, transform.y,
                    worldPos.x, worldPos.y
                );
            }
            
            // Perform attack: crossbow = left-click when loaded; bow = charge release (hold to charge, release to shoot); else melee
            if (combat && stamina && combat.isPlayer && combat.playerAttack) {
                const weapon = combat.playerAttack.weapon as { isRanged?: boolean; isBow?: boolean; dashAttack?: unknown; chargeAttack?: { minChargeTime?: number }; getDashAttackProperties?: () => unknown } | null;
                const isRanged = weapon && weapon.isRanged === true;
                const isBow = isRanged && weapon!.isBow === true;
                const isCrossbow = isRanged && !isBow;
                const crossbowConfig = GameConfig.player.crossbow;
                const bowConfig = (GameConfig.player as { bow?: { damage: number; speed: number; range: number; staminaCost: number; stunBuildup?: number; chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } }).bow;

                if (isCrossbow && crossbowConfig) {
                    // Crossbow: left-click fires when loaded
                    const projectileManager = this.systems.get('projectiles');
                    if (this.game.crossbowReloadProgress >= 1 && stamina.currentStamina >= crossbowConfig.staminaCost && projectileManager && transform && movement) {
                        const worldPos = cameraSystem.screenToWorld(data.x, data.y);
                        const angle = Utils.angleTo(transform.x, transform.y, worldPos.x, worldPos.y);
                        let damage = crossbowConfig.damage;
                        if (this.game.crossbowPerfectReloadNext) {
                            damage *= crossbowConfig.perfectReloadDamageMultiplier;
                            this.game.crossbowPerfectReloadNext = false;
                        }
                        projectileManager.createProjectile(
                            transform.x, transform.y, angle,
                            crossbowConfig.speed, damage, crossbowConfig.range,
                            player, 'player', crossbowConfig.stunBuildup ?? 0
                        );
                        stamina.currentStamina -= crossbowConfig.staminaCost;
                        this.game.crossbowReloadProgress = 0;
                        this.game.crossbowReloadInProgress = false;
                    }
                    return;
                }

                if (isBow && bowConfig) {
                    const bowProjectileManager = this.systems.get('projectiles');
                    if (bowProjectileManager && transform && movement) {
                        // Bow: charge release — level 1/2/3 by hold time; modular shot effect (default: N arrows for level N)
                        const chargeLevel = getBowChargeLevel(chargeDuration, {
                        level1: bowConfig.chargeLevel1,
                        level2: bowConfig.chargeLevel2,
                        level3: bowConfig.chargeLevel3
                    });
                    if (chargeLevel >= 1 && stamina.currentStamina >= bowConfig.staminaCost) {
                        const angle = Utils.angleTo(transform.x, transform.y, worldPos.x, worldPos.y);
                        const effect = getBowShotLevelEffect();
                        effect(chargeLevel, {
                            owner: player,
                            x: transform.x,
                            y: transform.y,
                            aimAngle: angle,
                            damage: bowConfig.damage,
                            speed: bowConfig.speed,
                            range: bowConfig.range,
                            stunBuildup: bowConfig.stunBuildup ?? 0,
                            projectileManager: bowProjectileManager,
                            ownerType: 'player'
                        });
                        stamina.currentStamina -= bowConfig.staminaCost;
                    }
                    }
                    return;
                }
                // Attack input while attacking is buffered and fires when current attack ends
                const useDashAttack = data.shiftKey && weapon.dashAttack;
                const staminaCost = combat.playerAttack.getNextAttackStaminaCost(
                    useDashAttack ? 0 : chargeDuration,
                    useDashAttack ? { useDashAttack: true } : {},
                    player
                );
                if (stamina.currentStamina < staminaCost) {
                    return;
                }

                // One release per press: only skip duplicate 0-charge (tap); allow charge releases through so they never fail.
                if (chargeDuration === 0 && this.attackPressId === this.processedReleaseForPressId) {
                    return;
                }
                this.processedReleaseForPressId = this.attackPressId;

                const minChargeForStab = (weapon.chargeAttack && weapon.chargeAttack.minChargeTime) ? weapon.chargeAttack.minChargeTime - 0.05 : 0.5;
                // Don't send 0-charge attack while a thrust (stab) is playing - backup guard
                if (chargeDuration === 0 && combat.isAttacking && combat.currentAttackIsThrust) {
                    return;
                }

                if (useDashAttack) {
                    const dashProps = weapon.getDashAttackProperties();
                    if (dashProps) {
                        combat.attack(worldPos.x, worldPos.y, 0, { useDashAttack: true });
                        this.eventBus.emit(EventTypes.PLAYER_DASH_ATTACK);
                    }
                } else {
                    combat.attack(worldPos.x, worldPos.y, chargeDuration);
                }
            }
        });
    }

    bindBlockControls() {
        // Handle right click - Block (buffer input if attacking so block starts when attack ends)
        this.eventBus.on(EventTypes.INPUT_RIGHTCLICK, (data) => {
            // Only allow block input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;
            // Right-click was on inventory/chest/shop UI — do not start block
            if (this.game.pointerDownConsumedByUI) return;
            const player = this.player;
            if (!player) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const healing = player.getComponent(PlayerHealing);
            if (healing && healing.isHealing) return;

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
            // Only allow block input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;
            // Right-click was on UI — do not process; clear flag
            if (this.game.pointerDownConsumedByUI) {
                this.game.clearPointerDownConsumedByUI?.();
                return;
            }
            const player = this.player;
            if (!player) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const combat = player.getComponent(Combat);
            if (combat && combat.isPlayer) {
                combat.stopBlocking();
            }
        });
    }

    bindProjectileControls() {
        const inputSystem = this.systems.get('input');
        const cameraSystem = this.systems.get('camera');

        // Handle projectile shooting (R key) and crossbow fire / perfect reload
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (key !== 'r' && key !== 'R') return;

            // Only allow projectile input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

            const player = this.player;
            if (!player || !inputSystem || !cameraSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const transform = player.getComponent(Transform);
            const movement = player.getComponent(Movement);
            const stamina = player.getComponent(Stamina);
            const projectileManager = this.systems.get('projectiles');
            const combat = player.getComponent(Combat);
            const weapon = combat && combat.playerAttack ? (combat.playerAttack.weapon as { isRanged?: boolean; isBow?: boolean } | null) : null;
            const isCrossbow = weapon && weapon.isRanged === true && !weapon.isBow;
            const crossbowConfig = GameConfig.player.crossbow;

            // Crossbow: R = begin reload (when empty) or trigger perfect reload when in window
            if (isCrossbow && crossbowConfig) {
                if (this.game.crossbowReloadProgress < 1) {
                    if (!this.game.crossbowReloadInProgress) {
                        this.game.crossbowReloadInProgress = true; // begin reload
                    } else {
                        const p = this.game.crossbowReloadProgress;
                        if (p >= crossbowConfig.perfectWindowStart && p <= crossbowConfig.perfectWindowEnd) {
                            this.game.crossbowPerfectReloadNext = true;
                            this.game.crossbowReloadProgress = 1;
                            this.game.crossbowReloadInProgress = false; // end reload early
                        }
                    }
                }
                return;
            }

            // Generic projectile (when not crossbow)
            if (transform && movement && stamina && projectileManager) {
                const projectileConfig = GameConfig.player.projectile;
                if (!projectileConfig || !projectileConfig.enabled) return;

                if (this.game.playerProjectileCooldown <= 0 && stamina.currentStamina >= projectileConfig.staminaCost) {
                    const worldPos = cameraSystem.screenToWorld(inputSystem.mouseX, inputSystem.mouseY);
                    const angle = Utils.angleTo(transform.x, transform.y, worldPos.x, worldPos.y);
                    projectileManager.createProjectile(
                        transform.x,
                        transform.y,
                        angle,
                        projectileConfig.speed,
                        projectileConfig.damage,
                        projectileConfig.range,
                        player,
                        'player',
                        projectileConfig.stunBuildup ?? 0
                    );
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

            // Don't dodge when Space was just used to leave title or death screen
            if (typeof this.game.suppressDodgeUntil === 'number' && Date.now() < this.game.suppressDodgeUntil) return;

            // Only allow dodge input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

            const healing = player.getComponent(PlayerHealing);
            if (healing && healing.isHealing) return;

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

            // Only allow sprint input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

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

            // Only allow sprint input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

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
        // Weapon switching only in sanctuary (hub board overlay). No in-game hotkeys.
    }

    bindMovementControls() {
        const inputSystem = this.systems.get('input');

        // Handle WASD movement
        this.eventBus.on(EventTypes.INPUT_KEYDOWN, (key) => {
            if (!['w', 'a', 's', 'd'].includes(key)) return;

            // Only allow movement input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            // Allow movement while inventory is open; block for chest, board, shop
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

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

            // Only allow movement input while actively playing (combat levels or hub)
            if (!this.game.screenManager || !(this.game.screenManager.isScreen('playing') || this.game.screenManager.isScreen('hub'))) return;
            // Allow movement while inventory is open; block for chest, board, shop
            if (this.game.chestOpen || this.game.boardOpen || this.game.shopOpen) return;

            const player = this.player;
            if (!player || !inputSystem) return;

            const statusEffects = player.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) return;

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


