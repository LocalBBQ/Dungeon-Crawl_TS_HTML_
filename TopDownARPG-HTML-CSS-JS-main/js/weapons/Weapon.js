// Base weapon class - defines weapon types and their combos
class Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 1.5, knockback = null, block = null, twoHanded = false) {
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
            config.twoHanded === true
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
        return {
            range: this.baseRange * (stageConfig.rangeMultiplier || 1.0),
            damage: this.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: arcRad,
            duration: stageConfig.duration || 100, // ms
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null,
            dashDuration: stageConfig.dashDuration || 0,
            stageName: stageConfig.name || `stage${stage}`,
            animationKey: stageConfig.animationKey || 'melee',
            isCircular,
            knockbackForce
        };
    }
    
    get maxComboStage() {
        return this.comboConfig.length;
    }
}

// Greatsword: two-handed weapon with no blocking (different block logic - override in subclass)
class Greatsword extends Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 1.5, knockback = null, block = null, twoHanded = true) {
        super(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow, knockback, null, twoHanded);
    }

    getBlockConfig() {
        return null;
    }

    static fromConfig(config) {
        const w = Weapon.fromConfig(config);
        return new Greatsword(w.name, w.baseRange, w.baseDamage, w.baseArcDegrees, w.cooldown, w.comboConfig, w.comboWindow, w.knockback, null, w.twoHanded);
    }
}

// Weapon registry: use config.weaponClass for class-based weapons (e.g. Greatsword), else Weapon.fromConfig
function buildWeaponFromConfig(key, config) {
    if (config.weaponClass === 'Greatsword') {
        return Greatsword.fromConfig(config);
    }
    return Weapon.fromConfig(config);
}

const Weapons = typeof GameConfig !== 'undefined' && GameConfig.weapons
    ? Object.fromEntries(
        Object.entries(GameConfig.weapons).map(([key, config]) => [key, buildWeaponFromConfig(key, config)])
      )
    : { sword: Weapon.fromConfig({ name: 'sword', baseRange: 80, baseDamage: 15, baseArcDegrees: 60, cooldown: 0.3, comboWindow: 1.5, block: { enabled: true, arcDegrees: 180, damageReduction: 1.0, staminaCost: 5 }, stages: [
        { name: 'swipe', arcDegrees: 90, duration: 320, staminaCost: 10, rangeMultiplier: 1.0, damageMultiplier: 1.2, animationKey: 'melee' },
        { name: 'stab', arcDegrees: 24, duration: 350, staminaCost: 12, rangeMultiplier: 1.2, damageMultiplier: 1.0, animationKey: 'melee2', dashSpeed: 500, dashDuration: 0.25 },
        { name: 'spin', arcDegrees: 360, duration: 520, staminaCost: 15, rangeMultiplier: 0.9, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 450, dashDuration: 0.45 }
    ]}) };

