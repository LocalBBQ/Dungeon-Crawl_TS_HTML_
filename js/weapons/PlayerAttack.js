// Player-specific attack handler: delegates all attack/charge resolution to the equipped weapon.
class PlayerAttack {
    constructor(weapon) {
        this.weapon = weapon;
        this.comboStage = 0;
        this.comboTimer = 0;
        this.comboWindow = this.weapon.comboWindow ?? 1.5;
        this.hitEnemies = new Set();
        this.attackTimer = 0;
        this.attackDuration = 0;
        this.attackBuffer = 0;
    }

    setWeapon(weapon) {
        this.weapon = weapon;
        this.comboWindow = weapon.comboWindow ?? 1.5;
        this.resetCombo();
    }
    
    update(deltaTime, entity = null) {
        // Update attack timer for visual effects
        if (this.attackTimer > 0) {
            this.attackTimer += deltaTime;
        }
        
        // Update attack buffer
        if (this.attackBuffer > 0) {
            this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
        }
        
        // Update combo timer
        if (this.comboStage > 0 && this.attackTimer <= 0) {
            this.comboTimer -= deltaTime;
            if (this.comboTimer <= 0) {
                this.resetCombo();
            }
        }
    }
    
    canAttack() {
        return this.attackBuffer <= 0;
    }

    /** Returns stamina cost for the next attack (delegates to weapon; no generic values). */
    getNextAttackStaminaCost(chargeDuration = 0, options = {}) {
        return this.weapon.getStaminaCostForAttack(chargeDuration, this.comboStage, options);
    }

    startAttack(targetX, targetY, entity, chargeDuration = 0, options = {}) {
        if (!this.canAttack()) return false;

        const resolved = this.weapon.getResolvedAttack(chargeDuration, this.comboStage, options);
        if (!resolved) return false;

        const { stageProps, finalDamage, finalRange, finalStaminaCost, dashSpeed, dashDuration, nextComboStage, isCharged, chargeMultiplier } = resolved;
        this.comboStage = nextComboStage;
        this.comboTimer = this.comboWindow;
        this.hitEnemies.clear();
        // Duration: stage config is in ms. Ensure attack lasts at least as long as any dash (e.g. charged thrust).
        let durationMs = stageProps.duration;
        if (durationMs < 50) durationMs = Math.round(durationMs * 1000); // config typo: value was in seconds
        if (dashDuration != null && dashDuration > 0) {
            const dashMs = Math.ceil(dashDuration * 1000);
            if (dashMs > durationMs) durationMs = dashMs;
        }
        this.attackDuration = durationMs / 1000;
        this.attackTimer = 0.001;

        if (dashSpeed && entity) {
            const transform = entity.getComponent(Transform);
            if (transform && targetX != null && targetY != null) {
                const dx = targetX - transform.x;
                const dy = targetY - transform.y;
                const normalized = Utils.normalize(dx, dy);
                const movement = entity.getComponent(Movement);
                if (movement && movement.startAttackDash) {
                    movement.startAttackDash(normalized.x, normalized.y, dashDuration, dashSpeed);
                }
            }
        }

        return {
            range: finalRange,
            damage: finalDamage,
            arc: stageProps.arc,
            arcOffset: stageProps.arcOffset ?? 0,
            reverseSweep: stageProps.reverseSweep === true,
            comboStage: this.comboStage,
            staminaCost: finalStaminaCost,
            duration: durationMs,
            stageName: stageProps.stageName,
            animationKey: stageProps.animationKey,
            isCircular: stageProps.isCircular,
            isThrust: stageProps.isThrust === true,
            thrustWidth: stageProps.thrustWidth ?? 40,
            knockbackForce: stageProps.knockbackForce,
            stunBuildup: stageProps.stunBuildup ?? 25,
            isCharged,
            chargeMultiplier,
            isDashAttack: !!(options.useDashAttack && this.weapon.dashAttack)
        };
    }
    
    endAttack() {
        this.attackTimer = 0;
        this.attackBuffer = 0;
        this.hitEnemies.clear();
    }
    
    resetCombo() {
        this.comboStage = 0;
        this.comboTimer = 0;
        this.hitEnemies.clear();
    }
    
    hasHitEnemy(enemyId) {
        return this.hitEnemies.has(enemyId);
    }
    
    markEnemyHit(enemyId) {
        this.hitEnemies.add(enemyId);
    }
    
    get isAttacking() {
        // Must stay true until endAttack() runs (setTimeout callback). If we used
        // "attackTimer < attackDuration", the update loop would set isAttacking false
        // a frame or more before the callback runs, allowing a new attack to start and chain.
        return this.attackTimer > 0;
    }

    /** True when the active hitbox/release phase is in progress (for visuals/hit detection). */
    get isAttackActive() {
        return this.attackTimer > 0 && this.attackTimer < this.attackDuration;
    }
}

