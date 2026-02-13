// Sword and Shield: one-handed with block and shield bash. Uses WeaponBehavior for shared logic.
(function () {
    const WB = window.WeaponBehavior;

    class SwordAndShield {
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
        }

        static fromConfig(config) {
            return new SwordAndShield(config);
        }

        getBlockConfig() {
            return this.block;
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

    // Balancing: attackSpeed < 1 = slower swings, cooldown = seconds between attacks, cooldownMultiplier = scale cooldown
    const config = {
        name: 'swordAndShield',
        baseRange: 80,
        baseDamage: 15,
        baseArcDegrees: 60,
        cooldown: 0.46,
        attackSpeed: .6 ,
        cooldownMultiplier: .5,
        comboWindow: 1.5                                                                                                                                                                                                                ,
        baseStunBuildup: 25,
        weaponLength: 55,
        block: {
            enabled: true,
            arcDegrees: 180,
            damageReduction: 1.0,
            staminaCost: 25,
            animationKey: 'block',
            shieldBash: {
                knockback: 1500,
                dashSpeed: 380,
                dashDuration: 0.22,
                staminaCost: 14,
                range: 100,
                arcDegrees: 120
            }
        },
        stages: [
            { name: 'slash', arcDegrees: 90, duration: 450, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28 },
            { name: 'slash', arcDegrees: 90, duration: 450, staminaCost: 10, range: 92, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 28, reverseSweep: true },
            { name: 'stab', arcDegrees: 24, duration: 340, staminaCost: 12, range: 120, damageMultiplier: 1.0, animationKey: 'melee2', stunBuildup: 22, thrust: true, thrustWidth: 44 }
        ],
        dashAttack: { name: 'spin', arcDegrees: 360, duration: 740, staminaCost: 25, range: 72, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 350, dashDuration: 0.5, stunBuildup: 50 },
        chargeAttack: {
            minChargeTime: 0.25,
            maxChargeTime: 2.0,
            damageMultiplier: 2.0,
            rangeMultiplier: 1.2,
            staminaCostMultiplier: 1.5,
            chargedThrustDashSpeed: 380,
            chargedThrustDashDistanceMin: 50,
            chargedThrustDashDistanceMax: 170
        },
        attackVisual: {
            thrustLungeForwardWorld: 32,
            thrustAnticipationRatio: 0.32
        }
    };
    window.SwordAndShieldWeapon = SwordAndShield.fromConfig(config);
})();
