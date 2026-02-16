// Structure Generator - creates complex patterns like houses, wood clusters, etc.
import { Utils } from '../utils/Utils.ts';
import type { ObjectFactory, CreatedObject } from './ObjectFactory.ts';

interface ObstacleManagerWithFactory {
  factory: ObjectFactory;
}

export class StructureGenerator {
    obstacleManager: ObstacleManagerWithFactory;
    factory: ObjectFactory;

    constructor(obstacleManager: ObstacleManagerWithFactory) {
        this.obstacleManager = obstacleManager;
        this.factory = obstacleManager.factory;
    }

    generateHouse(centerX: number, centerY: number, size = 200): CreatedObject[] {
        const houseObjects = [];
        const wallThickness = 20;
        const doorWidth = 80;
        const wallSegmentSize = 20; // Fixed wall segment size for grid alignment
        
        // House walls (rectangle)
        const halfSize = size / 2;
        
        // Create walls using grid-based segments for consistency
        // Top wall - create segments along the top edge
        const topWallSegments = Math.ceil(size / wallSegmentSize);
        for (let i = 0; i < topWallSegments; i++) {
            const segmentX = centerX - halfSize + (i * wallSegmentSize);
            const segmentWidth = Math.min(wallSegmentSize, centerX + halfSize - segmentX);
            if (segmentWidth > 0) {
                this.createWallSegment(segmentX, centerY - halfSize, segmentWidth, wallThickness, houseObjects);
            }
        }
        
        // Bottom wall
        for (let i = 0; i < topWallSegments; i++) {
            const segmentX = centerX - halfSize + (i * wallSegmentSize);
            const segmentWidth = Math.min(wallSegmentSize, centerX + halfSize - segmentX);
            if (segmentWidth > 0) {
                this.createWallSegment(segmentX, centerY + halfSize - wallThickness, segmentWidth, wallThickness, houseObjects);
            }
        }
        
        // Left wall (with door opening in the middle)
        const leftWallHeight = size;
        const leftWallSegments = Math.ceil(leftWallHeight / wallSegmentSize);
        const doorStartSegment = Math.floor((leftWallSegments / 2) - (doorWidth / 2 / wallSegmentSize));
        const doorSegmentCount = Math.ceil(doorWidth / wallSegmentSize);
        
        for (let i = 0; i < leftWallSegments; i++) {
            // Skip segments that are part of the door opening
            if (i >= doorStartSegment && i < doorStartSegment + doorSegmentCount) {
                continue;
            }
            const segmentY = centerY - halfSize + (i * wallSegmentSize);
            const segmentHeight = Math.min(wallSegmentSize, centerY + halfSize - segmentY);
            if (segmentHeight > 0) {
                this.createWallSegment(centerX - halfSize, segmentY, wallThickness, segmentHeight, houseObjects);
            }
        }
        
        // Right wall
        for (let i = 0; i < leftWallSegments; i++) {
            const segmentY = centerY - halfSize + (i * wallSegmentSize);
            const segmentHeight = Math.min(wallSegmentSize, centerY + halfSize - segmentY);
            if (segmentHeight > 0) {
                this.createWallSegment(centerX + halfSize - wallThickness, segmentY, wallThickness, segmentHeight, houseObjects);
            }
        }
        
        return houseObjects;
    }

    createWallSegment(x: number, y: number, width: number, height: number, objects: CreatedObject[]): void {
        // Create wall segment with fixed dimensions for grid alignment
        const segment = {
            x: x,
            y: y,
            width: width,
            height: height,
            type: 'wall',
            spritePath: this.factory.getConfig('wall').defaultSpritePath,
            color: this.factory.getConfig('wall').color
        };
        objects.push(segment);
    }

    generateWoodCluster(centerX: number, centerY: number, radius = 150, treeCount = 8): CreatedObject[] {
        const trees: CreatedObject[] = [];
        
        // Create a cluster with trees distributed in a natural pattern
        for (let i = 0; i < treeCount; i++) {
            // Use a more natural distribution (slightly clustered)
            const angle = Math.random() * Math.PI * 2;
            const distance = Utils.random(0, radius * (0.3 + Math.random() * 0.7)); // More trees near center
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            const tree = this.factory.createObject(x, y, 'tree');
            trees.push(tree);
        }
        
        return trees;
    }

