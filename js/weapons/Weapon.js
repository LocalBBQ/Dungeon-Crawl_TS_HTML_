// Base weapon class - defines weapon types and their combos
class Weapon {
    constructor(name, baseRange, baseDamage, baseArc, cooldown, comboConfig) {
        this.name = name;
        this.baseRange = baseRange;
        this.baseDamage = baseDamage;
        this.baseArc = baseArc;
        this.cooldown = cooldown;
        this.comboConfig = comboConfig; // Array of combo stage configs
    }
    
    // Get combo stage properties
    getComboStageProperties(stage) {
        if (stage < 1 || stage > this.comboConfig.length) {
            return null;
        }
        
        const stageConfig = this.comboConfig[stage - 1];
        return {
            range: this.baseRange * (stageConfig.rangeMultiplier || 1.0),
            damage: this.baseDamage * (stageConfig.damageMultiplier || 1.0),
            arc: stageConfig.arc || this.baseArc,
            duration: stageConfig.duration || 100, // ms
            staminaCost: stageConfig.staminaCost || 10,
            dashSpeed: stageConfig.dashSpeed || null, // null = no dash
            dashDuration: stageConfig.dashDuration || 0
        };
    }
    
    get maxComboStage() {
        return this.comboConfig.length;
    }
}

// Weapon definitions
const Weapons = {
    sword: new Weapon('sword', 100, 15, Math.PI / 3, 0.3, [
        {
            name: 'swipe',
            rangeMultiplier: 1.0,
            damageMultiplier: 1.2,
            arc: Math.PI * 0.6, // 108 degrees
            duration: 100,
            staminaCost: 10
        },
        {
            name: 'stab',
            rangeMultiplier: 1.2,
            damageMultiplier: 1.0,
            arc: Math.PI / 6, // 30 degrees
            duration: 100,
            staminaCost: 12,
            dashSpeed: 500, // pixels per second for lunge
            dashDuration: 0.2 // 100px / 500px/s = 0.2s
        },
        {
            name: 'spin',
            rangeMultiplier: 0.9,
            damageMultiplier: 1.5,
            arc: Math.PI * 2, // 360 degrees
            duration: 200,
            staminaCost: 15,
            dashSpeed: 450,
            dashDuration: 0.4
        }
    ]),
    
    // Add more weapon types here
    // axe: new Weapon('axe', ...),
    // dagger: new Weapon('dagger', ...),
};

