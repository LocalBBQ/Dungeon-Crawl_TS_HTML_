/**
 * Forest biome scene tiles (Village Outskirts / level 1).
 * All coordinates and sizes in world pixels, relative to tile (0,0).
 * Attached as SceneTiles.forest.
 */
export const SceneTilesForest: Record<string, { width: number; height: number; obstacles?: unknown[]; gatherables?: unknown[]; [key: string]: unknown }> = {
        /** Clearing: open center with a loose tree ring, undergrowth, and a few rocks. */
        clearing: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'tree', x: 52, y: 92, width: 110, height: 110 },
                { type: 'tree', x: 628, y: 58, width: 130, height: 130 },
                { type: 'tree', x: 675, y: 655, width: 100, height: 100 },
                { type: 'tree', x: 340, y: 20, width: 90, height: 90 },
                { type: 'tree', x: 20, y: 380, width: 100, height: 100 },
                { type: 'tree', x: 690, y: 400, width: 95, height: 95 },
                { type: 'bush', x: 372, y: 352, width: 56, height: 56 },
                { type: 'bush', x: 180, y: 280, width: 50, height: 50 },
                { type: 'bush', x: 560, y: 480, width: 52, height: 52 },
                { type: 'bush', x: 420, y: 620, width: 48, height: 48 },
                { type: 'rock', x: 380, y: 340, width: 55, height: 55 },
                { type: 'rock', x: 200, y: 520, width: 60, height: 60 },
                { type: 'rock', x: 540, y: 200, width: 50, height: 50 },
                { type: 'stoneDebris', x: 300, y: 450, width: 45, height: 45 },
                { type: 'stoneDebris', x: 480, y: 350, width: 40, height: 40 }
            ],
            gatherables: [
                { type: 'herb', x: 380, y: 360, width: 32, height: 32 },
                { type: 'herb', x: 520, y: 280, width: 32, height: 32 },
                { type: 'ore', x: 200, y: 520, width: 40, height: 40 }
            ]
        },

        /** Lumber mill: shed, wood cluster, log pile (barrels), fence, well, rubble. */
        lumberMill: {
            perimeterFence: { spacing: 36, size: 28 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'shed', x: 60, y: 260, width: 240, height: 240 },
                { type: 'tree', x: 325, y: 105, width: 140, height: 140 },
                { type: 'tree', x: 410, y: 170, width: 120, height: 120 },
                { type: 'tree', x: 462, y: 122, width: 150, height: 150 },
                { type: 'tree', x: 262, y: 192, width: 110, height: 110 },
                { type: 'tree', x: 487, y: 227, width: 130, height: 130 },
                { type: 'tree', x: 620, y: 80, width: 100, height: 100 },
                { type: 'bush', x: 280, y: 140, width: 48, height: 48 },
                { type: 'bush', x: 550, y: 240, width: 52, height: 52 },
                { type: 'barrel', x: 190, y: 390, width: 60, height: 60 },
                { type: 'barrel', x: 246, y: 410, width: 56, height: 56 },
                { type: 'barrel', x: 184, y: 464, width: 64, height: 64 },
                { type: 'barrel', x: 258, y: 458, width: 52, height: 52 },
                { type: 'barrel', x: 320, y: 420, width: 58, height: 58 },
                { type: 'barrel', x: 140, y: 520, width: 50, height: 50 },
                { type: 'rock', x: 560, y: 320, width: 80, height: 80 },
                { type: 'rock', x: 600, y: 400, width: 65, height: 65 },
                { type: 'rock', x: 380, y: 520, width: 58, height: 58 },
                { type: 'rubble', x: 320, y: 540, width: 55, height: 55 },
                { type: 'rubble', x: 100, y: 380, width: 50, height: 50 },
                { type: 'stoneDebris', x: 420, y: 480, width: 42, height: 42 },
                { type: 'fence', x: 82, y: 501, width: 36, height: 36 },
                { type: 'fence', x: 121, y: 501, width: 36, height: 36 },
                { type: 'fence', x: 160, y: 501, width: 36, height: 36 },
                { type: 'fence', x: 199, y: 501, width: 36, height: 36 },
                { type: 'fence', x: 40, y: 380, width: 36, height: 36 },
                { type: 'fence', x: 40, y: 418, width: 36, height: 36 },
                { type: 'well', x: 640, y: 560, width: 90, height: 90 }
            ],
            gatherables: [
                { type: 'ore', x: 560, y: 320, width: 40, height: 40 },
                { type: 'chest', x: 220, y: 420, width: 36, height: 36 }
            ]
        },

        /** Goblin camp: central firepit ring, barrels, rocks, rubble, dense cover. Extra pack spawn. */
        goblinCamp: {
            spawn: { type: 'pack', count: 1 },
            perimeterFence: { spacing: 40, size: 26 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'firepit', x: 321, y: 321, width: 76, height: 76 },
                { type: 'rock', x: 282, y: 282, width: 70, height: 70 },
                { type: 'rock', x: 362, y: 279, width: 76, height: 76 },
                { type: 'rock', x: 322, y: 364, width: 64, height: 64 },
                { type: 'rock', x: 400, y: 360, width: 72, height: 72 },
                { type: 'rock', x: 340, y: 268, width: 55, height: 55 },
                { type: 'rock', x: 418, y: 428, width: 58, height: 58 },
                { type: 'barrel', x: 266, y: 386, width: 56, height: 56 },
                { type: 'barrel', x: 435, y: 345, width: 60, height: 60 },
                { type: 'barrel', x: 327, y: 427, width: 52, height: 52 },
                { type: 'barrel', x: 240, y: 340, width: 50, height: 50 },
                { type: 'barrel', x: 460, y: 400, width: 54, height: 54 },
                { type: 'rubble', x: 300, y: 460, width: 52, height: 52 },
                { type: 'rubble', x: 448, y: 280, width: 48, height: 48 },
                { type: 'stoneDebris', x: 360, y: 480, width: 44, height: 44 },
                { type: 'stoneDebris', x: 260, y: 300, width: 40, height: 40 },
                { type: 'tree', x: 130, y: 170, width: 120, height: 120 },
                { type: 'tree', x: 592, y: 492, width: 110, height: 110 },
                { type: 'tree', x: 40, y: 520, width: 95, height: 95 },
                { type: 'tree', x: 665, y: 180, width: 100, height: 100 },
                { type: 'bush', x: 227, y: 347, width: 52, height: 52 },
                { type: 'bush', x: 486, y: 306, width: 56, height: 56 },
                { type: 'bush', x: 180, y: 480, width: 48, height: 48 },
                { type: 'bush', x: 520, y: 420, width: 50, height: 50 },
                { type: 'fence', x: 220, y: 240, width: 36, height: 36 },
                { type: 'fence', x: 256, y: 240, width: 36, height: 36 },
                { type: 'fence', x: 508, y: 540, width: 36, height: 36 },
                { type: 'fence', x: 544, y: 540, width: 36, height: 36 }
            ]
        },

        /** Thick grove: dense trees and bushes, few open paths. Bandits with daggers only (no goblins). */
        thickGrove: {
            spawn: { type: 'pack', count: 1, enemyTypes: ['banditDagger'] },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'tree', x: 40, y: 60, width: 120, height: 120 },
                { type: 'tree', x: 180, y: 40, width: 110, height: 110 },
                { type: 'tree', x: 320, y: 80, width: 130, height: 130 },
                { type: 'tree', x: 480, y: 50, width: 100, height: 100 },
                { type: 'tree', x: 620, y: 100, width: 115, height: 115 },
                { type: 'tree', x: 60, y: 220, width: 105, height: 105 },
                { type: 'tree', x: 250, y: 200, width: 125, height: 125 },
                { type: 'tree', x: 420, y: 240, width: 95, height: 95 },
                { type: 'tree', x: 580, y: 180, width: 110, height: 110 },
                { type: 'tree', x: 140, y: 380, width: 118, height: 118 },
                { type: 'tree', x: 340, y: 360, width: 108, height: 108 },
                { type: 'tree', x: 520, y: 340, width: 98, height: 98 },
                { type: 'tree', x: 80, y: 540, width: 112, height: 112 },
                { type: 'tree', x: 280, y: 520, width: 102, height: 102 },
                { type: 'tree', x: 460, y: 500, width: 116, height: 116 },
                { type: 'tree', x: 640, y: 560, width: 94, height: 94 },
                { type: 'bush', x: 200, y: 320, width: 52, height: 52 },
                { type: 'bush', x: 380, y: 280, width: 48, height: 48 },
                { type: 'bush', x: 550, y: 440, width: 50, height: 50 },
                { type: 'rock', x: 300, y: 450, width: 58, height: 58 },
                { type: 'rock', x: 500, y: 420, width: 55, height: 55 }
            ]
        },

        /** Orchard edge: sparse trees in rows, bushes, well. */
        orchardEdge: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'tree', x: 120, y: 100, width: 100, height: 100 },
                { type: 'tree', x: 340, y: 120, width: 95, height: 95 },
                { type: 'tree', x: 560, y: 90, width: 105, height: 105 },
                { type: 'tree', x: 680, y: 280, width: 98, height: 98 },
                { type: 'tree', x: 80, y: 400, width: 102, height: 102 },
                { type: 'tree', x: 280, y: 420, width: 92, height: 92 },
                { type: 'tree', x: 480, y: 380, width: 108, height: 108 },
                { type: 'tree', x: 640, y: 520, width: 96, height: 96 },
                { type: 'bush', x: 220, y: 320, width: 50, height: 50 },
                { type: 'bush', x: 400, y: 350, width: 48, height: 48 },
                { type: 'bush', x: 580, y: 480, width: 52, height: 52 },
                { type: 'well', x: 380, y: 360, width: 90, height: 90 }
            ]
        },

        /** Crossroads: minimal obstacles, well or rock as landmark. */
        crossroads: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'tree', x: 60, y: 80, width: 90, height: 90 },
                { type: 'tree', x: 660, y: 660, width: 85, height: 85 },
                { type: 'rock', x: 360, y: 360, width: 70, height: 70 },
                { type: 'well', x: 640, y: 80, width: 88, height: 88 }
            ]
        },

        /** Small farm: shed, well, fence pen, barrels, bushes (garden), a couple trees. Bandits with daggers only (no goblins). */
        smallFarm: {
            spawn: { type: 'pack', count: 1, enemyTypes: ['banditDagger'] },
            perimeterFence: { spacing: 36, size: 28 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'shed', x: 80, y: 280, width: 180, height: 180 },
                { type: 'well', x: 520, y: 320, width: 88, height: 88 },
                { type: 'barrel', x: 300, y: 420, width: 52, height: 52 },
                { type: 'barrel', x: 340, y: 440, width: 48, height: 48 },
                { type: 'barrel', x: 440, y: 520, width: 50, height: 50 },
                { type: 'fence', x: 280, y: 220, width: 36, height: 36 },
                { type: 'fence', x: 316, y: 220, width: 36, height: 36 },
                { type: 'fence', x: 352, y: 220, width: 36, height: 36 },
                { type: 'fence', x: 388, y: 220, width: 36, height: 36 },
                { type: 'fence', x: 280, y: 400, width: 36, height: 36 },
                { type: 'fence', x: 316, y: 400, width: 36, height: 36 },
                { type: 'fence', x: 352, y: 400, width: 36, height: 36 },
                { type: 'bush', x: 320, y: 320, width: 52, height: 52 },
                { type: 'bush', x: 400, y: 340, width: 48, height: 48 },
                { type: 'bush', x: 360, y: 380, width: 50, height: 50 },
                { type: 'bush', x: 480, y: 440, width: 48, height: 48 },
                { type: 'rock', x: 240, y: 480, width: 58, height: 58 },
                { type: 'rock', x: 600, y: 480, width: 55, height: 55 },
                { type: 'tree', x: 40, y: 120, width: 100, height: 100 },
                { type: 'tree', x: 660, y: 120, width: 95, height: 95 }
            ]
        },

        /** Bandit ambush: rocks and trees for cover, firepit, barrels. Bandits with daggers only (no goblins). */
        banditAmbush: {
            spawn: { type: 'pack', count: 1, enemyTypes: ['banditDagger'] },
            perimeterFence: { spacing: 38, size: 26 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'firepit', x: 340, y: 320, width: 70, height: 70 },
                { type: 'rock', x: 260, y: 260, width: 75, height: 75 },
                { type: 'rock', x: 420, y: 270, width: 68, height: 68 },
                { type: 'rock', x: 300, y: 420, width: 72, height: 72 },
                { type: 'rock', x: 430, y: 400, width: 65, height: 65 },
                { type: 'barrel', x: 240, y: 380, width: 55, height: 55 },
                { type: 'barrel', x: 480, y: 350, width: 52, height: 52 },
                { type: 'tree', x: 80, y: 180, width: 115, height: 115 },
                { type: 'tree', x: 620, y: 500, width: 108, height: 108 },
                { type: 'tree', x: 160, y: 560, width: 100, height: 100 },
                { type: 'tree', x: 660, y: 120, width: 95, height: 95 },
                { type: 'bush', x: 350, y: 480, width: 50, height: 50 },
                { type: 'bush', x: 420, y: 180, width: 48, height: 48 }
            ]
        },

        /** Goblin camp variant B: different layout, same spawn. */
        goblinCampB: {
            spawn: { type: 'pack', count: 1 },
            perimeterFence: { spacing: 40, size: 26 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'firepit', x: 300, y: 350, width: 76, height: 76 },
                { type: 'rock', x: 240, y: 290, width: 65, height: 65 },
                { type: 'rock', x: 380, y: 280, width: 70, height: 70 },
                { type: 'rock', x: 320, y: 420, width: 60, height: 60 },
                { type: 'barrel', x: 200, y: 360, width: 54, height: 54 },
                { type: 'barrel', x: 420, y: 380, width: 58, height: 58 },
                { type: 'rubble', x: 260, y: 440, width: 50, height: 50 },
                { type: 'tree', x: 50, y: 150, width: 118, height: 118 },
                { type: 'tree', x: 600, y: 480, width: 112, height: 112 },
                { type: 'tree', x: 700, y: 200, width: 95, height: 95 },
                { type: 'bush', x: 180, y: 480, width: 50, height: 50 },
                { type: 'bush', x: 500, y: 300, width: 52, height: 52 },
                { type: 'fence', x: 240, y: 220, width: 36, height: 36 },
                { type: 'fence', x: 276, y: 220, width: 36, height: 36 }
            ]
        },

        /** Lumber mill variant B: second shed position, more barrels. */
        lumberMillB: {
            perimeterFence: { spacing: 36, size: 28 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'shed', x: 480, y: 240, width: 220, height: 220 },
                { type: 'tree', x: 120, y: 100, width: 130, height: 130 },
                { type: 'tree', x: 260, y: 160, width: 110, height: 110 },
                { type: 'tree', x: 80, y: 320, width: 100, height: 100 },
                { type: 'tree', x: 620, y: 380, width: 115, height: 115 },
                { type: 'barrel', x: 280, y: 420, width: 58, height: 58 },
                { type: 'barrel', x: 320, y: 450, width: 52, height: 52 },
                { type: 'barrel', x: 360, y: 420, width: 56, height: 56 },
                { type: 'barrel', x: 200, y: 500, width: 50, height: 50 },
                { type: 'rock', x: 140, y: 480, width: 62, height: 62 },
                { type: 'fence', x: 460, y: 500, width: 36, height: 36 },
                { type: 'fence', x: 496, y: 500, width: 36, height: 36 },
                { type: 'fence', x: 532, y: 500, width: 36, height: 36 },
                { type: 'well', x: 100, y: 560, width: 88, height: 88 }
            ]
        },

        /** Woodcutter's clearing: shed, stump cluster (rocks + rubble), tool barrels, tree perimeter. */
        woodcutterClearing: {
            perimeterFence: true,
            width: 800,
            height: 800,
            obstacles: [
                { type: 'shed', x: 290, y: 270, width: 200, height: 200 },
                { type: 'rock', x: 262, y: 422, width: 70, height: 70 },
                { type: 'rock', x: 304, y: 444, width: 64, height: 64 },
                { type: 'rock', x: 381, y: 431, width: 76, height: 76 },
                { type: 'rock', x: 330, y: 490, width: 58, height: 58 },
                { type: 'rock', x: 240, y: 400, width: 62, height: 62 },
                { type: 'rubble', x: 358, y: 460, width: 55, height: 55 },
                { type: 'rubble', x: 420, y: 400, width: 50, height: 50 },
                { type: 'stoneDebris', x: 280, y: 360, width: 45, height: 45 },
                { type: 'stoneDebris', x: 450, y: 470, width: 42, height: 42 },
                { type: 'barrel', x: 380, y: 320, width: 52, height: 52 },
                { type: 'barrel', x: 420, y: 340, width: 48, height: 48 },
                { type: 'barrel', x: 260, y: 320, width: 56, height: 56 },
                { type: 'tree', x: 87, y: 147, width: 130, height: 130 },
                { type: 'tree', x: 611, y: 111, width: 116, height: 116 },
                { type: 'tree', x: 49, y: 569, width: 124, height: 124 },
                { type: 'tree', x: 652, y: 592, width: 110, height: 110 },
                { type: 'tree', x: 200, y: 80, width: 95, height: 95 },
                { type: 'tree', x: 520, y: 600, width: 100, height: 100 },
                { type: 'bush', x: 140, y: 400, width: 50, height: 50 },
                { type: 'bush', x: 600, y: 350, width: 48, height: 48 },
                { type: 'fence', x: 300, y: 230, width: 36, height: 36 },
                { type: 'fence', x: 336, y: 230, width: 36, height: 36 }
            ]
        },

        /** Wayside shrine: pillar, statue, offering rocks, rubble, columns, tree canopy. */
        waysideShrine: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'pillar', x: 337, y: 317, width: 90, height: 90 },
                { type: 'statueBase', x: 347, y: 375, width: 100, height: 100 },
                { type: 'column', x: 300, y: 340, width: 60, height: 60 },
                { type: 'column', x: 454, y: 338, width: 58, height: 58 },
                { type: 'rock', x: 305, y: 365, width: 60, height: 60 },
                { type: 'rock', x: 434, y: 354, width: 64, height: 64 },
                { type: 'rock', x: 370, y: 490, width: 55, height: 55 },
                { type: 'rock', x: 380, y: 268, width: 50, height: 50 },
                { type: 'rubble', x: 260, y: 400, width: 52, height: 52 },
                { type: 'rubble', x: 478, y: 418, width: 48, height: 48 },
                { type: 'stoneDebris', x: 320, y: 450, width: 42, height: 42 },
                { type: 'stoneDebris', x: 450, y: 370, width: 40, height: 40 },
                { type: 'tree', x: 170, y: 170, width: 120, height: 120 },
                { type: 'tree', x: 531, y: 491, width: 116, height: 116 },
                { type: 'tree', x: 80, y: 400, width: 90, height: 90 },
                { type: 'tree', x: 630, y: 250, width: 95, height: 95 },
                { type: 'bush', x: 240, y: 300, width: 50, height: 50 },
                { type: 'bush', x: 510, y: 520, width: 48, height: 48 }
            ],
            gatherables: [
                { type: 'shrineBlessing', x: 370, y: 400, width: 48, height: 48 },
                { type: 'herb', x: 320, y: 450, width: 32, height: 32 },
                { type: 'herb', x: 450, y: 370, width: 32, height: 32 }
            ]
        }
};
