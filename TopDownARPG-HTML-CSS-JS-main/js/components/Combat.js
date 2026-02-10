// Combat component - now uses PlayerAttack or enemy-specific attack classes
class Combat {
    constructor(attackRange, attackDamage, attackArc, cooldown, windUpTime = 0.5, isPlayer = false, weapon = null, enemyType = null) {
        this.entity = null;
        this.isPlayer = isPlayer;
        this.currentAttackIsCircular = false;
        this.currentAttackAnimationKey = null;
        
        // Use appropriate attack handler
        if (isPlayer) {
            this.playerAttack = new PlayerAttack(weapon || Weapons.sword);
            this.goblinAttack = null;
            this.skeletonAttack = null;
            this.demonAttack = null;
            this.enemyAttack = null;
        } else if (enemyType === 'greaterDemon') {
            // Greater demons use DemonAttack (claw: charge cone then heavy blow)
            this.demonAttack = new DemonAttack();
            this.goblinAttack = null;
            this.skeletonAttack = null;
            this.enemyAttack = null;
            this.playerAttack = null;
        } else if (enemyType === 'goblin' || enemyType === 'lesserDemon') {
            // Goblins use GoblinAttack (lunge and swipe)
            this.goblinAttack = new GoblinAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            this.skeletonAttack = null;
            this.demonAttack = null;
            this.enemyAttack = null;
            this.playerAttack = null;
        } else if (enemyType === 'skeleton') {
            // Skeletons use SkeletonAttack (ranged only, no melee)
            this.skeletonAttack = new SkeletonAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            this.goblinAttack = null;
            this.demonAttack = null;
            this.enemyAttack = null;
            this.playerAttack = null;
        } else {
            // Fallback to generic EnemyAttack for unknown types
            this.enemyAttack = new EnemyAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            this.goblinAttack = null;
            this.skeletonAttack = null;
            this.demonAttack = null;
            this.playerAttack = null;
        }
        
        // Legacy properties for compatibility (will be removed)
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackArc = attackArc;
        this._cooldown = 0;
        this.maxCooldown = cooldown;
        this.windUpTime = windUpTime;
        
        // Blocking state (player only); block config comes from weapon.getBlockConfig()
        this.isBlocking = false;
        // Block input buffer: start block as soon as attack ends if right-click was pressed during attack
        this.blockInputBuffered = false;
        this.blockInputBufferedFacingAngle = null;

        // Current attack knockback (player only; from weapon/stage config, used when applying hit)
        this._currentAttackKnockbackForce = null;
    }
    
    // Set weapon for player
    setWeapon(weapon) {
        if (this.isPlayer && this.playerAttack) {
            this.playerAttack.setWeapon(weapon);
        }
    }
    
    get weapon() {
        return this.isPlayer && this.playerAttack ? this.playerAttack.weapon : null;
    }

    update(deltaTime, systems) {
        if (this.isPlayer && this.playerAttack) {
            this.playerAttack.update(deltaTime);
            // Blocking stamina is consumed once when starting (handled in startBlocking)
        } else if (this.demonAttack) {
            this.demonAttack.update(deltaTime);
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

    attack(targetX = null, targetY = null, chargeDuration = 0) {
        if (this.isPlayer && this.playerAttack) {
            // Player attack with weapon combos
            const attackData = this.playerAttack.startAttack(targetX, targetY, this.entity, chargeDuration);
            if (attackData) {
                this._currentAttackKnockbackForce = attackData.knockbackForce ?? null;
                // Update legacy properties for compatibility
                this.attackRange = attackData.range;
                this.attackDamage = attackData.damage;
                this.attackArc = attackData.arc;
                this.currentAttackIsCircular = attackData.isCircular === true;
                this.currentAttackAnimationKey = attackData.animationKey || null;
                
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
                
                // Set timeout to end attack
                const combatRef = this;
                setTimeout(() => {
                    combatRef.currentAttackIsCircular = false;
                    combatRef.currentAttackAnimationKey = null;
                    combatRef._currentAttackKnockbackForce = null;
                    combatRef.playerAttack.endAttack();
                    // Apply buffered block input (player pressed block during attack)
                    if (combatRef.isPlayer && combatRef.blockInputBuffered) {
                        combatRef.blockInputBuffered = false;
                        if (combatRef.blockInputBufferedFacingAngle != null && combatRef.entity) {
                            const movement = combatRef.entity.getComponent(Movement);
                            if (movement) movement.facingAngle = combatRef.blockInputBufferedFacingAngle;
                            combatRef.blockInputBufferedFacingAngle = null;
                        }
                        combatRef.startBlocking();
                    }
                }, attackData.duration);
                
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
        } else if (this.goblinAttack) {
            // Goblin attack (swipe)
            return this.goblinAttack.attack();
        } else if (this.skeletonAttack) {
            // Skeleton attack (ranged only - melee attack should not be called)
            return false;
        } else if (this.enemyAttack) {
            // Fallback enemy attack (simple)
            return this.enemyAttack.attack();
        }
        return false;
    }
    
    // Getters for compatibility
    get isAttacking() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.isAttacking;
        } else if (this.demonAttack) {
            return this.demonAttack.isAttacking;
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
        }
        return 0;
    }
    
    get attackDuration() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.attackDuration;
        } else if (this.demonAttack) {
            return this.demonAttack.attackDuration;
        }
        return 0;
    }
    
    get hitEnemies() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.hitEnemies;
        } else if (this.demonAttack) {
            return this.demonAttack.hitEnemies;
        }
        return new Set();
    }

    get currentAttackKnockbackForce() {
        return this._currentAttackKnockbackForce;
    }
    
    get windUpProgress() {
        if (this.goblinAttack) {
            return this.goblinAttack.windUpProgress;
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

