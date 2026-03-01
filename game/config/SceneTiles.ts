/**
 * Scene tile registry for chunk-based level assembly.
 * Biomes from game/config/sceneTiles/*.
 * getTile(tileId) supports namespaced ids (theme.tileName) or bare id (resolves against forest).
 */
import { SceneTilesForest } from './sceneTiles/ForestTiles.js';
import { SceneTilesCursedWilds } from './sceneTiles/CursedWildsTiles.js';
import { SceneTilesDemonApproach } from './sceneTiles/DemonApproachTiles.js';
import { SceneTilesFort } from './sceneTiles/FortTiles.js';
import { SceneTilesDungeon } from './sceneTiles/DungeonTiles.js';
import { SceneTilesDelve } from './sceneTiles/DelveTiles.js';
import { SceneTilesElderWoods } from './sceneTiles/ElderWoodsTiles.js';

export interface SceneTileDef {
  width?: number;
  height?: number;
  obstacles?: unknown[];
  perimeterFence?: boolean | { type?: string; spacing?: number; size?: number; gapSegments?: number };
  perimeterWall?: boolean | { type?: string; spacing?: number; size?: number; gapSegments?: number };
  [key: string]: unknown;
}

export interface SceneTilesRegistry {
  defaultTileSize: number;
  forest: Record<string, SceneTileDef>;
  cursedWilds: Record<string, SceneTileDef>;
  demonApproach: Record<string, SceneTileDef>;
  fort: Record<string, SceneTileDef>;
  dungeon: Record<string, SceneTileDef>;
  delve: Record<string, SceneTileDef>;
  elderWoods: Record<string, SceneTileDef>;
  getTile(tileId: string): SceneTileDef | null;
}

const defaultTileSize = 1200;

const forest = SceneTilesForest as Record<string, SceneTileDef>;
const cursedWilds = SceneTilesCursedWilds as Record<string, SceneTileDef>;
const demonApproach = SceneTilesDemonApproach as Record<string, SceneTileDef>;
const fort = SceneTilesFort as Record<string, SceneTileDef>;
const dungeon = SceneTilesDungeon as Record<string, SceneTileDef>;
const delve = SceneTilesDelve as Record<string, SceneTileDef>;
const elderWoods = SceneTilesElderWoods as Record<string, SceneTileDef>;

const SceneTiles: SceneTilesRegistry = {
  defaultTileSize,
  forest,
  cursedWilds,
  demonApproach,
  fort,
  dungeon,
  delve,
  elderWoods,
  getTile(tileId: string): SceneTileDef | null {
    if (!tileId) return null;
    if (tileId.indexOf('.') !== -1) {
      const parts = tileId.split('.');
      const theme = parts[0];
      const id = parts[1];
      const themeTiles = (this as Record<string, unknown>)[theme] as Record<string, SceneTileDef> | undefined;
      return themeTiles?.[id] ?? null;
    }
    return forest[tileId] ?? null;
  },
};

export { SceneTiles };
