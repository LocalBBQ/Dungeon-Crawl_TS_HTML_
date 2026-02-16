// Player-specific attack handler: delegates all attack/charge resolution to the equipped weapon.
import { Movement } from '../components/Movement.ts';
import { Transform } from '../components/Transform.ts';
import { Utils } from '../utils/Utils.ts';
import type { EntityShape } from '../types/entity.ts';
import type { ResolveAttackResult, StagePropsResult } from './weaponBehavior.ts';

export interface PlayerWeaponLike {
    comboWindow?: number;
    dashAttack?: unknown;
    getResolvedAttack(chargeDuration: number, comboStage: number, options?: { useDashAttack?: boolean }): ResolveAttackResult | null;
    getStaminaCostForAttack(chargeDuration: number, comboStage: number, options?: object): number;
}

export interface StartAttackResult {
    range: number;
    damage: number;
    arc: number;
    arcOffset: number;
    reverseSweep: boolean;
    comboStage: number;
    staminaCost: number;
    duration: number;
    stageName: string;
    animationKey: string;
    isCircular: boolean;
    isThrust: boolean;
    thrustWidth: number;
    knockbackForce: number | null;
    stunBuildup: number;
    isCharged: boolean;
    chargeMultiplier: number;
    isDashAttack: boolean;
}

export class PlayerAttack {
    weapon: PlayerWeaponLike;
    comboStage = 0;
    comboTimer = 0;
    comboWindow: number;
    hitEnemies = new Set<string>();
    attackTimer = 0;
    attackDuration = 0;
    attackBuffer = 0;

    constructor(weapon: PlayerWeaponLike) {
        this.weapon = weapon;
        this.comboWindow = weapon.comboWindow ?? 1.5;
    }

    setWeapon(weapon: PlayerWeaponLike): void {
        this.weapon = weapon;
        this.comboWindow = weapon.comboWindow ?? 1.5;
        this.resetCombo();
    }

    update(deltaTime: number, entity: EntityShape | null = null): void {
        if (this.attackTimer > 0) this.attackTimer += deltaTime;
        if (this.attackBuffer > 0) this.attackBuffer = Math.max(0, this.attackBuffer - deltaTime);
        if (this.comboStage > 0 && this.attackTimer <= 0) {
            this.comboTimer -= deltaTime;
            if (this.comboTimer <= 0) this.resetCombo();
        }
    }

    canAttack(): boolean {
        return this.attackBuffer <= 0;
    }

    getNextAttackStaminaCost(chargeDuration = 0, options: object = {}): number {
        return this.weapon.getStaminaCostForAttack(chargeDuration, this.comboStage, options);
    }

    startAttack(
        targetX: number | null,
        targetY: number | null,
        entity: EntityShape | null,
        chargeDuration = 0,
        options: { useDashAttack?: boolean } = {}
    ): StartAttackResult | false {
        if (!this.canAttack()) return false;
        const resolved = this.weapon.getResolvedAttack(chargeDuration, this.comboStage, options);
        if (!resolved) return false;

        const { stageProps, finalDamage, finalRange, finalStaminaCost, dashSpeed, dashDuration, nextComboStage, isCharged, chargeMultiplier } = resolved;
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
            const transform = entity.getComponent(Transform);
            if (transform && targetX != null && targetY != null) {
                const dx = targetX - transform.x;
                const dy = targetY - transform.y;
                const normalized = Utils.normalize(dx, dy);
                const movement = entity.getComponent(Movement);
                if (movement && (movement as Movement & { startAttackDash?: (x: number, y: number, d: number, s: number) => void }).startAttackDash) {
                    (movement as Movement & { startAttackDash: (x: number, y: number, d: number, s: number) => void }).startAttackDash(normalized.x, normalized.y, dashDuration, dashSpeed);
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

    endAttack(): void {
        this.attackTimer = 0;
        this.attackBuffer = 0;
        this.hitEnemies.clear();
    }

    resetCombo(): void {
        this.comboStage = 0;
        this.comboTimer = 0;
        this.hitEnemies.clear();
    }

    hasHitEnemy(enemyId: string): boolean {
        return this.hitEnemies.has(enemyId);
    }

    markEnemyHit(enemyId: string): void {
        this.hitEnemies.add(enemyId);
    }

    get isAttacking(): boolean {
        return this.attackTimer > 0;
    }

    get isAttackActive(): boolean {
        return this.attackTimer > 0 && this.attackTimer < this.attackDuration;
    }
}
