/**
 * Demon Approach biome scene tiles (level 3).
 * Infernal: lava rocks, demon pillars, braziers, ruins.
 * Attached as SceneTiles.demonApproach.
 */
export const SceneTilesDemonApproach: Record<string, { width: number; height: number; obstacles?: unknown[]; gatherables?: unknown[]; [key: string]: unknown }> = {
        /** Clearing: sparse lava rocks, 1–2 braziers, open center, short wall fragment. */
        clearing: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'lavaRock', x: 120, y: 140, width: 48, height: 48 },
                { type: 'lavaRock', x: 620, y: 180, width: 52, height: 52 },
                { type: 'lavaRock', x: 380, y: 520, width: 45, height: 45 },
                { type: 'brazier', x: 340, y: 360, width: 42, height: 42 },
                { type: 'brazier', x: 460, y: 420, width: 40, height: 40 },
                { type: 'lavaRock', x: 80, y: 580, width: 50, height: 50 },
                { type: 'lavaRock', x: 680, y: 540, width: 46, height: 46 },
                { type: 'crumblingWall', x: 260, y: 620, width: 80, height: 24 },
                { type: 'crumblingWall', x: 460, y: 100, width: 24, height: 70 }
            ],
            gatherables: [
                { type: 'ore', x: 380, y: 520, width: 40, height: 40 },
                { type: 'herb', x: 340, y: 360, width: 32, height: 32 }
            ]
        },

        /** Crossroads: one central brazier, a few lava rocks, corner wall stubs. */
        crossroads: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'brazier', x: 370, y: 365, width: 48, height: 48 },
                { type: 'lavaRock', x: 80, y: 100, width: 50, height: 50 },
                { type: 'lavaRock', x: 660, y: 640, width: 48, height: 48 },
                { type: 'lavaRock', x: 620, y: 80, width: 52, height: 52 },
                { type: 'wall', x: 40, y: 40, width: 20, height: 20 },
                { type: 'wall', x: 60, y: 40, width: 20, height: 20 },
                { type: 'wall', x: 40, y: 60, width: 20, height: 20 },
                { type: 'crumblingWall', x: 720, y: 720, width: 60, height: 28 }
            ]
        },

        /** Pillar ring: central demon pillar, ring of lava rocks, rubble, wall fragments. */
        pillarRing: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'demonPillar', x: 362, y: 342, width: 52, height: 52 },
                { type: 'lavaRock', x: 280, y: 280, width: 55, height: 55 },
                { type: 'lavaRock', x: 460, y: 270, width: 50, height: 50 },
                { type: 'lavaRock', x: 470, y: 460, width: 52, height: 52 },
                { type: 'lavaRock', x: 270, y: 468, width: 48, height: 48 },
                { type: 'rubble', x: 320, y: 320, width: 45, height: 45 },
                { type: 'rubble', x: 430, y: 400, width: 42, height: 42 },
                { type: 'stoneDebris', x: 350, y: 480, width: 38, height: 38 },
                { type: 'stoneDebris', x: 440, y: 330, width: 35, height: 35 },
                { type: 'crumblingWall', x: 120, y: 340, width: 100, height: 24 },
                { type: 'crumblingWall', x: 580, y: 420, width: 24, height: 90 }
            ],
            gatherables: [
                { type: 'ore', x: 320, y: 320, width: 40, height: 40 },
                { type: 'chest', x: 430, y: 400, width: 36, height: 36 }
            ]
        },

        /** Demon shrine: pillars, statue base, columns, braziers, rubble, ruined walls. */
        demonShrine: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'demonPillar', x: 350, y: 300, width: 50, height: 50 },
                { type: 'statueBase', x: 340, y: 380, width: 90, height: 90 },
                { type: 'column', x: 295, y: 350, width: 56, height: 56 },
                { type: 'column', x: 448, y: 348, width: 54, height: 54 },
                { type: 'brazier', x: 260, y: 360, width: 44, height: 44 },
                { type: 'brazier', x: 490, y: 358, width: 42, height: 42 },
                { type: 'rubble', x: 270, y: 420, width: 48, height: 48 },
                { type: 'rubble', x: 465, y: 400, width: 46, height: 46 },
                { type: 'stoneDebris', x: 330, y: 460, width: 40, height: 40 },
                { type: 'lavaRock', x: 220, y: 480, width: 52, height: 52 },
                { type: 'lavaRock', x: 540, y: 440, width: 50, height: 50 },
                { type: 'crumblingWall', x: 200, y: 240, width: 140, height: 24 },
                { type: 'crumblingWall', x: 456, y: 240, width: 140, height: 24 },
                { type: 'wall', x: 308, y: 540, width: 20, height: 20 },
                { type: 'wall', x: 328, y: 540, width: 20, height: 20 },
                { type: 'wall', x: 348, y: 540, width: 20, height: 20 },
                { type: 'wall', x: 432, y: 540, width: 20, height: 20 },
                { type: 'wall', x: 452, y: 540, width: 20, height: 20 },
                { type: 'wall', x: 472, y: 540, width: 20, height: 20 }
            ],
            gatherables: [
                { type: 'shrineBlessing', x: 370, y: 420, width: 48, height: 48 },
                { type: 'ore', x: 330, y: 460, width: 40, height: 40 }
            ]
        },

        /** Brazier court: several braziers in a rough rectangle, lava rocks, rubble, low walls. */
        brazierCourt: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'brazier', x: 280, y: 280, width: 46, height: 46 },
                { type: 'brazier', x: 470, y: 275, width: 44, height: 44 },
                { type: 'brazier', x: 275, y: 460, width: 48, height: 48 },
                { type: 'brazier', x: 472, y: 458, width: 46, height: 46 },
                { type: 'brazier', x: 370, y: 365, width: 42, height: 42 },
                { type: 'lavaRock', x: 200, y: 360, width: 52, height: 52 },
                { type: 'lavaRock', x: 550, y: 370, width: 50, height: 50 },
                { type: 'rubble', x: 320, y: 420, width: 45, height: 45 },
                { type: 'rubble', x: 430, y: 320, width: 42, height: 42 },
                { type: 'wall', x: 240, y: 240, width: 20, height: 20 },
                { type: 'wall', x: 260, y: 240, width: 20, height: 20 },
                { type: 'wall', x: 280, y: 240, width: 20, height: 20 },
                { type: 'wall', x: 500, y: 240, width: 20, height: 20 },
                { type: 'wall', x: 520, y: 240, width: 20, height: 20 },
                { type: 'wall', x: 540, y: 240, width: 20, height: 20 },
                { type: 'crumblingWall', x: 240, y: 520, width: 320, height: 24 }
            ]
        },

        /** Ruined gate: arch, broken pillars, rubble, one brazier, flanking walls. */
        ruinedGate: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'arch', x: 350, y: 320, width: 80, height: 80 },
                { type: 'brokenPillar', x: 260, y: 380, width: 58, height: 72 },
                { type: 'brokenPillar', x: 480, y: 375, width: 55, height: 68 },
                { type: 'rubble', x: 320, y: 450, width: 90, height: 70 },
                { type: 'brazier', x: 370, y: 520, width: 44, height: 44 },
                { type: 'lavaRock', x: 180, y: 340, width: 50, height: 50 },
                { type: 'lavaRock', x: 570, y: 500, width: 48, height: 48 },
                { type: 'crumblingWall', x: 180, y: 300, width: 24, height: 120 },
                { type: 'crumblingWall', x: 596, y: 300, width: 24, height: 120 },
                { type: 'wall', x: 200, y: 420, width: 20, height: 20 },
                { type: 'wall', x: 220, y: 420, width: 20, height: 20 },
                { type: 'wall', x: 560, y: 420, width: 20, height: 20 },
                { type: 'wall', x: 580, y: 420, width: 20, height: 20 }
            ]
        },

        /** Lava rock field: dense lava rocks, 1–2 braziers, rubble, wall runs. */
        lavaRockField: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'lavaRock', x: 60, y: 80, width: 52, height: 52 },
                { type: 'lavaRock', x: 200, y: 60, width: 48, height: 48 },
                { type: 'lavaRock', x: 380, y: 100, width: 55, height: 55 },
                { type: 'lavaRock', x: 560, y: 70, width: 50, height: 50 },
                { type: 'lavaRock', x: 660, y: 200, width: 48, height: 48 },
                { type: 'lavaRock', x: 100, y: 280, width: 52, height: 52 },
                { type: 'lavaRock', x: 320, y: 260, width: 46, height: 46 },
                { type: 'lavaRock', x: 520, y: 300, width: 50, height: 50 },
                { type: 'lavaRock', x: 180, y: 420, width: 48, height: 48 },
                { type: 'lavaRock', x: 400, y: 400, width: 54, height: 54 },
                { type: 'lavaRock', x: 600, y: 480, width: 50, height: 50 },
                { type: 'lavaRock', x: 80, y: 560, width: 52, height: 52 },
                { type: 'lavaRock', x: 640, y: 600, width: 46, height: 46 },
                { type: 'brazier', x: 360, y: 360, width: 42, height: 42 },
                { type: 'brazier', x: 440, y: 520, width: 40, height: 40 },
                { type: 'rubble', x: 280, y: 380, width: 48, height: 48 },
                { type: 'rubble', x: 480, y: 420, width: 45, height: 45 },
                { type: 'crumblingWall', x: 40, y: 380, width: 24, height: 140 },
                { type: 'crumblingWall', x: 736, y: 200, width: 24, height: 160 },
                { type: 'wall', x: 340, y: 80, width: 20, height: 20 },
                { type: 'wall', x: 360, y: 80, width: 20, height: 20 },
                { type: 'wall', x: 380, y: 80, width: 20, height: 20 },
                { type: 'wall', x: 400, y: 80, width: 20, height: 20 },
                { type: 'wall', x: 420, y: 80, width: 20, height: 20 }
            ]
        },

        /** Demon camp: 2–3 demon pillars, braziers, lava rocks, wall segments. Pack spawn. */
        demonCamp: {
            spawn: { type: 'pack', count: 1 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'demonPillar', x: 320, y: 320, width: 52, height: 52 },
                { type: 'demonPillar', x: 428, y: 328, width: 48, height: 48 },
                { type: 'brazier', x: 340, y: 400, width: 44, height: 44 },
                { type: 'brazier', x: 420, y: 405, width: 42, height: 42 },
                { type: 'brazier', x: 370, y: 480, width: 46, height: 46 },
                { type: 'lavaRock', x: 260, y: 280, width: 55, height: 55 },
                { type: 'lavaRock', x: 490, y: 275, width: 50, height: 50 },
                { type: 'lavaRock', x: 270, y: 500, width: 52, height: 52 },
                { type: 'lavaRock', x: 485, y: 490, width: 48, height: 48 },
                { type: 'rubble', x: 350, y: 450, width: 45, height: 45 },
                { type: 'rubble', x: 430, y: 350, width: 42, height: 42 },
                { type: 'crumblingWall', x: 260, y: 220, width: 280, height: 24 },
                { type: 'wall', x: 300, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 320, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 460, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 480, y: 560, width: 20, height: 20 }
            ]
        },

        /** Skeleton camp: firepit, rubble, broken pillar, lava rocks, ruined walls. Pack spawn. */
        skeletonCamp: {
            spawn: { type: 'pack', count: 1 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'firepit', x: 355, y: 345, width: 68, height: 68 },
                { type: 'brokenPillar', x: 280, y: 320, width: 56, height: 70 },
                { type: 'rubble', x: 440, y: 400, width: 50, height: 50 },
                { type: 'rubble', x: 300, y: 460, width: 48, height: 48 },
                { type: 'lavaRock', x: 180, y: 380, width: 52, height: 52 },
                { type: 'lavaRock', x: 560, y: 420, width: 50, height: 50 },
                { type: 'stoneDebris', x: 360, y: 480, width: 38, height: 38 },
                { type: 'brazier', x: 240, y: 440, width: 42, height: 42 },
                { type: 'brazier', x: 520, y: 360, width: 40, height: 40 },
                { type: 'crumblingWall', x: 160, y: 260, width: 24, height: 120 },
                { type: 'crumblingWall', x: 616, y: 480, width: 24, height: 120 },
                { type: 'wall', x: 320, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 340, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 440, y: 560, width: 20, height: 20 },
                { type: 'wall', x: 460, y: 560, width: 20, height: 20 }
            ]
        },

        /** Ashen plaza: statue base, pillars, braziers at corners, rubble, interior walls. Fenced perimeter. */
        ashenPlaza: {
            perimeterFence: { spacing: 36, size: 28 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'statueBase', x: 350, y: 350, width: 95, height: 95 },
                { type: 'pillar', x: 280, y: 300, width: 52, height: 52 },
                { type: 'pillar', x: 468, y: 298, width: 50, height: 50 },
                { type: 'pillar', x: 282, y: 448, width: 54, height: 54 },
                { type: 'pillar', x: 466, y: 446, width: 50, height: 50 },
                { type: 'brazier', x: 200, y: 220, width: 44, height: 44 },
                { type: 'brazier', x: 556, y: 218, width: 42, height: 42 },
                { type: 'brazier', x: 198, y: 538, width: 46, height: 46 },
                { type: 'brazier', x: 558, y: 536, width: 44, height: 44 },
                { type: 'rubble', x: 320, y: 480, width: 48, height: 48 },
                { type: 'rubble', x: 430, y: 320, width: 45, height: 45 },
                { type: 'lavaRock', x: 140, y: 380, width: 50, height: 50 },
                { type: 'lavaRock', x: 610, y: 370, width: 48, height: 48 },
                { type: 'wall', x: 240, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 260, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 280, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 520, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 540, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 560, y: 260, width: 20, height: 20 },
                { type: 'wall', x: 240, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 260, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 280, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 520, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 540, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 560, y: 520, width: 20, height: 20 },
                { type: 'crumblingWall', x: 380, y: 260, width: 40, height: 24 },
                { type: 'crumblingWall', x: 380, y: 516, width: 40, height: 24 }
            ]
        },

        /** Ruin fragment: rubble, broken pillar, lava rocks, stone debris, ruined walls. */
        ruinFragment: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'rubble', x: 280, y: 300, width: 115, height: 75 },
                { type: 'rubble', x: 420, y: 420, width: 95, height: 70 },
                { type: 'brokenPillar', x: 320, y: 400, width: 58, height: 72 },
                { type: 'lavaRock', x: 260, y: 380, width: 52, height: 52 },
                { type: 'lavaRock', x: 500, y: 350, width: 50, height: 50 },
                { type: 'stoneDebris', x: 350, y: 480, width: 40, height: 40 },
                { type: 'stoneDebris', x: 450, y: 320, width: 38, height: 38 },
                { type: 'brazier', x: 380, y: 540, width: 42, height: 42 },
                { type: 'lavaRock', x: 180, y: 440, width: 48, height: 48 },
                { type: 'lavaRock', x: 580, y: 280, width: 52, height: 52 },
                { type: 'crumblingWall', x: 260, y: 240, width: 200, height: 24 },
                { type: 'crumblingWall', x: 340, y: 536, width: 180, height: 24 },
                { type: 'crumblingWall', x: 100, y: 320, width: 24, height: 140 },
                { type: 'crumblingWall', x: 676, y: 380, width: 24, height: 120 },
                { type: 'wall', x: 300, y: 280, width: 20, height: 20 },
                { type: 'wall', x: 320, y: 280, width: 20, height: 20 },
                { type: 'wall', x: 460, y: 280, width: 20, height: 20 },
                { type: 'wall', x: 480, y: 280, width: 20, height: 20 },
                { type: 'wall', x: 380, y: 520, width: 20, height: 20 },
                { type: 'wall', x: 400, y: 520, width: 20, height: 20 }
            ],
            gatherables: [
                { type: 'chest', x: 350, y: 480, width: 36, height: 36 },
                { type: 'ore', x: 450, y: 320, width: 40, height: 40 }
            ]
        }
};
