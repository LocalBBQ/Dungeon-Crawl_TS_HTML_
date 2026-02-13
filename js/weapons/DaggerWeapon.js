// Dagger: shared weapon for player and enemies. Slashes on left-click; dash attack (leap) on Shift+click for player.
// Goblins use EnemyAttackHandler(dagger, 'slashAndLeap'); lunge uses dash attack damage/knockback.
(function () {
    const WB = window.WeaponBehavior;

    class DaggerWeapon {
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
            this.block = p.block;
            this.dashAttack = p.dashAttack;
            this.rangeMultiplier = p.rangeMultiplier;
            this.weaponLength = p.weaponLength;
            this.chargeAttack = p.chargeAttack;
            this.attackVisual = p.attackVisual;
        }

        static fromConfig(config) {
            return new DaggerWeapon(config);
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

    const config = {
        name: 'dagger',
        baseRange: 40,
        baseDamage: 5,
        baseArcDegrees: 90,
        cooldown: 0.25,
        comboWindow: 1.2,
        baseStunBuildup: 18,
        weaponLength: 35,
        stages: [
            { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 42, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 80, stunBuildup: 18 },
            { name: 'slash', arcDegrees: 90, duration: 280, staminaCost: 6, range: 42, damageMultiplier: 1.0, animationKey: 'melee', knockbackForce: 80, stunBuildup: 18, reverseSweep: true },
            { name: 'slash', arcDegrees: 100, duration: 320, staminaCost: 8, range: 44, damageMultiplier: 1.2, animationKey: 'melee', knockbackForce: 100, stunBuildup: 22 }
        ],
        // Dash attack: leap forward (player Shift+click; reserved for future goblin use)
        dashAttack: {
            name: 'leap',
            arcDegrees: 90,
            duration: 400,
            staminaCost: 14,
            range: 55,
            damageMultiplier: 1.6,
            animationKey: 'melee',
            dashSpeed: 380,
            dashDuration: 0.32,
            knockbackForce: 240,
            stunBuildup: 28
        }
    };

    window.DaggerWeapon = DaggerWeapon;
    window.DaggerWeaponInstance = DaggerWeapon.fromConfig(config);
})();