    // Generate a tree line (for paths or boundaries)
    generateTreeLine(startX, startY, endX, endY, spacing = 60, jitter = 10) {
        const trees = [];
        const distance = Utils.distance(startX, startY, endX, endY);
        const numTrees = Math.floor(distance / spacing);
        const angle = Math.atan2(endY - startY, endX - startX);
        
        for (let i = 0; i <= numTrees; i++) {
            const t = i / numTrees;
            let x = startX + (endX - startX) * t;
            let y = startY + (endY - startY) * t;
            
            // Add perpendicular jitter for natural look
            const perpAngle = angle + Math.PI / 2;
            x += Math.cos(perpAngle) * Utils.random(-jitter, jitter);
            y += Math.sin(perpAngle) * Utils.random(-jitter, jitter);
            
            const tree = this.factory.createObject(x, y, 'tree');
            trees.push(tree);
        }
        
        return trees;
    }

    // Generate a simple shed
    generateShed(centerX, centerY, size = 120) {
        const shed = this.factory.createObject(centerX, centerY, 'shed', size);
        return [shed];
    }

    // Generate a firepit with seating area
    generateFirepit(centerX, centerY, radius = 100) {
        const objects = [];
        
        // Create a ring of stones around the firepit
        const stoneRingRadius = 35;
        const stoneCount = 8;
        for (let i = 0; i < stoneCount; i++) {
            const angle = (i / stoneCount) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * stoneRingRadius;
            const y = centerY + Math.sin(angle) * stoneRingRadius;
            
            // Use smaller rocks for the ring
            const stone = this.factory.createObject(x, y, 'rock', 25);
            objects.push(stone);
        }
        
        // Firepit in center
        const firepit = this.factory.createObject(centerX, centerY, 'firepit', 45);
        objects.push(firepit);
        
        // Add seating rocks around it (4-6 rocks at varying distances)
        const rockCount = Utils.randomInt(4, 6);
        for (let i = 0; i < rockCount; i++) {
            const angle = (i / rockCount) * Math.PI * 2 + Math.random() * 0.3;
            const distance = Utils.random(radius * 0.7, radius * 1.1);
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Larger rocks for seating
            const rock = this.factory.createObject(x, y, 'rock', Utils.randomInt(35, 45));
            objects.push(rock);
        }
        
        return objects;
    }

    // Generate a well
    generateWell(centerX, centerY, size = 45) {
        const well = this.factory.createObject(centerX, centerY, 'well', size);
        return [well];
    }

    // Generate a fence segment
    generateFenceSegment(startX, startY, endX, endY, spacing = 20) {
        const fencePosts = [];
        const distance = Utils.distance(startX, startY, endX, endY);
        const numPosts = Math.floor(distance / spacing);
        const angle = Math.atan2(endY - startY, endX - startX);
        
        for (let i = 0; i <= numPosts; i++) {
            const t = i / numPosts;
            const x = startX + (endX - startX) * t;
            const y = startY + (endY - startY) * t;
            
            const post = this.factory.createObject(x, y, 'fence');
            fencePosts.push(post);
        }
        
        return fencePosts;
    }

    // Generate a fenced area (rectangular)
    generateFencedArea(centerX, centerY, width, height) {
        const objects = [];
        const halfW = width / 2;
        const halfH = height / 2;
        const spacing = 20;
        
        // Top fence
        objects.push(...this.generateFenceSegment(
            centerX - halfW, centerY - halfH,
            centerX + halfW, centerY - halfH,
            spacing
        ));
        
        // Bottom fence
        objects.push(...this.generateFenceSegment(
            centerX - halfW, centerY + halfH,
            centerX + halfW, centerY + halfH,
            spacing
        ));
        
        // Left fence
        objects.push(...this.generateFenceSegment(
            centerX - halfW, centerY - halfH,
            centerX - halfW, centerY + halfH,
            spacing
        ));
        
        // Right fence
        objects.push(...this.generateFenceSegment(
            centerX + halfW, centerY - halfH,
            centerX + halfW, centerY + halfH,
            spacing
        ));
        
        return objects;
    }

