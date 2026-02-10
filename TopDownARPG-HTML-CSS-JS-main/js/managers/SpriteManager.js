// Sprite Manager - handles loading and caching of sprite sheets
class SpriteManager {
    constructor() {
        this.sprites = new Map(); // Cache loaded sprites
        this.spriteSheets = new Map(); // Cache sprite sheets with metadata
        this.loadingPromises = new Map(); // Track loading promises to avoid duplicate loads
    }

    // Load a single sprite image
    async loadSprite(path) {
        if (this.sprites.has(path)) {
            return this.sprites.get(path);
        }

        if (this.loadingPromises.has(path)) {
            return this.loadingPromises.get(path);
        }

        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.sprites.set(path, img);
                this.loadingPromises.delete(path);
                resolve(img);
            };
            img.onerror = () => {
                this.loadingPromises.delete(path);
                reject(new Error(`Failed to load sprite: ${path}`));
            };
            img.src = path;
        });

        this.loadingPromises.set(path, promise);
        return promise;
    }

    // Load a sprite sheet with frame definitions
    async loadSpriteSheet(path, frameWidth, frameHeight, rows, cols) {
        const key = `${path}_${frameWidth}_${frameHeight}_${rows}_${cols}`;
        if (this.spriteSheets.has(key)) {
            return this.spriteSheets.get(key);
        }

        const img = await this.loadSprite(path);
        const sheet = {
            image: img,
            frameWidth,
            frameHeight,
            rows,
            cols,
            totalFrames: rows * cols
        };
        
        this.spriteSheets.set(key, sheet);
        return sheet;
    }

    // Load a horizontal sprite sheet (single row, auto-detect frame count)
    async loadHorizontalSpriteSheet(path, frameWidth = null, frameHeight = null) {
        const key = `${path}_horizontal`;
        if (this.spriteSheets.has(key)) {
            return this.spriteSheets.get(key);
        }

        const img = await this.loadSprite(path);
        
        // Auto-detect frame dimensions for both width and height
        // First detect frame width (columns)
        let detectedFrameWidth = frameWidth;
        let detectedCols = 1;
        if (!detectedFrameWidth) {
            // Try to detect frame width by checking if image width is divisible by common frame counts
            // Common frame counts: 4, 6, 8, 10, 12, 16, 20, 24, 32
            const commonFrameCounts = [4, 6, 8, 10, 12, 16, 20, 24, 32];
            let bestMatch = null;
            let bestCount = null;
            
            for (const count of commonFrameCounts) {
                const testWidth = img.width / count;
                // Check if width divides evenly (within 1 pixel tolerance)
                const remainder = Math.abs(img.width - (testWidth * count));
                if (remainder < 1) {
                    // Prefer higher frame counts when division is exact
                    if (!bestMatch || count > bestCount) {
                        bestMatch = testWidth;
                        bestCount = count;
                    }
                }
            }
            
            if (bestMatch) {
                detectedFrameWidth = bestMatch;
                detectedCols = bestCount;
            } else {
                // If no clean division found, assume single frame width
                console.warn(`Could not auto-detect frame width for ${path}, assuming full width`);
                detectedFrameWidth = img.width;
                detectedCols = 1;
            }
        } else {
            detectedCols = Math.floor(img.width / detectedFrameWidth);
        }
        
        // Ensure frame width is valid (must be less than image width)
        if (detectedFrameWidth >= img.width) {
            console.error(`Invalid frame width detected: ${detectedFrameWidth} >= ${img.width} for ${path}`);
            detectedFrameWidth = img.width / 8; // Fallback to 8 frames
            detectedCols = 8;
        }
        
        // Validate columns
        if (detectedCols < 1) {
            console.error(`Invalid frame count detected: ${detectedCols} for ${path}`);
            detectedCols = 1;
            detectedFrameWidth = img.width;
        }
        
        // Now detect frame height (rows)
        let detectedFrameHeight = frameHeight;
        let detectedRows = 1;
        if (!detectedFrameHeight) {
            // Try to detect frame height by checking if image height is divisible by common row counts
            // Common row counts: 1, 2, 4, 6, 8, 10, 12, 16
            const commonRowCounts = [1, 2, 4, 6, 8, 10, 12, 16];
            let bestRowMatch = null;
            let bestRowCount = null;
            
            for (const rowCount of commonRowCounts) {
                const testHeight = img.height / rowCount;
                // Check if height divides evenly (within 1 pixel tolerance)
                const remainder = Math.abs(img.height - (testHeight * rowCount));
                if (remainder < 1) {
                    // Calculate aspect ratio of the frame (width/height)
                    const aspectRatio = detectedFrameWidth / testHeight;
                    // Prefer row counts that result in reasonable frame aspect ratios
                    // Character sprites are typically taller than wide (aspect ratio < 1)
                    // Prefer aspect ratios between 0.3 and 0.8 (reasonable for character sprites)
                    // If no match in that range, prefer higher row counts
                    const isReasonableAspect = aspectRatio >= 0.3 && aspectRatio <= 0.8;
                    const bestAspectRatio = bestRowMatch ? detectedFrameWidth / bestRowMatch : null;
                    const bestIsReasonable = bestAspectRatio && bestAspectRatio >= 0.3 && bestAspectRatio <= 0.8;
                    
                    if (!bestRowMatch) {
                        bestRowMatch = testHeight;
                        bestRowCount = rowCount;
                    } else if (isReasonableAspect && !bestIsReasonable) {
                        // Current is reasonable, best is not - prefer current
                        bestRowMatch = testHeight;
                        bestRowCount = rowCount;
                    } else if (isReasonableAspect && bestIsReasonable) {
                        // Both are reasonable - prefer the one closer to 0.5 (square-ish but taller)
                        const currentScore = Math.abs(aspectRatio - 0.5);
                        const bestScore = Math.abs(bestAspectRatio - 0.5);
                        if (currentScore < bestScore) {
                            bestRowMatch = testHeight;
                            bestRowCount = rowCount;
                        }
                    } else if (!isReasonableAspect && !bestIsReasonable) {
                        // Neither is reasonable - prefer higher row count (more frames)
                        if (rowCount > bestRowCount) {
                            bestRowMatch = testHeight;
                            bestRowCount = rowCount;
                        }
                    }
                }
            }
            
            if (bestRowMatch) {
                detectedFrameHeight = bestRowMatch;
                detectedRows = bestRowCount;
            } else {
                // Default to single row (full height) only if no match found
                detectedFrameHeight = img.height;
                detectedRows = 1;
            }
        } else {
            detectedRows = Math.floor(img.height / detectedFrameHeight);
        }
        
        // Validate rows
        if (detectedRows < 1) {
            detectedRows = 1;
            detectedFrameHeight = img.height;
        }
        
        const sheet = {
            image: img,
            frameWidth: detectedFrameWidth,
            frameHeight: detectedFrameHeight,
            rows: detectedRows,
            cols: detectedCols,
            totalFrames: detectedRows * detectedCols
        };
        
        this.spriteSheets.set(key, sheet);
        console.log(`Loaded sprite sheet: ${path}`);
        console.log(`  Image: ${img.width}x${img.height}`);
        console.log(`  Frame: ${detectedFrameWidth}x${detectedFrameHeight}`);
        console.log(`  Grid: ${detectedRows} rows x ${detectedCols} columns = ${sheet.totalFrames} total frames`);
        
        return sheet;
    }

    // Preload multiple sprites
    async preloadSprites(spritePaths) {
        return Promise.all(spritePaths.map(path => this.loadSprite(path)));
    }

    // Get a sprite sheet by key
    getSpriteSheet(key) {
        // First try direct lookup
        if (this.spriteSheets.has(key)) {
            const sheet = this.spriteSheets.get(key);
            return sheet;
        }
        
        // If key is just a path, try to find sprite sheet by path prefix
        for (const [sheetKey, sheet] of this.spriteSheets.entries()) {
            if (sheetKey.startsWith(key)) {
                return sheet;
            }
        }
        
        return null;
    }

    // Get a sprite by path
    getSprite(path) {
        return this.sprites.get(path);
    }
    
    // Find sprite sheet by path (useful when you only know the image path)
    findSpriteSheetByPath(path) {
        for (const [key, sheet] of this.spriteSheets.entries()) {
            if (key.startsWith(path)) {
                return { key, sheet };
            }
        }
        return null;
    }
}

