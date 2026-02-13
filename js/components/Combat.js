// Combat component - now uses PlayerAttack or enemy-specific attack classes
class Combat {
    constructor(attackRange, attackDamage, attackArc, cooldown, windUpTime = 0.5, isPlayer = false, weapon = null, enemyType = null) {
        this.entity = null;
        this.isPlayer = isPlayer;
        this.currentAttackIsCircular = false;
        this.currentAttackAnimationKey = null;
        this.currentAttackIsDashAttack = false;
        this.dashAttackFlashUntil = 0;
        
        // Use appropriate attack handler
        this.goblinAttack = null;
        this.chieftainAttack = null;
        this.skeletonAttack = null;
        this.demonAttack = null;
        this.enemyAttack = null;
        this.playerAttack = null;

        if (isPlayer) {
            this.playerAttack = new PlayerAttack(weapon || Weapons.swordAndShield);
        } else {
            const createAttack = Enemies.getAttackFactory(enemyType);
            const handler = createAttack
                ? createAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime)
                : new EnemyAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            if (handler instanceof GoblinAttack) {
                this.goblinAttack = handler;
            } else if (handler instanceof DemonAttack) {
                this.demonAttack = handler;
            } else if (handler instanceof ChieftainAttack) {
                this.chieftainAttack = handler;
            } else if (handler instanceof SkeletonAttack) {
                this.skeletonAttack = handler;
            } else {
                this.enemyAttack = handler;
            }
        }
        
        // Legacy properties for compatibility (attackRange/Damage/Arc read by hit detection and renderers)
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackArc = attackArc;
        this.windUpTime = windUpTime;
        
        // Blocking state (player only); block config comes from weapon.getBlockConfig()
        this.isBlocking = false;
        // Block input buffer: start block as soon as attack ends if right-click was pressed during attack
        this.blockInputBuffered = false;
        this.blockInputBufferedFacingAngle = null;
        // Attack input buffer: at most one attack queued; further clicks ignored until current attack finishes
        this.attackInputBuffered = null;

