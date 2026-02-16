// Enemy-specific attack handler (simpler, no combos)
export class EnemyAttack {
    attackRange: number;
    attackDamage: number;
    attackArc: number;
    cooldown = 0;
    maxCooldown: number;
    windUpTime: number;
    windUpTimer = 0;
    isWindingUp = false;
    isAttacking = false;
    attackProcessed = false;
    _slashStartTime = 0;
    isLunging = false;
    lungeTargetX = 0;
    lungeTargetY = 0;
    lungeDamage = 0;

    constructor(attackRange: number, attackDamage: number, attackArc: number, cooldown: number, windUpTime = 0.5) {
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackArc = attackArc;
        this.maxCooldown = cooldown;
        this.windUpTime = windUpTime;
    }

    update(deltaTime: number): void {
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - deltaTime);
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
    }

    startLunge(targetX: number, targetY: number, lungeConfig: { lungeDamage?: number }): void {
        this.isLunging = true;
        this.lungeTargetX = targetX;
        this.lungeTargetY = targetY;
        this.lungeDamage = lungeConfig.lungeDamage ?? this.attackDamage;
        this.isAttacking = true;
        this.attackProcessed = false;
    }

    endLunge(cooldownMultiplier = 1): void {
        this.isLunging = false;
        this.isAttacking = false;
        this.attackProcessed = false;
        this.cooldown = this.maxCooldown * (cooldownMultiplier != null ? cooldownMultiplier : 1);
    }

    attack(cooldownMultiplier = 1): boolean {
        if (this.cooldown > 0 || this.isWindingUp) return false;
        this.isWindingUp = true;
        this.windUpTimer = this.windUpTime;
        this.cooldown = this.maxCooldown * (cooldownMultiplier != null ? cooldownMultiplier : 1);
        return true;
    }

    get windUpProgress(): number {
        if (!this.isWindingUp) return 0;
        return 1 - (this.windUpTimer / this.windUpTime);
    }

    getSlashSweepProgress(): number {
        if (this.isLunging) return 1;
        if (!this.isAttacking || !this._slashStartTime) return 0;
        const raw = Math.min(1, (Date.now() - this._slashStartTime) / 200);
        return 1 - (1 - raw) ** 4;
    }
}
