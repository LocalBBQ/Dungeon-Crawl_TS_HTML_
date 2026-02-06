// Obstacle/Environment objects for collision
class Obstacle {
    constructor(x, y, width, height, type = 'tree') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'tree', 'rock', 'bush', etc.
        this.sprite = null; // Will hold loaded image
        this.spritePath = null; // Path to sprite image
    }

    // Check collision with player
    checkCollision(player) {
        return Utils.rectCollision(
            this.x, this.y, this.width, this.height,
            player.x - player.width/2, player.y - player.height/2, 
            player.width, player.height
        );
    }
}

// Object Factory - defines configurations for different object types
class ObjectFactory {
    constructor() {
        // Define object type configurations
        this.configs = {
            tree: {
                minSize: 40,
                maxSize: 60,
                defaultSpritePath: 'assets/tree.png',
                color: '#2d5016' // For fallback rendering
            },
            rock: {
                minSize: 30,
                maxSize: 50,
                defaultSpritePath: 'assets/rock.png',
                color: '#555555' // For fallback rendering
            },
            bush: {
                minSize: 25,
                maxSize: 35,
                defaultSpritePath: 'assets/bush.png',
                color: '#3a5a2a' // For fallback rendering
            }
        };
    }

    // Get configuration for an object type
    getConfig(type) {
        return this.configs[type] || this.configs.tree;
    }

    // Create an object at a specific position
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

    // Create multiple objects in an area
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

    // Create objects along a border
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
        this.loadedSprites = new Map(); // Cache loaded images
        this.factory = new ObjectFactory(); // Object creation factory
    }

    // Add an obstacle (using factory)
    addObstacle(x, y, width, height, type, spritePath = null) {
        const obstacle = new Obstacle(x, y, width, height, type);
        if (spritePath) {
            obstacle.spritePath = spritePath;
            this.loadSprite(spritePath);
        }
        this.obstacles.push(obstacle);
        return obstacle;
    }

    // Create and add object using factory
    createObject(x, y, type = 'tree', customSize = null, spritePath = null) {
        const objData = this.factory.createObject(x, y, type, customSize, spritePath);
        return this.addObstacle(objData.x, objData.y, objData.width, objData.height, objData.type, objData.spritePath);
    }

    // Load sprite image
    loadSprite(path) {
        if (this.loadedSprites.has(path)) {
            return this.loadedSprites.get(path);
        }
        
        const img = new Image();
        img.src = path;
        this.loadedSprites.set(path, img);
        return img;
    }

    // Check if player can move to a position
    canMoveTo(x, y, playerWidth, playerHeight) {
        for (const obstacle of this.obstacles) {
            if (Utils.rectCollision(
                x - playerWidth/2, y - playerHeight/2, playerWidth, playerHeight,
                obstacle.x, obstacle.y, obstacle.width, obstacle.height
            )) {
                return false;
            }
        }
        return true;
    }

    // Check if an object would overlap with existing obstacles
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

    // Generate a random forest using factory
    generateForest(worldWidth, worldHeight, density = 0.02) {
        const tileSize = 50;
        const numTrees = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('tree');
        
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 200
        };
        
        let treesPlaced = 0;
        let attempts = 0;
        const maxAttempts = numTrees * 3; // Allow more attempts per tree
        
        while (treesPlaced < numTrees && attempts < maxAttempts) {
            attempts++;
            
            // Generate random position
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            
            // Check exclusion area
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            // Create object to get its size
            const obj = this.factory.createObject(x, y, 'tree');
            
            // Check collision with existing obstacles
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                treesPlaced++;
            }
        }
    }

    // Generate rocks scattered across the world
    generateRocks(worldWidth, worldHeight, density = 0.015) {
        const tileSize = 50;
        const numRocks = Math.floor(worldWidth * worldHeight * density / (tileSize * tileSize));
        const config = this.factory.getConfig('rock');
        
        const excludeArea = {
            x: worldWidth / 2,
            y: worldHeight / 2,
            radius: 200
        };
        
        let rocksPlaced = 0;
        let attempts = 0;
        const maxAttempts = numRocks * 3; // Allow more attempts per rock
        
        while (rocksPlaced < numRocks && attempts < maxAttempts) {
            attempts++;
            
            // Generate random position
            const x = Utils.randomInt(0, worldWidth - config.maxSize);
            const y = Utils.randomInt(0, worldHeight - config.maxSize);
            
            // Check exclusion area
            const distFromCenter = Utils.distance(x, y, excludeArea.x, excludeArea.y);
            if (distFromCenter < excludeArea.radius) {
                continue;
            }
            
            // Create object to get its size
            const obj = this.factory.createObject(x, y, 'rock');
            
            // Check collision with existing obstacles (trees and other rocks)
            if (!this.wouldOverlap(obj.x, obj.y, obj.width, obj.height)) {
                this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
                rocksPlaced++;
            }
        }
    }

    // Generate trees along the world borders using factory
    generateBorderTrees(worldWidth, worldHeight, spacing = 50) {
        const treeObjects = this.factory.createObjectsAlongBorder(
            worldWidth, worldHeight, 'tree', spacing, 'all'
        );
        
        treeObjects.forEach(obj => {
            this.addObstacle(obj.x, obj.y, obj.width, obj.height, obj.type, obj.spritePath);
        });
    }
}
