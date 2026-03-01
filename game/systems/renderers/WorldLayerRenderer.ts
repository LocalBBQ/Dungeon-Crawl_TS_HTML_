// Renders ground tiles only. Obstacles are rendered by ObstacleLayerRenderer.
import { GameConfig } from '../../config/GameConfig.js';
import type { RenderContext } from './RenderContext.js';

export class WorldLayerRenderer {
    render(context: RenderContext, data: { currentLevel?: number; worldWidth?: number | null; worldHeight?: number | null }): void {
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

        type GroundLike = { texture?: string; patch?: { r: number; g: number; b: number; variation?: number; chance: number }; variation?: number; r?: number; g?: number; b?: number };
        const levelConfig = isHub ? GameConfig.hub : (GameConfig.levels && GameConfig.levels[currentLevel]);
        const theme = (levelConfig && levelConfig.theme ? levelConfig.theme : null) as { ground?: GroundLike } | null;
        const ground: GroundLike = theme && theme.ground ? theme.ground : { r: 30, g: 50, b: 30, variation: 18 };

        const useEnvironmentSprites = !settings || settings.useEnvironmentSprites !== false;
        const spriteManager = systems && systems.get ? (systems.get('sprites') as { getGroundTexture?(id: string): HTMLImageElement | null } | null) : null;
        const groundImage = useEnvironmentSprites && ground.texture && spriteManager && spriteManager.getGroundTexture ? spriteManager.getGroundTexture(ground.texture) : null;
        const tileScreenSize = tileSize * camera.zoom;

        const useTexture = groundImage && groundImage.complete && groundImage.naturalWidth > 0;
        if (useTexture) {
            ctx.imageSmoothingEnabled = false;
        }

        const patch = ground.patch != null && typeof ground.patch === 'object' ? ground.patch : null;
        const tileHash = (tx: number, ty: number) => ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        const isPatchTile = patch && patch.chance > 0 ? (x: number, y: number) => (tileHash(Math.floor(x / tileSize), Math.floor(y / tileSize)) % 1000) / 1000 < patch.chance : () => false;

        for (let x = startX; x < endX; x += tileSize) {
            for (let y = startY; y < endY; y += tileSize) {
                const screenX = camera.toScreenX(x);
                const screenY = camera.toScreenY(y);
                if (useTexture) {
                    ctx.drawImage(groundImage, 0, 0, groundImage.naturalWidth, groundImage.naturalHeight, screenX, screenY, tileScreenSize, tileScreenSize);
                } else {
                    const usePatch = isPatchTile(x, y);
                    const base = usePatch && patch ? patch : ground;
                    const vari = base.variation ?? ground.variation ?? 15;
                    const v = Math.floor((x + y) % 3) * vari;
                    const r = Math.max(0, Math.min(255, base.r + v));
                    const gVal = Math.max(0, Math.min(255, base.g + v));
                    const b = Math.max(0, Math.min(255, base.b + v));
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
