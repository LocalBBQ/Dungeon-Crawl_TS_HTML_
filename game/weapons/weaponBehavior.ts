// Shared weapon behavior: config parsing and attack/charge resolution.
import { Utils } from '../utils/Utils.ts';

/** Extra hold time required beyond minChargeTime before release counts as a charged attack (avoids quick taps triggering charge). */
const CHARGE_HOLD_BUFFER = 0.12;

function degToRad(deg: number): number {
    return Utils.degToRad(deg);
}

export interface BlockConfigInput {
    enabled?: boolean;
    arcDegrees?: number;
    damageReduction?: number;
    staminaCost?: number;
    animationKey?: string;
    /** Parry: if set, blocking within this many ms of block start absorbs all damage and adds a % to rally. */
    parryWindowMs?: number;
    /** Percent of parried damage (0–1) added to rally pool. Only used when parryWindowMs > 0. */
    parryRallyPercent?: number;
    shieldBash?: {
        knockback?: number;
        dashSpeed?: number;
        dashDuration?: number;
        staminaCost?: number;
        range?: number;
        arcDegrees?: number;
    };
}

export interface BlockResult {
    enabled: boolean;
    arcRad: number;
    damageReduction: number;
    staminaCost: number;
    animationKey: string;
    parryWindowMs: number;
    parryRallyPercent: number;
    shieldBash?: {
        knockback: number;
        dashSpeed: number;
        dashDuration: number;
        staminaCost: number;
        range: number;
        arcRad: number;
    };
}

/** Something that can be used to block (e.g. shield, or any weapon with block config). */
export interface BlockableLike {
    getBlockConfig(): BlockResult | { enabled?: boolean } | null;
}

export function isBlockable(w: unknown): w is BlockableLike {
    if (w == null || typeof w !== 'object') return false;
    const cfg = (w as BlockableLike).getBlockConfig?.();
    return cfg != null && (cfg as { enabled?: boolean }).enabled !== false;
}

export interface StageConfigInput {
    name?: string;
    animationKey?: string;
    arcDegrees?: number;
    arcOffsetDegrees?: number;
    arc?: number;
    range?: number;
    rangeMultiplier?: number;
    duration?: number;
    staminaCost?: number;
    damageMultiplier?: number;
    stunBuildup?: number;
    knockbackForce?: number;
    knockback?: { force?: number };
    reverseSweep?: boolean;
    thrust?: boolean;
    thrustWidth?: number;
    dashSpeed?: number;
    dashDuration?: number;
}

export interface WeaponLike {
    baseRange: number;
    baseDamage: number;
    baseArcDegrees: number;
    /** Weapon speed (number); higher = faster attacks and shorter animations. */
    speed?: number;
    rangeMultiplier?: number;
    knockback?: { force?: number } | null;
    comboConfig?: StageConfigInput[];
    dashAttack?: StageConfigInput | null;
    chargeAttack?: {
        minChargeTime?: number;
        maxChargeTime?: number;
        damageMultiplier?: number;
        rangeMultiplier?: number;
        staminaCostMultiplier?: number;
        chargedStageIndex?: number;
        chargedThrustDashSpeed?: number;
        chargedThrustDashDistanceMin?: number;
        chargedThrustDashDistanceMax?: number;
    } | null;
    getComboStageProperties?(stage: number): StagePropsResult | null;
    getDashAttackProperties?(): StagePropsResult | null;
    maxComboStage?: number;
}

export interface StagePropsResult {
    range: number;
    damage: number;
    arc: number;
    arcOffset: number;
    reverseSweep: boolean;
    duration: number;
    staminaCost: number;
    dashSpeed: number | null;
    dashDuration: number;
    stageName: string;
    animationKey: string;
    isCircular: boolean;
    isThrust: boolean;
    thrustWidth: number;
    knockbackForce: number | null;
    stunBuildup: number;
}

export interface ResolveAttackOptions {
    useDashAttack?: boolean;
}

export interface ResolveAttackResult {
    stageProps: StagePropsResult;
    finalDamage: number;
    finalRange: number;
    finalStaminaCost: number;
    dashSpeed: number | null;
    dashDuration: number;
    nextComboStage: number;
    isCharged: boolean;
    chargeMultiplier: number;
}

