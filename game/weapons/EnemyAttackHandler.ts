// Single enemy attack handler: weapon + behavior type. Used by registry; EnemyAttack is fallback for unknown types.
// Behavior types: slashOnly, slashAndLeap, chargeRelease, rangedOnly.
import type { EnemyWeaponLike } from './EnemyWeaponsRegistry.ts';

export type EnemyAttackHandlerBehaviorType = 'slashOnly' | 'slashAndLeap' | 'chargeRelease' | 'rangedOnly';

export interface EnemyAttackHandlerOptions {
    windUpTime?: number;
    cooldownMultiplier?: number;
    damageMultiplier?: number;
    attackBufferDuration?: number;
}

export class EnemyAttackHandler {
    weapon: EnemyWeaponLike | null;
    behaviorType: EnemyAttackHandlerBehaviorType;
    options: EnemyAttackHandlerOptions;
    attackRange: number;
    attackDamage: number;
    attackArc: number;
    cooldown: number;
    maxCooldown: number;
    windUpTime: number;
    cooldownMultiplier: number;
    damageMultiplier: number;
    windUpTimer: number;
    isWindingUp: boolean;
    _slashAttacking: boolean;
    _slashStartTime: number;
    attackProcessed: boolean;
    isLunging: boolean;
    SLASH_DURATION_MS: number;
    _currentSlashDurationMs: number;
    _currentWindUpDuration: number;
    lungeTargetX: number;
    lungeTargetY: number;
    lungeDamage: number;
    knockbackForce: number | null;
    hitEnemies: Set<string>;
    comboStage: number;
    comboTimer: number;
    comboWindow: number;
    chargeTime: number;
    releaseDuration: number;
    attackTimer: number;
    attackBuffer: number;
    attackBufferDuration: number;
    attackDuration: number;

    constructor(weaponOrAttackDef: EnemyWeaponLike | null, behaviorType: EnemyAttackHandlerBehaviorType | string, options: EnemyAttackHandlerOptions = {}) {
        this.weapon = weaponOrAttackDef;
        this.behaviorType = (behaviorType as EnemyAttackHandlerBehaviorType) || 'slashOnly';
        this.options = options;

        this.attackRange = 40;
        this.attackDamage = 5;
        this.attackArc = Math.PI / 2;
        this.cooldown = 0;
        this.maxCooldown = 1;
        this.windUpTime = options.windUpTime ?? 0.6;
        this.cooldownMultiplier = options.cooldownMultiplier ?? 1;
        this.damageMultiplier = options.damageMultiplier ?? 1;
        this.windUpTimer = 0;
        this.isWindingUp = false;
        this._slashAttacking = false;
        this._slashStartTime = 0;
        this.attackProcessed = false;
        this.isLunging = false;
        this.SLASH_DURATION_MS = 280;
        this._currentSlashDurationMs = 280;
        this._currentWindUpDuration = 0;
        this.lungeTargetX = 0;
        this.lungeTargetY = 0;
        this.lungeDamage = 8;
        this.knockbackForce = null;
        this.hitEnemies = new Set();

        // Combo state (same business logic as player dagger: stage 1 -> 2 -> 3 -> 1)
        this.comboStage = 0;
        this.comboTimer = 0;
        this.comboWindow = 1.2;

        // Charge-release state
        this.chargeTime = 0;
        this.releaseDuration = 0;
        this.attackTimer = 0;
        this.attackBuffer = 0;
        this.attackBufferDuration = options.attackBufferDuration ?? 0.2;
        this.attackDuration = 0;

        this._readStatsFromWeapon();
    }

    _readStatsFromWeapon() {
        const w = this.weapon;
        if (!w) return;
        if (w.noMelee) return;

        if (this.behaviorType === 'chargeRelease') {
            const get = w.getHeavySmashProperties || w.getChargeReleaseProperties;
            if (typeof get === 'function') {
                const p = get.call(w);
                if (p) {
                    this.attackRange = p.range;
                    this.attackDamage = p.damage;
                    this.attackArc = p.arc;
                    this.chargeTime = p.chargeTime;
                    this.releaseDuration = p.releaseDuration;
                    this.attackDuration = this.chargeTime + this.releaseDuration;
                }
            }
        } else if (this.behaviorType === 'slashOnly' || this.behaviorType === 'slashAndLeap') {
            const first = w.getComboStageProperties && w.getComboStageProperties(1);
            const dash = w.getDashAttackProperties && w.getDashAttackProperties();
            if (first) {
                this.attackRange = first.range;
                this.attackDamage = first.damage;
                this.attackArc = first.arc;
            }
            if (w.cooldown != null) this.maxCooldown = w.cooldown;
            if (w.comboWindow != null) this.comboWindow = w.comboWindow;
            if (dash) {
                this.lungeDamage = dash.damage;
            }
        }
    }

    getWeapon() {
        return this.weapon;
    }

    hasLunge() {
        return this.behaviorType === 'slashAndLeap';
    }

