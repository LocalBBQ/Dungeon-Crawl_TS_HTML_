// Demon claw attack: charge up in a cone in front, then release a heavy blow
class DemonAttack {
    constructor(weapon) {
        // Claw attack config (weapon param ignored; demons always use claw)
        this.chargeTime = 1.0;       // seconds winding up (cone charging in front)
        this.releaseDuration = 0.2;   // seconds the actual hit is active
        this.attackDuration = this.chargeTime + this.releaseDuration;
        this.range = 70;             // cone length
        this.damage = 18;            // heavy blow
        this.arc = Utils.degToRad(100); // cone angle in front (100°)
        this.knockbackForce = 280;

        this.hitEnemies = new Set();
        this.attackTimer = 0;
        this.attackBuffer = 0;
        this.attackBufferDuration = 0.25; // brief buffer after attack ends
        // Compatibility: comboStage always 1 for "claw"
        this.comboStage = 0;
        this.comboTimer = 0;
        this.comboWindow = 0;
    }

    setWeapon(weapon) {
        // No-op; demon always uses claw
    }

    update(deltaTime) {
        if (this.attackTimer > 0) {
            this.attackTimer += deltaTime;
            if (this.attackTimer >= this.attackDuration) {
                this.endAttack();
            }
        }
        if (this.attackBuffer > 0) {
            this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
        }
    }

    canAttack() {
        return !this.isAttacking && this.attackBuffer <= 0;
    }

    /** True only during the short window when the claw blow can hit */
    get isInReleasePhase() {
        return this.attackTimer >= this.chargeTime && this.attackTimer < this.attackDuration;
    }

    /** 0–1 during charge phase (for visuals) */
    get chargeProgress() {
        if (this.attackTimer <= 0 || this.attackTimer >= this.chargeTime) return 0;
        return this.attackTimer / this.chargeTime;
    }

    startAttack(targetX, targetY, entity) {
        if (!this.canAttack()) return false;

        this.comboStage = 1;
        this.hitEnemies.clear();
        this.attackDuration = this.chargeTime + this.releaseDuration;
        this.attackTimer = 0.001;
        this.attackBuffer = this.attackBufferDuration;

        // No dash for claw – demon stands and charges in place
        return {
            range: this.range,
            damage: this.damage,
            arc: this.arc,
            comboStage: this.comboStage,
            duration: this.attackDuration * 1000, // ms for Combat setTimeout
            stageName: 'claw',
            animationKey: 'claw',
            isCircular: false,
            knockbackForce: this.knockbackForce
        };
    }

    endAttack() {
        if (this.attackTimer <= 0) return;
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
