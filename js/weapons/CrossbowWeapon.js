// Crossbow: ranged, no melee combo. Uses WeaponBehavior; getResolvedAttack returns null (shoot handled elsewhere).
(function () {
    const WB = window.WeaponBehavior;

    class Crossbow {
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
            this.block = p.block;
            this.twoHanded = p.twoHanded;
            this.dashAttack = p.dashAttack;
            this.rangeMultiplier = p.rangeMultiplier;
            this.weaponLength = p.weaponLength;
            this.chargeAttack = p.chargeAttack;
            this.attackVisual = p.attackVisual;
            this.isRanged = true;
        }

        static fromConfig(config) {
            return new Crossbow(config);
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

    // Balancing: attackSpeed < 1 = slower (e.g. reload), cooldown = seconds between shots, cooldownMultiplier = scale cooldown
    const config = {
        name: 'crossbow',
        twoHanded: true,
        baseRange: 600,
        baseDamage: 22,
        baseArcDegrees: 0,
        cooldown: 0,
        // attackSpeed: 0.85,
        // cooldownMultiplier: 1.2,
        comboWindow: 0,
        stages: []
    };
    window.CrossbowWeaponInstance = Crossbow.fromConfig(config);
})();
