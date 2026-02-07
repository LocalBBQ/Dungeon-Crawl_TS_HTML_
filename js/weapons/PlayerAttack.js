// Player-specific attack handler with weapon support
class PlayerAttack {
    constructor(weapon) {
        this.weapon = weapon || Weapons.sword; // Default to sword
        this.comboStage = 0;
        this.comboTimer = 0;
        this.comboWindow = (this.weapon.comboWindow ?? 1.5); // seconds, from weapon config
        this.hitEnemies = new Set();
        this.attackTimer = 0;
        this.attackDuration = 0;
        this.attackBuffer = 0;
        this.attackBufferDuration = 0; // no delay after attack completes — can chain next attack immediately
    }
    
    setWeapon(weapon) {
        this.weapon = weapon;
        this.comboWindow = weapon.comboWindow ?? 1.5;
        this.resetCombo();
    }
    
    update(deltaTime) {
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
    
    startAttack(targetX, targetY, entity) {
        if (!this.canAttack()) {
            return false;
        }
        
        // Advance combo stage
        if (this.comboStage < this.weapon.maxComboStage) {
            this.comboStage++;
        } else {
            // Reset to first stage after completing full combo
            this.comboStage = 1;
        }
        
        // Reset combo window
        this.comboTimer = this.comboWindow;
        this.hitEnemies.clear();
        
        // Get combo stage properties
        const stageProps = this.weapon.getComboStageProperties(this.comboStage);
        if (!stageProps) return false;
        
        // Set attack duration
        this.attackDuration = stageProps.duration / 1000; // Convert to seconds
        this.attackTimer = 0.001; // Start timer (small value to indicate active)
        
        // Handle dash for stage 3 (or any stage with dashSpeed)
        if (stageProps.dashSpeed && entity) {
            const movement = entity.getComponent(Movement);
            const transform = entity.getComponent(Transform);
            if (movement && transform && targetX !== null && targetY !== null) {
                const dx = targetX - transform.x;
                const dy = targetY - transform.y;
                const normalized = Utils.normalize(dx, dy);
                movement.startAttackDash(normalized.x, normalized.y, stageProps.dashDuration);
            }
        }
        
        return {
            range: stageProps.range,
            damage: stageProps.damage,
            arc: stageProps.arc,
            comboStage: this.comboStage,
            staminaCost: stageProps.staminaCost,
            duration: stageProps.duration,
            stageName: stageProps.stageName,
            animationKey: stageProps.animationKey,
            isCircular: stageProps.isCircular,
            knockbackForce: stageProps.knockbackForce
        };
    }
    
    endAttack() {
        this.attackTimer = 0;
        this.attackBuffer = this.attackBufferDuration;
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
        return this.attackTimer > 0 && this.attackTimer < this.attackDuration;
    }
}