    // Generate decorative barrels/crates
    generateStorageArea(centerX, centerY, count = 3, radius = 40) {
        const objects = [];
        
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Utils.random(0, radius);
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            const barrel = this.factory.createObject(x, y, 'barrel');
            objects.push(barrel);
        }
        
        return objects;
    }

    // Generate a forest clearing (trees around an open area)
    generateClearing(centerX, centerY, clearingRadius = 100, treeRingRadius = 150, treeCount = 12) {
        const trees = [];
        
        // Place trees in a ring around the clearing
        for (let i = 0; i < treeCount; i++) {
            const angle = (i / treeCount) * Math.PI * 2;
            const distance = Utils.random(treeRingRadius, treeRingRadius + 50);
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            const tree = this.factory.createObject(x, y, 'tree');
            trees.push(tree);
        }
        
        return trees;
    }

    // Enhanced settlement generator with all features
    generateSettlement(centerX, centerY, houseCount = 3, radius = 200) {
        const structures = [];
        
        // Generate houses
        for (let i = 0; i < houseCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Utils.random(radius * 0.3, radius);
            const houseX = centerX + Math.cos(angle) * distance;
            const houseY = centerY + Math.sin(angle) * distance;
            
            const houseSize = Utils.randomInt(160, 240);
            const houseObjects = this.generateHouse(houseX, houseY, houseSize);
            structures.push(...houseObjects);
            
            // Add a shed near some houses (50% chance)
            if (Math.random() < 0.5) {
                const shedAngle = angle + Utils.random(-Math.PI/3, Math.PI/3);
                const shedDistance = houseSize / 2 + 40;
                const shedX = houseX + Math.cos(shedAngle) * shedDistance;
                const shedY = houseY + Math.sin(shedAngle) * shedDistance;
                
                const shedObjects = this.generateShed(shedX, shedY);
                structures.push(...shedObjects);
            }
        }
        
        // Add a central firepit (gathering area)
        const firepitObjects = this.generateFirepit(centerX, centerY, 120);
        structures.push(...firepitObjects);
        
        // Add a well (water source) - offset from center
        const wellAngle = Math.random() * Math.PI * 2;
        const wellDistance = radius * 0.4;
        const wellX = centerX + Math.cos(wellAngle) * wellDistance;
        const wellY = centerY + Math.sin(wellAngle) * wellDistance;
        const wellObjects = this.generateWell(wellX, wellY);
        structures.push(...wellObjects);
        
        // Add some storage areas (barrels/crates) near houses
        const storageCount = Math.floor(houseCount * 0.7);
        for (let i = 0; i < storageCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Utils.random(radius * 0.5, radius * 0.8);
            const storageX = centerX + Math.cos(angle) * distance;
            const storageY = centerY + Math.sin(angle) * distance;
            
            const storageObjects = this.generateStorageArea(storageX, storageY, Utils.randomInt(2, 4));
            structures.push(...storageObjects);
        }
        
        // Optionally add a fenced area (garden/pasture) - 30% chance
        if (Math.random() < 0.3) {
            const fenceAngle = Math.random() * Math.PI * 2;
            const fenceDistance = radius * 0.6;
            const fenceX = centerX + Math.cos(fenceAngle) * fenceDistance;
            const fenceY = centerY + Math.sin(fenceAngle) * fenceDistance;
            
            const fencedArea = this.generateFencedArea(fenceX, fenceY, 120, 100);
            structures.push(...fencedArea);
        }
        
        return structures;
    }

    // --- Ruins-themed structure generators ---

    // Irregular ruined wall (crumbling segments with gaps)
    generateRuinedWall(startX, startY, endX, endY, segmentSpacing = 28, gapChance = 0.35) {
        const objects = [];
        const distance = Utils.distance(startX, startY, endX, endY);
        const numSegments = Math.floor(distance / segmentSpacing);
        const angle = Math.atan2(endY - startY, endX - startX);

        for (let i = 0; i <= numSegments; i++) {
            if (Math.random() < gapChance) continue; // Skip for collapsed gap
            const t = numSegments > 0 ? i / numSegments : 0;
            const x = startX + (endX - startX) * t + Utils.random(-5, 5);
            const y = startY + (endY - startY) * t + Utils.random(-5, 5);
            const seg = this.factory.createObject(x, y, 'crumblingWall');
            objects.push(seg);
        }
        return objects;
    }

    // Cluster of standing or broken pillars
    generatePillarCluster(centerX, centerY, radius = 80, count = 4, mixBroken = true) {
        const objects = [];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Utils.random(0, radius);
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            const type = mixBroken && Math.random() < 0.5 ? 'brokenPillar' : 'pillar';
            objects.push(this.factory.createObject(x, y, type));
        }
        return objects;
    }

    // Scattered rubble and stone debris in an area
    generateRubblePile(centerX, centerY, radius = 60, rubbleCount = 5, debrisCount = 8) {
        const objects = [];
        for (let i = 0; i < rubbleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Utils.random(0, radius);
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            objects.push(this.factory.createObject(x, y, 'rubble'));
        }
        for (let i = 0; i < debrisCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Utils.random(0, radius);
            const x = centerX + Math.cos(angle) * dist;
            const y = centerY + Math.sin(angle) * dist;
            objects.push(this.factory.createObject(x, y, 'stoneDebris'));
        }
        return objects;
    }

    // Collapsed building outline (broken walls with gaps and rubble inside)
    generateRuinedStructure(centerX, centerY, size = 180) {
        const objects = [];
        const half = size / 2;
        const gapChance = 0.4;

        // Four walls with gaps
        objects.push(...this.generateRuinedWall(
            centerX - half, centerY - half,
            centerX + half, centerY - half,
            25, gapChance
        ));
        objects.push(...this.generateRuinedWall(
            centerX + half, centerY - half,
            centerX + half, centerY + half,
            25, gapChance
        ));
        objects.push(...this.generateRuinedWall(
            centerX + half, centerY + half,
            centerX - half, centerY + half,
            25, gapChance
        ));
        objects.push(...this.generateRuinedWall(
            centerX - half, centerY + half,
            centerX - half, centerY - half,
            25, gapChance
        ));

        // Interior rubble
        const rubbleInCenter = this.generateRubblePile(centerX, centerY, size * 0.35, 4, 6);
        objects.push(...rubbleInCenter);

        return objects;
    }

    // Single broken arch (arch + optional pillar stubs)
    generateBrokenArch(centerX, centerY, size = 75) {
        const objects = [];
        objects.push(this.factory.createObject(centerX, centerY, 'arch', size));
        if (Math.random() < 0.6) {
            const offset = size * 0.55;
            objects.push(this.factory.createObject(centerX - offset, centerY, 'column', size * 0.4));
            objects.push(this.factory.createObject(centerX + offset, centerY, 'column', size * 0.4));
        }
        return objects;
    }

    // Statue base or broken monument
    generateStatueRemnant(centerX, centerY, size = 50) {
        const objects = [];
        objects.push(this.factory.createObject(centerX, centerY, 'statueBase', size));
        if (Math.random() < 0.5) {
            const angle = Math.random() * Math.PI * 2;
            const dist = size * 0.6;
            objects.push(this.factory.createObject(
                centerX + Math.cos(angle) * dist,
                centerY + Math.sin(angle) * dist,
                'stoneDebris'
            ));
        }
        return objects;
    }
}

declare global {
  interface Window {
    StructureGenerator?: typeof StructureGenerator;
  }
}
if (typeof window !== 'undefined') {
  (window as Window).StructureGenerator = StructureGenerator;
}
