// Greatsword: two-handed, no block. Uses WeaponBehavior. Mace uses this class with different config.
(function () {
    const WB = window.WeaponBehavior;

    class Greatsword {
        constructor(config) {
            const p = WB.parseWeaponConfig(config);
            this.name = p.name;
            this.baseRange = p.baseRange;
            this.baseDamage = p.baseDamage;
            this.baseArcDegrees = p.baseArcDegrees;
            this.attackSpeed = p.attackSpeed ?? 1;
            this.cooldown = p.cooldown;
            this.comboConfig = p.comboConfig;
            this.comboWindow = p.comboWindow;
            this.knockback = p.knockback;
            this.block = null; // Greatsword never blocks
            this.twoHanded = p.twoHanded;
            this.dashAttack = p.dashAttack;
            this.rangeMultiplier = p.rangeMultiplier;
            this.weaponLength = p.weaponLength;
            this.chargeAttack = p.chargeAttack;
            this.attackVisual = p.attackVisual;
            this._maxComboStage = p.maxComboStage != null ? p.maxComboStage : null;
        }

        static fromConfig(config) {
            return new Greatsword(config);
        }

        getBlockConfig() {
            return null;
        }

        getComboStageProperties(stage) {
            if (stage < 1 || stage > this.comboConfig.length) return null;
            return WB.buildStageProps(this.comboConfig[stage - 1], this, stage);
        }

        get maxComboStage() {
            return this._maxComboStage != null ? this._maxComboStage : this.comboConfig.length;
        }

        getThrustStageIndex() {
            return WB.getThrustStageIndex(this.comboConfig);
        }

        getChargeState(chargeDuration) {
            return WB.getChargeState(chargeDuration, this.chargeAttack);
        }

        getResolvedAttack(chargeDuration, comboStage, options) {
            return WB.resolveAttack(this, chargeDuration, comboStage, options);
        }

        getStaminaCostForAttack(chargeDuration, comboStage, options) {
            const resolved = this.getResolvedAttack(chargeDuration, comboStage, options);
            return resolved ? resolved.finalStaminaCost : 0;
        }

        getDashAttackProperties() {
            if (!this.dashAttack) return null;
            return WB.buildStageProps(this.dashAttack, this, 'dashAttack');
        }
    }

    // Balancing: attackSpeed < 1 = slower swings, cooldown = seconds between attacks, cooldownMultiplier = scale cooldown
    const config = {
        name: 'greatsword',
        twoHanded: true,
        baseRange: 120,
        baseDamage: 20,
        baseArcDegrees: 100,
        cooldown: 0.4,
        attackSpeed: 0.5,
        cooldownMultiplier: .5,
        comboWindow: 1.5,
        baseStunBuildup: 35,
        weaponLength: 52,
        maxComboStage: 2,
        stages: [
            { name: 'slash1', arcDegrees: 120, duration: 480, staminaCost: 16, range: 100, damageMultiplier: 1.0, animationKey: 'melee', stunBuildup: 35 },
            { name: 'slash2', arcDegrees: 110, duration: 520, staminaCost: 18, range: 100, damageMultiplier: 1.4, animationKey: 'melee2', stunBuildup: 42, reverseSweep: true },
            { name: 'spin360', arcDegrees: 360, duration: 1000, staminaCost: 24, range: 120, damageMultiplier: 1.8, animationKey: 'meleeSpin', stunBuildup: 50 }
        ],
        chargeAttack: {
            minChargeTime: 0.5,
            maxChargeTime: 2.0,
            damageMultiplier: 2.0,
            rangeMultiplier: 1.4,
            staminaCostMultiplier: 1.5,
            chargedStageIndex: 3
        },
        dashAttack: {
            name: 'stab',
            arcDegrees: 24,
            duration: 320,
            staminaCost: 14,
            range: 140,
            damageMultiplier: 1.3,
            animationKey: 'melee2',
            thrust: true,
            thrustWidth: 42,
            stunBuildup: 28,
            dashSpeed: 340,
            dashDuration: 0.28
        }
    };
    window.Greatsword = Greatsword;
    window.GreatswordWeaponInstance = Greatsword.fromConfig(config);
})();
