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
        const cx = screenX + w / 2;
        const cy = screenY + h / 2;

        // Firepit: stone ring + campfire (always custom-drawn)
        if (obstacle.type === 'firepit') {
            const t = performance.now() * 0.004;
            const stoneCount = 10;
            const ringRadiusX = w * 0.38;
            const ringRadiusY = h * 0.32;
            const stoneBaseY = cy + h * 0.08;
            for (let i = 0; i < stoneCount; i++) {
                const a = (i / stoneCount) * Math.PI * 2 - Math.PI * 0.5;
                const sx = cx + Math.cos(a) * ringRadiusX;
                const sy = stoneBaseY + Math.sin(a) * ringRadiusY;
                const sw = w * 0.14;
                const sh = h * 0.12;
                ctx.fillStyle = '#5a5550';
                ctx.beginPath();
                ctx.ellipse(sx, sy, sw * 0.6, sh * 0.8, a * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#3d3a36';
                ctx.lineWidth = Math.max(1, 1.5 / zoom);
                ctx.stroke();
            }
            const flicker = 0.85 + 0.15 * Math.sin(t * 2.1) * Math.sin(t * 1.7);
            const flicker2 = 0.9 + 0.1 * Math.sin(t * 2.5);
            ctx.fillStyle = `rgba(255, 100, 30, ${0.35 * flicker})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy - h * 0.02, w * 0.28, h * 0.22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 160, 50, ${0.6 * flicker2})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy - h * 0.05, w * 0.18, h * 0.15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 220, 120, ${0.85 * flicker})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy - h * 0.06, w * 0.1, h * 0.08, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Barrel: always procedural (wooden hoops + body)
        if (obstacle.type === 'barrel') {
            const barrelCx = screenX + w / 2;
            ctx.fillStyle = '#3d3020';
            ctx.strokeStyle = '#2a2018';
            ctx.lineWidth = Math.max(1, 2 / zoom);
            ctx.beginPath();
            ctx.ellipse(barrelCx, screenY + h * 0.08, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(barrelCx, screenY + h * 0.92, w * 0.42, h * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = obstacle.color || '#5c4a32';
            ctx.strokeStyle = '#4a3c28';
            ctx.beginPath();
            ctx.ellipse(barrelCx, screenY + h / 2, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#4a3820';
            ctx.beginPath();
            ctx.ellipse(barrelCx, screenY + h * 0.5, w * 0.38, h * 0.36, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Rock: always procedural (irregular blob + highlight)
        if (obstacle.type === 'rock') {
            const rockCx = screenX + w / 2;
            const rockCy = screenY + h / 2;
            const rw = w * 0.48;
            const rh = h * 0.44;
            ctx.fillStyle = obstacle.color || '#4a4a4a';
            ctx.beginPath();
            for (let i = 0; i <= 8; i++) {
                const a = (i / 8) * Math.PI * 2 + 0.1;
                const r = (i & 1 ? 1.0 : 0.88);
                const ex = rockCx + Math.cos(a) * rw * r;
                const ey = rockCy + Math.sin(a) * rh * r;
                if (i === 0) ctx.moveTo(ex, ey);
                else ctx.lineTo(ex, ey);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = Math.max(1, 1.5 / zoom);
            ctx.stroke();
            ctx.fillStyle = 'rgba(120, 120, 130, 0.4)';
            ctx.beginPath();
            ctx.ellipse(rockCx - w * 0.12, rockCy - h * 0.15, w * 0.2, h * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Well: stone ring + dark shaft + small roof/crank
        if (obstacle.type === 'well') {
            const wellCx = screenX + w / 2;
            const wellCy = screenY + h / 2;
            ctx.fillStyle = '#5a5550';
            ctx.strokeStyle = '#3d3a36';
            ctx.lineWidth = Math.max(1, 2 / zoom);
            ctx.beginPath();
            ctx.ellipse(wellCx, screenY + h * 0.22, w * 0.42, h * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2a2830';
            ctx.beginPath();
            ctx.ellipse(wellCx, wellCy, w * 0.32, h * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a4540';
            ctx.fillRect(screenX + w * 0.35, screenY, w * 0.3, h * 0.18);
            ctx.strokeStyle = '#3a3530';
            ctx.strokeRect(screenX + w * 0.35, screenY, w * 0.3, h * 0.18);
            ctx.fillStyle = '#6b5b4f';
            ctx.beginPath();
            ctx.ellipse(wellCx, screenY + h * 0.08, w * 0.08, h * 0.06, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        // Fence: x-axis = post left + horizontal rails; y-axis = post top + vertical rails
        if (obstacle.type === 'fence') {
            const fenceColor = obstacle.color || '#8b7355';
            const dark = '#6b5b45';
            const isVertical = (obstacle as { fenceAxis?: string }).fenceAxis === 'y';
            const lw = Math.max(1, 1 / zoom);
            ctx.strokeStyle = '#5a4a38';
            ctx.lineWidth = lw;

            if (isVertical) {
                // Y-axis: post at top, vertical rails running down
                const postH = Math.max(2, h * 0.2);
                ctx.fillStyle = dark;
                ctx.fillRect(screenX, screenY, w, postH);
                ctx.fillStyle = fenceColor;
                ctx.fillRect(screenX, screenY + postH * 0.2, w, postH * 0.6);
                ctx.strokeRect(screenX, screenY, w, postH);
                const railX1 = screenX + w * 0.25;
                const railX2 = screenX + w * 0.55;
                const railX3 = screenX + w * 0.85;
                const railW = Math.max(2, w * 0.08);
                ctx.fillStyle = dark;
                ctx.fillRect(railX1, screenY, railW, h);
                ctx.fillRect(railX2, screenY, railW, h);
                ctx.fillRect(railX3, screenY, railW, h);
                ctx.fillStyle = fenceColor;
                ctx.fillRect(railX1 + 1, screenY, Math.max(1, railW - 2), h);
                ctx.fillRect(railX2 + 1, screenY, Math.max(1, railW - 2), h);
                ctx.fillRect(railX3 + 1, screenY, Math.max(1, railW - 2), h);
            } else {
                // X-axis: post left, horizontal rails
                const postW = Math.max(2, w * 0.25);
                const postH = h;
                ctx.fillStyle = dark;
                ctx.fillRect(screenX, screenY, postW, postH);
                ctx.fillStyle = fenceColor;
                ctx.fillRect(screenX + postW * 0.2, screenY, postW * 0.6, postH);
                ctx.strokeRect(screenX, screenY, postW, postH);
                const railY1 = screenY + h * 0.25;
                const railY2 = screenY + h * 0.55;
                const railY3 = screenY + h * 0.85;
                ctx.fillStyle = dark;
                ctx.fillRect(screenX, railY1, w, Math.max(2, h * 0.08));
                ctx.fillRect(screenX, railY2, w, Math.max(2, h * 0.08));
                ctx.fillRect(screenX, railY3, w, Math.max(2, h * 0.08));
                ctx.fillStyle = fenceColor;
                ctx.fillRect(screenX, railY1 + 1, w, Math.max(1, h * 0.06));
                ctx.fillRect(screenX, railY2 + 1, w, Math.max(1, h * 0.06));
                ctx.fillRect(screenX, railY3 + 1, w, Math.max(1, h * 0.06));
            }
            return;
        }

        // Pillar: rounded column with base and cap
        if (obstacle.type === 'pillar') {
            const pilCx = screenX + w / 2;
            const base = obstacle.color || '#6b6b6b';
            const shade = '#5a5a5a';
            const cap = '#7a7a7a';
            ctx.fillStyle = shade;
            ctx.fillRect(screenX + w * 0.1, screenY + h * 0.12, w * 0.8, h * 0.76);
            ctx.fillStyle = base;
            ctx.fillRect(screenX + w * 0.15, screenY + h * 0.15, w * 0.7, h * 0.7);
            ctx.fillStyle = 'rgba(140, 140, 150, 0.5)';
            ctx.fillRect(screenX + w * 0.2, screenY + h * 0.2, w * 0.35, h * 0.3);
            ctx.fillStyle = shade;
            ctx.fillRect(screenX + w * 0.15, screenY + h * 0.82, w * 0.7, h * 0.1);
            ctx.fillStyle = cap;
            ctx.fillRect(screenX + w * 0.1, screenY + h * 0.82, w * 0.8, h * 0.08);
            ctx.fillStyle = shade;
            ctx.fillRect(screenX + w * 0.2, screenY, w * 0.6, h * 0.12);
            ctx.fillStyle = cap;
            ctx.fillRect(screenX + w * 0.15, screenY, w * 0.7, h * 0.1);
            return;
        }

        // Bush: leafy blob (overlapping ellipses)
        if (obstacle.type === 'bush') {
            const bushColor = obstacle.color || '#3a5a2a';
            const darkLeaf = '#2d4a22';
            ctx.fillStyle = darkLeaf;
            ctx.beginPath();
            ctx.ellipse(cx, cy + h * 0.05, w * 0.4, h * 0.42, 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = bushColor;
            ctx.beginPath();
            ctx.ellipse(cx - w * 0.15, cy, w * 0.38, h * 0.4, -0.05, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx + w * 0.12, cy - h * 0.05, w * 0.35, h * 0.38, 0.08, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(cx, cy - h * 0.08, w * 0.32, h * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#254018';
            ctx.lineWidth = Math.max(1, 1 / zoom);
            ctx.stroke();
            return;
        }

        // Rubble: irregular pile of small stones
        if (obstacle.type === 'rubble') {
            const rubColor = obstacle.color || '#4a4a4a';
            const stones = 5 + Math.floor((obstacle.x + obstacle.y) % 4);
            for (let i = 0; i < stones; i++) {
                const ax = (i * 0.37 + 0.1) * Math.PI * 2;
                const ox = cx + Math.cos(ax) * w * (0.15 + (i % 3) * 0.08);
                const oy = cy + Math.sin(ax) * h * (0.12 + (i % 2) * 0.06);
                const sw = w * (0.18 + (i % 5) * 0.04);
                const sh = h * (0.16 + (i % 4) * 0.04);
                ctx.fillStyle = rubColor;
                ctx.beginPath();
                ctx.ellipse(ox, oy, sw, sh, ax * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = Math.max(1, 1 / zoom);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(90, 90, 95, 0.3)';
            ctx.beginPath();
            ctx.ellipse(cx - w * 0.08, cy - h * 0.06, w * 0.15, h * 0.12, 0, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

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
        const depthSortTypes = ['tree', 'deadTree', 'bush', 'rock', 'pillar', 'brokenPillar', 'column', 'statueBase', 'arch'];

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
