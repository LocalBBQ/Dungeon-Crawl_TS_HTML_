// Renders obstacle list (trees, walls, etc.) using context + obstacleManager.
import type { RenderContext } from './RenderContext.ts';

interface ObstacleManagerLike {
  obstacles: Array<{ x: number; y: number; width: number; height: number; type: string; color?: string; spritePath?: string; spriteFrameIndex?: number; [k: string]: unknown }>;
  loadedSprites: Map<string, HTMLImageElement>;
}

export class ObstacleLayerRenderer {
    /** Draw a single obstacle. Used when interleaving depth obstacles with entities by Y. */
    drawOne(context: RenderContext, data: { obstacle?: unknown; obstacleManager?: ObstacleManagerLike }): void {
        const { ctx, canvas, camera, settings } = context;
        const { obstacle, obstacleManager } = data;
        if (!obstacle || !obstacleManager) return;
        const zoom = camera.zoom;
        const useEnvironmentSprites = !settings || settings.useEnvironmentSprites !== false;
        const screenX = camera.toScreenX(obstacle.x);
        const screenY = camera.toScreenY(obstacle.y);
        const w = obstacle.width * zoom;
        const h = obstacle.height * zoom;
        if (screenX <= -w || screenX >= canvas.width + w || screenY <= -h || screenY >= canvas.height + h) return;
        this._drawObstacleBody(ctx, canvas, camera, zoom, obstacle, obstacleManager, useEnvironmentSprites);
    }

