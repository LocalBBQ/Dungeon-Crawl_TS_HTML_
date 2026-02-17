// Player procedural rendering: path, body (helmet, pauldrons), weapons (via PlayerCombatRenderer), vial, bars, reload, charge meter.
import { Movement } from '../../components/Movement.ts';
import { GameConfig } from '../../config/GameConfig.ts';
import { Utils } from '../../utils/Utils.ts';
import { Transform } from '../../components/Transform.ts';
import { Combat } from '../../components/Combat.ts';
import { Health } from '../../components/Health.ts';
import { Renderable } from '../../components/Renderable.ts';
import { PlayerHealing } from '../../components/PlayerHealing.ts';
import { Stamina } from '../../components/Stamina.ts';
import { PlayerCombatRenderer } from '../../renderers/PlayerCombatRenderer.ts';
import type { RenderContext } from './RenderContext.ts';
import type { EntityShape } from '../../types/entity.ts';

export const PlayerEntityRenderer = {
    render(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { ctx, canvas, camera, systems, settings } = context;
        const showPlayerHitboxIndicators = settings && settings.showPlayerHitboxIndicators !== false;

        const transform = entity.getComponent(Transform);
        const movement = entity.getComponent(Movement);
        const combat = entity.getComponent(Combat);
        const health = entity.getComponent(Health);
        const renderable = entity.getComponent(Renderable);
        const healing = entity.getComponent(PlayerHealing);
        const showWeapon = !healing || !healing.isHealing;
        const inputSystem = systems ? systems.get('input') : null;
        const weapon = combat && combat.attackHandler ? combat.attackHandler.weapon : (combat && combat.playerAttack ? combat.playerAttack.weapon : null);
        const isCrossbow = weapon && weapon.isRanged === true;
        const isMace = weapon && weapon.name && String(weapon.name).toLowerCase().includes('mace');

        if (movement && movement.path.length > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            for (let i = movement.pathIndex; i < movement.path.length; i++) {
                const waypoint = movement.path[i];
                ctx.lineTo(camera.toScreenX(waypoint.x), camera.toScreenY(waypoint.y));
            }
            ctx.stroke();
        }

        const isMeleeSpin = combat && combat.isAttacking && combat.currentAttackAnimationKey === 'meleeSpin';
        const spinProgress = isMeleeSpin ? PlayerCombatRenderer.getSweepProgress(combat) : 0;
        const raw = isMeleeSpin && combat.attackDuration > 0 ? Math.min(1, (combat.attackTimer || 0) / combat.attackDuration) : 0;
        const rotationBlend = raw < 0.08 ? Utils.easeInQuad(raw / 0.08) : 1;
        const outerRotation = spinProgress * rotationBlend * Math.PI * 2;

        ctx.save();
        try {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.translate(screenX, screenY);
            ctx.rotate(outerRotation);
            ctx.translate(-screenX, -screenY);
            if (showPlayerHitboxIndicators && combat && combat.isAttacking && combat.currentAttackAnimationKey !== 'meleeSpin' && !combat.currentAttackIsCircular) {
                const arcX = outerRotation !== 0 ? 0 : screenX;
                const arcY = outerRotation !== 0 ? 0 : screenY;
                PlayerCombatRenderer.drawAttackArc(ctx, arcX, arcY, combat, movement, camera, { comboColors: true });
            }
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + (transform.height / 2 + 6) * camera.zoom, (transform.width * 0.65) * camera.zoom, (transform.height / 3.5) * camera.zoom, 0, 0, Math.PI * 2);
            ctx.fill();
            if (weapon && showWeapon && !isCrossbow && !isMace) {
                PlayerCombatRenderer.drawSword(ctx, screenX, screenY, transform, movement, combat, camera, { part: 'handle' });
            }
            const isDodging = movement && movement.isDodging;
            const w = transform.width * camera.zoom;
            const h = transform.height * camera.zoom;
            if (isDodging) ctx.globalAlpha = 0.6;
            const lw = Math.max(1, 2 / camera.zoom);
            ctx.lineWidth = lw;
            const steel = isDodging ? '#707080' : (combat && combat.isAttacking ? '#9a8b8b' : '#8b8b9a');
            const steelDark = '#5a5a68';
            const steelDarker = '#4a4a58';
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(movement ? movement.facingAngle : 0);
            const helmetRx = w * 0.42;
            const helmetRy = w * 0.38;
            const paulOffsetY = helmetRy * 0.72;
            const paulRx = w * 0.22;
            const paulRy = w * 0.28;
            ctx.fillStyle = steel;
            ctx.strokeStyle = steelDarker;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(0, paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.ellipse(0, -paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isDodging ? '#505060' : steelDark;
            ctx.strokeStyle = steelDarker;
            ctx.beginPath();
            ctx.ellipse(0, 0, helmetRx, helmetRy, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = Math.max(1.5, lw * 1.2);
            ctx.beginPath();
            ctx.moveTo(helmetRx * 0.35, 0);
            ctx.lineTo(helmetRx * 0.95, 0);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = lw * 0.5;
            ctx.beginPath();
            ctx.moveTo(-helmetRx * 0.5, 0);
            ctx.lineTo(helmetRx * 0.5, 0);
            ctx.stroke();
            ctx.restore();
            ctx.globalAlpha = 1.0;
            if (weapon && showWeapon) {
                if (isCrossbow) {
                    PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isMace) {
                    PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                } else {
                    PlayerCombatRenderer.drawSword(ctx, screenX, screenY, transform, movement, combat, camera, { part: 'blade' });
                }
            }
            if (showWeapon && combat && movement && transform) {
                PlayerCombatRenderer.drawShield(ctx, screenX, screenY, transform, movement, combat, camera);
            }
            // Draw spin attack arc on top of body/weapon so it is visible. Arc center must be (screenX, screenY): after rotate-around-player, that point is still the player center.
            if (showPlayerHitboxIndicators && combat && combat.isAttacking && (combat.currentAttackAnimationKey === 'meleeSpin' || combat.currentAttackIsCircular)) {
                PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement, camera, { comboColors: true });
            }
        } finally {
            ctx.restore();
        }

        if (typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.drawHealingVial(context, entity, screenX, screenY);
        }
        if (health) {
            if (typeof EntityEffectsRenderer !== 'undefined') {
                EntityEffectsRenderer.renderBarsAndEffects(context, entity, screenX, screenY, { isPlayer: true });
            } else {
                const barWidth = 40 * camera.zoom;
                const barHeight = 5 * camera.zoom;
                const barX = screenX - barWidth / 2;
                const barY = screenY - (transform.height + 10) * camera.zoom;
                ctx.fillStyle = '#333';
                ctx.fillRect(barX, barY, barWidth, barHeight);
                ctx.fillStyle = health.percent > 0.5 ? '#44ff44' : health.percent > 0.25 ? '#ffff44' : '#ff4444';
                ctx.fillRect(barX, barY, barWidth * health.percent, barHeight);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1 / camera.zoom;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
                const stamina = entity.getComponent(Stamina);
                if (stamina) {
                    const gap = 3 * camera.zoom;
                    const staminaBarY = barY + barHeight + gap;
                    ctx.fillStyle = '#1a2520';
                    ctx.fillRect(barX, staminaBarY, barWidth, 4 * camera.zoom);
                    ctx.strokeStyle = '#2a3a32';
                    ctx.strokeRect(barX, staminaBarY, barWidth, 4 * camera.zoom);
                    ctx.fillStyle = '#2a7050';
                    ctx.fillRect(barX, staminaBarY, barWidth * stamina.percent, 4 * camera.zoom);
                }
            }
            const crossbowConfig = typeof GameConfig !== 'undefined' && GameConfig.player && GameConfig.player.crossbow ? GameConfig.player.crossbow : null;
            if (isCrossbow && crossbowConfig) {
                const barWidth = 40 * camera.zoom;
                const barHeight = 5 * camera.zoom;
                const barX = screenX - barWidth / 2;
                let barsBottomY = screenY - (transform.height + 10) * camera.zoom + barHeight + 3 * camera.zoom;
                const stamina = entity.getComponent(Stamina);
                if (stamina) barsBottomY += (4 * camera.zoom) + 3 * camera.zoom;
                const reloadBarHeight = 4 * camera.zoom;
                ctx.fillStyle = '#1a1208';
                ctx.fillRect(barX, barsBottomY, barWidth, reloadBarHeight);
                ctx.strokeStyle = '#3d2817';
                ctx.lineWidth = 1 / camera.zoom;
                ctx.strokeRect(barX, barsBottomY, barWidth, reloadBarHeight);
                const progress = Math.min(1, entity.crossbowReloadProgress ?? 1);
                ctx.fillStyle = 'rgba(180, 220, 100, 0.4)';
                ctx.fillRect(barX + barWidth * crossbowConfig.perfectWindowStart, barsBottomY, barWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
                ctx.strokeStyle = 'rgba(200, 255, 120, 0.6)';
                ctx.strokeRect(barX + barWidth * crossbowConfig.perfectWindowStart, barsBottomY, barWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
                ctx.fillStyle = '#4a6040';
                ctx.fillRect(barX, barsBottomY, barWidth * progress, reloadBarHeight);
            }
        }
        const chargeAttackConfig = combat && weapon && weapon.chargeAttack ? weapon.chargeAttack : null;
        if (inputSystem && inputSystem.isCharging && chargeAttackConfig && transform) {
            const chargeDuration = inputSystem.getChargeDuration();
            const maxChargeTime = chargeAttackConfig.maxChargeTime;
            const minChargeTime = chargeAttackConfig.minChargeTime;
            if (chargeDuration >= minChargeTime) {
                const chargeProgress = Math.min(1.0, (chargeDuration - minChargeTime) / (maxChargeTime - minChargeTime));
                const meterWidth = 6 * camera.zoom;
                const meterHeight = 40 * camera.zoom;
                const meterX = screenX - (transform.width / 2 + 15) * camera.zoom;
                const meterY = screenY - meterHeight / 2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(meterX - 1, meterY - 1, meterWidth + 2, meterHeight + 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1 / camera.zoom;
                ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
                const fillHeight = meterHeight * chargeProgress;
                const fillY = meterY + meterHeight - fillHeight;
                const gradient = ctx.createLinearGradient(meterX, meterY + meterHeight, meterX, meterY);
                gradient.addColorStop(0, '#ffff00');
                gradient.addColorStop(0.5, '#ff8800');
                gradient.addColorStop(1, '#ff0000');
                ctx.fillStyle = gradient;
                ctx.fillRect(meterX, fillY, meterWidth, fillHeight);
            }
        }
    },

    /** Called from EntitySpriteRenderer when player uses sprite path: draw weapon, attack arc, reload bar, charge meter. */
    drawWeaponAndMetersForSpritePath(context, entity, screenX, screenY) {
        const { ctx, camera, systems, settings } = context;
        const showPlayerHitboxIndicators = settings && settings.showPlayerHitboxIndicators !== false;
        const transform = entity.getComponent(Transform);
        const combat = entity.getComponent(Combat);
        const movement = entity.getComponent(Movement);
        const healing = entity.getComponent(PlayerHealing);
        const stamina = entity.getComponent(Stamina);
        const weapon = combat && combat.attackHandler ? combat.attackHandler.weapon : (combat && combat.playerAttack ? combat.playerAttack.weapon : null);
        const isCrossbow = weapon && weapon.isRanged === true;
        const isMace = weapon && weapon.name && String(weapon.name).toLowerCase().includes('mace');
        const showWeapon = !healing || !healing.isHealing;
        const useCharacterSprites = !settings || settings.useCharacterSprites !== false;
        if (!useCharacterSprites && showWeapon) {
            const isMeleeSpin = combat && combat.isAttacking && combat.currentAttackAnimationKey === 'meleeSpin';
            if (isMeleeSpin) {
                ctx.save();
                try {
                    ctx.translate(screenX, screenY);
                    const spinProgress = PlayerCombatRenderer.getSweepProgress(combat);
                    const pullBack = PlayerCombatRenderer.getAnticipationPullBack(combat);
                    ctx.rotate(Math.PI + pullBack + spinProgress * Math.PI * 2);
                    ctx.translate(-screenX, -screenY);
                    if (showPlayerHitboxIndicators && combat && combat.isAttacking && movement) {
                        PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement, camera, { comboColors: false });
                    }
                    if (isCrossbow && combat && movement && transform) {
                        PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                    } else if (isMace && combat && movement && transform) {
                        PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                    } else if (combat && movement && transform) {
                        PlayerCombatRenderer.drawSword(ctx, screenX, screenY, transform, movement, combat, camera);
                    }
                    if (combat && movement && transform) {
                        PlayerCombatRenderer.drawShield(ctx, screenX, screenY, transform, movement, combat, camera);
                    }
                } finally {
                    ctx.restore();
                }
            } else {
                if (showPlayerHitboxIndicators && combat && combat.isAttacking && movement) {
                    PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement, camera, { comboColors: false });
                }
                if (isCrossbow && combat && movement && transform) {
                    PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isMace && combat && movement && transform) {
                    PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (combat && movement && transform) {
                    PlayerCombatRenderer.drawSword(ctx, screenX, screenY, transform, movement, combat, camera);
                }
                if (combat && movement && transform) {
                    PlayerCombatRenderer.drawShield(ctx, screenX, screenY, transform, movement, combat, camera);
                }
            }
        }
        const crossbowConfig = typeof GameConfig !== 'undefined' && GameConfig.player && GameConfig.player.crossbow ? GameConfig.player.crossbow : null;
        if (isCrossbow && crossbowConfig && transform) {
            const pBarWidth = 40 * camera.zoom;
            const pBarHeight = 5 * camera.zoom;
            const pBarX = screenX - pBarWidth / 2;
            const pBarY = screenY - (transform.height + 10) * camera.zoom;
            const gap = 3 * camera.zoom;
            let reloadBarY = pBarY + pBarHeight + gap;
            if (stamina) reloadBarY += (4 * camera.zoom) + gap;
            const reloadBarHeight = 4 * camera.zoom;
            ctx.fillStyle = '#1a1208';
            ctx.fillRect(pBarX, reloadBarY, pBarWidth, reloadBarHeight);
            ctx.strokeStyle = '#3d2817';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(pBarX, reloadBarY, pBarWidth, reloadBarHeight);
            const progress = Math.min(1, entity.crossbowReloadProgress ?? 1);
            ctx.fillStyle = 'rgba(180, 220, 100, 0.4)';
            ctx.fillRect(pBarX + pBarWidth * crossbowConfig.perfectWindowStart, reloadBarY, pBarWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
            ctx.strokeStyle = 'rgba(200, 255, 120, 0.6)';
            ctx.strokeRect(pBarX + pBarWidth * crossbowConfig.perfectWindowStart, reloadBarY, pBarWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
            ctx.fillStyle = '#4a6040';
            ctx.fillRect(pBarX, reloadBarY, pBarWidth * progress, reloadBarHeight);
        }
        const inputSystem = systems ? systems.get('input') : null;
        const chargeAttackConfig = combat && weapon && weapon.chargeAttack ? weapon.chargeAttack : null;
        if (inputSystem && inputSystem.isCharging && transform && chargeAttackConfig) {
            const chargeDuration = inputSystem.getChargeDuration();
            const maxChargeTime = chargeAttackConfig.maxChargeTime;
            const minChargeTime = chargeAttackConfig.minChargeTime;
            if (chargeDuration >= minChargeTime) {
                const chargeProgress = Math.min(1.0, (chargeDuration - minChargeTime) / (maxChargeTime - minChargeTime));
                const meterWidth = 6 * camera.zoom;
                const meterHeight = 40 * camera.zoom;
                const meterX = screenX - (transform.width / 2 + 15) * camera.zoom;
                const meterY = screenY - meterHeight / 2;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.fillRect(meterX - 1, meterY - 1, meterWidth + 2, meterHeight + 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1 / camera.zoom;
                ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
                const fillHeight = meterHeight * chargeProgress;
                const fillY = meterY + meterHeight - fillHeight;
                const gradient = ctx.createLinearGradient(meterX, meterY + meterHeight, meterX, meterY);
                gradient.addColorStop(0, '#ffff00');
                gradient.addColorStop(0.5, '#ff8800');
                gradient.addColorStop(1, '#ff0000');
                ctx.fillStyle = gradient;
                ctx.fillRect(meterX, fillY, meterWidth, fillHeight);
            }
        }
    }
};

