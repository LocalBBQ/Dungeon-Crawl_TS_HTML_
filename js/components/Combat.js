// Combat component - uses shared WeaponAttackHandler for both player and enemy; single code path for applying attack result.
class Combat {
    constructor(attackRange, attackDamage, attackArc, cooldown, windUpTime = 0.5, isPlayer = false, weapon = null, enemyType = null) {
        this.entity = null;
        this.isPlayer = isPlayer;
        this.currentAttackIsCircular = false;
        this.currentAttackAoeInFront = false;
        this.currentAttackAoeOffset = 0;
        this.currentAttackAoeRadius = 0;
        this.currentAttackAnimationKey = null;
        this.currentAttackIsDashAttack = false;
        this.dashAttackFlashUntil = 0;

        this.attackHandler = null;
        this.enemyAttackHandler = null;
        this.playerAttack = null;

        if (isPlayer) {
            const HandlerClass = typeof window !== 'undefined' && window.WeaponAttackHandler ? window.WeaponAttackHandler : null;
            this.attackHandler = HandlerClass ? new HandlerClass(weapon || Weapons.swordAndShield, { isPlayer: true }) : new PlayerAttack(weapon || Weapons.swordAndShield);
            this.playerAttack = this.attackHandler;
        } else {
            this.attackHandler = (Enemies.createAttackHandler && Enemies.createAttackHandler(enemyType)) || null;
            if (!this.attackHandler && typeof Enemies.getAttackFactory === 'function') {
                const createAttack = Enemies.getAttackFactory(enemyType);
                this.attackHandler = createAttack
                    ? createAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime)
                    : new EnemyAttack(attackRange, attackDamage, attackArc, cooldown, windUpTime);
            }
            this.enemyAttackHandler = this.attackHandler;
        }

        const h = this.attackHandler;
        this.attackRange = h ? h.attackRange : attackRange;
        this.attackDamage = h ? h.attackDamage : attackDamage;
        this.attackArc = h ? h.attackArc : attackArc;
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
        if (this.isPlayer && this.attackHandler && typeof this.attackHandler.setWeapon === 'function') {
            this.attackHandler.setWeapon(weapon);
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
        return this.attackHandler ? this.attackHandler.weapon : null;
    }

    /** Pack modifier: attack cooldown multiplier (enemies only). */
    getPackCooldownMultiplier() {
        if (this.isPlayer || !this.entity) return 1;
        const statusEffects = this.entity.getComponent(StatusEffects);
        return (statusEffects && statusEffects.packAttackCooldownMultiplier != null) ? statusEffects.packAttackCooldownMultiplier : 1;
    }

