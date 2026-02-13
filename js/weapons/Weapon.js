// Base weapon class - defines weapon types and their combos
class Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 1.5, knockback = null, block = null, twoHanded = false, dashAttack = null, rangeMultiplier = 1, weaponLength = null, chargeAttack = null, attackVisual = null) {
        this.name = name;
        this.baseRange = baseRange;
        this.baseDamage = baseDamage;
        this.baseArcDegrees = baseArcDegrees;
        this.cooldown = cooldown;
        this.comboConfig = comboConfig; // Array of combo stage configs
        this.comboWindow = comboWindow;
        this.knockback = knockback; // Optional { force } for weapon-level default
        this.block = block; // Optional block config: { enabled, arcRad, damageReduction, staminaCost, animationKey }
        this.twoHanded = twoHanded === true;
        this.dashAttack = dashAttack || null; // Optional dash attack (e.g. shift+click 360° spin)
        this.chargeAttack = chargeAttack || null; // Optional charge attack config (minChargeTime, maxChargeTime, damageMultiplier, etc.)
        this.rangeMultiplier = rangeMultiplier != null ? rangeMultiplier : 1; // Weapon-specific range scale (e.g. unique weapons)
        this.weaponLength = weaponLength != null ? weaponLength : null; // Optional display length (world units); decouples drawn weapon size from attack range
        this.attackVisual = attackVisual || null; // Optional: { anticipationRatio, pullBackRadians, sweepSpeed, followThroughExtra, followThroughStart, thrustAnticipationRatio, thrustPullBackWorld, thrustLungeForwardWorld }
    }

    static fromConfig(config) {
        const stages = config.stages || [];
        let block = null;
        if (config.block != null && config.block.enabled !== false) {
            const arcDegrees = config.block.arcDegrees ?? 180;
            block = {
                enabled: config.block.enabled !== false,
                arcRad: typeof Utils !== 'undefined' ? Utils.degToRad(arcDegrees) : (arcDegrees * Math.PI / 180),
                damageReduction: config.block.damageReduction ?? 1.0,
                staminaCost: config.block.staminaCost ?? 5,
                animationKey: config.block.animationKey ?? 'block'
            };
            if (config.block.shieldBash) {
                const sb = config.block.shieldBash;
                block.shieldBash = {
                    knockback: sb.knockback ?? 500,
                    dashSpeed: sb.dashSpeed ?? 380,
                    dashDuration: sb.dashDuration ?? 0.22,
                    staminaCost: sb.staminaCost ?? 14,
                    range: sb.range ?? 100,
                    arcRad: typeof Utils !== 'undefined' ? Utils.degToRad(sb.arcDegrees ?? 120) : ((sb.arcDegrees ?? 120) * Math.PI / 180)
                };
            }
        }
        return new Weapon(
            config.name || 'weapon',
            config.baseRange ?? 100,
            config.baseDamage ?? 15,
            config.baseArcDegrees ?? 60,
            config.cooldown ?? 0.3,
            stages,
            config.comboWindow ?? 1.5,
            config.knockback ?? null,
            block,
            config.twoHanded === true,
            config.dashAttack ?? config.specialAttack ?? null,
            config.rangeMultiplier ?? 1,
            config.weaponLength ?? null,
            config.chargeAttack ?? null,
            config.attackVisual ?? null
        );
    }

    // Returns block config for Combat: { enabled, arcRad, damageReduction, staminaCost, animationKey } or null
    getBlockConfig() {
        return this.block;
    }
    
    // Get combo stage properties (returns arc in radians for runtime)
    getComboStageProperties(stage) {
        if (stage < 1 || stage > this.comboConfig.length) {
            return null;
        }
        
        const stageConfig = this.comboConfig[stage - 1];
        const arcDegrees = stageConfig.arcDegrees != null
            ? stageConfig.arcDegrees
            : (stageConfig.arc != null ? stageConfig.arc * 180 / Math.PI : this.baseArcDegrees);
        const arcRad = stageConfig.arcDegrees != null
            ? Utils.degToRad(stageConfig.arcDegrees)
            : (stageConfig.arc != null ? stageConfig.arc : Utils.degToRad(this.baseArcDegrees));
        const isCircular = arcDegrees >= 360;
        // Knockback: stage override → weapon default → null (caller uses player.knockback.force)
        const knockbackForce = stageConfig.knockbackForce ?? stageConfig.knockback?.force ?? this.knockback?.force ?? null;
        const stunBuildup = stageConfig.stunBuildup != null ? stageConfig.stunBuildup : 25;
        const arcOffset = stageConfig.arcOffsetDegrees != null
            ? Utils.degToRad(stageConfig.arcOffsetDegrees)
            : 0;
        const baseStageRange = stageConfig.range != null
            ? stageConfig.range
            : this.baseRange * (stageConfig.rangeMultiplier || 1.0);
        const isThrust = stageConfig.thrust === true;
        const thrustWidth = stageConfig.thrustWidth != null ? stageConfig.thrustWidth : 40;
        const reverseSweep = stageConfig.reverseSweep === true;
        return {
            range: baseStageRange * (this.rangeMultiplier ?? 1),
            damage: this.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: arcRad,
            arcOffset,
            reverseSweep,
            duration: stageConfig.duration || 100, // ms
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null,
            dashDuration: stageConfig.dashDuration || 0,
            stageName: stageConfig.name || `stage${stage}`,
            animationKey: stageConfig.animationKey || 'melee',
            isCircular,
            isThrust,
            thrustWidth,
            knockbackForce,
            stunBuildup
        };
    }
    
    get maxComboStage() {
        return this.comboConfig.length;
    }

    // Get dash attack properties (e.g. shift+click 360°) — same shape as getComboStageProperties
    getDashAttackProperties() {
        const stageConfig = this.dashAttack;
        if (!stageConfig) return null;
        const arcDegrees = stageConfig.arcDegrees != null
            ? stageConfig.arcDegrees
            : (stageConfig.arc != null ? stageConfig.arc * 180 / Math.PI : this.baseArcDegrees);
        const arcRad = stageConfig.arcDegrees != null
            ? Utils.degToRad(stageConfig.arcDegrees)
            : (stageConfig.arc != null ? stageConfig.arc : Utils.degToRad(this.baseArcDegrees));
        const isCircular = arcDegrees >= 360;
        const knockbackForce = stageConfig.knockbackForce ?? stageConfig.knockback?.force ?? this.knockback?.force ?? null;
        const stunBuildup = stageConfig.stunBuildup != null ? stageConfig.stunBuildup : 25;
        const arcOffset = stageConfig.arcOffsetDegrees != null
            ? Utils.degToRad(stageConfig.arcOffsetDegrees)
            : 0;
        const baseStageRange = stageConfig.range != null
            ? stageConfig.range
            : this.baseRange * (stageConfig.rangeMultiplier || 1.0);
        const isThrust = stageConfig.thrust === true;
        const thrustWidth = stageConfig.thrustWidth != null ? stageConfig.thrustWidth : 40;
        const reverseSweep = stageConfig.reverseSweep === true;
        return {
            range: baseStageRange * (this.rangeMultiplier ?? 1),
            damage: this.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: arcRad,
            arcOffset,
            reverseSweep,
            duration: stageConfig.duration || 100,
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null,
            dashDuration: stageConfig.dashDuration || 0,
            stageName: stageConfig.name || 'dashAttack',
            animationKey: stageConfig.animationKey || 'melee',
            isCircular,
            isThrust,
            thrustWidth,
            knockbackForce,
            stunBuildup
        };
    }
}

