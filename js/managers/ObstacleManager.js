// ObstacleManager - uses Obstacle, ObjectFactory, StructureGenerator from js/obstacles/ (loaded via script tags).
class ObstacleManager {
    constructor() {
        this.obstacles = [];
        this.loadedSprites = new Map();
        this.factory = new ObjectFactory();
        this.exclusionZones = [];
        this.lastPlacedTiles = [];
        this.suggestedPlayerStart = null;
    }

    init(systems) {
        this.systems = systems;
    }

    /** Optional: call after systems are registered so placeSceneTile can register gatherables and clearWorld can clear them. */
    getGatherableManager() {
        return this.systems && this.systems.get ? this.systems.get('gatherables') : null;
    }

    addObstacle(x, y, width, height, type, spritePath = null, customProps = null) {
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

    generateForest(worldWidth, worldHeight, density = 0.02) {
        const tileSize = GameConfig.world.tileSize;
        const numTrees = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('tree');
        
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 200
        };
        
        let treesPlaced = 0;
        let attempts = 0;
        const maxAttempts = numTrees * 3;
        
        while (treesPlaced < numTrees && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const obj = this.factory.createObject(x, y, 'tree');
            
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                treesPlaced++;
            }
        }
    }

    generateRocks(worldWidth, worldHeight, density = 0.015) {
        const tileSize = GameConfig.world.tileSize;
        const numRocks = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('rock');
        
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 200
        };
        
        let rocksPlaced = 0;
        let attempts = 0;
        const maxAttempts = numRocks * 3;
        
        while (rocksPlaced < numRocks && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const obj = this.factory.createObject(x, y, 'rock');
            
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                rocksPlaced++;
            }
        }
    }

    generateMushrooms(worldWidth, worldHeight, density = 0.025) {
        const tileSize = GameConfig.world.tileSize;
        const numTrees = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('mushroom');
        let placed = 0;
        let attempts = 0;
        const maxAttempts = numTrees * 3;
        while (placed < numTrees && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = this.factory.createObject(x, y, 'mushroom');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                const leafless = Math.random() < 0.5;
                const leaflessVariant = leafless ? Math.floor(Math.random() * 3) : 0;
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color, leafless, leaflessVariant });
                placed++;
            }
        }
    }

    generateDarkRocks(worldWidth, worldHeight, density = 0.02) {
        const tileSize = GameConfig.world.tileSize;
        const numRocks = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('darkRock');
        let placed = 0;
        let attempts = 0;
        const maxAttempts = numRocks * 3;
        while (placed < numRocks && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = this.factory.createObject(x, y, 'darkRock');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateGraves(worldWidth, worldHeight, count = 15) {
        const config = this.factory.getConfig('grave');
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            const obj = this.factory.createObject(x, y, 'grave');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateSwampPools(worldWidth, worldHeight, count = 10) {
        const config = this.factory.getConfig('swampPool');
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 6) {
            attempts++;
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            const obj = this.factory.createObject(x, y, 'swampPool');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateLavaRocks(worldWidth, worldHeight, density = 0.025) {
        const tileSize = GameConfig.world.tileSize;
        const numRocks = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('lavaRock');
        let placed = 0;
        let attempts = 0;
        const maxAttempts = numRocks * 3;
        while (placed < numRocks && attempts < maxAttempts) {
            attempts++;
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            const obj = this.factory.createObject(x, y, 'lavaRock');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateDemonPillars(worldWidth, worldHeight, count = 14) {
        const config = this.factory.getConfig('demonPillar');
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            const obj = this.factory.createObject(x, y, 'demonPillar');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateBraziers(worldWidth, worldHeight, count = 12) {
        const config = this.factory.getConfig('brazier');
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            const obj = this.factory.createObject(x, y, 'brazier');
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, { color: obj.color });
                placed++;
            }
        }
    }

    generateBorderTrees(worldWidth, worldHeight, spacing = 50, borderType = 'tree') {
        const treeObjects = this.factory.createObjectsAlongBorder(
            worldWidth, worldHeight, borderType, spacing, 'all'
        );
        treeObjects.forEach(obj => {
            const customProps = obj.color ? { color: obj.color } : {};
            if (obj.type === 'mushroom') {
                customProps.leafless = Math.random() < 0.5;
                if (customProps.leafless) customProps.leaflessVariant = Math.floor(Math.random() * 3);
            }
            this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, Object.keys(customProps).length ? customProps : null);
        });
    }

    generateHouses(worldWidth, worldHeight, count = 5) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 300
        };
        
        const generator = new StructureGenerator(this);
        let housesPlaced = 0;
        let attempts = 0;
        const maxAttempts = count * 5;
        
        while (housesPlaced < count && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(200, worldWidth - 200);
            const y = Utils.randomInt(200, worldHeight - 200);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            // Check if area is clear
            const houseSize = 240;
            if (!this.wouldOverlap(x - houseSize/2, y - houseSize/2, houseSize, houseSize)) {
                const houseObjects = generator.generateHouse(x, y, houseSize);
                
                // Add all house components
                let canPlace = true;
                for (const obj of houseObjects) {
                    if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    houseObjects.forEach(obj => {
                        this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                    });
                    housesPlaced++;
                }
            }
        }
    }

    generateWoodClusters(worldWidth, worldHeight, clusterCount = 4, treesPerCluster = 8) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 250
        };
        
        const generator = new StructureGenerator(this);
        let clustersPlaced = 0;
        let attempts = 0;
        const maxAttempts = clusterCount * 5;
        
        while (clustersPlaced < clusterCount && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(150, worldWidth - 150);
            const y = Utils.randomInt(150, worldHeight - 150);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const clusterRadius = 150;
            const trees = generator.generateWoodCluster(x, y, clusterRadius, treesPerCluster);
            
            // Try to place all trees
            let treesPlaced = 0;
            for (const tree of trees) {
                if (!this.wouldOverlap(tree.x, tree.y, tree.width, tree.height)) {
                    this.addObstacle(tree.x, tree.y, tree.width, tree.height, tree.type, tree.spritePath);
                    treesPlaced++;
                }
            }
            
            if (treesPlaced >= treesPerCluster * 0.6) { // At least 60% success
                clustersPlaced++;
            }
        }
    }

    generateSettlements(worldWidth, worldHeight, settlementCount = 2) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 400
        };
        
        const generator = new StructureGenerator(this);
        let settlementsPlaced = 0;
        let attempts = 0;
        const maxAttempts = settlementCount * 5;
        
        while (settlementsPlaced < settlementCount && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(300, worldWidth - 300);
            const y = Utils.randomInt(300, worldHeight - 300);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const settlementRadius = 200;
            const structures = generator.generateSettlement(x, y, 3, settlementRadius);
            
            // Check if we can place the settlement
            let canPlace = true;
            for (const obj of structures) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                    canPlace = false;
                    break;
                }
            }
            
            if (canPlace) {
                structures.forEach(obj => {
                    this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                });
                settlementsPlaced++;
            }
        }
    }

    generateFirepits(worldWidth, worldHeight, count = 3) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 250
        };
        
        const generator = new StructureGenerator(this);
        let firepitsPlaced = 0;
        let attempts = 0;
        const maxAttempts = count * 5;
        
        while (firepitsPlaced < count && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const firepitObjects = generator.generateFirepit(x, y);
            
            let canPlace = true;
            for (const obj of firepitObjects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                    canPlace = false;
                    break;
                }
            }
            
            if (canPlace) {
                firepitObjects.forEach(obj => {
                    this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                });
                firepitsPlaced++;
            }
        }
    }

    generateSheds(worldWidth, worldHeight, count = 4) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 250
        };
        
        const generator = new StructureGenerator(this);
        let shedsPlaced = 0;
        let attempts = 0;
        const maxAttempts = count * 5;
        
        while (shedsPlaced < count && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(50, worldWidth - 50);
            const y = Utils.randomInt(50, worldHeight - 50);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            const shedSize = Utils.randomInt(100, 140);
            if (!this.wouldOverlap(x - shedSize/2, y - shedSize/2, shedSize, shedSize)) {
                const shedObjects = generator.generateShed(x, y, shedSize);
                shedObjects.forEach(obj => {
                    this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                });
                shedsPlaced++;
            }
        }
    }

    generateWells(worldWidth, worldHeight, count = 2) {
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 250
        };
        
        const generator = new StructureGenerator(this);
        let wellsPlaced = 0;
        let attempts = 0;
        const maxAttempts = count * 5;
        
        while (wellsPlaced < count && attempts < maxAttempts) {
            attempts++;
            
            const x = Utils.randomInt(50, worldWidth - 50);
            const y = Utils.randomInt(50, worldHeight - 50);
            
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            if (!this.wouldOverlap(x - 25, y - 25, 50, 50)) {
                const wellObjects = generator.generateWell(x, y);
                wellObjects.forEach(obj => {
                    this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                });
                wellsPlaced++;
            }
        }
    }

    // --- Ruins generation ---

    generateRubblePiles(worldWidth, worldHeight, count = 12) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateRubblePile(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    generatePillarClusters(worldWidth, worldHeight, count = 6) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(100, worldWidth - 100);
            const y = Utils.randomInt(100, worldHeight - 100);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generatePillarCluster(x, y, 80, Utils.randomInt(3, 5));
            let canPlace = true;
            for (const obj of objects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    generateRuinedWalls(worldWidth, worldHeight, count = 8) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 280 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
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
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    generateRuinedStructures(worldWidth, worldHeight, count = 4) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 350 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(250, worldWidth - 250);
            const y = Utils.randomInt(250, worldHeight - 250);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const size = Utils.randomInt(140, 200);
            if (this.wouldOverlap(x - size/2, y - size/2, size, size)) continue;
            const objects = generator.generateRuinedStructure(x, y, size);
            let canPlace = true;
            for (const obj of objects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    generateBrokenArches(worldWidth, worldHeight, count = 5) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(80, worldWidth - 80);
            const y = Utils.randomInt(80, worldHeight - 80);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateBrokenArch(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
    }

    generateStatueRemnants(worldWidth, worldHeight, count = 6) {
        const excludeArea = { x: worldWidth / 2, y: worldHeight / 2, radius: 220 };
        const generator = new StructureGenerator(this);
        let placed = 0;
        let attempts = 0;
        while (placed < count && attempts < count * 5) {
            attempts++;
            const x = Utils.randomInt(60, worldWidth - 60);
            const y = Utils.randomInt(60, worldHeight - 60);
            if (Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius) continue;
            const objects = generator.generateStatueRemnant(x, y);
            let canPlace = true;
            for (const obj of objects) {
                if (this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) { canPlace = false; break; }
            }
            if (canPlace) {
                objects.forEach(obj => this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath, obj.color ? { color: obj.color } : null));
                placed++;
            }
        }
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
        const tile = typeof SceneTiles !== 'undefined' && SceneTiles.getTile ? SceneTiles.getTile(tileId) : null;
        if (!tile) return;
        const tileSize = tile.width != null ? tile.width : (typeof SceneTiles !== 'undefined' ? SceneTiles.defaultTileSize : 800);
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
        const tileSize = layout.tileSize || (typeof SceneTiles !== 'undefined' ? SceneTiles.defaultTileSize : 800);
        const rotateTiles = layout.rotateTiles !== false;
        let grid;
        if (layout.pool && layout.pool.length && layout.cols != null && layout.rows != null) {
            grid = [];
            const poolEntries = layout.pool.map(entry =>
                typeof entry === 'string' ? { id: entry, weight: 1 } : { id: entry.id, weight: Math.max(0.1, entry.weight || 1) }
            );
            const hasFence = (tileId) => {
                const tile = typeof SceneTiles !== 'undefined' && SceneTiles.getTile ? SceneTiles.getTile(tileId) : null;
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
                const tile = typeof SceneTiles !== 'undefined' && SceneTiles.getTile ? SceneTiles.getTile(tileId) : null;
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
        const entityW = (typeof GameConfig !== 'undefined' && GameConfig.player && GameConfig.player.width != null) ? GameConfig.player.width + 4 : 34;
        const entityH = (typeof GameConfig !== 'undefined' && GameConfig.player && GameConfig.player.height != null) ? GameConfig.player.height + 4 : 34;
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

    generateWorld(worldWidth, worldHeight, config, exclusionZone = null) {
        this.exclusionZones = [{ x: worldWidth / 2, y: worldHeight / 2, radius: 200 }];
        if (exclusionZone && exclusionZone.x != null && exclusionZone.y != null) {
            this.exclusionZones.push({ x: exclusionZone.x, y: exclusionZone.y, radius: exclusionZone.radius || 120 });
        }

        const borderSpacing = (config.border && config.border.spacing) || 50;
        const borderType = config.border && config.border.type || 'tree';
        this.generateBorderTrees(worldWidth, worldHeight, borderSpacing, borderType);

        if (config.useSceneTiles && config.sceneTileLayout) {
            this.placeSceneTilesGrid(config.sceneTileLayout);
            return;
        }

        if (config.forest && config.forest.density != null) {
            this.generateForest(worldWidth, worldHeight, config.forest.density);
        }
        if (config.mushrooms && config.mushrooms.density != null) {
            this.generateMushrooms(worldWidth, worldHeight, config.mushrooms.density);
        }
        if (config.rocks && config.rocks.density != null) {
            this.generateRocks(worldWidth, worldHeight, config.rocks.density);
        }
        if (config.darkRocks && config.darkRocks.density != null) {
            this.generateDarkRocks(worldWidth, worldHeight, config.darkRocks.density);
        }
        if (config.lavaRocks && config.lavaRocks.density != null) {
            this.generateLavaRocks(worldWidth, worldHeight, config.lavaRocks.density);
        }
        if (config.graves && config.graves.count != null) {
            this.generateGraves(worldWidth, worldHeight, config.graves.count);
        }
        if (config.swampPools && config.swampPools.count != null) {
            this.generateSwampPools(worldWidth, worldHeight, config.swampPools.count);
        }
        if (config.demonPillars && config.demonPillars.count != null) {
            this.generateDemonPillars(worldWidth, worldHeight, config.demonPillars.count);
        }
        if (config.braziers && config.braziers.count != null) {
            this.generateBraziers(worldWidth, worldHeight, config.braziers.count);
        }

        if (config.structures) {
            if (config.structures.houses && config.structures.houses.enabled) {
                this.generateHouses(worldWidth, worldHeight, config.structures.houses.count);
            }
            if (config.structures.woodClusters && config.structures.woodClusters.enabled) {
                this.generateWoodClusters(
                    worldWidth, worldHeight, config.structures.woodClusters.count,
                    config.structures.woodClusters.treesPerCluster
                );
            }
            if (config.structures.settlements && config.structures.settlements.enabled) {
                this.generateSettlements(worldWidth, worldHeight, config.structures.settlements.count);
            }
            if (config.structures.firepits && config.structures.firepits.enabled) {
                this.generateFirepits(worldWidth, worldHeight, config.structures.firepits.count);
            }
            if (config.structures.sheds && config.structures.sheds.enabled) {
                this.generateSheds(worldWidth, worldHeight, config.structures.sheds.count);
            }
            if (config.structures.wells && config.structures.wells.enabled) {
                this.generateWells(worldWidth, worldHeight, config.structures.wells.count);
            }
            if (config.structures.ruins && config.structures.ruins.enabled) {
                const r = config.structures.ruins;
                if (r.rubblePiles != null) this.generateRubblePiles(worldWidth, worldHeight, r.rubblePiles);
                if (r.pillarClusters != null) this.generatePillarClusters(worldWidth, worldHeight, r.pillarClusters);
                if (r.ruinedWalls != null) this.generateRuinedWalls(worldWidth, worldHeight, r.ruinedWalls);
                if (r.ruinedStructures != null) this.generateRuinedStructures(worldWidth, worldHeight, r.ruinedStructures);
                if (r.brokenArches != null) this.generateBrokenArches(worldWidth, worldHeight, r.brokenArches);
                if (r.statueRemnants != null) this.generateStatueRemnants(worldWidth, worldHeight, r.statueRemnants);
            }
        }
    }
}

