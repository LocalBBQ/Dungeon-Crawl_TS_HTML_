// Obstacle/Environment objects for collision
class Obstacle {
    constructor(x, y, width, height, type = 'tree') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.sprite = null;
        this.spritePath = null;
    }

    checkCollision(entity) {
        const transform = entity.getComponent(Transform);
        if (!transform) return false;
        
        return Utils.rectCollision(
            this.x, this.y, this.width, this.height,
            transform.left, transform.top, transform.width, transform.height
        );
    }
}

// Object Factory - defines configurations for different object types
class ObjectFactory {
    constructor() {
        this.configs = {
            tree: {
                minSize: 40,
                maxSize: 60,
                defaultSpritePath: 'assets/tree.png',
                color: '#2d5016'
            },
            rock: {
                minSize: 30,
                maxSize: 50,
                defaultSpritePath: 'assets/rock.png',
                color: '#555555'
            },
            bush: {
                minSize: 25,
                maxSize: 35,
                defaultSpritePath: 'assets/bush.png',
                color: '#3a5a2a'
            }
        };
    }

    getConfig(type) {
        return this.configs[type] || this.configs.tree;
    }

    createObject(x, y, type = 'tree', customSize = null, spritePath = null) {
        const config = this.getConfig(type);
        const size = customSize || Utils.randomInt(config.minSize, config.maxSize);
        const path = spritePath || config.defaultSpritePath;
        
        return {
            x: x,
            y: y,
            width: size,
            height: size,
            type: type,
            spritePath: path,
            color: config.color
        };
    }

    createObjectsInArea(startX, startY, endX, endY, type, count, excludeArea = null) {
        const objects = [];
        const config = this.getConfig(type);
        
        for (let i = 0; i < count; i++) {
            let x, y;
            let attempts = 0;
            const maxAttempts = 100;
            
            do {
                x = Utils.randomInt(startX, endX - config.maxSize);
                y = Utils.randomInt(startY, endY - config.maxSize);
                attempts++;
            } while (excludeArea && 
                     Utils.distance(x, y, excludeArea.x, excludeArea.y) < excludeArea.radius &&
                     attempts < maxAttempts);
            
            if (attempts < maxAttempts) {
                objects.push(this.createObject(x, y, type));
            }
        }
        
        return objects;
    }

    createObjectsAlongBorder(worldWidth, worldHeight, type, spacing, border = 'all') {
        const objects = [];
        const config = this.getConfig(type);
        const maxSize = config.maxSize;
        
        if (border === 'all' || border === 'top') {
            for (let x = 0; x < worldWidth; x += spacing) {
                objects.push(this.createObject(x, 0, type));
            }
        }
        
        if (border === 'all' || border === 'bottom') {
            for (let x = 0; x < worldWidth; x += spacing) {
                objects.push(this.createObject(x, worldHeight - maxSize, type));
            }
        }
        
        if (border === 'all' || border === 'left') {
            for (let y = spacing; y < worldHeight - spacing; y += spacing) {
                objects.push(this.createObject(0, y, type));
            }
        }
        
        if (border === 'all' || border === 'right') {
            for (let y = spacing; y < worldHeight - spacing; y += spacing) {
                objects.push(this.createObject(worldWidth - maxSize, y, type));
            }
        }
        
        return objects;
    }
}

// Manager for all obstacles
class ObstacleManager {
    constructor() {
        this.obstacles = [];
        this.loadedSprites = new Map();
        this.factory = new ObjectFactory();
    }

    init(systems) {
        this.systems = systems;
    }

    addObstacle(x, y, width, height, type, spritePath = null) {
        const obstacle = new Obstacle(x, y, width, height, type);
        if (spritePath) {
            obstacle.spritePath = spritePath;
            this.loadSprite(spritePath);
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

    canMoveTo(x, y, entityWidth, entityHeight) {
        for (const obstacle of this.obstacles) {
            if (Utils.rectCollision(
                x - entityWidth/2, y - entityHeight/2, entityWidth, entityHeight,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height
            )) {
                return false;
            }
        }
        return true;
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
        return false;
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

    generateBorderTrees(worldWidth, worldHeight, spacing = 50) {
        const treeObjects = this.factory.createObjectsAlongBorder(
            worldWidth, worldHeight, 'tree', spacing, 'all'
        );
        
        treeObjects.forEach(obj => {
            this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
        });
    }

    generateWorld(worldWidth, worldHeight, config) {
        this.generateBorderTrees(worldWidth, worldHeight, config.border.spacing);
        this.generateForest(worldWidth, worldHeight, config.forest.density);
        this.generateRocks(worldWidth, worldHeight, config.rocks.density);
    }
}

