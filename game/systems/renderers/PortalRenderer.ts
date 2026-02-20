// Renders portal (or stairs in delve) and interaction prompt. data: { portal, playerNearPortal, isStairs? }
import type { RenderContext } from './RenderContext.ts';

interface PortalLike {
  x: number;
  y: number;
  width: number;
  height: number;
  spawned?: boolean;
  hasNextLevel?: boolean;
}

export class PortalRenderer {
    render(context: RenderContext, data: { portal?: PortalLike | null; playerNearPortal?: boolean; promptLines?: string[]; isStairs?: boolean; channelProgress?: number }): void {
        const { ctx, canvas, camera } = context;
        const { portal, playerNearPortal, promptLines: customPromptLines, isStairs, channelProgress = 0 } = data;
        if (!portal || !portal.spawned) return;
        const screenX = camera.toScreenX(portal.x);
        const screenY = camera.toScreenY(portal.y);
        const w = portal.width * camera.zoom;
        const h = portal.height * camera.zoom;
        if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;
        const cx = screenX + w / 2;
        const cy = screenY + h / 2;

        if (isStairs) {
            // Stairs down: stepped brown/grey shape
            const stepCount = 5;
            const stepH = h / (stepCount + 0.5);
            const left = cx - w / 2;
            const top = cy - h / 2;
            ctx.fillStyle = '#4a4038';
            ctx.strokeStyle = '#2a2520';
            ctx.lineWidth = 2 / camera.zoom;
            for (let i = 0; i < stepCount; i++) {
                const y = top + i * stepH;
                const stepW = w * (0.4 + (0.6 * (i + 1)) / stepCount);
                const x = cx - stepW / 2;
                ctx.fillRect(x, y, stepW, stepH);
                ctx.strokeRect(x, y, stepW, stepH);
            }
            ctx.fillStyle = '#3d352e';
            ctx.fillRect(cx - w * 0.2, top, w * 0.4, h);
            ctx.strokeStyle = '#5a5048';
            ctx.strokeRect(cx - w * 0.2, top, w * 0.4, h);
        } else {
            const time = performance.now() * 0.002;
            const pulse = 0.85 + 0.15 * Math.sin(time);
            const r = Math.min(w, h) * 0.45 * pulse;
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            gradient.addColorStop(0, 'rgba(120, 80, 255, 0.9)');
            gradient.addColorStop(0.5, 'rgba(80, 40, 200, 0.6)');
            gradient.addColorStop(1, 'rgba(40, 20, 120, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(cx, cy, r, r * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 140, 255, 0.8)';
            ctx.lineWidth = 3 / camera.zoom;
            ctx.stroke();
        }

        if (playerNearPortal) {
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const padding = 12;
            const lineHeight = 24;
            const lines = customPromptLines && customPromptLines.length > 0
                ? customPromptLines
                : (() => {
                    const hasNext = portal.hasNextLevel === true;
                    return [hasNext ? 'E Next area' : 'E Return to Sanctuary'];
                })();
            const textMetrics = lines.map(t => ctx.measureText(t));
            const bgWidth = Math.max(...textMetrics.map(m => m.width)) + padding * 2;
            const bgHeight = lines.length * lineHeight + padding;
            const promptY = cy - h / 2 - 20 - (lines.length * lineHeight) / 2;
            const bgX = cx - bgWidth / 2;
            const bgY = promptY - padding;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            ctx.strokeStyle = isStairs ? 'rgba(90, 80, 70, 0.9)' : 'rgba(180, 140, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            lines.forEach((text, i) => {
                const y = promptY + i * lineHeight;
                ctx.fillText(text, cx + 1, y + 1);
            });
            ctx.fillStyle = '#e8dcc8';
            lines.forEach((text, i) => {
                const y = promptY + i * lineHeight;
                ctx.fillText(text, cx, y);
            });

            if (channelProgress > 0) {
                const barWidth = 120;
                const barHeight = 8;
                const barX = cx - barWidth / 2;
                const barY = promptY + lines.length * lineHeight + padding + 6;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.strokeStyle = isStairs ? 'rgba(90, 80, 70, 0.9)' : 'rgba(180, 140, 255, 0.9)';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
                ctx.fillStyle = isStairs ? 'rgba(140, 120, 100, 0.95)' : 'rgba(160, 120, 255, 0.95)';
                ctx.fillRect(barX, barY, barWidth * Math.min(1, channelProgress), barHeight);
            }
        }
    }
}
