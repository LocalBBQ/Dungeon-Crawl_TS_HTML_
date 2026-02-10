// Pathfinding System - A* implementation
class PathfindingSystem {
    constructor(obstacleManager, worldWidth, worldHeight, cellSize = 25) {
        this.obstacleManager = obstacleManager;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.cellSize = cellSize;
        this.systems = null;
        this.gridWidth = Math.ceil(worldWidth / cellSize);
        this.gridHeight = Math.ceil(worldHeight / cellSize);
    }

    init(systems) {
        this.systems = systems;
    }

    // Convert world coordinates to grid coordinates
    worldToGrid(x, y) {
        return {
            x: Math.floor(x / this.cellSize),
            y: Math.floor(y / this.cellSize)
        };
    }

    // Convert grid coordinates to world coordinates (center of cell)
    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.cellSize + this.cellSize / 2,
            y: gridY * this.cellSize + this.cellSize / 2
        };
    }

    // Check if a grid cell is walkable
    isWalkable(gridX, gridY, entityWidth, entityHeight) {
        // Clamp to grid bounds
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) {
            return false;
        }

        const worldPos = this.gridToWorld(gridX, gridY);
        return this.obstacleManager.canMoveTo(worldPos.x, worldPos.y, entityWidth, entityHeight);
    }

    // Get neighbors for A* (8-directional)
    getNeighbors(gridX, gridY) {
        const neighbors = [];
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0],           [1, 0],
            [-1, 1],  [0, 1],  [1, 1]
        ];

        for (const [dx, dy] of directions) {
            neighbors.push({ x: gridX + dx, y: gridY + dy });
        }

        return neighbors;
    }

    // Heuristic function for A* (Euclidean distance)
    heuristic(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return Math.sqrt(dx * dx + dy * dy);
    }

    // A* pathfinding algorithm
    findPath(startX, startY, endX, endY, entityWidth, entityHeight) {
        // First check if direct path is available (optimization)
        if (this.hasLineOfSight(startX, startY, endX, endY, entityWidth, entityHeight)) {
            return [{ x: endX, y: endY }];
        }

        const startGrid = this.worldToGrid(startX, startY);
        const endGrid = this.worldToGrid(endX, endY);

        // Check if start or end is unwalkable
        if (!this.isWalkable(startGrid.x, startGrid.y, entityWidth, entityHeight)) {
            // Try to find nearest walkable cell
            const nearest = this.findNearestWalkable(startGrid.x, startGrid.y, entityWidth, entityHeight);
            if (nearest) {
                startGrid.x = nearest.x;
                startGrid.y = nearest.y;
            } else {
                return null;
            }
        }

        if (!this.isWalkable(endGrid.x, endGrid.y, entityWidth, entityHeight)) {
            const nearest = this.findNearestWalkable(endGrid.x, endGrid.y, entityWidth, entityHeight);
            if (nearest) {
                endGrid.x = nearest.x;
                endGrid.y = nearest.y;
            } else {
                return null;
            }
        }

        // A* algorithm
        const openSet = [{ x: startGrid.x, y: startGrid.y }];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${startGrid.x},${startGrid.y}`;
        const endKey = `${endGrid.x},${endGrid.y}`;

        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startGrid, endGrid));

        while (openSet.length > 0) {
            // Find node with lowest fScore
            let currentIndex = 0;
            for (let i = 1; i < openSet.length; i++) {
                const currentKey = `${openSet[currentIndex].x},${openSet[currentIndex].y}`;
                const iKey = `${openSet[i].x},${openSet[i].y}`;
                if ((fScore.get(iKey) || Infinity) < (fScore.get(currentKey) || Infinity)) {
                    currentIndex = i;
                }
            }

            const current = openSet.splice(currentIndex, 1)[0];
            const currentKey = `${current.x},${current.y}`;

            // Reached goal
            if (currentKey === endKey) {
                // Reconstruct path
                const path = [];
                let node = current;
                while (node) {
                    const worldPos = this.gridToWorld(node.x, node.y);
                    path.unshift({ x: worldPos.x, y: worldPos.y });
                    const nodeKey = `${node.x},${node.y}`;
                    node = cameFrom.get(nodeKey);
                }
                // Add final destination
                path.push({ x: endX, y: endY });
                return path;
            }

            // Check neighbors
            const neighbors = this.getNeighbors(current.x, current.y);
            for (const neighbor of neighbors) {
                if (!this.isWalkable(neighbor.x, neighbor.y, entityWidth, entityHeight)) {
                    continue;
                }

                const neighborKey = `${neighbor.x},${neighbor.y}`;
                const tentativeG = (gScore.get(currentKey) || Infinity) + 
                    this.heuristic(current, neighbor);

                if (tentativeG < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, endGrid));

                    // Add to open set if not already there
                    if (!openSet.some(n => `${n.x},${n.y}` === neighborKey)) {
                        openSet.push(neighbor);
                    }
                }
            }

            // Limit pathfinding to prevent performance issues
            if (openSet.length > 500) {
                break;
            }
        }

        // No path found - return null
        return null;
    }

    // Find nearest walkable cell
    findNearestWalkable(gridX, gridY, entityWidth, entityHeight, maxRadius = 5) {
        for (let radius = 1; radius <= maxRadius; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                        const x = gridX + dx;
                        const y = gridY + dy;
                        if (this.isWalkable(x, y, entityWidth, entityHeight)) {
                            return { x, y };
                        }
                    }
                }
            }
        }
        return null;
    }

    hasLineOfSight(x1, y1, x2, y2, entityWidth, entityHeight) {
        const distance = Utils.distance(x1, y1, x2, y2);
        const steps = Math.max(10, Math.ceil(distance / (this.cellSize / 2)));
        
        // Check multiple points along the path, accounting for entity size
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Utils.lerp(x1, x2, t);
            const y = Utils.lerp(y1, y2, t);
            
            // Check center and corners of entity bounding box
            const halfWidth = entityWidth / 2;
            const halfHeight = entityHeight / 2;
            
            const checkPoints = [
                { x: x, y: y }, // center
                { x: x - halfWidth, y: y - halfHeight }, // top-left
                { x: x + halfWidth, y: y - halfHeight }, // top-right
                { x: x - halfWidth, y: y + halfHeight }, // bottom-left
                { x: x + halfWidth, y: y + halfHeight }  // bottom-right
            ];
            
            for (const point of checkPoints) {
                if (!this.obstacleManager.canMoveTo(point.x, point.y, entityWidth, entityHeight)) {
                    return false;
                }
            }
        }
        
        return true;
    }
}