    update(deltaTime, systems) {
        if (this.attackHandler && typeof this.attackHandler.update === 'function') {
            this.attackHandler.update(deltaTime, this.entity);
        }
        // Flush buffered attack same tick as handler may have ended attack (game-loop check runs after all entity updates; flush here so we see !isAttacking immediately)
        if (this.isPlayer && this.attackInputBuffered && !this.isAttacking) {
            this.tryFlushBufferedAttack();
        }
        if (this.isPlayer && this.isBlocking && this.entity) {
            const statusEffects = this.entity.getComponent(StatusEffects);
            if (statusEffects && statusEffects.isStunned) this.stopBlocking();
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

    /** Single code path: apply handler result to Combat state. */
    _applyAttackResult(result) {
        if (!result || typeof result !== 'object') return;
        this._currentAttackKnockbackForce = result.knockbackForce ?? null;
        this._currentAttackStunBuildup = result.stunBuildup ?? 25;
        if (result.range != null) this.attackRange = result.range;
        if (result.damage != null) this.attackDamage = result.damage;
        if (result.arc != null) this.attackArc = result.arc;
        this.attackArcOffset = result.arcOffset ?? 0;
        this.currentAttackReverseSweep = result.reverseSweep === true;
        this.currentAttackIsCircular = result.isCircular === true;
        this.currentAttackIsThrust = result.isThrust === true;
        this.currentAttackThrustWidth = result.thrustWidth ?? 40;
        this.currentAttackAnimationKey = result.animationKey || null;
        this.currentAttackIsDashAttack = result.isDashAttack === true;
        if (result.isDashAttack) this.dashAttackFlashUntil = Date.now() + 400;
        this.currentAttackAoeInFront = result.aoeInFront === true;
        this.currentAttackAoeOffset = result.aoeOffset != null ? result.aoeOffset : 0;
        this.currentAttackAoeRadius = result.aoeRadius != null ? result.aoeRadius : 0;
    }

    /** Flush buffered attack the same frame attack ends (called from game loop for responsive chaining). */
    tryFlushBufferedAttack() {
        if (!this.isPlayer || !this.attackInputBuffered || this.isAttacking) return false;
        const b = this.attackInputBuffered;
        this.attackInputBuffered = null;
        this.attack(b.targetX, b.targetY, b.chargeDuration, b.options);
        return true;
    }

    _clearAttackState() {
        this.currentAttackIsCircular = false;
        this.currentAttackIsThrust = false;
        this.currentAttackThrustWidth = 0;
        this.currentAttackAoeInFront = false;
        this.currentAttackAoeOffset = 0;
        this.currentAttackAoeRadius = 0;
        this.currentAttackAnimationKey = null;
        this.currentAttackIsDashAttack = false;
        this.attackArcOffset = 0;
        this.currentAttackReverseSweep = false;
        this._currentAttackKnockbackForce = null;
        this._currentAttackStunBuildup = null;
    }

    attack(targetX = null, targetY = null, chargeDuration = 0, options = {}) {
        if (!this.attackHandler) return false;

        if (this.isPlayer) {
            if (this.isAttacking) {
                this.attackInputBuffered = { targetX, targetY, chargeDuration, options: options || {} };
                return false;
            }
            const staminaCost = this.attackHandler.getNextAttackStaminaCost ? this.attackHandler.getNextAttackStaminaCost(chargeDuration, options) : 0;
            const stamina = this.entity ? this.entity.getComponent(Stamina) : null;
            if (stamina && stamina.currentStamina < staminaCost) return false;
            const result = this.attackHandler.startAttack(targetX, targetY, this.entity, chargeDuration, options);
            if (!result || typeof result !== 'object') return false;
            if (stamina && result.staminaCost != null) stamina.currentStamina -= result.staminaCost;
            this._applyAttackResult(result);
            if (this.entity && this.entity.systems) {
                const eventBus = this.entity.systems.eventBus || (this.entity.systems.get ? this.entity.systems.get('eventBus') : null);
                if (eventBus) eventBus.emit('entity:attack', { entity: this.entity, range: result.range, damage: result.damage, arc: result.arc, comboStage: result.comboStage });
            }
            const durationMs = result.duration >= 100 ? result.duration : Math.round((result.duration || 0) * 1000);
            const combatRef = this;
            setTimeout(() => {
                // Only clear when not attacking, so an old timer cannot wipe the current attack's state (e.g. stab thrust → small arc when 2nd slash's timer fires mid-stab)
                if (!combatRef.isAttacking) combatRef._clearAttackState();
                if (combatRef.isPlayer && combatRef.blockInputBuffered) {
                    combatRef.blockInputBuffered = false;
                    if (combatRef.blockInputBufferedFacingAngle != null && combatRef.entity) {
                        const movement = combatRef.entity.getComponent(Movement);
                        if (movement) movement.facingAngle = combatRef.blockInputBufferedFacingAngle;
                        combatRef.blockInputBufferedFacingAngle = null;
                    }
                    combatRef.startBlocking();
                }
                if (combatRef.attackInputBuffered) {
                    const b = combatRef.attackInputBuffered;
                    combatRef.attackInputBuffered = null;
                    combatRef.attack(b.targetX, b.targetY, b.chargeDuration, b.options);
                }
            }, durationMs);
            return result;
        }

        const stamina = this.entity ? this.entity.getComponent(Stamina) : null;
        if (stamina) {
            const ai = this.entity.getComponent(AI);
            const enemyType = ai ? ai.enemyType : null;
            const enemyConfig = enemyType && GameConfig.enemy && GameConfig.enemy.types ? GameConfig.enemy.types[enemyType] : null;
            const cost = (enemyConfig && enemyConfig.attackStaminaCost != null) ? enemyConfig.attackStaminaCost : 12;
            if (!stamina.use(cost)) return false;
        }
        const result = this.attackHandler.startAttack(targetX, targetY, this.entity, chargeDuration, { cooldownMultiplier: this.getPackCooldownMultiplier() });
        if (!result || typeof result !== 'object' || result.range == null) return !!result;
        this._applyAttackResult(result);
        const durationMs = result.duration;
        const combatRef = this;
        setTimeout(() => {
            combatRef._clearAttackState();
            if (combatRef.attackHandler && combatRef.attackHandler.isAttacking && typeof combatRef.attackHandler.endAttack === 'function') combatRef.attackHandler.endAttack();
        }, durationMs);
        return result;
    }
    
    // Getters for compatibility
    get isAttacking() {
        if (this.isPlayer && this.playerAttack) return this.playerAttack.isAttacking;
        if (this.enemyAttackHandler) return this.enemyAttackHandler.isAttacking;
        return false;
    }

    get isWindingUp() {
        if (this.enemyAttackHandler) {
            if (this.enemyAttackHandler.isWindingUp) return true;
            if (this.enemyAttackHandler.hasChargeRelease && this.enemyAttackHandler.isAttacking && !this.enemyAttackHandler.isInReleasePhase) return true;
        }
        return false;
    }

    get attackProcessed() {
        if (this.enemyAttackHandler) {
            if (this.enemyAttackHandler.hasHitEnemy) return this.enemyAttackHandler.hasHitEnemy('player');
            return this.enemyAttackHandler.attackProcessed;
        }
        return false;
    }

    get comboStage() {
        if (this.isPlayer && this.playerAttack) return this.playerAttack.comboStage;
        if (this.enemyAttackHandler && this.enemyAttackHandler.comboStage != null) return this.enemyAttackHandler.comboStage;
        return 0;
    }

    get attackTimer() {
        if (this.isPlayer && this.playerAttack) return this.playerAttack.attackTimer;
        if (this.enemyAttackHandler && this.enemyAttackHandler.attackTimer != null) return this.enemyAttackHandler.attackTimer;
        return 0;
    }

    get attackDuration() {
        if (this.isPlayer && this.attackHandler) return this.attackHandler.attackDuration != null ? this.attackHandler.attackDuration : 0;
        if (this.attackHandler && this.attackHandler.attackDurationEnemy != null) return this.attackHandler.attackDurationEnemy;
        return 0;
    }

    get hitEnemies() {
        if (this.isPlayer && this.playerAttack) return this.playerAttack.hitEnemies;
        if (this.enemyAttackHandler && this.enemyAttackHandler.hitEnemies) return this.enemyAttackHandler.hitEnemies;
        return new Set();
    }

    get currentAttackKnockbackForce() {
        return this._currentAttackKnockbackForce;
    }

    get currentAttackStunBuildup() {
        return this._currentAttackStunBuildup ?? 0;
    }
    
    get windUpProgress() {
        if (this.enemyAttackHandler) {
            if (this.enemyAttackHandler.windUpProgress != null) return this.enemyAttackHandler.windUpProgress;
            if (this.enemyAttackHandler.chargeProgress != null) return this.enemyAttackHandler.chargeProgress;
        }
        return 0;
    }

    /** For slash enemies (goblin): 0 = weapon back, 1 = end of swing. Used for side-to-side dagger swing. */
    get enemySlashSweepProgress() {
        if (!this.enemyAttackHandler || typeof this.enemyAttackHandler.getSlashSweepProgress !== 'function') return 0;
        return this.enemyAttackHandler.getSlashSweepProgress();
    }

    get cooldown() {
        if (this.enemyAttackHandler) {
            if (this.enemyAttackHandler.cooldown != null) return this.enemyAttackHandler.cooldown;
            if (this.enemyAttackHandler.canAttack) return this.enemyAttackHandler.canAttack() ? 0 : 0.1;
        }
        return 0;
    }

    get isLunging() {
        return this.enemyAttackHandler ? !!this.enemyAttackHandler.isLunging : false;
    }
}

