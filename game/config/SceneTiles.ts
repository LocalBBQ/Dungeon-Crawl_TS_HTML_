/**
 * Scene tile registry for chunk-based level assembly.
 * Biomes from game/config/sceneTiles/*.
 * getTile(tileId) supports namespaced ids (theme.tileName) or bare id (resolves against forest).
 */
import { SceneTilesForest } from './sceneTiles/ForestTiles.ts';
import { SceneTilesCursedWilds } from './sceneTiles/CursedWildsTiles.ts';
import { SceneTilesDemonApproach } from './sceneTiles/DemonApproachTiles.ts';
import { SceneTilesFort } from './sceneTiles/FortTiles.ts';
import { SceneTilesDungeon } from './sceneTiles/DungeonTiles.ts';
import { SceneTilesDelve } from './sceneTiles/DelveTiles.ts';
import { SceneTilesElderWoods } from './sceneTiles/ElderWoodsTiles.ts';

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