// Crossbow: ranged weapon, one shot then reload; has perfect-reload window
class Crossbow extends Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 0, knockback = null, block = null, twoHanded = true, dashAttack = null, rangeMultiplier = 1, weaponLength = null, chargeAttack = null) {
        super(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow, knockback, block, twoHanded, dashAttack, rangeMultiplier, weaponLength, chargeAttack);
        this.isRanged = true;
    }

    static fromConfig(config) {
        const w = Weapon.fromConfig(config);
        return new Crossbow(w.name, w.baseRange, w.baseDamage, w.baseArcDegrees, w.cooldown, w.comboConfig, w.comboWindow, w.knockback, w.block, w.twoHanded, w.dashAttack, w.rangeMultiplier, w.weaponLength, w.chargeAttack);
    }
}

// Greatsword: two-handed weapon with no blocking (different block logic - override in subclass)
class Greatsword extends Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 1.5, knockback = null, block = null, twoHanded = true, dashAttack = null, rangeMultiplier = 1, weaponLength = null, chargeAttack = null) {
        super(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow, knockback, null, twoHanded, dashAttack, rangeMultiplier, weaponLength, chargeAttack);
    }

    getBlockConfig() {
        return null;
    }

    static fromConfig(config) {
        const w = Weapon.fromConfig(config);
        return new Greatsword(w.name, w.baseRange, w.baseDamage, w.baseArcDegrees, w.cooldown, w.comboConfig, w.comboWindow, w.knockback, null, w.twoHanded, w.dashAttack, w.rangeMultiplier, w.weaponLength, w.chargeAttack);
    }
}

// Weapons registry is built in WeaponsRegistry.js from SwordAndShield.js, GreatswordWeapon.js, CrossbowWeapon.js
