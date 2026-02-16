// ObstacleManager - uses Obstacle, ObjectFactory, StructureGenerator from game/obstacles/.
import { Utils } from '../utils/Utils.ts';
import { Obstacle } from '../obstacles/Obstacle.ts';
import { ObjectFactory } from '../obstacles/ObjectFactory.ts';
import { StructureGenerator } from '../obstacles/StructureGenerator.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import { SceneTiles } from '../config/SceneTiles.ts';
import { GameConfig } from '../config/GameConfig.ts';
import type { GameConfigShape } from '../types/config.js';
import { WorldGenerator } from '../world/WorldGenerator.ts';

export class ObstacleManager {
    obstacles: Obstacle[];
    loadedSprites: Map<string, HTMLImageElement>;
    factory: ObjectFactory;
    exclusionZones: unknown[];
    lastPlacedTiles: unknown[];
    suggestedPlayerStart: { x: number; y: number } | null;
    systems: SystemManager | null;
    private config: GameConfigShape = GameConfig;
    private worldGenerator: WorldGenerator;

    constructor() {
        this.obstacles = [];
        this.loadedSprites = new Map();
        this.factory = new ObjectFactory();
        this.exclusionZones = [];
        this.lastPlacedTiles = [];
        this.suggestedPlayerStart = null;
        this.systems = null;
    }

    init(systems: SystemManager): void {
        this.systems = systems;
        const cfg = systems.get<GameConfigShape>('config');
        if (cfg) this.config = cfg;
        this.worldGenerator = new WorldGenerator();
    }

    getGatherableManager(): unknown {
        return this.systems?.get?.('gatherables') ?? null;
    }

    addObstacle(x: number, y: number, width: number, height: number, type: string, spritePath: string | null = null, customProps: Record<string, unknown> | null = null): Obstacle {
        const obstacle = new Obstacle(x, y, width, height, type);
        if (spritePath) {
            obstacle.spritePath = spritePath;
            this.loadSprite(spritePath);
        }
        // Copy custom properties if provided
        if (customProps) {
            Object.assign(obstacle, customProps);
        }
        // Trees.png is a 3-frame strip: assign random variant when not set so each tree gets a random sprite
        if (type === 'tree' && (obstacle.spritePath || '').includes('Trees.png') && obstacle.spriteFrameIndex == null) {
            obstacle.spriteFrameIndex = Utils.randomInt(0, 2);
        }
        this.obstacles.push(obstacle);
        return obstacle;
    }

    createObject(x, y, type = 'tree', customSize = null, spritePath = null) {
        const objData = this.factory.createObject(x, y, type, customSize, spritePath);
        return this.addObstacle(objData.x, objData.y, objData.width, objData.height, objData.type, objData.spritePath);
    }

    loadSprite(path) {
        if (this.loadedSprites.has(path)) {
            return this.loadedSprites.get(path);
        }
        
        const img = new Image();
        img.src = path;
        this.loadedSprites.set(path, img);
        return img;
    }

