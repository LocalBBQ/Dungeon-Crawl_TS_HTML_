/**
 * Cursed Wilds biome scene tiles (level 2).
 * Dark, corrupted: mushrooms, graves, swamp pools, ruins.
 * Attached as SceneTiles.cursedWilds.
 */
export const SceneTilesCursedWilds: Record<string, { width: number; height: number; obstacles?: unknown[]; gatherables?: unknown[]; [key: string]: unknown }> = {
        /** Clearing: sparse mushrooms, a few dark rocks, one swamp pool at edge. */
        clearing: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'mushroom', x: 120, y: 140, width: 50, height: 50 },
                { type: 'mushroom', x: 620, y: 180, width: 55, height: 55 },
                { type: 'mushroom', x: 380, y: 380, width: 48, height: 48 },
                { type: 'mushroom', x: 260, y: 520, width: 52, height: 52 },
                { type: 'mushroom', x: 540, y: 480, width: 45, height: 45 },
                { type: 'rock', x: 340, y: 320, width: 60, height: 60 },
                { type: 'rock', x: 180, y: 440, width: 55, height: 55 },
                { type: 'rock', x: 580, y: 300, width: 50, height: 50 },
                { type: 'swampPool', x: 640, y: 580, width: 90, height: 70 }
            ],
            gatherables: [
                { type: 'herb', x: 380, y: 380, width: 32, height: 32 },
                { type: 'ore', x: 340, y: 320, width: 40, height: 40 }
            ]
        },

        /** Crossroads: minimal obstacles, one central grave or dark rock as landmark. */
        crossroads: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'grave', x: 355, y: 355, width: 50, height: 60 },
                { type: 'mushroom', x: 80, y: 100, width: 45, height: 45 },
                { type: 'mushroom', x: 660, y: 640, width: 48, height: 48 },
                { type: 'rock', x: 620, y: 80, width: 55, height: 55 }
            ]
        },

        /** Graveyard: many graves, broken pillar, statue base, rubble. Black iron perimeter fence. Pack spawn. */
        graveyard: {
            spawn: { type: 'pack', count: 1 },
            perimeterFence: { type: 'ironFence', spacing: 38, size: 22 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'grave', x: 280, y: 300, width: 48, height: 58 },
                { type: 'grave', x: 340, y: 310, width: 52, height: 56 },
                { type: 'grave', x: 400, y: 295, width: 46, height: 60 },
                { type: 'grave', x: 460, y: 305, width: 50, height: 54 },
                { type: 'grave', x: 310, y: 380, width: 48, height: 58 },
                { type: 'grave', x: 370, y: 390, width: 44, height: 56 },
                { type: 'grave', x: 430, y: 375, width: 50, height: 58 },
                { type: 'brokenPillar', x: 350, y: 250, width: 55, height: 70 },
                { type: 'statueBase', x: 330, y: 440, width: 90, height: 90 },
                { type: 'rubble', x: 260, y: 350, width: 50, height: 50 },
                { type: 'rubble', x: 480, y: 420, width: 48, height: 48 },
                { type: 'mushroom', x: 240, y: 260, width: 52, height: 52 },
                { type: 'mushroom', x: 520, y: 460, width: 46, height: 46 },
                { type: 'rock', x: 200, y: 420, width: 58, height: 58 },
                { type: 'rock', x: 550, y: 340, width: 54, height: 54 }
            ]
        },

        /** Graveyard variant B: different layout, same spawn. Black iron perimeter fence. */
        graveyardB: {
            spawn: { type: 'pack', count: 1 },
            perimeterFence: { type: 'ironFence', spacing: 38, size: 22 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'grave', x: 300, y: 340, width: 50, height: 58 },
                { type: 'grave', x: 360, y: 350, width: 46, height: 56 },
                { type: 'grave', x: 420, y: 335, width: 52, height: 60 },
                { type: 'grave', x: 320, y: 420, width: 48, height: 54 },
                { type: 'grave', x: 380, y: 430, width: 50, height: 58 },
                { type: 'grave', x: 440, y: 415, width: 44, height: 56 },
                { type: 'pillar', x: 360, y: 260, width: 50, height: 65 },
                { type: 'rubble', x: 270, y: 400, width: 52, height: 52 },
                { type: 'rubble', x: 470, y: 380, width: 48, height: 48 },
                { type: 'stoneDebris', x: 340, y: 470, width: 40, height: 40 },
                { type: 'mushroom', x: 220, y: 300, width: 50, height: 50 },
                { type: 'mushroom', x: 530, y: 400, width: 48, height: 48 },
                { type: 'rock', x: 180, y: 360, width: 60, height: 60 },
                { type: 'rock', x: 560, y: 280, width: 56, height: 56 }
            ]
        },

        /** Skeleton camp: firepit, graves, rubble, mushrooms. Pack spawn. */
        skeletonCamp: {
            spawn: { type: 'pack', count: 1 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'firepit', x: 335, y: 325, width: 70, height: 70 },
                { type: 'grave', x: 260, y: 350, width: 48, height: 56 },
                { type: 'grave', x: 430, y: 340, width: 50, height: 58 },
                { type: 'grave', x: 350, y: 420, width: 46, height: 54 },
                { type: 'rubble', x: 290, y: 400, width: 52, height: 52 },
                { type: 'rubble', x: 420, y: 410, width: 48, height: 48 },
                { type: 'stoneDebris', x: 320, y: 270, width: 42, height: 42 },
                { type: 'mushroom', x: 240, y: 300, width: 54, height: 54 },
                { type: 'mushroom', x: 460, y: 380, width: 50, height: 50 },
                { type: 'rock', x: 200, y: 450, width: 58, height: 58 },
                { type: 'rock', x: 520, y: 280, width: 55, height: 55 }
            ]
        },

        /** Swamp edge: 2–3 swamp pools, mushrooms, dark rocks. */
        swampEdge: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'swampPool', x: 100, y: 320, width: 100, height: 75 },
                { type: 'swampPool', x: 580, y: 480, width: 90, height: 70 },
                { type: 'swampPool', x: 340, y: 600, width: 85, height: 68 },
                { type: 'mushroom', x: 180, y: 280, width: 52, height: 52 },
                { type: 'mushroom', x: 500, y: 420, width: 48, height: 48 },
                { type: 'mushroom', x: 380, y: 520, width: 55, height: 55 },
                { type: 'rock', x: 260, y: 380, width: 62, height: 62 },
                { type: 'rock', x: 520, y: 340, width: 58, height: 58 },
                { type: 'rock', x: 300, y: 480, width: 55, height: 55 }
            ]
        },

        /** Ruined shrine: pillar, columns, statue base, rubble, mushrooms. */
        ruinedShrine: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'pillar', x: 350, y: 320, width: 85, height: 85 },
                { type: 'statueBase', x: 340, y: 400, width: 95, height: 95 },
                { type: 'column', x: 295, y: 350, width: 58, height: 58 },
                { type: 'column', x: 450, y: 348, width: 56, height: 56 },
                { type: 'rubble', x: 270, y: 420, width: 50, height: 50 },
                { type: 'rubble', x: 465, y: 400, width: 48, height: 48 },
                { type: 'stoneDebris', x: 330, y: 460, width: 42, height: 42 },
                { type: 'stoneDebris', x: 440, y: 370, width: 40, height: 40 },
                { type: 'mushroom', x: 200, y: 340, width: 52, height: 52 },
                { type: 'mushroom', x: 530, y: 450, width: 48, height: 48 },
                { type: 'grave', x: 380, y: 270, width: 46, height: 56 },
                { type: 'rock', x: 220, y: 480, width: 58, height: 58 }
            ]
        },

        /** Thick mushroom grove: dense mushrooms and rocks, few open paths. Pack spawn. */
        thickMushroomGrove: {
            spawn: { type: 'pack', count: 1 },
            width: 800,
            height: 800,
            obstacles: [
                { type: 'mushroom', x: 50, y: 60, width: 55, height: 55 },
                { type: 'mushroom', x: 180, y: 50, width: 52, height: 52 },
                { type: 'mushroom', x: 320, y: 90, width: 58, height: 58 },
                { type: 'mushroom', x: 480, y: 40, width: 50, height: 50 },
                { type: 'mushroom', x: 620, y: 100, width: 54, height: 54 },
                { type: 'mushroom', x: 70, y: 220, width: 48, height: 48 },
                { type: 'mushroom', x: 250, y: 200, width: 56, height: 56 },
                { type: 'mushroom', x: 420, y: 240, width: 52, height: 52 },
                { type: 'mushroom', x: 580, y: 190, width: 50, height: 50 },
                { type: 'mushroom', x: 140, y: 380, width: 54, height: 54 },
                { type: 'mushroom', x: 340, y: 360, width: 48, height: 48 },
                { type: 'mushroom', x: 520, y: 340, width: 56, height: 56 },
                { type: 'mushroom', x: 80, y: 540, width: 52, height: 52 },
                { type: 'mushroom', x: 280, y: 520, width: 50, height: 50 },
                { type: 'mushroom', x: 460, y: 500, width: 54, height: 54 },
                { type: 'mushroom', x: 640, y: 560, width: 48, height: 48 },
                { type: 'rock', x: 300, y: 450, width: 60, height: 60 },
                { type: 'rock', x: 500, y: 420, width: 58, height: 58 },
                { type: 'rock', x: 200, y: 320, width: 55, height: 55 }
            ],
            gatherables: [
                { type: 'shrineBlessing', x: 360, y: 400, width: 48, height: 48 },
                { type: 'herb', x: 340, y: 360, width: 32, height: 32 }
            ]
        },

        /** Bog clearing: one central swamp pool, ring of mushrooms and rocks, firepit. */
        bogClearing: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'swampPool', x: 340, y: 330, width: 95, height: 72 },
                { type: 'firepit', x: 360, y: 260, width: 65, height: 65 },
                { type: 'mushroom', x: 200, y: 320, width: 52, height: 52 },
                { type: 'mushroom', x: 520, y: 340, width: 48, height: 48 },
                { type: 'mushroom', x: 350, y: 460, width: 50, height: 50 },
                { type: 'mushroom', x: 260, y: 200, width: 54, height: 54 },
                { type: 'mushroom', x: 500, y: 480, width: 46, height: 46 },
                { type: 'rock', x: 140, y: 400, width: 62, height: 62 },
                { type: 'rock', x: 600, y: 380, width: 58, height: 58 },
                { type: 'rock', x: 380, y: 560, width: 55, height: 55 }
            ]
        },

        /** Ruin fragment: crumbling wall, rubble, broken pillar, mushrooms. */
        ruinFragment: {
            width: 800,
            height: 800,
            obstacles: [
                { type: 'rubble', x: 280, y: 300, width: 120, height: 80 },
                { type: 'brokenPillar', x: 320, y: 400, width: 60, height: 75 },
                { type: 'rubble', x: 420, y: 420, width: 90, height: 70 },
                { type: 'stoneDebris', x: 260, y: 380, width: 42, height: 42 },
                { type: 'stoneDebris', x: 450, y: 350, width: 40, height: 40 },
                { type: 'mushroom', x: 240, y: 320, width: 52, height: 52 },
                { type: 'mushroom', x: 500, y: 450, width: 48, height: 48 },
                { type: 'grave', x: 350, y: 500, width: 46, height: 56 },
                { type: 'rock', x: 180, y: 440, width: 58, height: 58 },
                { type: 'rock', x: 560, y: 300, width: 55, height: 55 }
            ],
            gatherables: [
                { type: 'ore', x: 320, y: 400, width: 40, height: 40 },
                { type: 'herb', x: 450, y: 350, width: 32, height: 32 }
            ]
        }
};
