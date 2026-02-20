// Renders quest board (top-down bulletin board) and interaction prompt. data: { board, playerNearBoard }
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

        const cx = screenX + w / 2;
        const cy = screenY + h / 2;
        const lw = Math.max(1, 2 / camera.zoom);

        // Top-down quest board: wooden frame with notice area and stand
        ctx.fillStyle = '#3d3020';
        ctx.fillRect(screenX, screenY, w, h);
        ctx.strokeStyle = '#2a2018';
        ctx.lineWidth = lw;
        ctx.strokeRect(screenX, screenY, w, h);

        const trim = Math.max(4, w * 0.06);
        ctx.fillStyle = '#5a4a38';
        ctx.fillRect(screenX + trim, screenY + trim, w - trim * 2, h - trim * 2);
        ctx.strokeStyle = '#4a3c2a';
        ctx.lineWidth = lw;
        ctx.strokeRect(screenX + trim, screenY + trim, w - trim * 2, h - trim * 2);

        const noticePad = trim * 1.4;
        const noticeLeft = screenX + noticePad;
        const noticeTop = screenY + noticePad;
        const noticeW = w - noticePad * 2;
        const noticeH = h - noticePad * 2 - (h * 0.2);
        ctx.fillStyle = '#b89b6f';
        ctx.fillRect(noticeLeft, noticeTop, noticeW, noticeH);
        ctx.strokeStyle = '#8b7355';
        ctx.lineWidth = lw;
        ctx.strokeRect(noticeLeft, noticeTop, noticeW, noticeH);

        const postW = noticeW * 0.28;
        const postH = noticeH * 0.35;
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(noticeLeft + noticeW * 0.08, noticeTop + noticeH * 0.15, postW, postH);
        ctx.fillStyle = 'rgba(232, 220, 200, 0.95)';
        ctx.fillRect(noticeLeft + noticeW * 0.38, noticeTop + noticeH * 0.22, postW * 0.9, postH * 0.9);
        ctx.fillStyle = 'rgba(220, 208, 188, 0.9)';
        ctx.fillRect(noticeLeft + noticeW * 0.68, noticeTop + noticeH * 0.18, postW * 0.85, postH * 0.85);

        const footW = w * 0.22;
        const footH = h * 0.18;
        const footY = screenY + h - footH - trim * 0.5;
        ctx.fillStyle = '#4a3c2a';
        ctx.fillRect(screenX + trim, footY, footW, footH);
        ctx.fillRect(screenX + w - trim - footW, footY, footW, footH);
        ctx.strokeStyle = '#3d3020';
        ctx.lineWidth = lw;
        ctx.strokeRect(screenX + trim, footY, footW, footH);
        ctx.strokeRect(screenX + w - trim - footW, footY, footW, footH);

        if (playerNearBoard) {
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
