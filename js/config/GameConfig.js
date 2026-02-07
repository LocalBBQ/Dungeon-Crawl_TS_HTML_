// Centralized game configuration
const GameConfig = {
    world: {
        width: 2400,
        height: 1400,
        tileSize: 50
    },

    weapons: {
        sword: {
            name: 'sword',
            baseRange: 80,
            baseDamage: 15,
            baseArcDegrees: 60,
            cooldown: 0.3,
            comboWindow: 1.5,
            stages: [
                { name: 'swipe', arcDegrees: 90, duration: 320, staminaCost: 10, rangeMultiplier: 1.0, damageMultiplier: 1.2, animationKey: 'melee' },
                { name: 'stab', arcDegrees: 24, duration: 350, staminaCost: 12, rangeMultiplier: 1.2, damageMultiplier: 1.0, animationKey: 'melee2', dashSpeed: 500, dashDuration: 0.25 },
                { name: 'spin', arcDegrees: 360, duration: 520, staminaCost: 15, rangeMultiplier: 0.9, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 450, dashDuration: 0.45 }
            ]
        }
    },
    
    player: {
        startX: 1200,
        startY: 700,
        width: 30,
        height: 30,
        speed: 100, // pixels per second (now properly scaled by deltaTime)
        maxHealth: 100,
        maxStamina: 50,
        staminaRegen: 5, // stamina per second (scaled by deltaTime)
        attackRange: 80,
        attackDamage: 15,
        attackArcDegrees: 60,
        attackCooldown: 0.3, // seconds - faster for combos (was 0.5)
        color: '#4444ff',
        defaultWeapon: 'sword',
        sprint: {
            multiplier: 1.66, // 66% speed increase
            staminaCost: 12 // stamina consumed per second
        },
        dodge: {
            speed: 400, // pixels per second during dodge
            duration: 0.3, // seconds of dodge roll
            cooldown: 1.0, // seconds between dodges
            staminaCost: 15 // stamina cost to dodge
        },
        knockback: {
            force: 550, // Knockback force for player attacks (pixels per second initial velocity)
            decay: 0.85 // Friction factor (higher = less friction, more distance)
        },
        projectile: {
            speed: 400, // Pixels per second
            damage: 10, // Base damage
            range: 500, // Maximum travel distance
            cooldown: 0.5, // Seconds between shots
            staminaCost: 8 // Stamina cost per shot
        }
    },
    
    enemy: {
        types: {
            goblin: {
                maxHealth: 30,
                speed: 40, // pixels per second (now properly scaled by deltaTime)
                attackRange: 40,
                attackDamage: 5,
                attackArcDegrees: 90,
                detectionRange: 200,
                color: '#44aa44',
                attackCooldown: 1.0, // seconds (was 60 frames at 60fps)
                windUpTime: 0.6, // seconds before attack hits
                knockback: {
                    force: 160, // Knockback force when goblin hits player (increased by 10)
                    decay: 0.88 // Friction factor
                },
                lunge: {
                    enabled: true,
                    chargeRange: 150, // Distance at which goblin starts charging lunge
                    chargeTime: 0.8, // Time to charge up the lunge
                    lungeSpeed: 300, // Speed during lunge
                    lungeDistance: 120, // Maximum distance to lunge
                    lungeDamage: 8, // Damage dealt by lunge (higher than normal attack)
                    knockback: { force: 240 } // Per-attack knockback (default type is 160)
                }
            },
            skeleton: {
                maxHealth: 50,
                speed: 30, // pixels per second (now properly scaled by deltaTime)
                attackRange: 50,
                attackDamage: 8,
                attackArcDegrees: 90,
                detectionRange: 250,
                color: '#cccccc',
                attackCooldown: 0.83, // seconds (was 50 frames at 60fps)
                windUpTime: 0.7, // seconds before attack hits
                knockback: {
                    force: 190, // Knockback force when skeleton hits player (increased by 10)
                    decay: 0.87
                },
                projectile: {
                    enabled: true, // Skeletons are ranged enemies
                    speed: 300, // Pixels per second
                    damage: 6,
                    range: 400,
                    cooldown: 2.0 // Seconds between shots
                }
            },
            demon: {
                maxHealth: 80,
                speed: 50, // pixels per second (now properly scaled by deltaTime)
                attackRange: 60,
                attackDamage: 12,
                attackArcDegrees: 90,
                detectionRange: 300,
                color: '#aa4444',
                attackCooldown: 0.67, // seconds (was 40 frames at 60fps)
                windUpTime: 0.5, // seconds before attack hits
                knockback: {
                    force: 230, // Knockback force when demon hits player (stronger, increased by 10)
                    decay: 0.86
                }
            }
        },
        spawn: {
            maxEnemies: 20
        }
    },
    
    levels: {
        // Level-based enemy spawn points
        // Each level defines spawn zones where enemies will appear
        1: {
            spawnZones: [
                { x: 300, y: 300, type: 'goblin' },
                { x: 600, y: 400, type: 'goblin' },
                { x: 900, y: 500, type: 'goblin' },
                { x: 1200, y: 300, type: 'goblin' },
                { x: 1500, y: 600, type: 'goblin' },
                { x: 1800, y: 400, type: 'goblin' },
                { x: 2100, y: 700, type: 'goblin' },
                { x: 500, y: 800, type: 'goblin' },
                { x: 1000, y: 900, type: 'goblin' },
                { x: 1600, y: 1000, type: 'goblin' }
            ]
        },
        2: {
            spawnZones: [
                { x: 400, y: 200, type: 'goblin' },
                { x: 700, y: 350, type: 'goblin' },
                { x: 1000, y: 450, type: 'skeleton' },
                { x: 1300, y: 250, type: 'goblin' },
                { x: 1600, y: 550, type: 'skeleton' },
                { x: 1900, y: 350, type: 'goblin' },
                { x: 2200, y: 650, type: 'skeleton' },
                { x: 600, y: 750, type: 'goblin' },
                { x: 1100, y: 850, type: 'skeleton' },
                { x: 1700, y: 950, type: 'goblin' },
                { x: 800, y: 1100, type: 'skeleton' },
                { x: 1400, y: 1200, type: 'goblin' }
            ]
        },
        3: {
            spawnZones: [
                { x: 500, y: 150, type: 'skeleton' },
                { x: 800, y: 300, type: 'skeleton' },
                { x: 1100, y: 400, type: 'skeleton' },
                { x: 1400, y: 200, type: 'demon' },
                { x: 1700, y: 500, type: 'skeleton' },
                { x: 2000, y: 300, type: 'demon' },
                { x: 700, y: 700, type: 'skeleton' },
                { x: 1200, y: 800, type: 'demon' },
                { x: 1800, y: 900, type: 'skeleton' },
                { x: 900, y: 1050, type: 'demon' },
                { x: 1500, y: 1150, type: 'skeleton' },
                { x: 600, y: 600, type: 'demon' },
                { x: 1600, y: 650, type: 'skeleton' }
            ]
        }
    },
    
    obstacles: {
        forest: {
            density: 0.03
        },
        rocks: {
            density: 0.015
        },
        border: {
            spacing: 50
        }
    },
    
    pathfinding: {
        cellSize: 25
    },
    
    camera: {
        smoothing: 0.1,
        minZoom: 1.0,
        maxZoom: 2.0,
        zoomSpeed: 0.05
    }
};

