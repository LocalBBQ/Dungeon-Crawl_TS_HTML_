// Renders level board and interaction prompt. data: { board, playerNearBoard }
import type { RenderContext } from './RenderContext.ts';

interface BoardLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class BoardRenderer {
    render(context: RenderContext, data: { board?: BoardLike | null; playerNearBoard?: boolean }): void {
        const { ctx, canvas, camera } = context;
        const { board, playerNearBoard } = data;
        if (!board) return;
        const screenX = camera.toScreenX(board.x);
        const screenY = camera.toScreenY(board.y);
        const w = board.width * camera.zoom;
        const h = board.height * camera.zoom;
        if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;
        ctx.fillStyle = '#2a2418';
        ctx.fillRect(screenX, screenY, w, h);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 3 / camera.zoom;
        ctx.strokeRect(screenX, screenY, w, h);
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(screenX + 4, screenY + 4, w - 8, h - 8);
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '600 14px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Level Board', screenX + w / 2, screenY + h / 2);

        if (playerNearBoard) {
            const cx = screenX + w / 2;
            const cy = screenY + h / 2;
            const promptY = cy - h / 2 - 28;
            const text = 'Press E to select level';
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
            ctx.strokeStyle = '#c9a227';
            ctx.lineWidth = 2;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
            ctx.fillStyle = '#e8dcc8';
            ctx.fillText(text, cx, promptY);
        }
    }
}
