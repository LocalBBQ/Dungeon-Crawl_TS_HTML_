// Base weapon class - defines weapon types and their combos
class Weapon {
    constructor(name, baseRange, baseDamage, baseArcDegrees, cooldown, comboConfig, comboWindow = 1.5, knockback = null) {
        this.name = name;
        this.baseRange = baseRange;
        this.baseDamage = baseDamage;
        this.baseArcDegrees = baseArcDegrees;
        this.cooldown = cooldown;
        this.comboConfig = comboConfig; // Array of combo stage configs
        this.comboWindow = comboWindow;
        this.knockback = knockback; // Optional { force } for weapon-level default
    }

    static fromConfig(config) {
        const stages = config.stages || [];
        return new Weapon(
            config.name || 'weapon',
            config.baseRange ?? 100,
            config.baseDamage ?? 15,
            config.baseArcDegrees ?? 60,
            config.cooldown ?? 0.3,
            stages,
            config.comboWindow ?? 1.5,
            config.knockback ?? null
        );
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

// Weapon registry built from config (add new weapons in GameConfig.weapons)
const Weapons = typeof GameConfig !== 'undefined' && GameConfig.weapons
    ? Object.fromEntries(
        Object.entries(GameConfig.weapons).map(([key, config]) => [key, Weapon.fromConfig(config)])
      )
    : { sword: Weapon.fromConfig({ name: 'sword', baseRange: 80, baseDamage: 15, baseArcDegrees: 60, cooldown: 0.3, comboWindow: 1.5, stages: [
        { name: 'swipe', arcDegrees: 90, duration: 320, staminaCost: 10, rangeMultiplier: 1.0, damageMultiplier: 1.2, animationKey: 'melee' },
        { name: 'stab', arcDegrees: 24, duration: 350, staminaCost: 12, rangeMultiplier: 1.2, damageMultiplier: 1.0, animationKey: 'melee2', dashSpeed: 500, dashDuration: 0.25 },
        { name: 'spin', arcDegrees: 360, duration: 520, staminaCost: 15, rangeMultiplier: 0.9, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 450, dashDuration: 0.45 }
    ]}) };

