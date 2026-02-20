// Renders shopkeeper NPC and interaction prompt. data: { shop, playerNearShop, playerWorldPos? }
// When the player is within HEAD_LOOK_RADIUS (world units), the shopkeeper's head turns to face them.
import type { RenderContext } from './RenderContext.ts';
import { Utils } from '../../utils/Utils.ts';

/** World distance within which the shopkeeper's head tracks the player. */
const HEAD_LOOK_RADIUS = 140;

interface ShopLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ShopkeeperRenderer {
    render(context: RenderContext, data: {
        shop?: ShopLike | null;
        playerNearShop?: boolean;
        playerWorldPos?: { x: number; y: number } | null;
    }): void {
        const { ctx, canvas, camera } = context;
        const { shop, playerNearShop, playerWorldPos } = data;
        if (!shop) return;
        const screenX = camera.toScreenX(shop.x);
        const screenY = camera.toScreenY(shop.y);
        const w = shop.width * camera.zoom;
        const h = shop.height * camera.zoom;
        if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;

        const shopCenterWorldX = shop.x + shop.width / 2;
        const shopCenterWorldY = shop.y + shop.height / 2;
        let headAngle = Math.PI / 2;
        if (playerWorldPos) {
            const dist = Utils.distance(shopCenterWorldX, shopCenterWorldY, playerWorldPos.x, playerWorldPos.y);
            if (dist <= HEAD_LOOK_RADIUS) {
                headAngle = Utils.angleTo(shopCenterWorldX, shopCenterWorldY, playerWorldPos.x, playerWorldPos.y);
            }
        }

        // NPC body (simple figure: robe + head)
        ctx.fillStyle = '#4a3728';
        ctx.fillRect(screenX, screenY + h * 0.25, w, h * 0.75);
        ctx.strokeStyle = '#6b5344';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeRect(screenX, screenY + h * 0.25, w, h * 0.75);

        const headCenterScreenX = screenX + w / 2;
        const headCenterScreenY = screenY + h * 0.22;
        const headRadius = h * 0.2;

        ctx.fillStyle = '#e8d4b8';
        ctx.beginPath();
        ctx.arc(headCenterScreenX, headCenterScreenY, headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b7355';
        ctx.stroke();

        ctx.save();
        ctx.translate(headCenterScreenX, headCenterScreenY);
        ctx.rotate(headAngle);
        ctx.fillStyle = '#8b7355';
        ctx.beginPath();
        ctx.ellipse(headRadius * 0.45, 0, headRadius * 0.2, headRadius * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = '#c9a227';
        ctx.font = '600 10px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Shop', screenX + w / 2, screenY + h * 0.62);

        if (playerNearShop) {
            const cx = screenX + w / 2;
            const cy = screenY + h / 2;
            const promptY = cy - h / 2 - 28;
            const text = 'Press E to buy weapons';
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
