// Combat component - now uses PlayerAttack or EnemyAttack classes
class Combat {
    constructor(attackRange, attackDamage, attackArc, cooldown, windUpTime = 0.5, isPlayer = false, weapon = null) {
        this.entity = null;
        this.isPlayer = isPlayer;
        this.currentAttackIsCircular = false;
        this.currentAttackAnimationKey = null;
        
        // Use appropriate attack handler
        if (isPlayer) {
            this.playerAttack = new PlayerAttack(weapon || Weapons.sword);
            this.enemyAttack = null;
        } else {
            this.enemyAttack = new EnemyAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            this.playerAttack = null;
        }
        
        // Legacy properties for compatibility (will be removed)
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackArc = attackArc;
        this._cooldown = 0;
        this.maxCooldown = cooldown;
        this.windUpTime = windUpTime;
        
        // Blocking properties (player only)
        this.isBlocking = false;
        this.blockDamageReduction = 1.0; // 100% damage reduction when blocking
        this.blockStaminaCost = 5; // Stamina cost to start blocking (one-time)
        this.blockArc = Math.PI * 0.75; // 135 degrees - can block attacks from front

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
        } else if (this.enemyAttack) {
            this.enemyAttack.update(deltaTime);
        }
    }
    
    startBlocking() {
        if (this.isPlayer && !this.isAttacking) {
            // Start blocking - no stamina cost (cost is per blocked attack)
            this.isBlocking = true;
            return true;
        }
        return false;
    }
    
    // Consume stamina when successfully blocking an attack
    consumeBlockStamina() {
        if (this.isPlayer && this.isBlocking) {
            const stamina = this.entity.getComponent(Stamina);
            if (stamina && stamina.currentStamina >= this.blockStaminaCost) {
                stamina.currentStamina -= this.blockStaminaCost;
                return true;
            }
            // Not enough stamina - stop blocking
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
        
        // Calculate angle difference
        let angleDiff = Math.abs(attackAngle - facingAngle);
        // Normalize to -PI to PI
        if (angleDiff > Math.PI) {
            angleDiff = (Math.PI * 2) - angleDiff;
        }
        
        // Check if attack is within block arc
        return angleDiff <= (this.blockArc / 2);
    }

    attack(targetX = null, targetY = null) {
        if (this.isPlayer && this.playerAttack) {
            // Player attack with weapon combos
            const attackData = this.playerAttack.startAttack(targetX, targetY, this.entity);
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
                setTimeout(() => {
                    this.currentAttackIsCircular = false;
                    this.currentAttackAnimationKey = null;
                    this._currentAttackKnockbackForce = null;
                    this.playerAttack.endAttack();
                }, attackData.duration);
                
                return attackData;
            }
            return false;
        } else if (this.enemyAttack) {
            // Enemy attack (simple)
            return this.enemyAttack.attack();
        }
        return false;
    }
    
    // Getters for compatibility
    get isAttacking() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.isAttacking;
        } else if (this.enemyAttack) {
            return this.enemyAttack.isAttacking;
        }
        return false;
    }
    
    get isWindingUp() {
        if (this.enemyAttack) {
            return this.enemyAttack.isWindingUp;
        }
        return false;
    }
    
    get attackProcessed() {
        if (this.enemyAttack) {
            return this.enemyAttack.attackProcessed;
        }
        return false;
    }
    
    get comboStage() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.comboStage;
        }
        return 0;
    }
    
    get attackTimer() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.attackTimer;
        }
        return 0;
    }
    
    get attackDuration() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.attackDuration;
        }
        return 0;
    }
    
    get hitEnemies() {
        if (this.isPlayer && this.playerAttack) {
            return this.playerAttack.hitEnemies;
        }
        return new Set();
    }

    get currentAttackKnockbackForce() {
        return this._currentAttackKnockbackForce;
    }
    
    get windUpProgress() {
        if (this.enemyAttack) {
            return this.enemyAttack.windUpProgress;
        }
        return 0;
    }
    
    get cooldown() {
        if (this.enemyAttack) {
            return this.enemyAttack.cooldown;
        }
        // For player attacks, return 0 (cooldown is managed by PlayerAttack)
        return 0;
    }
    
    get isLunging() {
        if (this.enemyAttack) {
            return this.enemyAttack.isLunging;
        }
        return false;
    }
}

