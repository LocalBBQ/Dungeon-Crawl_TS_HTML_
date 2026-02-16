// Player healing: charge-based, 2s drink then rapid regen; 50% move speed while active
class PlayerHealing {
    constructor() {
        const cfg = GameConfig.player.heal || {};
        this.maxCharges = cfg.maxCharges ?? 3;
        this.charges = this.maxCharges;
        this.chargeRegenTimer = 0;
        this.chargeRegenTime = cfg.chargeRegenTime ?? 30;

        this.drinkTime = cfg.drinkTime ?? 2;
        this.regenRate = cfg.regenRate ?? 20;
        this.regenDuration = cfg.regenDuration ?? 2;

        /** 'idle' | 'drinking' | 'regening' */
        this.phase = 'idle';
        this.phaseTimer = 0;

        this.entity = null;
    }

    get isDrinking() {
        return this.phase === 'drinking';
    }

    get isRegening() {
        return this.phase === 'regening';
    }

    get isHealing() {
        return this.isDrinking || this.isRegening;
    }

    startDrinking() {
        if (this.phase !== 'idle' || this.charges <= 0) return false;
        const health = this.entity ? this.entity.getComponent(Health) : null;
        if (health && health.currentHealth >= health.maxHealth) return false;
        this.phase = 'drinking';
        this.phaseTimer = 0;
        return true;
    }

    cancelDrinking() {
        if (this.phase === 'drinking') {
            this.phase = 'idle';
            this.phaseTimer = 0;
        }
    }

    update(deltaTime) {
        const health = this.entity ? this.entity.getComponent(Health) : null;

        if (this.phase === 'drinking') {
            this.phaseTimer += deltaTime;
            if (this.phaseTimer >= this.drinkTime) {
                this.phase = 'regening';
                this.phaseTimer = 0;
                this.charges = Math.max(0, this.charges - 1);
            }
            return;
        }

        if (this.phase === 'regening') {
            if (health) {
                const amount = Math.min(
                    this.regenRate * deltaTime,
                    health.maxHealth - health.currentHealth
                );
                if (amount > 0) health.heal(amount);
            }
            this.phaseTimer += deltaTime;
            if (this.phaseTimer >= this.regenDuration || (health && health.currentHealth >= health.maxHealth)) {
                this.phase = 'idle';
                this.phaseTimer = 0;
            }
            return;
        }

        // idle: regenerate charges
        if (this.charges < this.maxCharges) {
            this.chargeRegenTimer += deltaTime;
            if (this.chargeRegenTimer >= this.chargeRegenTime) {
                this.charges = Math.min(this.maxCharges, this.charges + 1);
                this.chargeRegenTimer = 0;
            }
        } else {
            this.chargeRegenTimer = 0;
        }
    }
}
