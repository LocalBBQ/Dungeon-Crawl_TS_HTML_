// Renders ground tiles only. Obstacles are rendered by ObstacleLayerRenderer.
class WorldLayerRenderer {
    render(context, data) {
        const { ctx, canvas, camera, systems, settings } = context;
        const { currentLevel = 1, worldWidth = null, worldHeight = null } = data;
        const isHub = currentLevel === 0;
        const tileSize = isHub && GameConfig.hub.tileSize ? GameConfig.hub.tileSize : GameConfig.world.tileSize;
        const effectiveWidth = canvas.width / camera.zoom;
        const effectiveHeight = canvas.height / camera.zoom;
        let startX = Math.floor(camera.x / tileSize) * tileSize;
        let startY = Math.floor(camera.y / tileSize) * tileSize;
        let endX = camera.x + effectiveWidth + tileSize;
        let endY = camera.y + effectiveHeight + tileSize;
        if (isHub && worldWidth != null && worldHeight != null) {
            startX = Math.max(0, startX);
            startY = Math.max(0, startY);
            endX = Math.min(worldWidth, endX);
            endY = Math.min(worldHeight, endY);
        }

        const levelConfig = isHub ? GameConfig.hub : (GameConfig.levels && GameConfig.levels[currentLevel]);
        const theme = levelConfig && levelConfig.theme ? levelConfig.theme : null;
        const ground = theme && theme.ground ? theme.ground : { r: 30, g: 50, b: 30, variation: 18 };

        const useEnvironmentSprites = !settings || settings.useEnvironmentSprites !== false;
        const spriteManager = systems && systems.get ? systems.get('sprites') : null;
        const groundImage = useEnvironmentSprites && ground.texture && spriteManager && spriteManager.getGroundTexture ? spriteManager.getGroundTexture(ground.texture) : null;
        const tileScreenSize = tileSize * camera.zoom;

        const useTexture = groundImage && groundImage.complete && groundImage.naturalWidth > 0;
        if (useTexture) {
            ctx.imageSmoothingEnabled = false;
        }

        for (let x = startX; x < endX; x += tileSize) {
            for (let y = startY; y < endY; y += tileSize) {
                const screenX = camera.toScreenX(x);
                const screenY = camera.toScreenY(y);
                if (useTexture) {
                    ctx.drawImage(groundImage, 0, 0, groundImage.naturalWidth, groundImage.naturalHeight, screenX, screenY, tileScreenSize, tileScreenSize);
                } else {
                    const v = Math.floor((x + y) % 3) * (ground.variation || 15);
                    const r = Math.max(0, Math.min(255, ground.r + v));
                    const gVal = Math.max(0, Math.min(255, ground.g + v));
                    const b = Math.max(0, Math.min(255, ground.b + v));
                    ctx.fillStyle = `rgb(${r}, ${gVal}, ${b})`;
                    ctx.fillRect(screenX, screenY, tileScreenSize, tileScreenSize);
                }
            }
        }

        if (useTexture) {
            ctx.imageSmoothingEnabled = true;
        }
    }
}

if (typeof window !== 'undefined') {
    window.WorldLayerRenderer = WorldLayerRenderer;
}
