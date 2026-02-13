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
            return this.comboConfig.length;
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

    const config = {
        name: 'greatsword',
        twoHanded: true,
        baseRange: 100,
        baseDamage: 20,
        baseArcDegrees: 100,
        cooldown: 0.4,
        comboWindow: 2.0,
        baseStunBuildup: 35,
        weaponLength: 75,
        stages: [
            { name: 'slash1', arcDegrees: 180, duration: 540, staminaCost: 18, range: 100, damageMultiplier: 1.0, animationKey: 'melee', stunBuildup: 35 },
            { name: 'slash2', arcDegrees: 110, duration: 600, staminaCost: 20, range: 105, damageMultiplier: 1.5, animationKey: 'melee2', stunBuildup: 42, reverseSweep: true },
            { name: 'slash3', arcDegrees: 360, duration: 1120, staminaCost: 26, range: 120, damageMultiplier: 1.9, animationKey: 'meleeSpin', stunBuildup: 55 }
        ],
        chargeAttack: {
            minChargeTime: 0.5,
            maxChargeTime: 2.0,
            damageMultiplier: 2.0,
            rangeMultiplier: 3.0,
            staminaCostMultiplier: 1.5
        }
    };
    window.Greatsword = Greatsword;
    window.GreatswordWeaponInstance = Greatsword.fromConfig(config);
})();
