/**
 * Elder Woods biome scene tiles. Village outskirts theme with massive ancient tree trunks.
 * Design space 0..800; positions/sizes scaled to tileSize at placement.
 * Attached as SceneTiles.elderWoods.
 */
export const SceneTilesElderWoods: Record<string, { width: number; height: number; obstacles?: unknown[]; gatherables?: unknown[]; perimeterFence?: unknown; spawn?: unknown; [key: string]: unknown }> = {
  /** Clearing: one massive trunk, normal trees, bushes, rocks. */
  clearing: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 380, y: 320, width: 280, height: 280 },
      { type: 'tree', x: 52, y: 92, width: 73, height: 73 },
      { type: 'tree', x: 618, y: 58, width: 87, height: 87 },
      { type: 'tree', x: 80, y: 380, width: 67, height: 67 },
      { type: 'tree', x: 640, y: 400, width: 63, height: 63 },
      { type: 'bush', x: 248, y: 235, width: 37, height: 37 },
      { type: 'bush', x: 373, y: 413, width: 35, height: 35 },
      { type: 'rock', x: 253, y: 227, width: 37, height: 37 },
      { type: 'rock', x: 360, y: 453, width: 40, height: 40 },
      { type: 'stoneDebris', x: 200, y: 300, width: 30, height: 30 },
    ],
    gatherables: [
      { type: 'herb', x: 253, y: 240, width: 32, height: 32 },
      { type: 'herb', x: 347, y: 413, width: 32, height: 32 },
    ],
  },

  /** Giant trunk grove: several massive trunks, sparse undergrowth. */
  giantTrunkGrove: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 80, y: 100, width: 260, height: 260 },
      { type: 'elderTrunk', x: 460, y: 80, width: 240, height: 240 },
      { type: 'elderTrunk', x: 120, y: 440, width: 220, height: 220 },
      { type: 'elderTrunk', x: 500, y: 460, width: 250, height: 250 },
      { type: 'tree', x: 360, y: 340, width: 70, height: 70 },
      { type: 'bush', x: 300, y: 200, width: 35, height: 35 },
      { type: 'bush', x: 520, y: 360, width: 33, height: 33 },
      { type: 'rock', x: 200, y: 360, width: 40, height: 40 },
    ],
    gatherables: [
      { type: 'herb', x: 360, y: 347, width: 32, height: 32 },
    ],
  },

  /** Path between trunks: two big trunks with open path, well. */
  pathBetweenTrunks: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 60, y: 200, width: 270, height: 270 },
      { type: 'elderTrunk', x: 470, y: 330, width: 260, height: 260 },
      { type: 'well', x: 427, y: 427, width: 60, height: 60 },
      { type: 'tree', x: 320, y: 120, width: 65, height: 65 },
      { type: 'tree', x: 680, y: 560, width: 68, height: 68 },
      { type: 'bush', x: 340, y: 340, width: 34, height: 34 },
      { type: 'rock', x: 700, y: 200, width: 38, height: 38 },
    ],
    gatherables: [
      { type: 'herb', x: 427, y: 360, width: 32, height: 32 },
    ],
  },

  /** Outskirts camp: shed, barrels, fence, one massive trunk in the back. */
  outskirtsCamp: {
    perimeterFence: { spacing: 36, size: 28 },
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 480, y: 60, width: 250, height: 250 },
      { type: 'shed', x: 40, y: 173, width: 160, height: 160 },
      { type: 'tree', x: 220, y: 80, width: 93, height: 93 },
      { type: 'tree', x: 120, y: 380, width: 67, height: 67 },
      { type: 'barrel', x: 127, y: 260, width: 40, height: 40 },
      { type: 'barrel', x: 173, y: 273, width: 37, height: 37 },
      { type: 'barrel', x: 123, y: 309, width: 43, height: 43 },
      { type: 'rock', x: 373, y: 347, width: 53, height: 53 },
      { type: 'fence', x: 55, y: 334, width: 36, height: 36 },
      { type: 'fence', x: 81, y: 334, width: 36, height: 36 },
      { type: 'fence', x: 40, y: 253, width: 36, height: 36 },
      { type: 'fence', x: 40, y: 279, width: 36, height: 36 },
    ],
    gatherables: [
      { type: 'chest', x: 147, y: 280, width: 36, height: 36 },
    ],
  },

  /** Crossroads: minimal obstacles, one elder trunk as landmark. */
  crossroads: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 260, y: 260, width: 280, height: 280 },
      { type: 'tree', x: 40, y: 53, width: 60, height: 60 },
      { type: 'tree', x: 440, y: 587, width: 57, height: 57 },
      { type: 'well', x: 427, y: 53, width: 59, height: 59 },
    ],
  },

  /** Orchard edge: sparse trees, bushes, one massive trunk. */
  orchardEdge: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 520, y: 60, width: 240, height: 240 },
      { type: 'tree', x: 80, y: 67, width: 67, height: 67 },
      { type: 'tree', x: 227, y: 80, width: 63, height: 63 },
      { type: 'tree', x: 373, y: 60, width: 72, height: 72 },
      { type: 'tree', x: 453, y: 187, width: 65, height: 65 },
      { type: 'tree', x: 53, y: 267, width: 68, height: 68 },
      { type: 'tree', x: 187, y: 280, width: 61, height: 61 },
      { type: 'tree', x: 320, y: 253, width: 72, height: 72 },
      { type: 'bush', x: 147, y: 213, width: 33, height: 33 },
      { type: 'bush', x: 267, y: 347, width: 32, height: 32 },
      { type: 'well', x: 253, y: 360, width: 60, height: 60 },
    ],
    gatherables: [
      { type: 'herb', x: 267, y: 360, width: 32, height: 32 },
    ],
  },

  /** Wayside shrine: pillar, statue, offering rocks, one elder trunk. */
  waysideShrine: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 40, y: 440, width: 230, height: 230 },
      { type: 'pillar', x: 225, y: 211, width: 60, height: 60 },
      { type: 'statueBase', x: 231, y: 250, width: 67, height: 67 },
      { type: 'column', x: 200, y: 227, width: 40, height: 40 },
      { type: 'column', x: 303, y: 225, width: 39, height: 39 },
      { type: 'rock', x: 203, y: 243, width: 40, height: 40 },
      { type: 'rock', x: 289, y: 236, width: 43, height: 43 },
      { type: 'rubble', x: 173, y: 267, width: 35, height: 35 },
      { type: 'tree', x: 113, y: 140, width: 80, height: 80 },
      { type: 'tree', x: 354, y: 327, width: 77, height: 77 },
      { type: 'bush', x: 160, y: 200, width: 33, height: 33 },
    ],
    gatherables: [
      { type: 'shrineBlessing', x: 247, y: 267, width: 48, height: 48 },
      { type: 'herb', x: 213, y: 300, width: 32, height: 32 },
    ],
  },

  /** Bandit ambush: rocks and trees for cover, firepit, one massive trunk. Pack spawn. */
  banditAmbush: {
    spawn: { type: 'pack', count: 1, enemyTypes: ['banditDagger'] },
    perimeterFence: { spacing: 38, size: 26 },
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 520, y: 480, width: 250, height: 250 },
      { type: 'firepit', x: 227, y: 213, width: 47, height: 47 },
      { type: 'rock', x: 173, y: 173, width: 50, height: 50 },
      { type: 'rock', x: 280, y: 180, width: 45, height: 45 },
      { type: 'rock', x: 200, y: 280, width: 48, height: 48 },
      { type: 'barrel', x: 160, y: 253, width: 37, height: 37 },
      { type: 'barrel', x: 320, y: 233, width: 35, height: 35 },
      { type: 'tree', x: 53, y: 120, width: 77, height: 77 },
      { type: 'tree', x: 413, y: 333, width: 72, height: 72 },
      { type: 'bush', x: 233, y: 320, width: 33, height: 33 },
    ],
  },

  /** Woodcutter's clearing: shed, stump cluster, barrels, elder trunk perimeter. */
  woodcutterClearing: {
    perimeterFence: true,
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'elderTrunk', x: 60, y: 98, width: 260, height: 260 },
      { type: 'elderTrunk', x: 480, y: 74, width: 240, height: 240 },
      { type: 'shed', x: 193, y: 180, width: 133, height: 133 },
      { type: 'rock', x: 175, y: 281, width: 47, height: 47 },
      { type: 'rock', x: 203, y: 296, width: 43, height: 43 },
      { type: 'rock', x: 254, y: 287, width: 51, height: 51 },
      { type: 'rubble', x: 239, y: 307, width: 37, height: 37 },
      { type: 'barrel', x: 253, y: 213, width: 35, height: 35 },
      { type: 'barrel', x: 280, y: 227, width: 32, height: 32 },
      { type: 'tree', x: 133, y: 373, width: 83, height: 83 },
      { type: 'tree', x: 435, y: 395, width: 73, height: 73 },
      { type: 'bush', x: 93, y: 267, width: 33, height: 33 },
      { type: 'fence', x: 200, y: 153, width: 36, height: 36 },
      { type: 'fence', x: 224, y: 153, width: 36, height: 36 },
    ],
  },
};