/** Charge-release / heavy smash (e.g. chieftain club): charge then AOE in front. */
export interface ChargeReleaseResult {
    chargeTime: number;
    releaseDuration: number;
    damage: number;
    knockbackForce: number;
    aoeInFront: boolean;
    aoeOffset: number;
    aoeRadius: number;
    range: number;
}

export interface ParseWeaponConfigResult {
    name: string;
    baseRange: number;
    baseDamage: number;
    baseArcDegrees: number;
    speed: number;
    /** Stored so cooldown = baseCooldown/speed (one unit with speed). */
    baseCooldown: number;
    comboConfig: StageConfigInput[];
    maxComboStage: number | null;
    comboWindow: number;
    knockback: { force?: number } | null;
    block: BlockResult | null;
    twoHanded: boolean;
    offhandOnly: boolean;
    dashAttack: StageConfigInput | null;
    rangeMultiplier: number;
    weaponLength: number | null;
    chargeAttack: WeaponLike['chargeAttack'];
    attackVisual: unknown;
    chargeRelease: ChargeReleaseResult | null;
}

/** Default block config for weapons that don't define block (parry with weapon). */
const DEFAULT_WEAPON_BLOCK: BlockConfigInput = {
    enabled: true,
    arcDegrees: 90,
    damageReduction: 0.4,
    staminaCost: 20,
    animationKey: 'block'
};

