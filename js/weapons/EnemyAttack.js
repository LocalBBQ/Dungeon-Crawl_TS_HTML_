// Enemy-specific attack handler (simpler, no combos)
class EnemyAttack {
    constructor(attackRange, attackDamage, attackArc, cooldown, windUpTime = 0.5) {
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackArc = attackArc;
        this.cooldown = 0;
        this.maxCooldown = cooldown;
        this.windUpTime = windUpTime;
        this.windUpTimer = 0;
        this.isWindingUp = false;
        this.isAttacking = false;
        this.attackProcessed = false;
        this._slashStartTime = 0;

        // Lunge attack properties
        this.isLunging = false;
        this.lungeTargetX = 0;
        this.lungeTargetY = 0;
        this.lungeDamage = 0;
    }
    
    update(deltaTime) {
        if (this.cooldown > 0) {
            this.cooldown = Math.max(0, this.cooldown - deltaTime);
        }
        
        if (this.isWindingUp) {
            this.windUpTimer -= deltaTime;
            
            if (this.windUpTimer <= 0) {
                this.isWindingUp = false;
                this.isAttacking = true;
                this.attackProcessed = false;
                this._slashStartTime = Date.now();
                const self = this;
                setTimeout(() => {
                    self.isAttacking = false;
                    self.attackProcessed = false;
                }, 200);
            }
        }
        
        // Lunge attack is handled by movement, but we track it here
        // The lunge ends when movement finishes it
    }
    
    startLunge(targetX, targetY, lungeConfig) {
        this.isLunging = true;
        this.lungeTargetX = targetX;
        this.lungeTargetY = targetY;
        this.lungeDamage = lungeConfig.lungeDamage || this.attackDamage;
        this.isAttacking = true;
        this.attackProcessed = false;
    }
    
    endLunge(cooldownMultiplier = 1) {
        this.isLunging = false;
        this.isAttacking = false;
        this.attackProcessed = false;
        this.cooldown = this.maxCooldown * (cooldownMultiplier != null ? cooldownMultiplier : 1);
    }
    
    attack(cooldownMultiplier = 1) {
        if (this.cooldown > 0 || this.isWindingUp) return false;
        
        this.isWindingUp = true;
        this.windUpTimer = this.windUpTime;
        this.cooldown = this.maxCooldown * (cooldownMultiplier != null ? cooldownMultiplier : 1);
        
        return true;
    }
    
    get windUpProgress() {
        if (!this.isWindingUp) return 0;
        return 1 - (this.windUpTimer / this.windUpTime);
    }

    /** 0 = weapon back, 1 = end of swing. Used for goblin dagger swipe when this handler is used as fallback. */
    getSlashSweepProgress() {
        if (this.isLunging) return 1;
        if (!this.isAttacking || !this._slashStartTime) return 0;
        const raw = Math.min(1, (Date.now() - this._slashStartTime) / 200);
        return 1 - (1 - raw) ** 4;
    }
}

