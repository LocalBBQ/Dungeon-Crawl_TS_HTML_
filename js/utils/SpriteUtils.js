// Sprite utility functions for direction mapping and animation
const SpriteUtils = {
    // Convert facing angle to 4-direction index
    // Returns: 0 = right, 1 = down, 2 = left, 3 = up
    angleToDirection(angle) {
        const normalized = ((angle + Math.PI * 2) % (Math.PI * 2));
        
        // Map to 4 directions
        if (normalized >= -Math.PI/4 && normalized < Math.PI/4) return 0; // Right
        if (normalized >= Math.PI/4 && normalized < 3*Math.PI/4) return 1; // Down
        if (normalized >= 3*Math.PI/4 || normalized < -3*Math.PI/4) return 2; // Left
        return 3; // Up
    },

    // Get direction name for sprite path
    getDirectionName(direction) {
        const names = ['right', 'down', 'left', 'up'];
        return names[direction] || 'right';
    },

    // Convert facing angle to 8-direction index
    // Returns row index for Walk.png sprite sheet (8 rows, 13 columns):
    //   Row 0: East (0°)
    //   Row 1: South East (45°)
    //   Row 2: South (90°)
    //   Row 3: South West (135°)
    //   Row 4: West (180°)
    //   Row 5: North West (225°)
    //   Row 6: North (270°)
    //   Row 7: North East (315°)
    angleTo8Direction(angle) {
        // Normalize angle to 0-2π range
        let normalized = angle;
        while (normalized < 0) normalized += Math.PI * 2;
        while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;
        
        // Map angle ranges to row indices
        // Each sector is π/4 (45°) wide, centered on the cardinal/intercardinal directions
        const sectorSize = Math.PI / 4; // 45 degrees
        const offset = sectorSize / 2; // Offset to center sectors
        
        // Calculate which sector the angle falls into
        let sector = Math.floor((normalized + offset) / sectorSize);
        
        // Handle edge case at 2π (should map to row 0, East)
        if (sector >= 8) sector = 0;
        
        return sector;
    },

    // Get sprite frame coordinates from sprite sheet
    // row and col are 0-indexed
    getFrameCoords(spriteSheet, row, col) {
        if (!spriteSheet || !spriteSheet.image) return null;
        
        // Clamp row and col to valid ranges
        const maxRow = Math.max(0, spriteSheet.rows - 1);
        const maxCol = Math.max(0, spriteSheet.cols - 1);
        row = Math.max(0, Math.min(row, maxRow));
        col = Math.max(0, Math.min(col, maxCol));
        
        // Calculate exact pixel coordinates
        const sourceX = col * spriteSheet.frameWidth;
        const sourceY = row * spriteSheet.frameHeight;
        
        // Use exact frame dimensions (don't clamp unless necessary)
        let sourceWidth = spriteSheet.frameWidth;
        let sourceHeight = spriteSheet.frameHeight;
        
        // Only clamp if we would exceed image bounds
        if (sourceX + sourceWidth > spriteSheet.image.width) {
            sourceWidth = spriteSheet.image.width - sourceX;
        }
        if (sourceY + sourceHeight > spriteSheet.image.height) {
            sourceHeight = spriteSheet.image.height - sourceY;
        }
        
        // Ensure valid dimensions
        if (sourceWidth <= 0 || sourceHeight <= 0) {
            console.warn('Invalid frame dimensions calculated:', {
                sourceX, sourceY, sourceWidth, sourceHeight,
                frameWidth: spriteSheet.frameWidth,
                frameHeight: spriteSheet.frameHeight,
                imageWidth: spriteSheet.image.width,
                imageHeight: spriteSheet.image.height,
                row, col
            });
            return null;
        }
        
        const result = {
            sourceX: Math.floor(sourceX),
            sourceY: Math.floor(sourceY),
            sourceWidth: Math.floor(sourceWidth),
            sourceHeight: Math.floor(sourceHeight)
        };
        
        return result;
    },

    // Get frame index from row and col
    getFrameIndex(row, col, cols) {
        return row * cols + col;
    },

    // Get row and col from frame index
    getRowCol(frameIndex, cols) {
        return {
            row: Math.floor(frameIndex / cols),
            col: frameIndex % cols
        };
    }
};

