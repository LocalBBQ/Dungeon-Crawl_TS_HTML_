/**
 * Underground dungeon scene tiles for the Delve (2x2 floor layout).
 * Dark stone, braziers, pillars, rubble. Attached as SceneTiles.dungeon.
 */
export const SceneTilesDungeon: Record<string, { width: number; height: number; obstacles?: unknown[]; perimeterWall?: unknown; spawn?: { type: string; count?: number }; [key: string]: unknown }> = {
  /** Open chamber: pillars and braziers. */
  chamber: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'column', x: 320, y: 320, width: 48, height: 48 },
      { type: 'column', x: 832, y: 318, width: 50, height: 50 },
      { type: 'column', x: 318, y: 832, width: 48, height: 48 },
      { type: 'column', x: 830, y: 830, width: 50, height: 50 },
      { type: 'brazier', x: 560, y: 360, width: 44, height: 44 },
      { type: 'brazier', x: 596, y: 796, width: 42, height: 42 },
      { type: 'rubble', x: 420, y: 520, width: 46, height: 46 },
      { type: 'stoneDebris', x: 720, y: 420, width: 38, height: 38 },
    ],
    spawn: { type: 'pack', count: 1 },
  },

  /** Corridor junction: walls and braziers. */
  corridor: {
    width: 1200,
    height: 1200,
    perimeterWall: { type: 'crumblingWall', spacing: 28, size: 24, gapSegments: 4 },
    obstacles: [
      { type: 'crumblingWall', x: 340, y: 340, width: 120, height: 24 },
      { type: 'crumblingWall', x: 736, y: 836, width: 120, height: 24 },
      { type: 'brazier', x: 568, y: 568, width: 46, height: 46 },
      { type: 'barrel', x: 380, y: 520, width: 52, height: 52 },
      { type: 'barrel', x: 768, y: 620, width: 50, height: 50 },
      { type: 'rubble', x: 520, y: 400, width: 44, height: 44 },
    ],
    spawn: { type: 'pack', count: 1 },
  },

  /** Crypt: columns and braziers. */
  crypt: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'column', x: 280, y: 360, width: 50, height: 50 },
      { type: 'column', x: 868, y: 358, width: 48, height: 48 },
      { type: 'column', x: 574, y: 574, width: 52, height: 52 },
      { type: 'brazier', x: 400, y: 400, width: 44, height: 44 },
      { type: 'brazier', x: 756, y: 756, width: 42, height: 42 },
      { type: 'brazier', x: 400, y: 756, width: 44, height: 44 },
      { type: 'brazier', x: 756, y: 400, width: 42, height: 42 },
      { type: 'rubble', x: 520, y: 520, width: 48, height: 48 },
      { type: 'stoneDebris', x: 620, y: 380, width: 40, height: 40 },
    ],
    spawn: { type: 'pack', count: 1 },
  },

  /** Pit room: crumbled perimeter, central braziers. */
  pit: {
    width: 1200,
    height: 1200,
    perimeterWall: { type: 'crumblingWall', spacing: 24, size: 24, gapSegments: 6 },
    obstacles: [
      { type: 'brazier', x: 520, y: 360, width: 46, height: 46 },
      { type: 'brazier', x: 634, y: 360, width: 44, height: 44 },
      { type: 'brazier', x: 520, y: 794, width: 46, height: 46 },
      { type: 'brazier', x: 634, y: 794, width: 44, height: 44 },
      { type: 'rubble', x: 400, y: 560, width: 50, height: 50 },
      { type: 'rubble', x: 750, y: 620, width: 46, height: 46 },
      { type: 'crumblingWall', x: 360, y: 560, width: 200, height: 24 },
      { type: 'stoneDebris', x: 577, y: 577, width: 42, height: 42 },
    ],
    spawn: { type: 'pack', count: 1 },
  },

  /** Shrine: pillars and central brazier. */
  shrine: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'column', x: 360, y: 340, width: 48, height: 48 },
      { type: 'column', x: 792, y: 338, width: 50, height: 50 },
      { type: 'column', x: 358, y: 812, width: 48, height: 48 },
      { type: 'column', x: 790, y: 810, width: 50, height: 50 },
      { type: 'brazier', x: 562, y: 562, width: 48, height: 48 },
      { type: 'rubble', x: 480, y: 480, width: 44, height: 44 },
      { type: 'rubble', x: 676, y: 676, width: 44, height: 44 },
      { type: 'stoneDebris', x: 576, y: 400, width: 38, height: 38 },
    ],
    spawn: { type: 'pack', count: 1 },
  },

  /** Dragon arena: open floor, braziers and pillars, no pack spawn (boss spawned by level). */
  dragonArena: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'column', x: 280, y: 320, width: 50, height: 50 },
      { type: 'column', x: 868, y: 320, width: 50, height: 50 },
      { type: 'column', x: 280, y: 828, width: 50, height: 50 },
      { type: 'column', x: 868, y: 828, width: 50, height: 50 },
      { type: 'brazier', x: 520, y: 340, width: 46, height: 46 },
      { type: 'brazier', x: 634, y: 340, width: 44, height: 44 },
      { type: 'brazier', x: 520, y: 808, width: 46, height: 46 },
      { type: 'brazier', x: 634, y: 808, width: 44, height: 44 },
    ],
  },

  /** Vault: solid perimeter with gaps, barrels and braziers. */
  vault: {
    width: 1200,
    height: 1200,
    perimeterWall: { spacing: 22, size: 22, gapSegments: 4 },
    obstacles: [
      { type: 'barrel', x: 340, y: 380, width: 54, height: 54 },
      { type: 'barrel', x: 806, y: 384, width: 52, height: 52 },
      { type: 'barrel', x: 338, y: 766, width: 54, height: 54 },
      { type: 'barrel', x: 804, y: 770, width: 52, height: 52 },
      { type: 'brazier', x: 568, y: 568, width: 46, height: 46 },
      { type: 'rubble', x: 460, y: 540, width: 48, height: 48 },
      { type: 'rubble', x: 692, y: 620, width: 46, height: 46 },
      { type: 'column', x: 574, y: 340, width: 50, height: 50 },
      { type: 'column', x: 574, y: 810, width: 50, height: 50 },
    ],
    spawn: { type: 'pack', count: 1 },
  },
};
