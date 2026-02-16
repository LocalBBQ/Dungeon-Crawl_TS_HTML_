// Shared entity effects: shadow, healing vial, modifier tags, stun symbol, health/stamina/stun bars.
import { Movement } from '../../components/Movement.ts';
import { GameConfig } from '../../config/GameConfig.ts';
import { Transform } from '../../components/Transform.ts';
import { PlayerHealing } from '../../components/PlayerHealing.ts';
import { Renderable } from '../../components/Renderable.ts';
import { StatusEffects } from '../../components/StatusEffects.ts';
import { AI } from '../../components/AI.ts';
import { Health } from '../../components/Health.ts';
import { Stamina } from '../../components/Stamina.ts';
import type { RenderContext } from './RenderContext.ts';
import type { EntityShape } from '../../types/entity.ts';
import type { CameraShape } from '../../types/camera.ts';

export const EntityEffectsRenderer = {
    drawShadow(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, transform: Transform, camera: CameraShape, opts: { scale?: number; offsetY?: number; fillStyle?: string } = {}): void {
        const scale = opts.scale || 1;
        const offsetY = (opts.offsetY != null) ? opts.offsetY : 5;
        ctx.fillStyle = opts.fillStyle || 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(
            screenX,
            screenY + (transform.height / 2 + offsetY) * camera.zoom,
            (transform.width / 2) * camera.zoom * scale,
            (transform.height / 4) * camera.zoom * scale,
            0, 0, Math.PI * 2
        );
        ctx.fill();
    },

    drawHealingVial(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { ctx, camera } = context;
        const transform = entity.getComponent(Transform);
        const healing = entity.getComponent(PlayerHealing);
        const movement = entity.getComponent(Movement);
        const renderable = entity.getComponent(Renderable);
        if (!transform || !(entity.id === 'player' || (renderable && renderable.type === 'player')) || !healing || !healing.isHealing) return;
        const z = camera.zoom;
        const vialW = 8 * z;
        const vialH = 14 * z;
        const facingAngle = movement ? movement.facingAngle : 0;
        const offsetDist = (transform.height / 2 + 12) * z;
        const vialCenterX = screenX + Math.cos(facingAngle) * offsetDist;
        const vialCenterY = screenY + Math.sin(facingAngle) * offsetDist;
        ctx.save();
        ctx.translate(vialCenterX, vialCenterY);
        ctx.rotate(facingAngle);
        const left = -vialW / 2;
        const top = -vialH / 2;
        ctx.strokeStyle = '#3d1a1a';
        ctx.lineWidth = Math.max(1, 1.5 * z);
        ctx.fillStyle = '#2a0a0a';
        ctx.fillRect(left, top, vialW, vialH);
        ctx.strokeRect(left, top, vialW, vialH);
        ctx.fillStyle = '#c03030';
        const fillInset = 1.5 * z;
        ctx.fillRect(left + fillInset, top + fillInset, vialW - 2 * fillInset, vialH - 2 * fillInset);
        ctx.restore();
    },

    /** Draw a colored glow under enemies for each active modifier (pack modifier, War Cry, etc.). */
    drawPackModifierGlow(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { ctx, camera } = context;
        const renderable = entity.getComponent(Renderable);
        const statusEffects = entity.getComponent(StatusEffects);
        const ai = entity.getComponent(AI);
        const transform = entity.getComponent(Transform);
        if (!renderable || renderable.type !== 'enemy' || !transform) return;
        const colors = [];
        // Use same source as tooltip: active buff (statusEffects) or assigned pack modifier (ai) so label and glow stay in sync
        const packModifierName = (statusEffects && statusEffects.packModifierName) || (ai && ai.packModifierName) || null;
        if (packModifierName) {
            const packModifiers = (typeof GameConfig !== 'undefined' && GameConfig.packModifiers) ? GameConfig.packModifiers : {};
            const modDef = packModifiers[packModifierName];
            if (modDef) colors.push(modDef.color ? modDef.color : '#ffffff');
        }
        const now = performance.now() / 1000;
        if (statusEffects && statusEffects.buffedUntil != null && now < statusEffects.buffedUntil) {
            colors.push('#ffaa00'); // War Cry
        }
        if (colors.length === 0) return;
        const z = camera.zoom;
        const glowY = screenY + (transform.height / 2 + 4) * z;
        const baseRadius = Math.max(transform.width, transform.height) * z * 0.9;
        colors.forEach((color, i) => {
            const radius = baseRadius * (1 + i * 0.15);
            const gradient = ctx.createRadialGradient(screenX, glowY, 0, screenX, glowY, radius);
            const hex = color.replace('#', '');
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.18)`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.save();
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(screenX, glowY, radius, radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    },

    drawStunSymbol(context: RenderContext, screenX: number, symbolY: number, camera: CameraShape): void {
        const { ctx } = context;
        const zoom = camera.zoom;
        const scale = 0.8;
        const r = (4 * scale) / zoom;
        const spread = (10 * scale) / zoom;
        const positions = [
            { x: screenX - spread, y: symbolY - (2 * scale) / zoom },
            { x: screenX, y: symbolY - (6 * scale) / zoom },
            { x: screenX + spread, y: symbolY - (2 * scale) / zoom }
        ];
        ctx.save();
        ctx.fillStyle = '#ffdd88';
        ctx.strokeStyle = '#cc9900';
        ctx.lineWidth = Math.max(1, (1.5 * scale) / zoom);
        for (const pos of positions) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    },

    /** Draw health, stamina, stun bars, modifier labels, stun duration bar, stun symbol for any entity. */
    renderBarsAndEffects(context: RenderContext, entity: EntityShape, screenX: number, screenY: number, options: { skipShadow?: boolean; skipVial?: boolean; skipBars?: boolean } = {}): void {
        const { ctx, camera, settings } = context;
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        const renderable = entity.getComponent(Renderable);
        const statusEffects = entity.getComponent(StatusEffects);
        if (!transform) return;
        const isPlayer = options.isPlayer === true || (renderable && renderable.type === 'player');
        const barWidth = isPlayer ? 40 * camera.zoom : 30 * camera.zoom;
        const barHeight = isPlayer ? 5 * camera.zoom : 4 * camera.zoom;
        const barX = screenX - barWidth / 2;
        const barY = screenY - (transform.height + (isPlayer ? 10 : 8)) * camera.zoom;

        // Pack modifier / War Cry are shown as glows (drawPackModifierGlow), not pill labels.

        if (!isPlayer && statusEffects && statusEffects.stunDurationPercentRemaining > 0) {
            const gap = 2 * camera.zoom;
            const stunDurationBarHeight = 3 * camera.zoom;
            const stunDurationBarY = barY - stunDurationBarHeight - gap;
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, stunDurationBarY, barWidth, stunDurationBarHeight);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, stunDurationBarY, barWidth, stunDurationBarHeight);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(barX, stunDurationBarY, barWidth * statusEffects.stunDurationPercentRemaining, stunDurationBarHeight);
        }

        const showHealthBar = (isPlayer && settings && settings.showPlayerHealthBarAlways) ||
            (!isPlayer && settings && settings.showEnemyHealthBars) ||
            (health && health.percent < 1);
        if (health && showHealthBar) {
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            const healthPercent = health.percent;
            ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : healthPercent > 0.25 ? '#ffff44' : '#ff4444';
            ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        const stamina = entity.getComponent(Stamina);
        const gap = 2 * camera.zoom;
        let underBarY = barY + barHeight + gap;
        if (isPlayer && stamina) {
            const underBarHeight = 4 * camera.zoom;
            ctx.fillStyle = '#1a2520';
            ctx.fillRect(barX, underBarY, barWidth, underBarHeight);
            ctx.strokeStyle = '#2a3a32';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, underBarY, barWidth, underBarHeight);
            ctx.fillStyle = '#2a7050';
            ctx.fillRect(barX, underBarY, barWidth * stamina.percent, underBarHeight);
        } else if (!isPlayer && stamina && settings && settings.showEnemyStaminaBars) {
            const underBarHeight = 3 * camera.zoom;
            ctx.fillStyle = '#1a2520';
            ctx.fillRect(barX, underBarY, barWidth, underBarHeight);
            ctx.strokeStyle = '#2a3a32';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, underBarY, barWidth, underBarHeight);
            ctx.fillStyle = '#2a7050';
            ctx.fillRect(barX, underBarY, barWidth * stamina.percent, underBarHeight);
            underBarY += underBarHeight + gap;
        }
        if (!isPlayer && statusEffects && statusEffects.hasBeenStunnedOnce && statusEffects.stunMeterPercent > 0) {
            const stunBarHeight = 3 * camera.zoom;
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, underBarY, barWidth, stunBarHeight);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, underBarY, barWidth, stunBarHeight);
            const stunPercent = statusEffects.stunMeterPercent;
            ctx.fillStyle = stunPercent >= 1 ? '#ff6600' : '#ffaa00';
            ctx.fillRect(barX, underBarY, barWidth * stunPercent, stunBarHeight);
        }

        // Stun symbol above the head for any entity that can be stunned (player and enemies)
        if (statusEffects && statusEffects.isStunned) {
            const stunSymbolY = barY - 14 * camera.zoom;
            this.drawStunSymbol(context, screenX, stunSymbolY, camera);
        }
    }
};

if (typeof window !== 'undefined') {
    window.EntityEffectsRenderer = EntityEffectsRenderer;
}
