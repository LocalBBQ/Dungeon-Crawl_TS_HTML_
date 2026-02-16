// Renders portal and interaction prompt. data: { portal, playerNearPortal }
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
    render(context: RenderContext, data: { portal?: PortalLike | null; playerNearPortal?: boolean }): void {
        const { ctx, canvas, camera } = context;
        const { portal, playerNearPortal } = data;
        if (!portal || !portal.spawned) return;
        const screenX = camera.toScreenX(portal.x);
        const screenY = camera.toScreenY(portal.y);
        const w = portal.width * camera.zoom;
        const h = portal.height * camera.zoom;
        if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;
        const cx = screenX + w / 2;
        const cy = screenY + h / 2;
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

        if (playerNearPortal) {
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const padding = 12;
            const lineHeight = 24;
            const hasNext = portal.hasNextLevel === true;
            const lines = [];
            if (hasNext) lines.push('E Next area');
            lines.push('B Return to Sanctuary');
            const textMetrics = lines.map(t => ctx.measureText(t));
            const bgWidth = Math.max(...textMetrics.map(m => m.width)) + padding * 2;
            const bgHeight = lines.length * lineHeight + padding;
            const promptY = cy - h / 2 - 20 - (lines.length * lineHeight) / 2;
            const bgX = cx - bgWidth / 2;
            const bgY = promptY - padding;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
            ctx.strokeStyle = 'rgba(180, 140, 255, 0.9)';
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
        }
    }
}
