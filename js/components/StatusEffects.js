// Status effects (stun, etc.) - shared by player and enemies
// Stun is a meter: attacks add buildup; when buildup >= threshold, entity is stunned and meter resets.
class StatusEffects {
    constructor(isPlayer = false) {
        this.entity = null;
        this.isPlayer = isPlayer;
        // Stun: end time in seconds (performance.now()/1000)
        this.stunnedUntil = 0;
        // Total duration of current stun (seconds), for UI bar
        this.stunDurationTotal = 0;
        // True once this entity has been stunned at least once (used to show enemy stun bar only after first stun)
        this.hasBeenStunnedOnce = false;
        // Stun meter (buildup toward threshold)
        this.stunBuildup = 0;
        // Last time (seconds) we received stun buildup — used for player decay cooldown
        this.lastStunBuildupTime = 0;
        // War cry buff (enemies only): temporary speed/damage boost from goblin chieftain
        this.buffedUntil = 0;
        this.speedMultiplier = 1;
        this.damageMultiplier = 1;
        // Knockback resistance 0–1 (percentage; 0 = none, 0.3 = 30% less, 1 = immune). Set from config or buffs.
        this.knockbackResist = isPlayer ? (typeof GameConfig !== 'undefined' ? (GameConfig.player?.knockback?.knockbackResist ?? 0) : 0) : 0;
        // Pack modifier buff (enemies only): applied when in pack with same-type allies
        this.packModifierName = null;
        this.packSpeedMultiplier = 1;
        this.packDamageMultiplier = 1;
        this.packKnockbackResist = 0;
        this.packAttackCooldownMultiplier = 1;
        this.packStunBuildupMultiplier = 1;
        this.packDetectionRangeMultiplier = 1;
    }

    /** Set pack buff from modifier definition (called by EnemyManager when in pack). */
    setPackBuff(modifierName, stats) {
        this.packModifierName = modifierName;
        this.packSpeedMultiplier = stats.speedMultiplier != null ? stats.speedMultiplier : 1;
        this.packDamageMultiplier = stats.damageMultiplier != null ? stats.damageMultiplier : 1;
        this.packKnockbackResist = Math.max(0, Math.min(1, stats.knockbackResist || 0));
        this.packAttackCooldownMultiplier = stats.attackCooldownMultiplier != null ? stats.attackCooldownMultiplier : 1;
        this.packStunBuildupMultiplier = stats.stunBuildupPerHitMultiplier != null ? stats.stunBuildupPerHitMultiplier : 1;
        this.packDetectionRangeMultiplier = stats.detectionRangeMultiplier != null ? stats.detectionRangeMultiplier : 1;
    }

    /** Clear pack buff (when no longer in pack). */
    clearPackBuff() {
        this.packModifierName = null;
        this.packSpeedMultiplier = 1;
        this.packDamageMultiplier = 1;
        this.packKnockbackResist = 0;
        this.packAttackCooldownMultiplier = 1;
        this.packStunBuildupMultiplier = 1;
        this.packDetectionRangeMultiplier = 1;
    }

    get isStunned() {
        const now = performance.now() / 1000;
        if (now >= this.stunnedUntil) return false;
        return true;
    }

    /** Stun meter fill (0–1) for UI. */
    get stunMeterPercent() {
        const threshold = this._getStunThreshold();
        return threshold <= 0 ? 0 : Math.min(1, this.stunBuildup / threshold);
    }

    _getStunThreshold() {
        if (this.isPlayer) {
            const cfg = GameConfig.player.stun || {};
            return cfg.threshold ?? 100;
        }
        // Per-enemy-type override (e.g. goblin, goblinChieftain have lower threshold)
        if (this.entity && this.entity.components) {
            for (const comp of this.entity.components.values()) {
                if (comp.enemyType != null && GameConfig.enemy && GameConfig.enemy.types && GameConfig.enemy.types[comp.enemyType]) {
                    const typeCfg = GameConfig.enemy.types[comp.enemyType];
                    if (typeCfg.stunThreshold != null) return typeCfg.stunThreshold;
                }
            }
        }
        const cfg = GameConfig.statusEffects || {};
        return cfg.enemyStunThreshold ?? 100;
    }

    _getStunDuration() {
        if (this.isPlayer) {
            const cfg = GameConfig.player.stun || {};
            return cfg.duration ?? 1;
        }
        const cfg = GameConfig.statusEffects || {};
        return cfg.enemyStunDuration ?? 1;
    }

    _getStunDecayPerSecond() {
        if (this.isPlayer) {
            const cfg = GameConfig.player.stun || {};
            return cfg.decayPerSecond ?? 0;
        }
        const cfg = GameConfig.statusEffects || {};
        return cfg.enemyStunDecayPerSecond ?? 0;
    }

    /** Seconds after last buildup before decay starts (player or enemy). */
    _getStunDecayCooldown() {
        if (this.isPlayer) {
            const cfg = GameConfig.player.stun || {};
            return cfg.decayCooldown ?? 0;
        }
        const cfg = GameConfig.statusEffects || {};
        return cfg.enemyStunDecayCooldown ?? 0;
    }

    /** Apply stun for the given duration (seconds). */
    applyStun(duration) {
        const now = performance.now() / 1000;
        const end = now + duration;
        if (end > this.stunnedUntil) {
            this.stunnedUntil = end;
            this.stunDurationTotal = end - now;
            this.hasBeenStunnedOnce = true;
        }
    }

    /** Fraction of stun duration remaining (0–1) for UI bar; 0 when not stunned. */
    get stunDurationPercentRemaining() {
        const now = performance.now() / 1000;
        if (now >= this.stunnedUntil || this.stunDurationTotal <= 0) return 0;
        return Math.min(1, (this.stunnedUntil - now) / this.stunDurationTotal);
    }

    /**
     * Add stun buildup. When buildup >= threshold, applies stun and resets meter.
     * @param {number} amount - stun buildup to add (from attacks/weapons)
     */
    addStunBuildup(amount) {
        if (amount <= 0) return;
        const threshold = this._getStunThreshold();
        if (threshold <= 0) return;
        this.stunBuildup += amount;
        this.lastStunBuildupTime = performance.now() / 1000;
        if (this.stunBuildup >= threshold) {
            this.applyStun(this._getStunDuration());
            this.stunBuildup = 0;
        }
    }

    /** Apply war cry buff from goblin chieftain (enemies only). */
    applyWarCryBuff(durationSeconds, speedMultiplier, damageMultiplier) {
        const now = performance.now() / 1000;
        this.buffedUntil = now + durationSeconds;
        this.speedMultiplier = speedMultiplier != null ? speedMultiplier : 1;
        this.damageMultiplier = damageMultiplier != null ? damageMultiplier : 1;
    }

    update(deltaTime, systems) {
        const now = performance.now() / 1000;
        if (now >= this.buffedUntil) {
            this.speedMultiplier = 1;
            this.damageMultiplier = 1;
        }
        if (now < this.stunnedUntil) return; // no decay while stunned
        const decay = this._getStunDecayPerSecond();
        if (decay <= 0 || this.stunBuildup <= 0) return;
        // Wait for decay cooldown after last stun buildup before decaying (player and enemies)
        const cooldown = this._getStunDecayCooldown();
        if (cooldown > 0 && now - this.lastStunBuildupTime < cooldown) return;
        this.stunBuildup = Math.max(0, this.stunBuildup - decay * deltaTime);
    }
}
