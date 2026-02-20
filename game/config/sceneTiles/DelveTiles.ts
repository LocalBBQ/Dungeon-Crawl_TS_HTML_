/**
 * Delve-only scene tiles: 1x1 dirt underground environment.
 * Single tile fills the floor (1200x1200). Attached as SceneTiles.delve.
 */
export const SceneTilesDelve: Record<string, { width: number; height: number; obstacles?: unknown[]; spawn?: { type: string; count?: number }; [key: string]: unknown }> = {
  /** Single dirt cavern: earth, rocks, roots. No perimeter; open underground feel. */
  dirt: {
    width: 1200,
    height: 1200,
    obstacles: [
      { type: 'rock', x: 180, y: 220, width: 56, height: 52 },
      { type: 'rock', x: 920, y: 180, width: 48, height: 50 },
      { type: 'rock', x: 160, y: 880, width: 52, height: 48 },
      { type: 'rock', x: 940, y: 900, width: 50, height: 54 },
      { type: 'rubble', x: 380, y: 320, width: 44, height: 44 },
      { type: 'rubble', x: 780, y: 380, width: 46, height: 46 },
      { type: 'rubble', x: 340, y: 760, width: 42, height: 42 },
      { type: 'rubble', x: 820, y: 720, width: 48, height: 48 },
      { type: 'stoneDebris', x: 520, y: 280, width: 38, height: 38 },
      { type: 'stoneDebris', x: 640, y: 880, width: 40, height: 40 },
      { type: 'stoneDebris', x: 280, y: 520, width: 36, height: 36 },
      { type: 'stoneDebris', x: 900, y: 540, width: 42, height: 42 },
    ],
    spawn: { type: 'pack', count: 1 },
  },
};
