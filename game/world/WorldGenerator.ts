/**
 * World generation: populate obstacles via a placer (e.g. ObstacleManager).
 * All generate* logic lives here; placer provides addObstacle, wouldOverlap, factory, config.
 */
import { Utils } from '../utils/Utils.ts';
import { StructureGenerator } from '../obstacles/StructureGenerator.ts';
import type { ObjectFactory } from '../obstacles/ObjectFactory.ts';

export interface IWorldGenPlacer {
    config: { world: { tileSize: number } };
    factory: ObjectFactory;
    exclusionZones: { x: number; y: number; radius: number }[];
    addObstacle(x: number, y: number, width: number, height: number, type: string, spritePath: string | null, customProps?: Record<string, unknown> | null): unknown;
    wouldOverlap(x: number, y: number, width: number, height: number): boolean;
    placeSceneTilesGrid(layout: unknown, worldWidth?: number, worldHeight?: number): void;
}

export class WorldGenerator {
    generateWorld(
        placer: IWorldGenPlacer,
        worldWidth: number,
        worldHeight: number,
        config: Record<string, unknown>,
        exclusionZone: { x: number; y: number; radius?: number } | null
    ): void {
        placer.exclusionZones.length = 0;
        placer.exclusionZones.push({ x: worldWidth / 2, y: worldHeight / 2, radius: 200 });
        if (exclusionZone && exclusionZone.x != null && exclusionZone.y != null) {
            placer.exclusionZones.push({
                x: exclusionZone.x,
                y: exclusionZone.y,
                radius: exclusionZone.radius ?? 120
            });
        }

        const borderSpacing = ((config.border as { spacing?: number })?.spacing) ?? 50;
        const borderType = ((config.border as { type?: string })?.type) ?? 'tree';
        this.generateBorderTrees(placer, worldWidth, worldHeight, borderSpacing, borderType);

        if (config.useSceneTiles && config.sceneTileLayout) {
            placer.placeSceneTilesGrid(config.sceneTileLayout, worldWidth, worldHeight);
            return;
        }

        const forest = config.forest as { density?: number } | undefined;
        if (forest?.density != null) this.generateForest(placer, worldWidth, worldHeight, forest.density);
        const mushrooms = config.mushrooms as { density?: number } | undefined;
        if (mushrooms?.density != null) this.generateMushrooms(placer, worldWidth, worldHeight, mushrooms.density);
        const rocks = config.rocks as { density?: number } | undefined;
        if (rocks?.density != null) this.generateRocks(placer, worldWidth, worldHeight, rocks.density);
        const darkRocks = config.darkRocks as { density?: number } | undefined;
        if (darkRocks?.density != null) this.generateDarkRocks(placer, worldWidth, worldHeight, darkRocks.density);
        const lavaRocks = config.lavaRocks as { density?: number } | undefined;
        if (lavaRocks?.density != null) this.generateLavaRocks(placer, worldWidth, worldHeight, lavaRocks.density);
        const graves = config.graves as { count?: number } | undefined;
        if (graves?.count != null) this.generateGraves(placer, worldWidth, worldHeight, graves.count);
        const swampPools = config.swampPools as { count?: number } | undefined;
        if (swampPools?.count != null) this.generateSwampPools(placer, worldWidth, worldHeight, swampPools.count);
        const demonPillars = config.demonPillars as { count?: number } | undefined;
        if (demonPillars?.count != null) this.generateDemonPillars(placer, worldWidth, worldHeight, demonPillars.count);
        const braziers = config.braziers as { count?: number } | undefined;
        if (braziers?.count != null) this.generateBraziers(placer, worldWidth, worldHeight, braziers.count);

        const structures = config.structures as Record<string, { enabled?: boolean; count?: number; treesPerCluster?: number }> | undefined;
        if (structures) {
            if (structures.houses?.enabled) this.generateHouses(placer, worldWidth, worldHeight, structures.houses.count ?? 5);
            if (structures.woodClusters?.enabled) {
                this.generateWoodClusters(
                    placer, worldWidth, worldHeight,
                    structures.woodClusters.count ?? 4,
                    structures.woodClusters.treesPerCluster ?? 8
                );
            }
            if (structures.settlements?.enabled) this.generateSettlements(placer, worldWidth, worldHeight, structures.settlements.count ?? 2);
            if (structures.firepits?.enabled) this.generateFirepits(placer, worldWidth, worldHeight, structures.firepits.count ?? 3);
            if (structures.sheds?.enabled) this.generateSheds(placer, worldWidth, worldHeight, structures.sheds.count ?? 4);
            if (structures.wells?.enabled) this.generateWells(placer, worldWidth, worldHeight, structures.wells.count ?? 2);
            if (structures.ruins?.enabled) {
                const r = structures.ruins as Record<string, number | undefined>;
                if (r.rubblePiles != null) this.generateRubblePiles(placer, worldWidth, worldHeight, r.rubblePiles);
                if (r.pillarClusters != null) this.generatePillarClusters(placer, worldWidth, worldHeight, r.pillarClusters);
                if (r.ruinedWalls != null) this.generateRuinedWalls(placer, worldWidth, worldHeight, r.ruinedWalls);
                if (r.ruinedStructures != null) this.generateRuinedStructures(placer, worldWidth, worldHeight, r.ruinedStructures);
                if (r.brokenArches != null) this.generateBrokenArches(placer, worldWidth, worldHeight, r.brokenArches);
                if (r.statueRemnants != null) this.generateStatueRemnants(placer, worldWidth, worldHeight, r.statueRemnants);
            }
        }
    }