    _drawObstacleBody(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, camera: RenderContext['camera'], zoom: number, obstacle: { x: number; y: number; width: number; height: number; type: string; color?: string; spritePath?: string; spriteFrameIndex?: number; leafless?: boolean; leaflessVariant?: number; [k: string]: unknown }, obstacleManager: ObstacleManagerLike, useEnvironmentSprites: boolean): void {
        const screenX = camera.toScreenX(obstacle.x);
        const screenY = camera.toScreenY(obstacle.y);
        const w = obstacle.width * zoom;
        const h = obstacle.height * zoom;
        if (useEnvironmentSprites && obstacle.spritePath && obstacleManager.loadedSprites.has(obstacle.spritePath)) {
            const sprite = obstacleManager.loadedSprites.get(obstacle.spritePath);
            if (sprite.complete && sprite.naturalWidth > 0) {
                const frameIndex = obstacle.spriteFrameIndex;
                if (typeof frameIndex === 'number' && frameIndex >= 0 && (obstacle.spritePath || '').includes('Trees.png')) {
                    const numFrames = 3;
                    const frameW = sprite.naturalWidth / numFrames;
                    const frameH = sprite.naturalHeight;
                    const sx = Math.min(frameIndex, numFrames - 1) * frameW;
                    ctx.drawImage(sprite, sx, 0, frameW, frameH, screenX, screenY, w, h);
                } else {
                    ctx.drawImage(sprite, screenX, screenY, w, h);
                }
                return;
            }
        }
        const cx = screenX + w / 2;
        const cy = screenY + h / 2;
        const color = obstacle.color || '#555';
        if (obstacle.type === 'tree') {
            ctx.fillStyle = '#4a2c1a';
            ctx.fillRect(screenX + w * 0.4, screenY + h * 0.6, w * 0.2, h * 0.4);
            ctx.fillStyle = '#2d5016';
            ctx.beginPath();
            ctx.arc(cx, screenY + h * 0.4, w * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else if (obstacle.type === 'deadTree') {
            const trunk = obstacle.color || '#2a2520';
            const branch = '#1e1b18';
            ctx.fillStyle = trunk;
            ctx.fillRect(screenX + w * 0.4, screenY + h * 0.35, w * 0.2, h * 0.65);
            ctx.strokeStyle = branch;
            ctx.lineWidth = Math.max(2, 6 / zoom);
            ctx.lineCap = 'round';
            const topX = cx;
            const topY = screenY + h * 0.38;
            ctx.beginPath();
            ctx.moveTo(topX, topY);
            ctx.lineTo(topX - w * 0.35, topY - h * 0.25);
            ctx.moveTo(topX, topY);
            ctx.lineTo(topX + w * 0.32, topY - h * 0.2);
            ctx.moveTo(topX, topY);
            ctx.lineTo(topX - w * 0.12, topY - h * 0.35);
            ctx.moveTo(topX, topY);
            ctx.lineTo(topX + w * 0.38, topY - h * 0.12);
            ctx.stroke();
        } else if (obstacle.type === 'mushroom') {
            ctx.fillStyle = '#2a221c';
            if (obstacle.leafless) {
                ctx.fillRect(screenX + w * 0.41, screenY + h * 0.3, w * 0.18, h * 0.7);
            } else {
                ctx.fillRect(screenX + w * 0.35, screenY + h * 0.3, w * 0.3, h * 0.7);
            }
            if (obstacle.leafless) {
                ctx.strokeStyle = '#2a221c';
                ctx.lineWidth = Math.max(2, 5 / zoom);
                ctx.lineCap = 'round';
                const topX = cx;
                const topY = screenY + h * 0.32;
                const v = (obstacle.leaflessVariant ?? 0) % 3;
                ctx.beginPath();
                if (v === 0) {
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.38, topY - h * 0.22);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.35, topY - h * 0.18);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.15, topY - h * 0.38);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.4, topY - h * 0.12);
                } else if (v === 1) {
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.42, topY - h * 0.08);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.28, topY - h * 0.28);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.08, topY - h * 0.4);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.38, topY - h * 0.15);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.12, topY - h * 0.35);
                } else {
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.35, topY - h * 0.32);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.4, topY - h * 0.25);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX - w * 0.22, topY - h * 0.12);
                    ctx.moveTo(topX, topY);
                    ctx.lineTo(topX + w * 0.18, topY - h * 0.38);
                }
                ctx.stroke();
            } else {
                ctx.fillStyle = '#3d3028';
                ctx.beginPath();
                ctx.ellipse(cx, screenY + h * 0.35, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#2a221c';
                ctx.lineWidth = 2 / zoom;
                ctx.stroke();
            }
        } else if (obstacle.type === 'grave') {
            ctx.fillStyle = '#3a3835';
            ctx.fillRect(screenX, screenY + h * 0.2, w, h * 0.6);
            ctx.fillStyle = '#4a4845';
            ctx.fillRect(screenX + w * 0.15, screenY, w * 0.2, h * 0.85);
            ctx.fillRect(screenX + w * 0.4, screenY + h * 0.4, w * 0.2, h * 0.45);
        } else if (obstacle.type === 'swampPool') {
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);
            grad.addColorStop(0, 'rgba(25, 55, 50, 0.85)');
            grad.addColorStop(0.7, 'rgba(20, 45, 42, 0.75)');
            grad.addColorStop(1, 'rgba(15, 35, 32, 0.6)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(30, 60, 55, 0.9)';
            ctx.lineWidth = 2 / zoom;
            ctx.stroke();
        } else if (obstacle.type === 'demonPillar') {
            ctx.fillStyle = '#1a0e10';
            ctx.fillRect(screenX + w * 0.2, screenY, w * 0.6, h);
            ctx.fillStyle = '#2a1518';
            ctx.fillRect(screenX, screenY + h * 0.7, w, h * 0.3);
            ctx.fillStyle = 'rgba(80, 20, 25, 0.6)';
            ctx.fillRect(screenX + w * 0.25, screenY, w * 0.5, h * 0.15);
        } else if (obstacle.type === 'brazier') {
            ctx.fillStyle = '#3d2518';
            ctx.fillRect(screenX + w * 0.2, screenY + h * 0.5, w * 0.6, h * 0.5);
            ctx.fillStyle = '#5c3020';
            ctx.beginPath();
            ctx.ellipse(cx, screenY + h * 0.35, w * 0.35, h * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            const t = performance.now() * 0.003;
            const glow = 0.7 + 0.3 * Math.sin(t);
            ctx.fillStyle = `rgba(255, 120, 40, ${0.4 * glow})`;
            ctx.beginPath();
            ctx.ellipse(cx, screenY + h * 0.3, w * 0.25, h * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 180, 80, ${0.6 * glow})`;
            ctx.beginPath();
            ctx.ellipse(cx, screenY + h * 0.28, w * 0.12, h * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (obstacle.type === 'lavaRock') {
            ctx.fillStyle = obstacle.color || '#4a2520';
            ctx.fillRect(screenX, screenY, w, h);
            ctx.fillStyle = 'rgba(180, 60, 30, 0.35)';
            ctx.fillRect(screenX + w * 0.1, screenY + h * 0.1, w * 0.5, h * 0.4);
        } else if (obstacle.type === 'ironFence') {
            const black = obstacle.color || '#1a1a1a';
            const highlight = '#2a2a2a';
            const pad = Math.max(1, w * 0.12);
            const barCount = Math.max(2, Math.floor(w / (pad * 2)));
            const barW = Math.max(1.5, (w - pad * 2) / barCount - pad * 0.5);
            for (let i = 0; i < barCount; i++) {
                const bx = screenX + pad + i * (barW + pad * 0.5);
                ctx.fillStyle = black;
                ctx.fillRect(bx, screenY, barW, h);
                ctx.strokeStyle = highlight;
                ctx.lineWidth = Math.max(1, 1 / zoom);
                ctx.strokeRect(bx, screenY, barW, h);
            }
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(screenX, screenY, w, h);
        }
    }

    render(context: RenderContext, data: { obstacleManager?: ObstacleManagerLike; currentLevel?: number; playerY?: number | null; phase?: string }): void {
        const { ctx, canvas, camera, settings } = context;
        const { obstacleManager, currentLevel = 1, playerY = null, phase = 'all' } = data;
        if (!obstacleManager) return;
        const zoom = camera.zoom;
        const useEnvironmentSprites = !settings || settings.useEnvironmentSprites !== false;
        const depthSortTypes = ['tree', 'deadTree', 'rock', 'pillar', 'brokenPillar', 'column', 'statueBase', 'arch'];

        // View bounds in world space (with margin so we don't clip at edges)
        const margin = 80;
        const viewLeft = camera.x - margin;
        const viewTop = camera.y - margin;
        const viewRight = camera.x + canvas.width / zoom + margin;
        const viewBottom = camera.y + canvas.height / zoom + margin;

        // Filter to obstacles in view first — avoids sorting hundreds of off-screen obstacles (big win on level 2+)
        // phase 'noDepth': only non-depth obstacles (walls, swamp, etc.); depth-sort types are drawn with entities.
        let toDraw = obstacleManager.obstacles.filter((obstacle) => {
            const obsRight = obstacle.x + obstacle.width;
            const obsBottom = obstacle.y + obstacle.height;
            if (obsRight < viewLeft || obstacle.x > viewRight || obsBottom < viewTop || obstacle.y > viewBottom) return false;
            if (phase === 'noDepth' && depthSortTypes.includes(obstacle.type)) return false;
            if (typeof playerY === 'number' && (phase === 'behind' || phase === 'front') && depthSortTypes.includes(obstacle.type)) {
                const top = obstacle.y;
                const bottom = obstacle.y + obstacle.height;
                const playerInBand = playerY >= top && playerY <= bottom;
                const drawOnTopOfPlayer = playerInBand;
                if ((phase === 'behind' && drawOnTopOfPlayer) || (phase === 'front' && !drawOnTopOfPlayer)) return false;
            }
            return true;
        });
        // Sort only the visible subset by center Y (depth order)
        toDraw = toDraw.slice().sort((a, b) => {
            const cyA = a.y + a.height / 2;
            const cyB = b.y + b.height / 2;
            return cyA - cyB;
        });

        for (const obstacle of toDraw) {
            const screenX = camera.toScreenX(obstacle.x);
            const screenY = camera.toScreenY(obstacle.y);
            const w = obstacle.width * zoom;
            const h = obstacle.height * zoom;
            if (screenX > -w && screenX < canvas.width + w && screenY > -h && screenY < canvas.height + h) {
                this._drawObstacleBody(ctx, canvas, camera, zoom, obstacle, obstacleManager, useEnvironmentSprites);
            }
        }
    }
}
