// Skeleton-specific attack handler - ranged attacks only (no melee)
class SkeletonAttack {
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
                
                // Reset attack state after a short time
                setTimeout(() => {
                    this.isAttacking = false;
                    this.attackProcessed = false;
                }, 200);
            }
        }
    }
    
    attack() {
        // Skeletons don't use melee attacks - they only use projectiles
        // This method exists for compatibility but should not be called
        return false;
    }
    
    get windUpProgress() {
        if (!this.isWindingUp) return 0;
        return 1 - (this.windUpTimer / this.windUpTime);
    }
}

