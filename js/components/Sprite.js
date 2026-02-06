// Sprite component - defines sprite rendering properties
class Sprite {
    constructor(spriteSheetKey, width, height, config = {}) {
        this.defaultSpriteSheetKey = spriteSheetKey; // Default/fallback sprite sheet key
        this.width = width; // Display width in world units
        this.height = height; // Display height in world units
        this.offsetX = config.offsetX || 0; // Offset from entity position
        this.offsetY = config.offsetY || 0;
        this.scaleX = config.scaleX || 1;
        this.scaleY = config.scaleY || 1;
        this.rotation = config.rotation || 0;
        this.flipX = config.flipX || false; // For facing direction
        this.tint = config.tint || null; // Optional color overlay
        this.entity = null;
    }

    // Get the sprite sheet from SpriteManager
    // If animation provides a sprite sheet key, use that; otherwise use default
    getSpriteSheet(spriteManager, animation = null) {
        if (!spriteManager) return null;
        
        // If animation component provides a sprite sheet key, use it
        if (animation) {
            const animSpriteSheetKey = animation.getCurrentSpriteSheetKey();
            if (animSpriteSheetKey) {
                const sheet = spriteManager.getSpriteSheet(animSpriteSheetKey);
                if (sheet) return sheet;
            }
        }
        
        // Fallback to default sprite sheet
        return spriteManager.getSpriteSheet(this.defaultSpriteSheetKey);
    }
}

