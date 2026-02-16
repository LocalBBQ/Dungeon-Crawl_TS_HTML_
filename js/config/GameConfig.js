// Centralized game configuration
const GameConfig = {
    world: {
        width: 4800,
        height: 2800,
        tileSize: 50
    },

    /** Entity-vs-entity collision: buffer (px) added so player and enemies don't get as close. */
    entityCollision: {
        buffer: 12
    },

    /** Ground texture registry: id -> asset path. Use theme.ground.texture = id in levels. */
    groundTextures: {
        grass: 'assets/sprites/environment/Grass1.png'
        // e.g. dirt: 'assets/sprites/environment/Dirt1.png',
        // stone: 'assets/sprites/environment/Stone1.png',
    },

    player: {
        startX: 2400,
        startY: 1400,
        width: 34.5,  // 30 * 1.15 (15% larger)
        height: 34.5,
        speed: 100, // pixels per second (now properly scaled by deltaTime)
        maxHealth: 100,
        maxStamina: 100,
        staminaRegen: 8, // stamina per second (scaled by deltaTime)
        // Melee attack range, damage, arc and cooldown come from the equipped weapon (see weapons/*.js), not from here
        color: '#8b8b9a', // steel (fallback when knight sprites not loaded)
        defaultWeapon: 'swordAndShield',
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
            receivedMultiplier: 3.0, // Multiplier applied to knockback received from enemies
            knockbackResist: 0 // 0–1; percentage reduction to knockback received (e.g. 0.2 = 20% less)
        },
        projectile: {
            enabled: false, // Temporarily disabled for player; projectile system still used by enemies
            speed: 400, // Pixels per second
            damage: 10, // Base damage
            range: 500, // Maximum travel distance
            cooldown: 0.5, // Seconds between shots
            staminaCost: 8, // Stamina cost per shot
            stunBuildup: 20
        },
        crossbow: {
            damage: 22,
            speed: 550,
            range: 600,
            staminaCost: 12,
            stunBuildup: 25,
            reloadTime: 1.4,           // seconds to fully reload
            perfectWindowStart: 0.62,   // perfect reload zone start (0–1)
            perfectWindowEnd: 0.78,     // perfect reload zone end (0–1)
            perfectReloadDamageMultiplier: 1.5  // damage multiplier on next shot if perfect reload
        },
        heal: {
            maxCharges: 3,
            drinkTime: 2,           // seconds of "drinking" before regen starts
            regenRate: 25,         // HP per second during regen
            regenDuration: 2,      // seconds of regen per charge (total 50 HP per charge)
            chargeRegenTime: 30    // seconds to regain one charge (when not at max)
        },
        stun: {
            threshold: 100,      // stun meter fills to this, then stun triggers
            duration: 1,        // stun duration in seconds
            decayPerSecond: 15,  // meter drains when not being hit (0 = no decay)
            decayCooldown: 4,   // seconds after last stun buildup before decay starts (player only)
            blockedMultiplier: 0.5  // stun buildup when hit is blocked (0.5 = 50%, 1 = full)
        }
    },

    statusEffects: {
        enemyStunThreshold: 100,  // enemy stun meter threshold
        enemyStunDuration: 1,     // seconds enemies are stunned when meter fills
        enemyStunDecayPerSecond: 20,  // enemy meter decay (0 = no decay)
        enemyStunDecayCooldown: 4  // seconds after last stun buildup before decay starts (all enemies)
    },
    
    enemy: {
        // types populated by EnemiesRegistry.js after enemy type scripts load
        types: {},
        /** Pack detection: same-type allies within radius; need at least minAllies to count as "in pack". */
        pack: {
            radius: 180,
            minAllies: 2,
            /** Chance (0–1) that a pack gets a shared modifier; otherwise pack has no modifier. Difficulty tuning. */
            modifierChance: 0.5
        },
        spawn: {
            maxEnemies: 20
        }
    },

    /** Pack modifiers: named buff sets applied when enemy is in a pack (same-type allies in range). Fewer, stronger identities; some scale health at spawn. */
    packModifiers: {
        fierce: {
            damageMultiplier: 1.4,
            healthMultiplier: 1.25,
            color: '#cc2222'
        },
        swift: {
            speedMultiplier: 1.3,
            damageMultiplier: 1.05,
            color: '#ffcc00'
        },
        stalwart: {
            healthMultiplier: 1.6,
            knockbackResist: 0.5,
            damageMultiplier: 1.0,
            color: '#228822'
        },
        relentless: {
            attackCooldownMultiplier: 0.65,
            damageMultiplier: 1.15,
            color: '#6666ff'
        },
        vicious: {
            stunBuildupPerHitMultiplier: 1.5,
            damageMultiplier: 1.15,
            color: '#cc44cc'
        },
        inspiring: {
            speedMultiplier: 1.15,
            damageMultiplier: 1.2,
            healthMultiplier: 1.3,
            color: '#00aacc'
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
        weaponChest: { x: 340, y: 780, width: 80, height: 60 },
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
        // Level 0 = hub (Sanctuary); no enemies, no portal, level-select board, weapon chest
        0: {
            name: 'Sanctuary',
            tileSize: 50,
            width: 1600,
            height: 1600,
            playerStart: { x: 800, y: 800 },
            board: { x: 750, y: 765, width: 100, height: 70 },
            weaponChest: { x: 340, y: 780, width: 80, height: 60 },
            theme: {
                ground: { r: 42, g: 38, b: 32, variation: 6 },
                sky: 'rgba(100, 90, 80, 0.06)'
            },
            walls: [
                { x: 200, y: 200, width: 1200, height: 50 },
                { x: 200, y: 1350, width: 1200, height: 50 },
                { x: 200, y: 200, width: 50, height: 1200 },
                { x: 1350, y: 200, width: 50, height: 1200 }
            ]
        },
        // Level-based enemy pack + theme (ground colors) + obstacles; portal after killsToUnlockPortal
        // packSpread: radius range within each pack (enemies placed min..max from center). Larger = more dispersed.
        // packCountVariance: 0..1; pack count is multiplied by random(1-variance, 1+variance) for more random density.
        // minPackDistance: minimum distance between pack centers so packs don't cluster.
        1: {
            name: 'Village Outskirts',
            packSpawn: {
                density: 0.008,
                packSize: { min: 2, max: 4 },
                patrol: true,
                packSpread: { min: 40, max: 95 },
                packCountVariance: 0.35,
                minPackDistance: 220
            },
            enemyTypes: ['goblin', 'goblin', 'goblinChieftain', 'bandit'],
            killsToUnlockPortal: 10,
            theme: {
                ground: { r: 38, g: 48, b: 38, variation: 8, texture: 'grass' },
                sky: 'rgba(135, 206, 235, 0.05)'
            },
            // Optional world size when using scene tiles (6*800 x 3*800)
            worldWidth: 4800,
            worldHeight: 2400,
            obstacles: {
                border: { spacing: 50 },
                useSceneTiles: true,
                sceneTileLayout: {
                    tileSize: 800,
                    cols: 6,
                    rows: 3,
                    // Weights: higher = more common. Open areas dominant; few settled/encounter tiles.
                    pool: [
                        { id: 'clearing', weight: 5 },
                        { id: 'crossroads', weight: 4 },
                        { id: 'orchardEdge', weight: 3 },
                        { id: 'thickGrove', weight: 3 },
                        { id: 'waysideShrine', weight: 2 },
                        { id: 'woodcutterClearing', weight: 2 },
                        { id: 'lumberMill', weight: 1 },
                        { id: 'lumberMillB', weight: 1 },
                        { id: 'smallFarm', weight: 1 },
                        { id: 'goblinCamp', weight: 1 },
                        { id: 'goblinCampB', weight: 1 },
                        { id: 'banditAmbush', weight: 0.5 }
                    ]
                }
            }
        },
        2: {
            name: 'Cursed Wilds',
            packSpawn: {
                density: 0.012,
                packSize: { min: 3, max: 5 },
                patrol: true,
                packSpread: { min: 45, max: 100 },
                packCountVariance: 0.35,
                minPackDistance: 240
            },
            enemyTypes: ['goblin', 'goblin', 'goblinChieftain', 'skeleton', 'skeleton'],
            killsToUnlockPortal: 15,
            theme: {
                ground: { r: 28, g: 26, b: 24, variation: 10 },
                sky: 'rgba(60, 55, 70, 0.08)'
            },
            worldWidth: 4800,
            worldHeight: 2400,
            obstacles: {
                border: { spacing: 50, type: 'deadTree' },
                useSceneTiles: true,
                sceneTileLayout: {
                    tileSize: 800,
                    cols: 6,
                    rows: 3,
                    pool: [
                        { id: 'cursedWilds.clearing', weight: 5 },
                        { id: 'cursedWilds.crossroads', weight: 4 },
                        { id: 'cursedWilds.bogClearing', weight: 3 },
                        { id: 'cursedWilds.swampEdge', weight: 3 },
                        { id: 'cursedWilds.ruinedShrine', weight: 2 },
                        { id: 'cursedWilds.thickMushroomGrove', weight: 2 },
                        { id: 'cursedWilds.ruinFragment', weight: 1 },
                        { id: 'cursedWilds.graveyard', weight: 1 },
                        { id: 'cursedWilds.graveyardB', weight: 1 },
                        { id: 'cursedWilds.skeletonCamp', weight: 0.5 }
                    ]
                }
            }
        },
        3: {
            name: 'Demon Approach',
            packSpawn: {
                density: 0.016,
                packSize: { min: 4, max: 6 },
                packSpread: { min: 50, max: 110 },
                packCountVariance: 0.4,
                minPackDistance: 260
            },
            enemyTypes: ['skeleton', 'skeleton', 'lesserDemon', 'lesserDemon'],
            killsToUnlockPortal: 20,
            theme: {
                ground: { r: 34, g: 16, b: 18, variation: 12 },
                sky: 'rgba(80, 20, 30, 0.12)'
            },
            worldWidth: 4800,
            worldHeight: 2400,
            obstacles: {
                border: { spacing: 50, type: 'lavaRock' },
                useSceneTiles: true,
                sceneTileLayout: {
                    tileSize: 800,
                    cols: 6,
                    rows: 3,
                    pool: [
                        { id: 'demonApproach.clearing', weight: 5 },
                        { id: 'demonApproach.crossroads', weight: 4 },
                        { id: 'demonApproach.pillarRing', weight: 3 },
                        { id: 'demonApproach.lavaRockField', weight: 3 },
                        { id: 'demonApproach.demonShrine', weight: 2 },
                        { id: 'demonApproach.brazierCourt', weight: 2 },
                        { id: 'demonApproach.ashenPlaza', weight: 2 },
                        { id: 'demonApproach.ruinedGate', weight: 1 },
                        { id: 'demonApproach.ruinFragment', weight: 1 },
                        { id: 'demonApproach.demonCamp', weight: 1 },
                        { id: 'demonApproach.skeletonCamp', weight: 0.5 }
                    ]
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
        /** Higher smoothing when player is attack-dashing (e.g. spin) so camera keeps up and player doesn't appear to leave the frame */
        fastFollowSmoothing: 0.35,
        minZoom: 1.0,
        maxZoom: 2.0,
        zoomSpeed: 0.05
    }
};

