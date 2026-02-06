// Centralized game configuration
const GameConfig = {
    world: {
        width: 2400,
        height: 1400,
        tileSize: 50
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
        attackRange: 100,
        attackDamage: 15,
        attackArc: Math.PI / 3,
        attackCooldown: 0.3, // seconds - faster for combos (was 0.5)
        color: '#4444ff',
        combo: {
            window: 1.5, // seconds to continue combo
            staminaCosts: {
                stage1: 10, // swipe
                stage2: 12, // stab
                stage3: 15  // spin
            },
            stab: {
                rangeMultiplier: 1.2,
                damageMultiplier: 1.0,
                arc: Math.PI / 6 // 30 degrees
            },
            swipe: {
                rangeMultiplier: 1.0,
                damageMultiplier: 1.2,
                arc: Math.PI * 0.6 // 108 degrees
            },
            spin: {
                rangeMultiplier: 0.9,
                damageMultiplier: 1.5,
                arc: Math.PI * 2 // 360 degrees
            }
        },
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
            force: 250, // Knockback force for player attacks (pixels per second initial velocity)
            decay: 0.85 // Friction factor (higher = less friction, more distance)
        }
    },
    
    enemy: {
        types: {
            goblin: {
                maxHealth: 30,
                speed: 40, // pixels per second (now properly scaled by deltaTime)
                attackRange: 40,
                attackDamage: 5,
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
                    lungeDamage: 8 // Damage dealt by lunge (higher than normal attack)
                }
            },
            skeleton: {
                maxHealth: 50,
                speed: 30, // pixels per second (now properly scaled by deltaTime)
                attackRange: 50,
                attackDamage: 8,
                detectionRange: 250,
                color: '#cccccc',
                attackCooldown: 0.83, // seconds (was 50 frames at 60fps)
                windUpTime: 0.7, // seconds before attack hits
                knockback: {
                    force: 190, // Knockback force when skeleton hits player (increased by 10)
                    decay: 0.87
                }
            },
            demon: {
                maxHealth: 80,
                speed: 50, // pixels per second (now properly scaled by deltaTime)
                attackRange: 60,
                attackDamage: 12,
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