export const WeaponBehavior = {
    buildBlockFromConfig(blockConfig: BlockConfigInput | null | undefined): BlockResult | null {
        if (blockConfig != null && blockConfig.enabled === false) return null;
        const effective = blockConfig ?? DEFAULT_WEAPON_BLOCK;
        const arcDegrees = effective.arcDegrees ?? 180;
        const block: BlockResult = {
            enabled: effective.enabled !== false,
            arcRad: degToRad(arcDegrees),
            damageReduction: effective.damageReduction ?? 1.0,
            staminaCost: effective.staminaCost ?? 5,
            animationKey: effective.animationKey ?? 'block',
            parryWindowMs: effective.parryWindowMs ?? 0,
            parryRallyPercent: Math.max(0, Math.min(1, effective.parryRallyPercent ?? 0))
        };
        if (effective.shieldBash) {
            const sb = effective.shieldBash;
            block.shieldBash = {
                knockback: sb.knockback ?? 500,
                dashSpeed: sb.dashSpeed ?? 380,
                dashDuration: sb.dashDuration ?? 0.22,
                staminaCost: sb.staminaCost ?? 14,
                range: sb.range ?? 100,
                arcRad: degToRad(sb.arcDegrees ?? 120)
            };
        }
        return block;
    },

    buildStageProps(stageConfig: StageConfigInput | null | undefined, weapon: WeaponLike | null, stageIndex: number | string): StagePropsResult | null {
        if (!stageConfig || !weapon) return null;
        const arcDegrees = stageConfig.arcDegrees != null
            ? stageConfig.arcDegrees
            : (stageConfig.arc != null ? stageConfig.arc * 180 / Math.PI : weapon.baseArcDegrees);
        const arcRad = stageConfig.arcDegrees != null
            ? degToRad(stageConfig.arcDegrees)
            : (stageConfig.arc != null ? stageConfig.arc : degToRad(weapon.baseArcDegrees));
        const isCircular = arcDegrees >= 360;
        const knockbackForce = stageConfig.knockbackForce ?? stageConfig.knockback?.force ?? weapon.knockback?.force ?? null;
        const stunBuildup = stageConfig.stunBuildup != null ? stageConfig.stunBuildup : 25;
        const arcOffset = stageConfig.arcOffsetDegrees != null ? degToRad(stageConfig.arcOffsetDegrees) : 0;
        const baseStageRange = stageConfig.range != null
            ? stageConfig.range
            : weapon.baseRange * (stageConfig.rangeMultiplier || 1.0);
        const isThrust = stageConfig.thrust === true;
        const thrustWidth = stageConfig.thrustWidth != null ? stageConfig.thrustWidth : 40;
        const reverseSweep = stageConfig.reverseSweep === true;
        const speed = weapon.speed ?? 1;
        const rawDuration = stageConfig.duration || 100;
        const duration = Math.round(rawDuration / speed);
        return {
            range: baseStageRange * (weapon.rangeMultiplier ?? 1),
            damage: weapon.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: arcRad,
            arcOffset,
            reverseSweep,
            duration,
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null,
            dashDuration: stageConfig.dashDuration || 0,
            stageName: stageConfig.name || (typeof stageIndex === 'string' ? stageIndex : `stage${stageIndex}`),
            animationKey: stageConfig.animationKey || 'melee',
            isCircular,
            isThrust,
            thrustWidth,
            knockbackForce,
            stunBuildup
        };
    },

    getThrustStageIndex(comboConfig: StageConfigInput[] | null | undefined): number | null {
        if (!comboConfig) return null;
        for (let i = 0; i < comboConfig.length; i++) {
            if (comboConfig[i].thrust === true) return i + 1;
        }
        return null;
    },

    getChargeState(chargeDuration: number, chargeAttackConfig: WeaponLike['chargeAttack']): { isCharged: boolean; chargeMultiplier: number } {
        if (!chargeAttackConfig || !chargeAttackConfig.minChargeTime) {
            return { isCharged: false, chargeMultiplier: 0 };
        }
        const effectiveMin = chargeAttackConfig.minChargeTime + CHARGE_HOLD_BUFFER;
        const isCharged = chargeDuration >= effectiveMin;
        const span = (chargeAttackConfig.maxChargeTime! - chargeAttackConfig.minChargeTime) || 1;
        const chargeMultiplier = !isCharged ? 0 : Math.max(0, Math.min(1, (chargeDuration - chargeAttackConfig.minChargeTime) / span));
        return { isCharged, chargeMultiplier };
    },

    resolveAttack(weapon: WeaponLike, chargeDuration: number, comboStage: number, options: ResolveAttackOptions = {}): ResolveAttackResult | null {
        const useDashAttack = options.useDashAttack && weapon.dashAttack;
        if (useDashAttack) {
            const stageProps = weapon.getDashAttackProperties?.();
            if (!stageProps) return null;
            return {
                stageProps,
                finalDamage: stageProps.damage,
                finalRange: stageProps.range,
                finalStaminaCost: stageProps.staminaCost,
                dashSpeed: stageProps.dashSpeed,
                dashDuration: stageProps.dashDuration,
                nextComboStage: 1,
                isCharged: false,
                chargeMultiplier: 0
            };
        }
        const chargeState = this.getChargeState(chargeDuration, weapon.chargeAttack);
        const maxStage = (weapon.maxComboStage != null && weapon.maxComboStage > 0) ? weapon.maxComboStage : (weapon.comboConfig && weapon.comboConfig.length) || 1;
        const nextComboStage = chargeState.isCharged ? 0 : (comboStage < maxStage ? comboStage + 1 : 1);
        const useChargedThrust = chargeState.isCharged && weapon.chargeAttack && weapon.chargeAttack.chargedThrustDashSpeed != null;
        const thrustStageIndex = this.getThrustStageIndex(weapon.comboConfig ?? null);
        const c = weapon.chargeAttack;
        const chargedStageIndex = (c && c.chargedStageIndex != null) ? c.chargedStageIndex : null;
        const stageForLookup = chargeState.isCharged
            ? (chargedStageIndex != null ? chargedStageIndex : (thrustStageIndex != null ? thrustStageIndex : 1))
            : nextComboStage;
        let stageProps = weapon.getComboStageProperties?.(stageForLookup) ?? null;
        if (!stageProps) return null;
        if (useChargedThrust && thrustStageIndex != null) {
            const thrustProps = weapon.getComboStageProperties?.(thrustStageIndex);
            if (thrustProps) stageProps = thrustProps;
        }
        let finalDamage = stageProps.damage;
        let finalRange = stageProps.range;
        let finalStaminaCost = stageProps.staminaCost;
        if (chargeState.isCharged && c && chargeState.chargeMultiplier > 0) {
            const dm = 1 + (c.damageMultiplier! - 1) * chargeState.chargeMultiplier;
            const rm = 1 + (c.rangeMultiplier! - 1) * chargeState.chargeMultiplier;
            const sm = 1 + (c.staminaCostMultiplier! - 1) * chargeState.chargeMultiplier;
            finalDamage = stageProps.damage * dm;
            finalRange = stageProps.range * rm;
            finalStaminaCost = stageProps.staminaCost * sm;
        }
        let dashSpeed = stageProps.dashSpeed;
        let dashDuration = stageProps.dashDuration;
        if (useChargedThrust && c) {
            const minD = c.chargedThrustDashDistanceMin ?? 25;
            const maxD = c.chargedThrustDashDistanceMax ?? 140;
            const dashDistance = minD + (maxD - minD) * chargeState.chargeMultiplier;
            dashSpeed = c.chargedThrustDashSpeed ?? null;
            dashDuration = dashDistance / (dashSpeed ?? 1);
        }
        return {
            stageProps,
            finalDamage,
            finalRange,
            finalStaminaCost,
            dashSpeed,
            dashDuration,
            nextComboStage,
            isCharged: chargeState.isCharged,
            chargeMultiplier: chargeState.chargeMultiplier
        };
    },

    parseWeaponConfig(config: {
        name?: string;
        baseRange?: number;
        baseDamage?: number;
        baseArcDegrees?: number;
        /** Weapon speed (number); higher = faster. */
        speed?: number;
        cooldown?: number;
        maxComboStage?: number | null;
        comboWindow?: number;
        stages?: StageConfigInput[];
        block?: BlockConfigInput | null;
        knockback?: { force?: number } | null;
        twoHanded?: boolean;
        offhandOnly?: boolean;
        dashAttack?: StageConfigInput | null;
        specialAttack?: StageConfigInput | null;
        rangeMultiplier?: number;
        weaponLength?: number | null;
        chargeAttack?: WeaponLike['chargeAttack'];
        attackVisual?: unknown;
        chargeRelease?: {
            chargeTime: number;
            releaseDuration: number;
            damage: number;
            knockbackForce: number;
            aoeInFront?: boolean;
            aoeOffset?: number;
            aoeRadius?: number;
            range?: number;
        } | null;
    }): ParseWeaponConfigResult {
        const stages = config.stages || [];
        const block = this.buildBlockFromConfig(config.block ?? null);
        const speed = config.speed ?? 1;
        const hasAttackModes = stages.length > 0 || !!config.dashAttack || !!config.specialAttack || !!config.chargeAttack || !!config.chargeRelease;
        const cooldownSec = hasAttackModes ? (config.cooldown ?? 0.3) : 0;
        const baseCooldown = speed > 0 ? cooldownSec * speed : 0;
        const cr = config.chargeRelease ?? null;
        const chargeRelease: ChargeReleaseResult | null = cr
            ? {
                chargeTime: cr.chargeTime,
                releaseDuration: cr.releaseDuration,
                damage: cr.damage,
                knockbackForce: cr.knockbackForce,
                aoeInFront: cr.aoeInFront === true,
                aoeOffset: cr.aoeOffset ?? 55,
                aoeRadius: cr.aoeRadius ?? 42,
                range: cr.aoeInFront
                    ? (cr.aoeOffset ?? 55) + (cr.aoeRadius ?? 42)
                    : (cr.range ?? 97)
            }
            : null;
        return {
            name: config.name || 'weapon',
            baseRange: config.baseRange ?? 100,
            baseDamage: config.baseDamage ?? 15,
            baseArcDegrees: config.baseArcDegrees ?? 60,
            speed,
            baseCooldown,
            comboConfig: stages,
            maxComboStage: config.maxComboStage != null ? config.maxComboStage : null,
            comboWindow: config.comboWindow ?? 1.5,
            knockback: config.knockback ?? null,
            block,
            twoHanded: config.twoHanded === true,
            offhandOnly: config.offhandOnly === true,
            dashAttack: config.dashAttack ?? config.specialAttack ?? null,
            rangeMultiplier: config.rangeMultiplier != null ? config.rangeMultiplier : 1,
            weaponLength: config.weaponLength != null ? config.weaponLength : null,
            chargeAttack: config.chargeAttack ?? null,
            attackVisual: config.attackVisual ?? null,
            chargeRelease
        };
    }
};
