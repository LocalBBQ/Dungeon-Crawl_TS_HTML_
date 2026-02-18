// Renders equipment chest and interaction prompt. data: { chest, playerNearChest }
import type { RenderContext } from './RenderContext.ts';

interface ChestLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ChestRenderer {
    render(context: RenderContext, data: { chest?: ChestLike | null; playerNearChest?: boolean }): void {
        const { ctx, canvas, camera } = context;
        const { chest, playerNearChest } = data;
        if (!chest) return;
        const screenX = camera.toScreenX(chest.x);
        const screenY = camera.toScreenY(chest.y);
        const w = chest.width * camera.zoom;
        const h = chest.height * camera.zoom;
        if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;
        ctx.fillStyle = '#3d2914';
        ctx.fillRect(screenX, screenY, w, h);
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.strokeRect(screenX, screenY, w, h);
        ctx.fillStyle = '#5c3d1e';
        ctx.fillRect(screenX + 4, screenY + 4, w - 8, h * 0.4);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(screenX + 4, screenY + 4, w - 8, h * 0.4);
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Weapons', screenX + w / 2, screenY + h / 2);

        if (playerNearChest) {
            const cx = screenX + w / 2;
            const cy = screenY + h / 2;
            const promptY = cy - h / 2 - 28;
            const text = 'Press E to change weapon';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textMetrics = ctx.measureText(text);
            const padding = 10;
            const bgWidth = textMetrics.width + padding * 2;
            const bgHeight = 24;
            const bgX = cx - bgWidth / 2;
            const bgY = promptY - bgHeight / 2;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            ctx.strokeStyle = '#8b6914';
            ctx.lineWidth = 2;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
            ctx.fillStyle = '#e8dcc8';
            ctx.fillText(text, cx, promptY);
        }
    }
}