    private generateForest(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, density = 0.02): void {
        const tileSize = placer.config.world.tileSize;
        const config = placer.factory.getConfig('tree');
        const numTrees = Math.floor((worldWidth * worldHeight * density) / (tileSize * tileSize));
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 200 };
        let treesPlaced = 0, attempts = 0, maxAttempts = numTrees * 3;
        while (treesPlaced < numTrees && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const obj = placer.factory.createObject(x, y, 'tree');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                treesPlaced++;
            }
        }
    }

    private generateRocks(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, density = 0.015): void {
        const tileSize = placer.config.world.tileSize;
        const config = placer.factory.getConfig('rock');
        const numRocks = Math.floor((worldWidth * worldHeight * density) / (tileSize * tileSize));
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 200 };
        let rocksPlaced = 0, attempts = 0, maxAttempts = numRocks * 3;
        while (rocksPlaced < numRocks && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const obj = placer.factory.createObject(x, y, 'rock');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                rocksPlaced++;
            }
        }
    }

    private generateMushrooms(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, density = 0.025): void {
        const tileSize = placer.config.world.tileSize;
        const config = placer.factory.getConfig('mushroom');
        const numTrees = Math.floor((worldWidth * worldHeight * density) / (tileSize * tileSize));
        let placed = 0, attempts = 0, maxAttempts = numTrees * 3;
        while (placed < numTrees && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = placer.factory.createObject(x, y, 'mushroom');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                const leafless = Math.random() < 0.5;
                const leaflessVariant = leafless ? Math.floor(Math.random() * 3) : 0;
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color, leafless, leaflessVariant });
                placed++;
            }
        }
    }

    private generateDarkRocks(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, density = 0.02): void {
        const tileSize = placer.config.world.tileSize;
        const config = placer.factory.getConfig('darkRock');
        const numRocks = Math.floor((worldWidth * worldHeight * density) / (tileSize * tileSize));
        let placed = 0, attempts = 0, maxAttempts = numRocks * 3;
        while (placed < numRocks && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = placer.factory.createObject(x, y, 'darkRock');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateGraves(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 15): void {
        const config = placer.factory.getConfig('grave');
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            const obj = placer.factory.createObject(x, y, 'grave');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateSwampPools(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 10): void {
        const config = placer.factory.getConfig('swampPool');
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 6) {
            attempts++;
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            const obj = placer.factory.createObject(x, y, 'swampPool');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateLavaRocks(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, density = 0.025): void {
        const tileSize = placer.config.world.tileSize;
        const config = placer.factory.getConfig('lavaRock');
        const numRocks = Math.floor((worldWidth * worldHeight * density) / (tileSize * tileSize));
        let placed = 0, attempts = 0, maxAttempts = numRocks * 3;
        while (placed < numRocks && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = placer.factory.createObject(x, y, 'lavaRock');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateDemonPillars(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 14): void {
        const config = placer.factory.getConfig('demonPillar');
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            const obj = placer.factory.createObject(x, y, 'demonPillar');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateBraziers(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 12): void {
        const config = placer.factory.getConfig('brazier');
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            const obj = placer.factory.createObject(x, y, 'brazier');
            if (!placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    private generateBorderTrees(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, spacing = 50, borderType = 'tree'): void {
        const treeObjects = placer.factory.createObjectsAlongBorder(worldWidth, worldHeight, borderType, spacing, 'all');
        treeObjects.forEach(obj => {
            const customProps: Record<string, unknown> = obj.color ? { color: obj.color } : {};
            if (obj.type === 'mushroom') {
                customProps.leafless = Math.random() < 0.5;
                if (customProps.leafless) customProps.leaflessVariant = Math.floor(Math.random() * 3);
            }
            placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, Object.keys(customProps).length ? customProps : null);
        });
    }

    private generateHouses(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 5): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 300 };
        const generator = new StructureGenerator(placer);
        let housesPlaced = 0, attempts = 0, maxAttempts = count * 5;
        while (housesPlaced < count && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(200, worldWidth - 200);
            const y = Utils.randomInt(200, worldHeight - 200);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const houseSize = 240;
            if (!placer.wouldOverlap(x - houseSize / 2, y - houseSize / 2, houseSize, houseSize)) {
                const houseObjects = generator.generateHouse(x, y, houseSize);
                let canPlace = true;
                for (const obj of houseObjects) {
                    if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
                }
                if (canPlace) {
                    houseObjects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath));
                    housesPlaced++;
                }
            }
        }
    }

    private generateWoodClusters(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, clusterCount = 4, treesPerCluster = 8): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 250 };
        const generator = new StructureGenerator(placer);
        let clustersPlaced = 0, attempts = 0, maxAttempts = clusterCount * 5;
        while (clustersPlaced < clusterCount && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(150, worldWidth - 150);
            const y = Utils.randomInt(150, worldHeight - 150);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const clusterRadius = 150;
            const trees = generator.generateWoodCluster(x, y, clusterRadius, treesPerCluster);
            let treesPlaced = 0;
            for (const tree of trees) {
                if (!placer.wouldOverlap(tree.x, tree.y, tree.width, tree.height)) {
                    placer.addObstacle(tree.x, tree.y, tree.width, tree.height, tree.type, tree.spritePath);
                    treesPlaced++;
                }
            }
            if (treesPlaced >= treesPerCluster * 0.6) clustersPlaced++;
        }
    }

    private generateSettlements(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, settlementCount = 2): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 400 };
        const generator = new StructureGenerator(placer);
        let settlementsPlaced = 0, attempts = 0, maxAttempts = settlementCount * 5;
        while (settlementsPlaced < settlementCount && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(300, worldWidth - 300);
            const y = Utils.randomInt(300, worldHeight - 300);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const structures = generator.generateSettlement(x, y, 3, 200);
            let canPlace = true;
            for (const obj of structures) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                structures.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath));
                settlementsPlaced++;
            }
        }
    }

    private generateFirepits(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 3): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 250 };
        const generator = new StructureGenerator(placer);
        let firepitsPlaced = 0, attempts = 0, maxAttempts = count * 5;
        while (firepitsPlaced < count && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const firepitObjects = generator.generateFirepit(x, y);
            let canPlace = true;
            for (const obj of firepitObjects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                firepitObjects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath));
                firepitsPlaced++;
            }
        }
    }

    private generateSheds(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 4): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 250 };
        const generator = new StructureGenerator(placer);
        let shedsPlaced = 0, attempts = 0, maxAttempts = count * 5;
        while (shedsPlaced < count && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(50, worldWidth - 50);
            const y = Utils.randomInt(50, worldHeight - 50);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const shedSize = Utils.randomInt(100, 140);
            if (!placer.wouldOverlap(x - shedSize / 2, y - shedSize / 2, shedSize, shedSize)) {
                const shedObjects = generator.generateShed(x, y, shedSize);
                shedObjects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath));
                shedsPlaced++;
            }
        }
    }

    private generateWells(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 2): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 250 };
        const generator = new StructureGenerator(placer);
        let wellsPlaced = 0, attempts = 0, maxAttempts = count * 5;
        while (wellsPlaced < count && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(50, worldWidth - 50);
            const y = Utils.randomInt(50, worldHeight - 50);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            if (!placer.wouldOverlap(x - 25, y - 25, 50, 50)) {
                const wellObjects = generator.generateWell(x, y);
                wellObjects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath));
                wellsPlaced++;
            }
        }
    }

    private generateRubblePiles(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 12): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateRubblePile(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    private generatePillarClusters(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 6): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generatePillarCluster(x, y, 80, Utils.randomInt(3, 5));
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    private generateRuinedWalls(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 8): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 280 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 6) {
            attempts++;
            const cx = Utils.randomInt(150, worldWidth - 150);
            const cy = Utils.randomInt(150, worldHeight - 150);
            if (Utils.distance(cx, cy, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const len = Utils.randomInt(120, 220);
            const angle = Math.random() * Math.PI * 2;
            const ex = cx + Math.cos(angle) * len;
            const ey = cy + Math.sin(angle) * len;
            const objects = generator.generateRuinedWall(cx, cy, ex, ey);
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    private generateRuinedStructures(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 4): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 350 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(250, worldWidth - 250);
            const y = Utils.randomInt(250, worldHeight - 250);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const size = Utils.randomInt(140, 200);
            if (placer.wouldOverlap(x - size / 2, y - size / 2, size, size)) continue;
            const objects = generator.generateRuinedStructure(x, y, size);
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    private generateBrokenArches(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 5): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateBrokenArch(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    private generateStatueRemnants(placer: IWorldGenPlacer, worldWidth: number, worldHeight: number, count = 6): void {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(placer);
        let placed = 0, attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateStatueRemnant(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (placer.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => placer.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }
}
