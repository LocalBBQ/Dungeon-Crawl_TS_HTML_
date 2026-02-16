// Shared attack handler for both player and enemy: weapon, combo state, options.
import { Movement } from '../components/Movement.ts';
import { Transform } from '../components/Transform.ts';
import { Combat } from '../components/Combat.ts';
import { Utils } from '../utils/Utils.ts';
import type { EntityShape } from '../types/entity.ts';

export type AttackHandlerBehaviorType = 'slashOnly' | 'slashAndLeap' | 'chargeRelease' | 'rangedOnly' | 'comboAndCharge';

export interface WeaponAttackHandlerOptions {
    isPlayer?: boolean;
    behaviorType?: AttackHandlerBehaviorType;
    comboWindow?: number;
    windUpTime?: number;
    cooldownMultiplier?: number;
    damageMultiplier?: number;
    attackBufferDuration?: number;
    attackDurationMultiplier?: number;
}

export class WeaponAttackHandler {
    weapon: unknown;
    isPlayer: boolean;
    behaviorType: AttackHandlerBehaviorType;
    options: WeaponAttackHandlerOptions;
    attackRange: number;
    attackDamage: number;
    attackArc: number;
    comboStage: number;
    comboTimer: number;
    comboWindow: number;
    hitEnemies: Set<string>;
    attackTimer: number;
    attackDuration: number;
    attackBuffer: number;
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
    chargeTime: number;
    releaseDuration: number;
    attackBufferDuration: number;
    attackDurationEnemy: number;

