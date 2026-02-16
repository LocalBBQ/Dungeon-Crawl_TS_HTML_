// Single weapon class: parses config via WeaponBehavior and delegates all methods.
import { WeaponBehavior } from './weaponBehavior.ts';
import type {
    ParseWeaponConfigResult,
    StageConfigInput,
    BlockResult,
    ResolveAttackOptions,
    ResolveAttackResult,
    StagePropsResult,
    ChargeReleaseResult,
} from './weaponBehavior.ts';

export type WeaponConfigInput = Parameters<typeof WeaponBehavior.parseWeaponConfig>[0] & {
    isRanged?: boolean;
    visual?: string;
};

export class Weapon {
    name: string;
    baseRange: number;
    baseDamage: number;
    baseArcDegrees: number;
    attackSpeed: number;
    cooldown: number;
    comboConfig: StageConfigInput[];
    comboWindow: number;
    knockback: ParseWeaponConfigResult['knockback'];
    block: BlockResult | null;
    twoHanded: boolean;
    dashAttack: StageConfigInput | null;
    rangeMultiplier: number;
    weaponLength: number | null;
    chargeAttack: ParseWeaponConfigResult['chargeAttack'];
    attackVisual: unknown;
    _maxComboStage: number | null;
    isRanged: boolean;
    visual: string | undefined;
    chargeRelease: ChargeReleaseResult | null;

    constructor(config: WeaponConfigInput) {
        const p = WeaponBehavior.parseWeaponConfig(config);
        this.name = p.name;
        this.baseRange = p.baseRange;
        this.baseDamage = p.baseDamage;
        this.baseArcDegrees = p.baseArcDegrees;
        this.attackSpeed = p.attackSpeed ?? 1;
        this.cooldown = p.cooldown;
        this.comboConfig = p.comboConfig;
        this.comboWindow = p.comboWindow;
        this.knockback = p.knockback;
        this.block = p.block;
        this.twoHanded = p.twoHanded;
        this.dashAttack = p.dashAttack;
        this.rangeMultiplier = p.rangeMultiplier;
        this.weaponLength = p.weaponLength;
        this.chargeAttack = p.chargeAttack;
        this.attackVisual = p.attackVisual;
        this._maxComboStage = p.maxComboStage;
        this.isRanged = config.isRanged === true;
        this.visual = config.visual;
        this.chargeRelease = p.chargeRelease ?? null;
    }

    static fromConfig(config: WeaponConfigInput): Weapon {
        return new Weapon(config);
    }

    getBlockConfig(): BlockResult | null {
        return this.block;
    }

    getComboStageProperties(stage: number): StagePropsResult | null {
        if (stage < 1 || stage > this.comboConfig.length) return null;
        return WeaponBehavior.buildStageProps(this.comboConfig[stage - 1], this, stage);
    }

    get maxComboStage(): number {
        return this._maxComboStage != null ? this._maxComboStage : this.comboConfig.length;
    }

    getThrustStageIndex(): number | null {
        return WeaponBehavior.getThrustStageIndex(this.comboConfig);
    }

    getChargeState(chargeDuration: number): { isCharged: boolean; chargeMultiplier: number } {
        return WeaponBehavior.getChargeState(chargeDuration, this.chargeAttack);
    }

    getResolvedAttack(chargeDuration: number, comboStage: number, options?: ResolveAttackOptions): ResolveAttackResult | null {
        return WeaponBehavior.resolveAttack(this, chargeDuration, comboStage, options ?? {});
    }

    getStaminaCostForAttack(chargeDuration: number, comboStage: number, options?: ResolveAttackOptions): number {
        const resolved = this.getResolvedAttack(chargeDuration, comboStage, options);
        return resolved ? resolved.finalStaminaCost : 0;
    }

    getDashAttackProperties(): StagePropsResult | null {
        if (!this.dashAttack) return null;
        return WeaponBehavior.buildStageProps(this.dashAttack, this, 'dashAttack');
    }

    /** For charge-release behavior (e.g. chieftain club). Returns same shape as ChieftainClub getHeavySmashProperties. */
    getHeavySmashProperties(): {
        range: number;
        damage: number;
        arc: number;
        isCircular: boolean;
        chargeTime: number;
        releaseDuration: number;
        knockbackForce: number;
        aoeInFront: boolean;
        aoeOffset: number;
        aoeRadius: number;
    } | null {
        if (!this.chargeRelease) return null;
        const cr = this.chargeRelease;
        return {
            range: cr.range,
            damage: cr.damage,
            arc: Math.PI * 2,
            isCircular: false,
            chargeTime: cr.chargeTime,
            releaseDuration: cr.releaseDuration,
            knockbackForce: cr.knockbackForce,
            aoeInFront: cr.aoeInFront,
            aoeOffset: cr.aoeOffset,
            aoeRadius: cr.aoeRadius
        };
    }
}