    /** Trees: trunk-only collision. Rocks/shrines: smaller centered collision so the player can walk behind the visible image. */
    _getObstacleCollisionRect(obstacle) {
        if (obstacle.type === 'tree') {
            const trunkWidthFraction = 0.16;
            const trunkHeightFraction = 0.22;
            const minTrunkW = 10;
            const minTrunkH = 8;
            const cw = Math.max(minTrunkW, obstacle.width * trunkWidthFraction);
            const ch = Math.max(minTrunkH, obstacle.height * trunkHeightFraction);
            const left = obstacle.x + (obstacle.width - cw) / 2;
            const top = obstacle.y + obstacle.height - ch;
            return { x: left, y: top, width: cw, height: ch };
        }
        // Rock and shrine-like props: collision smaller than sprite so player can walk behind the edges
        const smallCollisionTypes = ['rock', 'pillar', 'brokenPillar', 'column', 'statueBase', 'arch'];
        if (smallCollisionTypes.includes(obstacle.type)) {
            const frac = 0.5;  // 50% of width/height, centered
            const minSize = 14;
            const cw = Math.max(minSize, obstacle.width * frac);
            const ch = Math.max(minSize, obstacle.height * frac);
            const left = obstacle.x + (obstacle.width - cw) / 2;
            const top = obstacle.y + (obstacle.height - ch) / 2;
            return { x: left, y: top, width: cw, height: ch };
        }
        return { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
    }

    canMoveTo(x, y, entityWidth, entityHeight, options = null) {
        const entityLeft = x - entityWidth / 2;
        const entityTop = y - entityHeight / 2;
        const allowSwampPools = options && options.allowSwampPools;
        for (const obstacle of this.obstacles) {
            if (allowSwampPools && obstacle.type === 'swampPool') continue;
            const rect = this._getObstacleCollisionRect(obstacle);
            if (Utils.rectCollision(
                entityLeft, entityTop, entityWidth, entityHeight,
                rect.x, rect.y, rect.width, rect.height
            )) {
                return false;
            }
        }
        return true;
    }

    /** Returns 0.5 if the given entity rect overlaps a swamp pool, else 1. Used for player swamp slow. */
    getSwampPoolSpeedMultiplier(centerX, centerY, width, height) {
        const left = centerX - width / 2;
        const top = centerY - height / 2;
        for (const obstacle of this.obstacles) {
            if (obstacle.type !== 'swampPool') continue;
            if (Utils.rectCollision(left, top, width, height, obstacle.x, obstacle.y, obstacle.width, obstacle.height))
                return 0.5;
        }
        return 1;
    }

    wouldOverlap(x, y, width, height) {
        for (const obstacle of this.obstacles) {
            if (Utils.rectCollision(
                x, y, width, height,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height
            )) {
                return true;
            }
        }
        const cx = x + width / 2;
        const cy = y + height / 2;
        for (const zone of this.exclusionZones) {
            if (Utils.distance(cx, cy, zone.x, zone.y) < zone.radius) return true;
        }
        return false;
    }

    clearWorld() {
        this.obstacles = [];
        this.exclusionZones = [];
        this.lastPlacedTiles = [];
        this.suggestedPlayerStart = null;
        const gm = this.getGatherableManager();
        if (gm && typeof gm.clear === 'function') gm.clear();
    }

    /**
     * Rotate a rectangle (x, y, width, height) inside a square of size tileSize by 90° steps CW.
     * rotation: 0 = 0°, 1 = 90° CW, 2 = 180°, 3 = 270° CW.
     * @returns {{ x, y, width, height }}
     */
    rotateObstacleInTile(x, y, width, height, tileSize, rotation) {
        if (!rotation) return { x, y, width, height };
        const S = tileSize;
        switch (rotation) {
            case 1: return { x: S - y - height, y: x, width: height, height: width };
            case 2: return { x: S - x - width, y: S - y - height, width, height };
            case 3: return { x: y, y: S - x - width, width: height, height: width };
            default: return { x, y, width, height };
        }
    }

    /**
     * Generate perimeter fence segments in tile space (0,0)..(tileSize, tileSize).
     * Leaves gaps (openings) in the middle of each side so the player can enter/exit.
     * @param {number} tileSize - tile side length
     * @param {{ spacing?: number, size?: number, gapSegments?: number }} options
     *   - spacing (default 32), size (default 28), gapSegments (default 2 = skip 2 segment slots per side for an opening)
     * @returns {Array<{x,y,width,height}>}
     */
    getPerimeterFenceSegments(tileSize, options = {}) {
        const spacing = options.spacing != null ? options.spacing : 32;
        const size = options.size != null ? options.size : 28;
        const gapSegments = options.gapSegments != null ? options.gapSegments : 2;
        const gapHalfWidth = (gapSegments * spacing) / 2;
        const center = tileSize / 2;
        const segments = [];
        const maxX = tileSize - size;
        const maxY = tileSize - size;

        const skipTopBottom = (segX) => Math.abs(segX + size / 2 - center) < gapHalfWidth;
        const skipLeftRight = (segY) => Math.abs(segY + size / 2 - center) < gapHalfWidth;

        for (let x = 0; x <= maxX; x += spacing) {
            if (!skipTopBottom(x)) {
                segments.push({ x, y: 0, width: size, height: size });
                segments.push({ x, y: maxY, width: size, height: size });
            }
        }
        for (let y = spacing; y < maxY; y += spacing) {
            if (!skipLeftRight(y)) {
                segments.push({ x: 0, y, width: size, height: size });
                segments.push({ x: maxX, y, width: size, height: size });
            }
        }
        return segments;
    }

    /**
     * Place a single scene tile at the given world origin. Obstacle positions in the tile are relative to (originX, originY).
     * If tile.perimeterFence is set, adds fence segments around the tile edge (same rotation as tile).
     * @param {number} originX - World X of tile top-left
     * @param {number} originY - World Y of tile top-left
     * @param {string} tileId - e.g. 'forest.lumberMill', 'clearing'
     * @param {number} rotation - 0..3 for 0°, 90°, 180°, 270° CW
     */
    placeSceneTile(originX, originY, tileId, rotation = 0) {
        const tile = SceneTiles.getTile(tileId);
        if (!tile) return;
        const tileSize = tile.width != null ? tile.width : SceneTiles.defaultTileSize;
        if (tile.obstacles && tile.obstacles.length) {
            for (const obs of tile.obstacles) {
                const r = this.rotateObstacleInTile(obs.x, obs.y, obs.width, obs.height, tileSize, rotation);
                const config = this.factory.getConfig(obs.type);
                const spritePath = obs.spritePath != null ? obs.spritePath : (config && config.defaultSpritePath) || null;
                const customProps = (config && config.color) ? { color: config.color } : null;
                this.addObstacle(
                    originX + r.x, originY + r.y,
                    r.width, r.height,
                    obs.type, spritePath, customProps
                );
            }
        }
        if (tile.perimeterFence) {
            const opts = typeof tile.perimeterFence === 'object' ? tile.perimeterFence : {};
            const fenceType = opts.type || 'fence';
            const fenceConfig = this.factory.getConfig(fenceType);
            const spritePath = fenceConfig && fenceConfig.defaultSpritePath || null;
            const customProps = (fenceConfig && fenceConfig.color) ? { color: fenceConfig.color } : null;
            const segments = this.getPerimeterFenceSegments(tileSize, opts);
            for (const seg of segments) {
                const r = this.rotateObstacleInTile(seg.x, seg.y, seg.width, seg.height, tileSize, rotation);
                this.addObstacle(originX + r.x, originY + r.y, r.width, r.height, fenceType, spritePath, customProps);
            }
        }
        if (tile.gatherables && tile.gatherables.length) {
            const gm = this.getGatherableManager();
            if (gm) {
                for (const g of tile.gatherables) {
                    const r = this.rotateObstacleInTile(g.x, g.y, g.width || 32, g.height || 32, tileSize, rotation);
                    gm.add(originX + r.x, originY + r.y, r.width, r.height, g.type || 'herb');
                }
            }
        }
    }

    /**
     * Place a grid of scene tiles.
     * layout.grid: optional row-major [row][col] of tile ids (fixed layout).
     * layout.pool + layout.cols + layout.rows: optional procedural; pick random from pool per cell.
     * layout.tileSize: tile side length in world pixels.
     * layout.rotateTiles: if true (default), each tile gets a random 90° rotation (0/90/180/270 CW).
     * Fills lastPlacedTiles for spawn hints: [{ tileId, originX, originY, tileSize, rotation }, ...].
     */
    placeSceneTilesGrid(layout) {
        if (!layout) return;
        this.lastPlacedTiles = [];
        this.suggestedPlayerStart = null;
        const tileSize = layout.tileSize || SceneTiles.defaultTileSize;
        const rotateTiles = layout.rotateTiles !== false;
        let grid;
        if (layout.pool && layout.pool.length && layout.cols != null && layout.rows != null) {
            grid = [];
            const poolEntries = layout.pool.map(entry =>
                typeof entry === 'string' ? { id: entry, weight: 1 } : { id: entry.id, weight: Math.max(0.1, entry.weight || 1) }
            );
            const hasFence = (tileId) => {
                const tile = SceneTiles.getTile(tileId);
                return !!(tile && tile.perimeterFence);
            };
            for (let row = 0; row < layout.rows; row++) {
                const rowTiles = [];
                for (let col = 0; col < layout.cols; col++) {
                    const neighborHasFence =
                        (row > 0 && hasFence(grid[row - 1][col])) ||
                        (col > 0 && hasFence(rowTiles[col - 1])) ||
                        (row > 0 && col > 0 && hasFence(grid[row - 1][col - 1])) ||
                        (row > 0 && col + 1 < layout.cols && hasFence(grid[row - 1][col + 1]));
                    const entries = neighborHasFence
                        ? poolEntries.filter(e => !hasFence(e.id))
                        : poolEntries;
                    const usePool = entries.length > 0 ? entries : poolEntries;
                    const totalWeight = usePool.reduce((s, e) => s + e.weight, 0);
                    let r = Math.random() * totalWeight;
                    let tileId = usePool[0].id;
                    for (const e of usePool) {
                        r -= e.weight;
                        if (r <= 0) { tileId = e.id; break; }
                    }
                    rowTiles.push(tileId);
                }
                grid.push(rowTiles);
            }
        } else if (layout.grid && layout.grid.length) {
            grid = layout.grid;
        } else {
            return;
        }
        const safeCells = [];
        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[row].length; col++) {
                const tileId = grid[row][col];
                if (!tileId) continue;
                const tile = SceneTiles.getTile(tileId);
                if (tile && !tile.perimeterFence) safeCells.push({ row, col });
            }
        }
        let spawnCell = null;
        if (safeCells.length) {
            spawnCell = safeCells[Utils.randomInt(0, safeCells.length - 1)];
        }
        for (let row = 0; row < grid.length; row++) {
            const rowTiles = grid[row];
            for (let col = 0; col < rowTiles.length; col++) {
                const tileId = rowTiles[col];
                if (tileId) {
                    const originX = col * tileSize;
                    const originY = row * tileSize;
                    const rotation = rotateTiles ? Utils.randomInt(0, 3) : 0;
                    this.placeSceneTile(originX, originY, tileId, rotation);
                    this.lastPlacedTiles.push({ tileId, originX, originY, tileSize, rotation });
                }
            }
        }
        const entityW = (this.config.player && this.config.player.width != null) ? this.config.player.width + 4 : 34;
        const entityH = (this.config.player && this.config.player.height != null) ? this.config.player.height + 4 : 34;
        if (spawnCell) {
            const originX = spawnCell.col * tileSize;
            const originY = spawnCell.row * tileSize;
            const walkable = this.findWalkableInTile(originX, originY, tileSize, entityW, entityH);
            if (walkable) {
                this.suggestedPlayerStart = walkable;
            } else {
                for (let i = 0; i < safeCells.length; i++) {
                    const c = safeCells[i];
                    if (c.row === spawnCell.row && c.col === spawnCell.col) continue;
                    const ox = c.col * tileSize;
                    const oy = c.row * tileSize;
                    const w = this.findWalkableInTile(ox, oy, tileSize, entityW, entityH);
                    if (w) {
                        this.suggestedPlayerStart = w;
                        break;
                    }
                }
                if (!this.suggestedPlayerStart) {
                    this.suggestedPlayerStart = { x: originX + tileSize / 2, y: originY + tileSize / 2 };
                }
            }
        }
    }

    getSuggestedPlayerStart() {
        return this.suggestedPlayerStart || null;
    }

    /**
     * Find a walkable position inside a tile (after obstacles are placed). Tries center then a grid of points.
     * @param {number} originX - tile top-left X
     * @param {number} originY - tile top-left Y
     * @param {number} tileSize - tile side length
     * @param {number} entityWidth - player/entity width for collision
     * @param {number} entityHeight - player/entity height for collision
     * @returns {{ x, y } | null} - center position that is walkable, or null
     */
    findWalkableInTile(originX, originY, tileSize, entityWidth, entityHeight) {
        const inset = 60;
        const minX = originX + inset;
        const maxX = originX + tileSize - inset;
        const minY = originY + inset;
        const maxY = originY + tileSize - inset;
        const centerX = originX + tileSize / 2;
        const centerY = originY + tileSize / 2;
        if (this.canMoveTo(centerX, centerY, entityWidth, entityHeight)) {
            return { x: centerX, y: centerY };
        }
        const step = 50;
        for (let x = minX; x <= maxX; x += step) {
            for (let y = minY; y <= maxY; y += step) {
                if (this.canMoveTo(x, y, entityWidth, entityHeight)) {
                    return { x, y };
                }
            }
        }
        for (let x = minX; x <= maxX; x += 25) {
            for (let y = minY; y <= maxY; y += 25) {
                if (this.canMoveTo(x, y, entityWidth, entityHeight)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    getLastPlacedTiles() {
        return this.lastPlacedTiles || [];
    }

    generateWorld(worldWidth: number, worldHeight: number, config: Record<string, unknown>, exclusionZone: { x: number; y: number; radius?: number } | null = null): void {
        this.worldGenerator.generateWorld(this, worldWidth, worldHeight, config, exclusionZone);
    }
}


