// Centralized game configuration
const GameConfig = {
    world: {
        width: 4800,
        height: 2800,
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
        },
        swordAndShield: {
            name: 'swordAndShield',
            baseRange: 80,
            baseDamage: 15,
            baseArcDegrees: 60,
            cooldown: 0.3,
            comboWindow: 1.5,
            block: {
                enabled: true,
                arcDegrees: 180,
                damageReduction: 1.0,
                staminaCost: 5,
                animationKey: 'block'
            },
            stages: [
                { name: 'swipe', arcDegrees: 90, duration: 320, staminaCost: 10, rangeMultiplier: 1.0, damageMultiplier: 1.2, animationKey: 'melee' },
                { name: 'stab', arcDegrees: 24, duration: 350, staminaCost: 12, rangeMultiplier: 1.2, damageMultiplier: 1.0, animationKey: 'melee2', dashSpeed: 500, dashDuration: 0.25 },
                { name: 'spin', arcDegrees: 360, duration: 520, staminaCost: 15, rangeMultiplier: 0.9, damageMultiplier: 1.5, animationKey: 'meleeSpin', dashSpeed: 450, dashDuration: 0.45 }
            ]
        },
        greatsword: {
            weaponClass: 'Greatsword',
            name: 'greatsword',
            twoHanded: true,
            baseRange: 100,
            baseDamage: 28,
            baseArcDegrees: 100,
            cooldown: 0.55,
            comboWindow: 1.6,
            stages: [
                { name: 'slash1', arcDegrees: 100, duration: 480, staminaCost: 18, rangeMultiplier: 1.0, damageMultiplier: 1.2, animationKey: 'melee' },
                { name: 'slash2', arcDegrees: 110, duration: 540, staminaCost: 20, rangeMultiplier: 1.05, damageMultiplier: 1.5, animationKey: 'melee2' },
                { name: 'slash3', arcDegrees: 120, duration: 620, staminaCost: 24, rangeMultiplier: 1.05, damageMultiplier: 1.9, animationKey: 'meleeSpin' }
            ]
        },
        broadsword: {
            weaponClass: 'Greatsword',
            name: 'broadsword',
            twoHanded: true,
            baseRange: 110,
            baseDamage: 32,
            baseArcDegrees: 95,
            cooldown: 0.5,
            comboWindow: 1.5,
            stages: [
                { name: 'broad1', arcDegrees: 95, duration: 440, staminaCost: 16, rangeMultiplier: 1.0, damageMultiplier: 1.25, animationKey: 'melee' },
                { name: 'broad2', arcDegrees: 100, duration: 500, staminaCost: 18, rangeMultiplier: 1.05, damageMultiplier: 1.45, animationKey: 'melee2' },
                { name: 'broad3', arcDegrees: 110, duration: 580, staminaCost: 22, rangeMultiplier: 1.05, damageMultiplier: 1.85, animationKey: 'meleeSpin' }
            ]
        }
    },
    
    player: {
        startX: 2400,
        startY: 1400,
        width: 30,
        height: 30,
        speed: 100, // pixels per second (now properly scaled by deltaTime)
        maxHealth: 100,
        maxStamina: 50,
        staminaRegen: 6.75, // stamina per second (scaled by deltaTime)
        attackRange: 80,
        attackDamage: 15,
        attackArcDegrees: 60,
        attackCooldown: 0.3, // seconds - faster for combos (was 0.5)
        color: '#8b8b9a', // steel (fallback when knight sprites not loaded)
        defaultWeapon: 'swordAndShield',
        chargedAttack: {
            minChargeTime: 0.5, // Minimum time to charge (seconds)
            maxChargeTime: 2.0, // Maximum charge time (seconds)
            damageMultiplier: 2.0, // Damage multiplier at max charge
            rangeMultiplier: 1.5, // Range multiplier at max charge
            staminaCostMultiplier: 1.5 // Stamina cost multiplier at max charge
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
            force: 550, // Knockback force for player attacks (pixels per second initial velocity)
            decay: 0.85, // Friction factor (higher = less friction, more distance)
            receivedMultiplier: 3.0 // Multiplier applied to knockback received from enemies
        },
        projectile: {
            enabled: false, // Temporarily disabled for player; projectile system still used by enemies
            speed: 400, // Pixels per second
            damage: 10, // Base damage
            range: 500, // Maximum travel distance
            cooldown: 0.5, // Seconds between shots
            staminaCost: 8 // Stamina cost per shot
        },
        healthOrbDropChance: 0.25 // 25% chance for enemies to drop a health orb on death
    },
    
    enemy: {
        types: {
            goblin: {
                maxHealth: 30,
                speed: 25, // pixels per second (now properly scaled by deltaTime) - slowed down
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
                    lungeSpeed: 200, // Speed during lunge - slowed down
                    lungeDistance: 120, // Maximum distance to lunge
                    lungeDamage: 8, // Damage dealt by lunge (higher than normal attack)
                    knockback: { force: 240 } // Per-attack knockback (default type is 160)
                }
            },
            skeleton: {
                maxHealth: 50,
                speed: 20, // pixels per second (now properly scaled by deltaTime) - slowed down
                attackRange: 50,
                attackDamage: 8,
                attackArcDegrees: 90,
                color: '#cccccc',
                attackCooldown: 1.5, // seconds (was 50 frames at 60fps)
                windUpTime: 0.7, // seconds before attack hits
                knockback: {
                    force: 190, // Knockback force when skeleton hits player (increased by 10)
                    decay: 0.87
                },
                projectile: {
                    enabled: true, // Skeletons are ranged enemies
                    speed: 200, // Pixels per second - slowed down
                    damage: 6,
                    range: 280,
                    cooldown: 3.5 // Seconds between shots - increased cooldown
                }
            },
            lesserDemon: {
                maxHealth: 45,
                speed: 32, // pixels per second - faster than goblin
                attackRange: 45,
                attackDamage: 7,
                attackArcDegrees: 90,
                detectionRange: 220,
                color: '#884444',
                attackCooldown: 0.85, // seconds - faster than goblin
                windUpTime: 0.5, // seconds before attack hits
                knockback: {
                    force: 180, // Knockback force when lesser demon hits player
                    decay: 0.87
                },
                lunge: {
                    enabled: true,
                    chargeRange: 160, // Distance at which lesser demon starts charging lunge
                    chargeTime: 0.7, // Time to charge up the lunge - faster than goblin
                    lungeSpeed: 220, // Speed during lunge - faster than goblin
                    lungeDistance: 130, // Maximum distance to lunge
                    lungeDamage: 10, // Damage dealt by lunge (higher than goblin)
                    knockback: { force: 260 } // Per-attack knockback
                }
            },
            greaterDemon: {
                maxHealth: 80,
                speed: 30, // pixels per second (now properly scaled by deltaTime) - slowed down
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
                },
                pillarFlame: {
                    castDelay: 2.0,   // Telegraph time before pillar spawns (more time to escape)
                    activeDuration: 2.0,
                    radius: 45,
                    damage: 8,
                    damageInterval: 0.4,
                    cooldown: 18.0,   // Seconds before same demon can cast again (fewer pillars)
                    pillarRange: 220
                }
            }
        },
        spawn: {
            maxEnemies: 20
        }
    },
    
    // Portal spawns at this position when kills required for current level are met
    portal: {
        x: 2400,
        y: 1400,
        width: 80,
        height: 80
    },

    // Safe hub: static square tile room, no procedural gen; camera follows player (later: NPCs)
    hub: {
        name: 'Sanctuary',
        tileSize: 50,
        width: 1600,
        height: 1600,
        playerStart: { x: 800, y: 800 },
        board: { x: 750, y: 765, width: 100, height: 70 },
        theme: {
            ground: { r: 42, g: 38, b: 32, variation: 6 },
            sky: 'rgba(100, 90, 80, 0.06)'
        },
        // Static walls: room inset by 200px on each side so there is space around the sanctuary
        walls: [
            { x: 200, y: 200, width: 1200, height: 50 },
            { x: 200, y: 1350, width: 1200, height: 50 },
            { x: 200, y: 200, width: 50, height: 1200 },
            { x: 1350, y: 200, width: 50, height: 1200 }
        ]
    },

    levels: {
        // Level-based enemy pack + theme (ground colors) + obstacles; portal after killsToUnlockPortal
        1: {
            name: 'Village Outskirts',
            packSpawn: { density: 0.008, packSize: { min: 2, max: 4 } },
            enemyTypes: ['goblin'],
            killsToUnlockPortal: 10,
            theme: {
                ground: { r: 38, g: 48, b: 38, variation: 8 },
                sky: 'rgba(135, 206, 235, 0.05)'
            },
            obstacles: {
                forest: { density: 0.025 },
                mushrooms: { density: 0.012 },
                rocks: { density: 0.022 },
                border: { spacing: 50 },
                structures: {
                    houses: { enabled: true, count: 3 },
                    woodClusters: { enabled: true, count: 3, treesPerCluster: 6 },
                    settlements: { enabled: true, count: 1 },
                    firepits: { enabled: true, count: 2 },
                    sheds: { enabled: true, count: 2 },
                    wells: { enabled: true, count: 1 },
                    ruins: { enabled: true, rubblePiles: 12, pillarClusters: 6, ruinedWalls: 8, ruinedStructures: 4, brokenArches: 5, statueRemnants: 6 }
                }
            }
        },
        2: {
            name: 'Cursed Wilds',
            packSpawn: { density: 0.012, packSize: { min: 3, max: 5 } },
            enemyTypes: ['goblin', 'goblin', 'skeleton', 'skeleton'],
            killsToUnlockPortal: 15,
            theme: {
                ground: { r: 28, g: 26, b: 24, variation: 10 },
                sky: 'rgba(60, 55, 70, 0.08)'
            },
            obstacles: {
                mushrooms: { density: 0.028 },
                darkRocks: { density: 0.02 },
                border: { spacing: 50, type: 'mushroom' },
                graves: { count: 18 },
                swampPools: { count: 10 },
                structures: {
                    houses: { enabled: false },
                    woodClusters: { enabled: false },
                    settlements: { enabled: false },
                    firepits: { enabled: true, count: 1 },
                    sheds: { enabled: false },
                    wells: { enabled: false },
                    ruins: { enabled: true, rubblePiles: 15, pillarClusters: 4, ruinedWalls: 10, ruinedStructures: 2, brokenArches: 3, statueRemnants: 8 }
                }
            }
        },
        3: {
            name: 'Demon Approach',
            packSpawn: { density: 0.016, packSize: { min: 4, max: 6 } },
            enemyTypes: ['skeleton', 'skeleton', 'lesserDemon', 'lesserDemon'],
            killsToUnlockPortal: 20,
            theme: {
                ground: { r: 34, g: 16, b: 18, variation: 12 },
                sky: 'rgba(80, 20, 30, 0.12)'
            },
            obstacles: {
                lavaRocks: { density: 0.025 },
                demonPillars: { count: 14 },
                braziers: { count: 12 },
                border: { spacing: 50, type: 'lavaRock' },
                structures: {
                    houses: { enabled: false },
                    woodClusters: { enabled: false },
                    settlements: { enabled: false },
                    firepits: { enabled: false },
                    sheds: { enabled: false },
                    wells: { enabled: false },
                    ruins: { enabled: true, rubblePiles: 20, pillarClusters: 8, ruinedWalls: 12, ruinedStructures: 6, brokenArches: 4, statueRemnants: 10 }
                }
            }
        }
    },

    // Default obstacles config (used if a level omits obstacles; level configs override)
    obstacles: {
        forest: {
            density: 0.025
        },
        rocks: {
            density: 0.022
        },
        border: {
            spacing: 50
        },
        structures: {
            houses: {
                enabled: true,
                count: 3
            },
            woodClusters: {
                enabled: true,
                count: 3,
                treesPerCluster: 6
            },
            settlements: {
                enabled: true,
                count: 1
            },
            firepits: {
                enabled: true,
                count: 2
            },
            sheds: {
                enabled: true,
                count: 2
            },
            wells: {
                enabled: true,
                count: 1
            },
            ruins: {
                enabled: true,
                rubblePiles: 12,
                pillarClusters: 6,
                ruinedWalls: 8,
                ruinedStructures: 4,
                brokenArches: 5,
                statueRemnants: 6
            }
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