    hasChargeRelease() {
        return this.behaviorType === 'chargeRelease';
    }

    canMeleeAttack() {
        return this.behaviorType !== 'rangedOnly' && !(this.weapon && this.weapon.noMelee);
    }

    update(deltaTime) {
        if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - deltaTime);

        if (this.behaviorType === 'chargeRelease') {
            if (this.attackTimer > 0) {
                this.attackTimer += deltaTime;
                if (this.attackTimer >= this.attackDuration) this.endAttack();
            }
            if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
            return;
        }

        if (this.behaviorType === 'slashOnly' || this.behaviorType === 'slashAndLeap') {
            if (!this.isWindingUp && !this._slashAttacking && !this.isLunging && this.comboStage > 0) {
                this.comboTimer -= deltaTime;
                if (this.comboTimer <= 0) {
                    this.comboStage = 0;
                    this.comboTimer = 0;
                }
            }
            if (this.isWindingUp) {
                this.windUpTimer -= deltaTime;
                if (this.windUpTimer <= 0) {
                    this.isWindingUp = false;
                    this._slashAttacking = true;
                    this._slashStartTime = Date.now();
                    this.attackProcessed = false;
                    this.hitEnemies.delete('player'); // allow this slash to hit the player once
                    const durationMs = this._currentSlashDurationMs;
                    const self = this;
                    setTimeout(() => {
                        self._slashAttacking = false;
                        self.attackProcessed = false;
                    }, durationMs);
                }
            }
        }
    }

    startLunge(targetX, targetY, lungeConfig) {
        if (!this.hasLunge()) return;
        this.isLunging = true;
        this.lungeTargetX = targetX;
        this.lungeTargetY = targetY;
        this.lungeDamage = (lungeConfig && lungeConfig.lungeDamage != null) ? lungeConfig.lungeDamage : this.lungeDamage;
        this._slashAttacking = true;
        this.attackProcessed = false;
        this.hitEnemies.delete('player'); // allow this lunge to hit the player once
    }

    endLunge(packCooldownMultiplier = 1) {
        this.isLunging = false;
        this._slashAttacking = false;
        this.attackProcessed = false;
        const packMult = packCooldownMultiplier != null ? packCooldownMultiplier : 1;
        this.cooldown = this.maxCooldown * this.cooldownMultiplier * packMult;
    }

    /** Unified entry: Combat.attack(targetX, targetY) calls this. */
    attack(targetX, targetY, entity, cooldownMultiplier) {
        const mult = cooldownMultiplier != null ? cooldownMultiplier : 1;
        if (this.behaviorType === 'rangedOnly' || (this.weapon && this.weapon.noMelee)) return false;
        if (this.behaviorType === 'chargeRelease') return this._startChargeRelease(targetX, targetY, entity);
        return this._doSlashAttack(mult);
    }

    _doSlashAttack(packCooldownMultiplier) {
        if (this.cooldown > 0 || this.isWindingUp || this.isLunging) return false;
        const w = this.weapon;
        if (!w) return false;

        const packMult = packCooldownMultiplier != null ? packCooldownMultiplier : 1;
        const effectiveCooldownMult = this.cooldownMultiplier * packMult;

        let stageProps;
        let finalDamage;
        let finalRange;
        let nextComboStage;

        if (typeof w.getResolvedAttack === 'function') {
            const stage = this.comboStage >= 1 ? this.comboStage : 1;
            const resolved = w.getResolvedAttack(0, stage, {});
            if (!resolved) return false;
            stageProps = resolved.stageProps;
            finalDamage = resolved.finalDamage;
            finalRange = resolved.finalRange;
            nextComboStage = resolved.nextComboStage;
        } else if (w.getComboStageProperties) {
            const maxStage = w.maxComboStage != null ? w.maxComboStage : 3;
            const stage = this.comboStage >= 1 ? this.comboStage : 1;
            stageProps = w.getComboStageProperties(stage);
            if (!stageProps) return false;
            finalDamage = stageProps.damage;
            finalRange = stageProps.range;
            nextComboStage = stage < maxStage ? stage + 1 : 1;
        } else {
            return false;
        }

        this.attackRange = finalRange;
        this.attackDamage = finalDamage * this.damageMultiplier;
        this.attackArc = stageProps.arc;
        this.knockbackForce = stageProps.knockbackForce != null ? stageProps.knockbackForce : null;

        // Scale animation and wind-up by attack speed so 50% faster/slower applies to the whole attack, not just cooldown
        const speedMult = Math.max(0.2, Math.min(2, effectiveCooldownMult));
        const baseSlashMs = stageProps.duration >= 50 ? stageProps.duration : Math.round((stageProps.duration || 0.28) * 1000);
        this._currentSlashDurationMs = Math.max(50, Math.round(baseSlashMs * speedMult));
        this._currentWindUpDuration = this.windUpTime * speedMult;

        this.comboStage = nextComboStage;
        this.comboTimer = this.comboWindow;
        this.hitEnemies.delete('player');

        this.isWindingUp = true;
        this.windUpTimer = this._currentWindUpDuration;
        this.cooldown = this.maxCooldown * effectiveCooldownMult;

        const totalDurationMs = Math.round(this._currentWindUpDuration * 1000) + this._currentSlashDurationMs;
        return {
            range: this.attackRange,
            damage: this.attackDamage,
            arc: this.attackArc,
            arcOffset: stageProps.arcOffset != null ? stageProps.arcOffset : 0,
            reverseSweep: stageProps.reverseSweep === true,
            duration: totalDurationMs,
            knockbackForce: this.knockbackForce,
            stunBuildup: stageProps.stunBuildup != null ? stageProps.stunBuildup : 25,
            animationKey: stageProps.animationKey || 'melee',
            comboStage: this.comboStage
        };
    }

    _startChargeRelease(targetX, targetY, entity) {
        if (!this.canAttack()) return false;
        let isCircular = false;
        let aoeInFront = false;
        let aoeOffset = 0;
        let aoeRadius = 0;
        const w = this.weapon;
        const get = w && (w.getHeavySmashProperties || w.getChargeReleaseProperties);
        if (typeof get === 'function') {
            const p = get.call(w);
            if (p) {
                this.attackRange = p.range;
                this.attackDamage = p.damage;
                this.attackArc = p.arc;
                this.chargeTime = p.chargeTime;
                this.releaseDuration = p.releaseDuration;
                this.knockbackForce = p.knockbackForce;
                if (p.isCircular) isCircular = true;
                if (p.aoeInFront) {
                    aoeInFront = true;
                    aoeOffset = p.aoeOffset != null ? p.aoeOffset : 55;
                    aoeRadius = p.aoeRadius != null ? p.aoeRadius : 42;
                }
            }
        }
        this.attackDuration = this.chargeTime + this.releaseDuration;
        this.hitEnemies.clear();
        this.attackTimer = 0.001;
        this.attackBuffer = this.attackBufferDuration;
        return {
            range: this.attackRange,
            damage: this.attackDamage,
            arc: this.attackArc,
            duration: this.attackDuration * 1000,
            stageName: this.behaviorType === 'chargeRelease' ? 'heavySmash' : 'claw',
            animationKey: this.behaviorType === 'chargeRelease' ? 'heavySmash' : 'claw',
            isCircular,
            knockbackForce: this.knockbackForce != null ? this.knockbackForce : 280,
            aoeInFront: aoeInFront || undefined,
            aoeOffset: aoeInFront ? aoeOffset : undefined,
            aoeRadius: aoeInFront ? aoeRadius : undefined
        };
    }

    endAttack() {
        if (this.behaviorType === 'chargeRelease') {
            if (this.attackTimer <= 0) return;
            this.attackTimer = 0;
            this.attackBuffer = this.attackBufferDuration;
            this.hitEnemies.clear();
        }
    }

    canAttack() {
        if (this.behaviorType === 'rangedOnly' || (this.weapon && this.weapon.noMelee)) return false;
        if (this.behaviorType === 'chargeRelease') return !this.isAttacking && this.attackBuffer <= 0;
        return this.cooldown <= 0 && !this.isWindingUp && !this.isLunging;
    }

    get isInReleasePhase() {
        if (this.behaviorType !== 'chargeRelease') return false;
        return this.attackTimer >= this.chargeTime && this.attackTimer < this.attackDuration;
    }

    get chargeProgress() {
        if (this.behaviorType !== 'chargeRelease') return 0;
        if (this.attackTimer <= 0 || this.attackTimer >= this.chargeTime) return 0;
        return this.attackTimer / this.chargeTime;
    }

    get isAttacking() {
        if (this.behaviorType === 'chargeRelease') return this.attackTimer > 0 && this.attackTimer < this.attackDuration;
        return this._slashAttacking || this.isLunging;
    }

    get windUpProgress() {
        if (!this.isWindingUp) return 0;
        const duration = this._currentWindUpDuration > 0 ? this._currentWindUpDuration : this.windUpTime;
        return duration <= 0 ? 1 : 1 - (this.windUpTimer / duration);
    }

    hasHitEnemy(enemyId) {
        return this.hitEnemies.has(enemyId);
    }

    markEnemyHit(enemyId) {
        this.hitEnemies.add(enemyId);
    }

    /** 0 = start of swing (weapon back), 1 = end of swing (weapon forward). Used for goblin dagger side-to-side swing. Eased like player for visual clarity. */
    getSlashSweepProgress(): number {
        if (this.isLunging) return 1;
        if (!this._slashAttacking || !this._slashStartTime) return 0;
        const durationMs = this._currentSlashDurationMs != null ? this._currentSlashDurationMs : this.SLASH_DURATION_MS;
        const raw = Math.min(1, (Date.now() - this._slashStartTime) / durationMs);
        return 1 - (1 - raw) ** 4;
    }
}