    constructor(weapon: unknown, options: WeaponAttackHandlerOptions = {}) {
            this.weapon = weapon;
            this.isPlayer = options.isPlayer === true;
            this.behaviorType = options.behaviorType || 'slashOnly';
            this.options = options;

            this.attackRange = 40;
            this.attackDamage = 5;
            this.attackArc = Math.PI / 2;
            this.comboStage = 0;
            this.comboTimer = 0;
            this.comboWindow = (weapon as { comboWindow?: number })?.comboWindow ?? options.comboWindow ?? 1.5;
            this.hitEnemies = new Set();

            // Player: attack timer and buffer (no wind-up)
            this.attackTimer = 0;
            this.attackDuration = 0;
            this.attackBuffer = 0;

            // Enemy: cooldown, wind-up, slash sweep
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

            // Enemy charge-release
            this.chargeTime = 0;
            this.releaseDuration = 0;
            this.attackBufferDuration = options.attackBufferDuration ?? 0.2;
            this.attackDurationEnemy = 0;

            if (!this.isPlayer) this._readStatsFromWeapon();
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
                        this.attackDurationEnemy = this.chargeTime + this.releaseDuration;
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
                if (dash) this.lungeDamage = dash.damage;
            } else if (this.behaviorType === 'comboAndCharge') {
                const first = w.getComboStageProperties && w.getComboStageProperties(1);
                if (first) {
                    this.attackRange = first.range;
                    this.attackDamage = first.damage;
                    this.attackArc = first.arc;
                }
                if (w.cooldown != null) this.maxCooldown = w.cooldown;
                if (this.options && this.options.comboWindow != null) this.comboWindow = this.options.comboWindow;
                else if (w.comboWindow != null) this.comboWindow = w.comboWindow;
            }
        }

        getWeapon() {
            return this.weapon;
        }

        setWeapon(weapon) {
            this.weapon = weapon;
            this.comboWindow = (weapon && weapon.comboWindow) ?? this.options.comboWindow ?? 1.5;
            this.resetCombo();
        }

        hasLunge() {
            return !this.isPlayer && this.behaviorType === 'slashAndLeap';
        }

        hasChargeRelease() {
            return !this.isPlayer && this.behaviorType === 'chargeRelease';
        }

        canMeleeAttack() {
            return this.isPlayer || (this.behaviorType !== 'rangedOnly' && !(this.weapon && this.weapon.noMelee));
        }

        /** Unified entry: Combat calls handler.startAttack(...) for both player and enemy. */
        startAttack(targetX: number | null, targetY: number | null, entity: EntityShape | null, chargeDuration = 0, options: { useDashAttack?: boolean; cooldownMultiplier?: number } = {}): unknown {
            if (this.isPlayer) return this._startPlayerAttack(targetX, targetY, entity, chargeDuration, options);
            return this._startEnemyAttack(targetX, targetY, entity, chargeDuration, options);
        }

        _startPlayerAttack(targetX, targetY, entity, chargeDuration, options) {
            if (!this.canAttack()) return null;
            const w = this.weapon;
            if (!w || typeof w.getResolvedAttack !== 'function') return null;
            const resolved = w.getResolvedAttack(chargeDuration, this.comboStage, options);
            if (!resolved) return null;

            const { stageProps, finalDamage, finalRange, finalStaminaCost, dashSpeed, dashDuration, nextComboStage } = resolved;
            this.comboStage = nextComboStage;
            this.comboTimer = this.comboWindow;
            this.hitEnemies.clear();
            let durationMs = stageProps.duration;
            if (durationMs < 50) durationMs = Math.round(durationMs * 1000);
            if (dashDuration != null && dashDuration > 0) {
                const dashMs = Math.ceil(dashDuration * 1000);
                if (dashMs > durationMs) durationMs = dashMs;
            }
            this.attackDuration = durationMs / 1000;
            this.attackTimer = 0.001;

            if (dashSpeed && entity) {
                const transform = entity.getComponent && entity.getComponent(Transform);
                if (transform && targetX != null && targetY != null) {
                    const dx = targetX - transform.x;
                    const dy = targetY - transform.y;
                    const normalized = typeof Utils !== 'undefined' && Utils.normalize ? Utils.normalize(dx, dy) : { x: 0, y: 0 };
                    const movement = entity.getComponent && entity.getComponent(Movement);
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
                isCharged: resolved.isCharged,
                chargeMultiplier: resolved.chargeMultiplier,
                isDashAttack: !!(options.useDashAttack && w.dashAttack)
            };
        }

        _startEnemyAttack(targetX, targetY, entity, chargeDuration, options) {
            const packMult = options.cooldownMultiplier != null ? options.cooldownMultiplier : 1;
            if (this.behaviorType === 'rangedOnly' || (this.weapon && this.weapon.noMelee)) return null;
            if (this.behaviorType === 'chargeRelease') return this._startChargeRelease(targetX, targetY, entity);
            if (this.behaviorType === 'comboAndCharge') return this._startComboAndCharge(targetX, targetY, entity, chargeDuration, options);
            return this._doSlashAttack(packMult, options);
        }

        /** Player-like attack: light (combo) or charged heavy, driven by AI-supplied chargeDuration. */
        _startComboAndCharge(targetX, targetY, entity, chargeDuration, options) {
            if (!this.canAttack()) return null;
            const w = this.weapon;
            if (!w || typeof w.getResolvedAttack !== 'function') return null;
            const resolved = w.getResolvedAttack(chargeDuration, this.comboStage, {});
            if (!resolved) return null;

            const { stageProps, finalDamage, finalRange, nextComboStage } = resolved;
            const packMult = options.cooldownMultiplier != null ? options.cooldownMultiplier : 1;
            const effectiveMult = this.damageMultiplier * packMult;

            this.comboStage = nextComboStage;
            this.comboTimer = this.comboWindow;
            this.hitEnemies.clear();
            let durationMs = stageProps.duration;
            if (durationMs < 50) durationMs = Math.round(durationMs * 1000);
            const durationMult = (this.options && this.options.attackDurationMultiplier != null) ? this.options.attackDurationMultiplier : 1;
            durationMs = Math.round(durationMs * durationMult);

            this.attackRange = finalRange;
            this.attackDamage = finalDamage * effectiveMult;
            this.attackArc = stageProps.arc;
            this.attackDurationEnemy = durationMs / 1000;
            this.cooldown = (w.cooldown != null ? w.cooldown : 0.35) * this.cooldownMultiplier * packMult;
            this.maxCooldown = w.cooldown != null ? w.cooldown : 0.35;

            const useWindUp = this.windUpTime > 0;
            if (useWindUp) {
                this.isWindingUp = true;
                this._currentWindUpDuration = this.windUpTime;
                this.windUpTimer = this.windUpTime;
                this.attackTimer = 0;
            } else {
                this.attackTimer = 0.001;
            }

            return {
                range: this.attackRange,
                damage: this.attackDamage,
                arc: this.attackArc,
                arcOffset: stageProps.arcOffset ?? 0,
                reverseSweep: stageProps.reverseSweep === true,
                duration: durationMs,
                knockbackForce: stageProps.knockbackForce ?? null,
                stunBuildup: stageProps.stunBuildup != null ? stageProps.stunBuildup : 25,
                animationKey: stageProps.animationKey || 'melee',
                comboStage: this.comboStage,
                isCircular: stageProps.isCircular === true
            };
        }

        _doSlashAttack(packCooldownMultiplier, options?) {
            if (this.cooldown > 0 || this.isWindingUp || this.isLunging) return null;
            const w = this.weapon;
            if (!w) return null;

            const packMult = packCooldownMultiplier != null ? packCooldownMultiplier : 1;
            const effectiveCooldownMult = this.cooldownMultiplier * packMult;
            const useDashAttack = options?.useDashAttack === true && w.dashAttack && typeof w.getResolvedAttack === 'function';

            let stageProps;
            let finalDamage;
            let finalRange;
            let nextComboStage;
            let dashSpeed = null;
            let dashDuration = null;

            if (typeof w.getResolvedAttack === 'function') {
                const stage = useDashAttack ? 1 : (this.comboStage >= 1 ? this.comboStage : 1);
                const attackOptions = useDashAttack ? { useDashAttack: true } : {};
                const resolved = w.getResolvedAttack(0, stage, attackOptions);
                if (!resolved) return null;
                stageProps = resolved.stageProps;
                finalDamage = resolved.finalDamage;
                finalRange = resolved.finalRange;
                nextComboStage = resolved.nextComboStage;
                dashSpeed = resolved.dashSpeed ?? null;
                dashDuration = resolved.dashDuration ?? null;
            } else if (w.getComboStageProperties) {
                const maxStage = w.maxComboStage != null ? w.maxComboStage : 3;
                const stage = this.comboStage >= 1 ? this.comboStage : 1;
                stageProps = w.getComboStageProperties(stage);
                if (!stageProps) return null;
                finalDamage = stageProps.damage;
                finalRange = stageProps.range;
                nextComboStage = stage < maxStage ? stage + 1 : 1;
            } else {
                return null;
            }

            this.attackRange = finalRange;
            this.attackDamage = finalDamage * this.damageMultiplier;
            this.attackArc = stageProps.arc;
            this.knockbackForce = stageProps.knockbackForce != null ? stageProps.knockbackForce : null;

            const speedMult = Math.max(0.2, Math.min(2, effectiveCooldownMult));
            let baseSlashMs = stageProps.duration >= 50 ? stageProps.duration : Math.round((stageProps.duration || 0.28) * 1000);
            if (dashDuration != null && dashDuration > 0) {
                const dashMs = Math.ceil(dashDuration * 1000);
                if (dashMs > baseSlashMs) baseSlashMs = dashMs;
            }
            this._currentSlashDurationMs = Math.max(50, Math.round(baseSlashMs * speedMult));
            this._currentWindUpDuration = this.windUpTime * speedMult;

            this.comboStage = nextComboStage;
            this.comboTimer = this.comboWindow;
            this.hitEnemies.delete('player');
            this.isWindingUp = true;
            this.windUpTimer = this._currentWindUpDuration;
            this.cooldown = this.maxCooldown * effectiveCooldownMult;

            const totalDurationMs = Math.round(this._currentWindUpDuration * 1000) + this._currentSlashDurationMs;
            const result: Record<string, unknown> = {
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
            if (dashSpeed != null && dashDuration != null) {
                result.dashSpeed = dashSpeed;
                result.dashDuration = dashDuration;
                result.isDashAttack = useDashAttack;
            }
            return result;
        }

        _startChargeRelease(targetX, targetY, entity) {
            if (!this.canAttack()) return null;
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
            this.attackDurationEnemy = this.chargeTime + this.releaseDuration;
            this.hitEnemies.clear();
            this.attackTimer = 0.001;
            this.attackBuffer = this.attackBufferDuration;
            return {
                range: this.attackRange,
                damage: this.attackDamage,
                arc: this.attackArc,
                duration: this.attackDurationEnemy * 1000,
                stageName: this.behaviorType === 'chargeRelease' ? 'heavySmash' : 'claw',
                animationKey: this.behaviorType === 'chargeRelease' ? 'heavySmash' : 'claw',
                isCircular,
                knockbackForce: this.knockbackForce != null ? this.knockbackForce : 280,
                aoeInFront: aoeInFront || undefined,
                aoeOffset: aoeInFront ? aoeOffset : undefined,
                aoeRadius: aoeInFront ? aoeRadius : undefined
            };
        }

        update(deltaTime: number, entity: EntityShape | null): void {
            if (this.isPlayer) {
                if (this.attackTimer > 0) {
                    this.attackTimer += deltaTime;
                    // Clamp to duration so hit-window progress never wraps or extends past 1
                    if (this.attackDuration > 0 && this.attackTimer >= this.attackDuration) {
                        this.attackTimer = this.attackDuration;
                        this.endAttack();
                    }
                }
                if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
                if (this.comboStage > 0 && this.attackTimer <= 0) {
                    this.comboTimer -= deltaTime;
                    if (this.comboTimer <= 0) {
                        // Don't reset combo while player has a buffered attack so the 3rd hit (stab) can still resolve
                        if (entity && typeof entity.getComponent === 'function' && typeof Combat !== 'undefined') {
                            const combat = entity.getComponent(Combat);
                            if (combat && combat.attackInputBuffered) return;
                        }
                        this.resetCombo();
                    }
                }
                return;
            }
            if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - deltaTime);
            if (this.behaviorType === 'chargeRelease') {
                if (this.attackTimer > 0) {
                    this.attackTimer += deltaTime;
                    if (this.attackTimer >= this.attackDurationEnemy) this.endAttack();
                }
                if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
                return;
            }
            if (this.behaviorType === 'comboAndCharge') {
                if (this.isWindingUp) {
                    this.windUpTimer -= deltaTime;
                    if (this.windUpTimer <= 0) {
                        this.isWindingUp = false;
                        this.attackTimer = 0.001;
                    }
                } else if (this.attackTimer > 0) {
                    this.attackTimer += deltaTime;
                    if (this.attackTimer >= this.attackDurationEnemy) this.endAttack();
                }
                if (!this.isAttacking && !this.isWindingUp && this.comboStage > 0) {
                    this.comboTimer -= deltaTime;
                    if (this.comboTimer <= 0) this.resetCombo();
                }
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
                        this.hitEnemies.delete('player');
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

        startLunge(targetX: number, targetY: number, lungeConfig: { lungeDamage?: number } | null): void {
            if (!this.hasLunge()) return;
            this.isLunging = true;
            this.lungeTargetX = targetX;
            this.lungeTargetY = targetY;
            this.lungeDamage = (lungeConfig && lungeConfig.lungeDamage != null) ? lungeConfig.lungeDamage : this.lungeDamage;
            this._slashAttacking = true;
            this.attackProcessed = false;
            this.hitEnemies.delete('player');
        }

        endLunge(packCooldownMultiplier?: number): void {
            this.isLunging = false;
            this._slashAttacking = false;
            this.attackProcessed = false;
            const packMult = packCooldownMultiplier != null ? packCooldownMultiplier : 1;
            this.cooldown = this.maxCooldown * this.cooldownMultiplier * packMult;
        }

        endAttack() {
            if (this.isPlayer) {
                this.attackTimer = 0;
                this.attackBuffer = 0;
                this.hitEnemies.clear();
                return;
            }
            if (this.behaviorType === 'chargeRelease') {
                if (this.attackTimer <= 0) return;
                this.attackTimer = 0;
                this.attackBuffer = this.attackBufferDuration;
                this.hitEnemies.clear();
                return;
            }
            if (this.behaviorType === 'comboAndCharge') {
                if (this.attackTimer <= 0 && !this.isWindingUp) return;
                this.attackTimer = 0;
                this.isWindingUp = false;
                this.windUpTimer = 0;
                this.hitEnemies.clear();
            }
        }

        resetCombo() {
            this.comboStage = 0;
            this.comboTimer = 0;
            this.hitEnemies.clear();
        }

        canAttack() {
            if (this.isPlayer) return this.attackBuffer <= 0;
            if (this.behaviorType === 'rangedOnly' || (this.weapon && this.weapon.noMelee)) return false;
            if (this.behaviorType === 'chargeRelease') return !this.isAttacking && this.attackBuffer <= 0;
            if (this.behaviorType === 'comboAndCharge') return this.attackTimer <= 0 && this.cooldown <= 0;
            return this.cooldown <= 0 && !this.isWindingUp && !this.isLunging;
        }

        get isInReleasePhase() {
            if (this.isPlayer || this.behaviorType !== 'chargeRelease') return false;
            return this.attackTimer >= this.chargeTime && this.attackTimer < this.attackDurationEnemy;
        }

        get chargeProgress() {
            if (this.isPlayer || this.behaviorType !== 'chargeRelease') return 0;
            if (this.attackTimer <= 0 || this.attackTimer >= this.chargeTime) return 0;
            return this.attackTimer / this.chargeTime;
        }

        get isAttacking() {
            if (this.isPlayer) return this.attackTimer > 0;
            if (this.behaviorType === 'chargeRelease') return this.attackTimer > 0 && this.attackTimer < this.attackDurationEnemy;
            if (this.behaviorType === 'comboAndCharge') return this.attackTimer > 0 && this.attackTimer < this.attackDurationEnemy;
            return this._slashAttacking || this.isLunging;
        }

        get isAttackActive() {
            if (this.isPlayer) return this.attackTimer > 0 && this.attackTimer < this.attackDuration;
            return false;
        }

        get windUpProgress() {
            if (this.isPlayer) return 0;
            if (!this.isWindingUp) return 0;
            const duration = this._currentWindUpDuration > 0 ? this._currentWindUpDuration : this.windUpTime;
            return duration <= 0 ? 1 : 1 - (this.windUpTimer / duration);
        }

        getSlashSweepProgress() {
            if (this.isPlayer) return 0;
            if (this.behaviorType === 'comboAndCharge' && this.attackDurationEnemy > 0) {
                const raw = Math.min(1, this.attackTimer / this.attackDurationEnemy);
                return 1 - (1 - raw) ** 4;
            }
            if (this.isLunging) return 1;
            if (!this._slashAttacking || !this._slashStartTime) return 0;
            const durationMs = this._currentSlashDurationMs != null ? this._currentSlashDurationMs : this.SLASH_DURATION_MS;
            const raw = Math.min(1, (Date.now() - this._slashStartTime) / durationMs);
            return 1 - (1 - raw) ** 4;
        }

        hasHitEnemy(enemyId: string): boolean {
            return this.hitEnemies.has(enemyId);
        }

        markEnemyHit(enemyId: string): void {
            this.hitEnemies.add(enemyId);
        }

        getNextAttackStaminaCost(chargeDuration: number, options: object): number {
            if (!this.isPlayer || !this.weapon) return 0;
            return this.weapon.getStaminaCostForAttack ? this.weapon.getStaminaCostForAttack(chargeDuration, this.comboStage, options || {}) : 0;
        }

        /** Forwards to startAttack (e.g. Combat may call .attack(x, y, entity, cooldownMult)). */
        attack(targetX: number | null, targetY: number | null, entity: EntityShape | null, cooldownMultiplier?: number): unknown {
            return this.startAttack(targetX, targetY, entity, 0, { cooldownMultiplier: cooldownMultiplier });
        }
    }