        // Current attack knockback (player only; from weapon/stage config, used when applying hit)
        this._currentAttackKnockbackForce = null;
        this._currentAttackStunBuildup = null;
    }
    
    // Set weapon for player; sync displayed range/damage/arc from weapon (single source of truth)
    setWeapon(weapon) {
        if (this.isPlayer && this.playerAttack) {
            this.playerAttack.setWeapon(weapon);
            if (weapon) {
                const first = weapon.getComboStageProperties ? weapon.getComboStageProperties(1) : null;
                if (first) {
                    this.attackRange = first.range;
                    this.attackDamage = first.damage;
                    this.attackArc = first.arc;
                } else {
                    this.attackRange = weapon.baseRange;
                    this.attackDamage = weapon.baseDamage;
                    this.attackArc = typeof weapon.baseArcDegrees === 'number' ? Utils.degToRad(weapon.baseArcDegrees) : this.attackArc;
                }
            }
        }
    }
    
    get weapon() {
        return this.isPlayer && this.playerAttack ? this.playerAttack.weapon : null;
    }

    /** Pack modifier: attack cooldown multiplier (enemies only). */
    getPackCooldownMultiplier() {
        if (this.isPlayer || !this.entity) return 1;
        const statusEffects = this.entity.getComponent(StatusEffects);
        return (statusEffects && statusEffects.packAttackCooldownMultiplier != null) ? statusEffects.packAttackCooldownMultiplier : 1;
    }

    update(deltaTime, systems) {
        if (this.isPlayer && this.playerAttack) {
            this.playerAttack.update(deltaTime, this.entity);
            if (this.isBlocking && this.entity) {
                const statusEffects = this.entity.getComponent(StatusEffects);
                if (statusEffects && statusEffects.isStunned) this.stopBlocking();
            }
        } else if (this.demonAttack) {
            this.demonAttack.update(deltaTime);
        } else if (this.chieftainAttack) {
            this.chieftainAttack.update(deltaTime);
        } else if (this.goblinAttack) {
            this.goblinAttack.update(deltaTime);
        } else if (this.skeletonAttack) {
            this.skeletonAttack.update(deltaTime);
        } else if (this.enemyAttack) {
            this.enemyAttack.update(deltaTime);
        }
    }
    
    startBlocking() {
        const blockConfig = this._getBlockConfig();
        if (this.isPlayer && !this.isAttacking && blockConfig && blockConfig.enabled) {
            this.isBlocking = true;
            return true;
        }
        return false;
    }

    _getBlockConfig() {
        if (!this.isPlayer || !this.weapon) return null;
        return this.weapon.getBlockConfig ? this.weapon.getBlockConfig() : null;
    }

    get blockDamageReduction() {
        const blockConfig = this._getBlockConfig();
        return blockConfig ? blockConfig.damageReduction : 0;
    }
    
    // Consume stamina when successfully blocking an attack
    consumeBlockStamina() {
        if (this.isPlayer && this.isBlocking) {
            const blockConfig = this._getBlockConfig();
            if (!blockConfig) return false;
            const stamina = this.entity.getComponent(Stamina);
            if (stamina && stamina.currentStamina >= blockConfig.staminaCost) {
                stamina.currentStamina -= blockConfig.staminaCost;
                return true;
            }
            this.stopBlocking();
            return false;
        }
        return false;
    }
    
    stopBlocking() {
        this.isBlocking = false;
    }

    /**
     * Shield bash: while blocking, attack = dash forward and knock back enemies in front.
     * Call when player is blocking and releases attack; consumes stamina and stops block.
     * @param {Object} systems - game systems (for entityManager)
     * @param {number} targetX - world X (used to confirm facing; movement.facingAngle should already be set)
     * @returns {boolean} true if bash was performed
     */
    shieldBash(systems, targetX, targetY) {
        if (!this.isPlayer || !this.entity) return false;
        const blockConfig = this._getBlockConfig();
        const sb = blockConfig && blockConfig.shieldBash;
        if (!sb) return false;
        if (!this.isBlocking) return false;

        const stamina = this.entity.getComponent(Stamina);
        if (stamina && stamina.currentStamina < sb.staminaCost) return false;

        // Keep blocking during and after shield bash (do not call stopBlocking())
        if (stamina) stamina.currentStamina -= sb.staminaCost;

        const transform = this.entity.getComponent(Transform);
        const movement = this.entity.getComponent(Movement);
        if (!transform || !movement || !movement.startAttackDash) return true;

        const facingAngle = movement.facingAngle;
        const entityManager = systems ? systems.get('entities') : null;
        if (entityManager) {
            const enemies = entityManager.getAll('enemy');
            const arcRad = sb.arcRad != null ? sb.arcRad : (120 * Math.PI / 180);
            const range = sb.range != null ? sb.range : 100;
            const knockback = sb.knockback != null ? sb.knockback : 500;

            if (enemies && enemies.length > 0) {
                for (const enemy of enemies) {
                    const enemyHealth = enemy.getComponent(Health);
                    const enemyTransform = enemy.getComponent(Transform);
                    if (!enemyHealth || !enemyTransform || enemyHealth.isDead) continue;
                    if (!Utils.pointInArc(enemyTransform.x, enemyTransform.y, transform.x, transform.y, facingAngle, arcRad, range)) continue;
                    const enemyMovement = enemy.getComponent(Movement);
                    if (enemyMovement) {
                        const dx = enemyTransform.x - transform.x;
                        const dy = enemyTransform.y - transform.y;
                        const norm = Utils.normalize(dx, dy);
                        enemyMovement.applyKnockback(norm.x, norm.y, knockback);
                    }
                }
            }
        }

        const dirX = Math.cos(facingAngle);
        const dirY = Math.sin(facingAngle);
        movement.startAttackDash(dirX, dirY, sb.dashDuration, sb.dashSpeed);
        return true;
    }
    
    // Check if an attack from a given angle can be blocked
    canBlockAttack(attackAngle, facingAngle) {
        if (!this.isBlocking || !this.isPlayer) return false;
        const blockConfig = this._getBlockConfig();
        if (!blockConfig || !blockConfig.arcRad) return false;
        
        let angleDiff = Math.abs(attackAngle - facingAngle);
        if (angleDiff > Math.PI) {
            angleDiff = (Math.PI * 2) - angleDiff;
        }
        return angleDiff <= (blockConfig.arcRad / 2);
    }

    attack(targetX = null, targetY = null, chargeDuration = 0, options = {}) {
        if (this.isPlayer && this.playerAttack) {
            // Buffer one combo input during attack; fire when current attack ends so combos chain
            if (this.isAttacking) {
                this.attackInputBuffered = { targetX, targetY, chargeDuration, options: options || {} };
                return false;
            }
            // Pre-check stamina before starting (so buffered attack can also be validated when it fires)
            const staminaCost = this.playerAttack.getNextAttackStaminaCost(chargeDuration, options);
            const stamina = this.entity ? this.entity.getComponent(Stamina) : null;
            if (stamina && stamina.currentStamina < staminaCost) {
                return false;
            }
            // Player attack with weapon combos (or dash attack if options.useDashAttack)
            const attackData = this.playerAttack.startAttack(targetX, targetY, this.entity, chargeDuration, options);
            if (attackData) {
                if (stamina) stamina.currentStamina -= attackData.staminaCost;
                this._currentAttackKnockbackForce = attackData.knockbackForce ?? null;
                this._currentAttackStunBuildup = attackData.stunBuildup ?? 25;
                this.attackRange = attackData.range;
                this.attackDamage = attackData.damage;
                this.attackArc = attackData.arc;
                this.attackArcOffset = attackData.arcOffset ?? 0;
                this.currentAttackReverseSweep = attackData.reverseSweep === true;
                this.currentAttackIsCircular = attackData.isCircular === true;
                this.currentAttackIsThrust = attackData.isThrust === true;
                this.currentAttackThrustWidth = attackData.thrustWidth ?? 40;
                this.currentAttackAnimationKey = attackData.animationKey || null;
                this.currentAttackIsDashAttack = attackData.isDashAttack === true;
                if (attackData.isDashAttack) this.dashAttackFlashUntil = Date.now() + 400;
                
                // Emit attack event
                if (this.entity && this.entity.systems) {
                    const eventBus = this.entity.systems.eventBus || (this.entity.systems.get ? this.entity.systems.get('eventBus') : null);
                    if (eventBus) {
                        eventBus.emit('entity:attack', {
                            entity: this.entity,
                            range: attackData.range,
                            damage: attackData.damage,
                            arc: attackData.arc,
                            comboStage: attackData.comboStage
                        });
                    }
                }
                
                // Set timeout to end attack (duration from weapon is in ms; ensure we never use seconds by mistake)
                const durationMs = attackData.duration >= 100 ? attackData.duration : Math.round(attackData.duration * 1000);
                const combatRef = this;
                setTimeout(() => {
                    combatRef.currentAttackIsCircular = false;
                    combatRef.currentAttackIsThrust = false;
                    combatRef.currentAttackThrustWidth = 0;
                    combatRef.currentAttackAnimationKey = null;
                    combatRef.currentAttackIsDashAttack = false;
                    combatRef.attackArcOffset = 0;
                    combatRef.currentAttackReverseSweep = false;
                    combatRef._currentAttackKnockbackForce = null;
                    combatRef._currentAttackStunBuildup = null;
                    combatRef.playerAttack.endAttack();
                    // Apply buffered block first (player pressed block during attack)
                    if (combatRef.isPlayer && combatRef.blockInputBuffered) {
                        combatRef.blockInputBuffered = false;
                        if (combatRef.blockInputBufferedFacingAngle != null && combatRef.entity) {
                            const movement = combatRef.entity.getComponent(Movement);
                            if (movement) movement.facingAngle = combatRef.blockInputBufferedFacingAngle;
                            combatRef.blockInputBufferedFacingAngle = null;
                        }
                        combatRef.startBlocking();
                    }
                    // Fire buffered attack if player pressed attack during the animation
                    if (combatRef.attackInputBuffered) {
                        const b = combatRef.attackInputBuffered;
                        combatRef.attackInputBuffered = null;
                        combatRef.attack(b.targetX, b.targetY, b.chargeDuration, b.options);
                    }
                }, durationMs);
                
                return attackData;
            }
            return false;
        } else if (this.demonAttack) {
            // Demon claw: charge up in cone, then release heavy blow
            if (this.demonAttack.isAttacking || !this.demonAttack.canAttack()) {
                return false;
            }
            const attackData = this.demonAttack.startAttack(targetX, targetY, this.entity);
            if (attackData) {
                this._currentAttackKnockbackForce = attackData.knockbackForce ?? null;
                this.attackRange = attackData.range;
                this.attackDamage = attackData.damage;
                this.attackArc = attackData.arc;
                this.currentAttackIsCircular = attackData.isCircular === true;
                this.currentAttackAnimationKey = attackData.animationKey || null;
                const durationMs = attackData.duration;
                setTimeout(() => {
                    if (this.demonAttack && this.demonAttack.isAttacking) {
                        this.currentAttackIsCircular = false;
                        this.currentAttackAnimationKey = null;
                        this._currentAttackKnockbackForce = null;
                        this.demonAttack.endAttack();
                    } else {
                        this.currentAttackIsCircular = false;
                        this.currentAttackAnimationKey = null;
                        this._currentAttackKnockbackForce = null;
                    }
                }, durationMs);
                return attackData;
            }
            return false;
        } else if (this.chieftainAttack) {
            // Chieftain heavy smash: charge then release
            if (this.chieftainAttack.isAttacking || !this.chieftainAttack.canAttack()) {
                return false;
            }
            const attackData = this.chieftainAttack.startAttack(targetX, targetY, this.entity);
            if (attackData) {
                this._currentAttackKnockbackForce = attackData.knockbackForce ?? null;
                this.attackRange = attackData.range;
                this.attackDamage = attackData.damage;
                this.attackArc = attackData.arc;
                this.currentAttackIsCircular = attackData.isCircular === true;
                this.currentAttackAnimationKey = attackData.animationKey || null;
                const durationMs = attackData.duration;
                const combatRef = this;
                setTimeout(() => {
                    if (combatRef.chieftainAttack && combatRef.chieftainAttack.isAttacking) {
                        combatRef.currentAttackIsCircular = false;
                        combatRef.currentAttackAnimationKey = null;
                        combatRef._currentAttackKnockbackForce = null;
                        combatRef.chieftainAttack.endAttack();
                    } else {
                        combatRef.currentAttackIsCircular = false;
                        combatRef.currentAttackAnimationKey = null;
                        combatRef._currentAttackKnockbackForce = null;
                    }
                }, durationMs);
                return attackData;
            }
            return false;
        } else if (this.goblinAttack) {
            // Goblin attack (swipe)
            return this.goblinAttack.attack(this.getPackCooldownMultiplier());
        } else if (this.skeletonAttack) {
            // Skeleton attack (ranged only - melee attack should not be called)
            return false;
        } else if (this.enemyAttack) {
            // Fallback enemy attack (simple)
            return this.enemyAttack.attack(this.getPackCooldownMultiplier());
        }
        return false;
    }
    
    // Getters for compatibility
    get isAttacking() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.isAttacking;
        } else if (this.demonAttack) {
            return this.demonAttack.isAttacking;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.isAttacking;
        } else if (this.goblinAttack) {
            return this.goblinAttack.isAttacking;
        } else if (this.skeletonAttack) {
            return this.skeletonAttack.isAttacking;
        } else if (this.enemyAttack) {
            return this.enemyAttack.isAttacking;
        }
        return false;
    }
    
    get isWindingUp() {
        if (this.goblinAttack) {
            return this.goblinAttack.isWindingUp;
        } else if (this.chieftainAttack && this.chieftainAttack.isAttacking && !this.chieftainAttack.isInReleasePhase) {
            return true; // charge phase = wind-up for visuals
        } else if (this.skeletonAttack) {
            return this.skeletonAttack.isWindingUp;
        } else if (this.enemyAttack) {
            return this.enemyAttack.isWindingUp;
        }
        return false;
    }
    
    get attackProcessed() {
        if (this.demonAttack) {
            // For demons, check if player has been hit
            return this.demonAttack.hasHitEnemy('player');
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.hasHitEnemy('player');
        } else if (this.goblinAttack) {
            return this.goblinAttack.attackProcessed;
        } else if (this.skeletonAttack) {
            return this.skeletonAttack.attackProcessed;
        } else if (this.enemyAttack) {
            return this.enemyAttack.attackProcessed;
        }
        return false;
    }
    
    get comboStage() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.comboStage;
        } else if (this.demonAttack) {
            return this.demonAttack.comboStage;
        }
        return 0;
    }
    
    get attackTimer() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.attackTimer;
        } else if (this.demonAttack) {
            return this.demonAttack.attackTimer;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.attackTimer;
        }
        return 0;
    }
    
    get attackDuration() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.attackDuration;
        } else if (this.demonAttack) {
            return this.demonAttack.attackDuration;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.attackDuration;
        }
        return 0;
    }
    
    get hitEnemies() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.hitEnemies;
        } else if (this.demonAttack) {
            return this.demonAttack.hitEnemies;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.hitEnemies;
        }
        return new Set();
    }

    get currentAttackKnockbackForce() {
        return this._currentAttackKnockbackForce;
    }

    get currentAttackStunBuildup() {
        return this._currentAttackStunBuildup ?? 0;
    }
    
    get windUpProgress() {
        if (this.goblinAttack) {
            return this.goblinAttack.windUpProgress;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.chargeProgress;
        } else if (this.skeletonAttack) {
            return this.skeletonAttack.windUpProgress;
        } else if (this.enemyAttack) {
            return this.enemyAttack.windUpProgress;
        }
        return 0;
    }
    
    get cooldown() {
        if (this.goblinAttack) {
            return this.goblinAttack.cooldown;
        } else if (this.skeletonAttack) {
            return this.skeletonAttack.cooldown;
        } else if (this.enemyAttack) {
            return this.enemyAttack.cooldown;
        } else if (this.demonAttack) {
            // For demon attacks, return 0 if can attack, otherwise a small value
            return this.demonAttack.canAttack() ? 0 : 0.1;
        } else if (this.chieftainAttack) {
            return this.chieftainAttack.canAttack() ? 0 : 0.1;
        }
        // For player attacks, return 0 (cooldown is managed by PlayerAttack)
        return 0;
    }
    
    get isLunging() {
        if (this.goblinAttack) {
            return this.goblinAttack.isLunging;
        } else if (this.enemyAttack) {
            return this.enemyAttack.isLunging;
        }
        return false;
    }
}

