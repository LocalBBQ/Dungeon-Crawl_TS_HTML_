// Player procedural rendering: path, body (helmet, pauldrons), weapons (via PlayerCombatRenderer), vial, bars, reload, charge meter.
import { Movement } from '../../components/Movement.js';
import { GameConfig } from '../../config/GameConfig.js';
import { Utils } from '../../utils/Utils.js';
import { Transform } from '../../components/Transform.js';
import { Combat } from '../../components/Combat.js';
import { Health } from '../../components/Health.js';
import { Renderable } from '../../components/Renderable.js';
import { PlayerHealing } from '../../components/PlayerHealing.js';
import { Stamina } from '../../components/Stamina.js';
import { PlayerCombatRenderer } from './PlayerCombatRenderer.js';
import { EntityEffectsRenderer } from './EntityEffectsRenderer.js';
import { getBowChargeLevel } from '../../weapons/bowShotEffects.js';
import type { RenderContext } from './RenderContext.js';
import type { EntityShape } from '../../types/entity.js';

type WeaponLike = { name?: string; isRanged?: boolean; isBow?: boolean; isStaff?: boolean; chargeAttack?: { minChargeTime?: number; maxChargeTime?: number } };

function getBowChargeLevelForRender(
    inputSystem: { isCharging?: boolean; getChargeDuration?: () => number } | null,
    bowConfig: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } | undefined
): number {
    if (!inputSystem?.isCharging || !inputSystem.getChargeDuration || !bowConfig) return 0;
    const duration = inputSystem.getChargeDuration();
    return getBowChargeLevel(duration, {
        level1: bowConfig.chargeLevel1,
        level2: bowConfig.chargeLevel2,
        level3: bowConfig.chargeLevel3
    });
}

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
        const weapon = (combat && combat.attackHandler ? combat.attackHandler.weapon : (combat && combat.playerAttack ? combat.playerAttack.weapon : null)) as WeaponLike | null;
        const inputLike = inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null;
        const isRanged = weapon && weapon.isRanged === true;
        const isBow = isRanged && weapon.isBow === true;
        const isStaff = weapon && (weapon.isStaff === true || (weapon.name && String(weapon.name).toLowerCase().includes('staff')));
        const isCrossbow = isRanged && !isBow && !isStaff;
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
            if (weapon && showWeapon && !isRanged && !isMace && !isStaff) {
                PlayerCombatRenderer.drawSword(ctx, screenX, screenY, transform, movement, combat, camera, { part: 'handle' });
            }
            const isDodging = movement && (movement as Movement & { isDodging?: boolean }).isDodging;
            const w = transform.width * camera.zoom;
            const h = transform.height * camera.zoom;
            if (isDodging) ctx.globalAlpha = 0.6;
            const lw = Math.max(1, 2 / camera.zoom);
            ctx.lineWidth = lw;
            const playingState = systems?.get?.('playingState') as { playerClass?: string } | undefined;
            const playerClass = playingState?.playerClass;
            const isMage = playerClass === 'mage';
            const isRogue = playerClass === 'rogue';
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(movement ? movement.facingAngle : 0);
            if (isMage) {
                // Wizard top-down (matches class select): sleeves, bald head under hood, hood, hat tip
                const hoodRx = w * 0.42;
                const hoodRy = w * 0.38;
                const sleeveOffsetY = hoodRy * 0.72;
                const sleeveRx = w * 0.22;
                const sleeveRy = w * 0.28;
                const robeFill = isDodging ? '#2a1a3a' : (combat && combat.isAttacking ? '#4a3a5a' : '#3d2d4d');
                const robeStroke = '#2a2035';
                const hoodFill = isDodging ? '#2a1a32' : '#352540';
                const hoodStroke = '#2a2035';
                const headFill = isDodging ? '#5a4a4a' : '#8b7355';
                const headStroke = '#6a5a48';
                ctx.fillStyle = robeFill;
                ctx.strokeStyle = robeStroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.ellipse(0, sleeveOffsetY, sleeveRx, sleeveRy, 0, 0, Math.PI * 2);
                ctx.ellipse(0, -sleeveOffsetY, sleeveRx, sleeveRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Bald head (small, mostly covered by hood)
                ctx.fillStyle = headFill;
                ctx.strokeStyle = headStroke;
                ctx.beginPath();
                ctx.ellipse(0, 0, hoodRx * 0.5, hoodRy * 0.55, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Hood covering the head
                ctx.fillStyle = hoodFill;
                ctx.strokeStyle = hoodStroke;
                ctx.beginPath();
                ctx.ellipse(0, 0, hoodRx, hoodRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (isRogue) {
                // Rogue top-down: all brown hood and shoulders, no face opening
                const hoodRx = w * 0.44;
                const hoodRy = w * 0.40;
                const shoulderOffsetY = hoodRy * 0.68;
                const shoulderRx = w * 0.18;
                const shoulderRy = w * 0.24;
                const brownFill = isDodging ? '#5c4a3a' : (combat && combat.isAttacking ? '#6b5a4a' : '#5a4a3a');
                const brownStroke = '#3d3228';
                // Slim shoulders
                ctx.fillStyle = brownFill;
                ctx.strokeStyle = brownStroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.ellipse(0, shoulderOffsetY, shoulderRx, shoulderRy, 0, 0, Math.PI * 2);
                ctx.ellipse(0, -shoulderOffsetY, shoulderRx, shoulderRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Hood: large draping shape
                ctx.fillStyle = brownFill;
                ctx.strokeStyle = brownStroke;
                ctx.lineWidth = lw;
                ctx.beginPath();
                ctx.ellipse(0, 0, hoodRx, hoodRy, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                // Knight: pauldrons + helmet
                const steel = isDodging ? '#707080' : (combat && combat.isAttacking ? '#9a8b8b' : '#8b8b9a');
                const steelDark = '#5a5a68';
                const steelDarker = '#4a4a58';
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
            }
            ctx.restore();
            ctx.globalAlpha = 1.0;
            if (weapon && showWeapon) {
                if (isBow) {
                    const bowChargeLevel = getBowChargeLevelForRender(inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null, (GameConfig.player as { bow?: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } })?.bow);
                    PlayerCombatRenderer.drawBow(ctx, screenX, screenY, transform, movement, combat, camera, bowChargeLevel);
                } else if (isRanged && !isStaff) {
                    PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isMace) {
                    PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isStaff) {
                    PlayerCombatRenderer.drawStaff(ctx, screenX, screenY, transform, movement, combat, camera);
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
            // Parry success: brief white flash
            if (combat && combat.parryFlashUntil > Date.now()) {
                ctx.save();
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, (transform.width / 2 + 6) * camera.zoom, (transform.height / 2 + 6) * camera.zoom, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        } finally {
            ctx.restore();
        }

        EntityEffectsRenderer.drawHealingVial(context, entity, screenX, screenY);
        if (health) {
            EntityEffectsRenderer.renderBarsAndEffects(context, entity, screenX, screenY, { isPlayer: true });
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
                const progress = Math.min(1, (entity as EntityShape & { crossbowReloadProgress?: number }).crossbowReloadProgress ?? 1);
                ctx.fillStyle = 'rgba(180, 220, 100, 0.4)';
                ctx.fillRect(barX + barWidth * crossbowConfig.perfectWindowStart, barsBottomY, barWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
                ctx.strokeStyle = 'rgba(200, 255, 120, 0.6)';
                ctx.strokeRect(barX + barWidth * crossbowConfig.perfectWindowStart, barsBottomY, barWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
                ctx.fillStyle = '#4a6040';
                ctx.fillRect(barX, barsBottomY, barWidth * progress, reloadBarHeight);
            }
        const bowConfig = (GameConfig.player as { bow?: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } })?.bow;
        if (isBow && (inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null)?.isCharging && bowConfig && transform) {
            const chargeDuration = (inputSystem as { getChargeDuration?: () => number }).getChargeDuration?.() ?? 0;
            const barWidth = 40 * camera.zoom;
            const barHeight = 4 * camera.zoom;
            const barX = screenX - barWidth / 2;
            let barY = screenY - (transform.height + 10) * camera.zoom + 5 * camera.zoom + 3 * camera.zoom;
            const stamina = entity.getComponent(Stamina);
            if (stamina) barY += (4 * camera.zoom) + 3 * camera.zoom;
            const maxT = bowConfig.chargeLevel3;
            const fillRatio = Math.min(1, chargeDuration / maxT);
            ctx.fillStyle = 'rgba(20, 25, 15, 0.9)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.strokeStyle = '#3d4a35';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            const w1 = (bowConfig.chargeLevel1 / maxT) * barWidth;
            const w2 = (bowConfig.chargeLevel2 / maxT) * barWidth;
            ctx.strokeStyle = 'rgba(80, 100, 60, 0.8)';
            ctx.beginPath();
            ctx.moveTo(barX + w1, barY);
            ctx.lineTo(barX + w1, barY + barHeight);
            ctx.moveTo(barX + w2, barY);
            ctx.lineTo(barX + w2, barY + barHeight);
            ctx.stroke();
            ctx.fillStyle = '#5a7a40';
            ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
        }
        const chargeAttackConfig = combat && weapon && weapon.chargeAttack ? weapon.chargeAttack : null;
        if (inputLike && inputLike.isCharging && chargeAttackConfig && transform) {
            const chargeDuration = inputLike.getChargeDuration?.() ?? 0;
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
    drawWeaponAndMetersForSpritePath(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { ctx, camera, systems, settings } = context;
        const inputSystem = systems ? systems.get('input') : null;
        const showPlayerHitboxIndicators = settings && settings.showPlayerHitboxIndicators !== false;
        const transform = entity.getComponent(Transform);
        const combat = entity.getComponent(Combat);
        const movement = entity.getComponent(Movement);
        const healing = entity.getComponent(PlayerHealing);
        const stamina = entity.getComponent(Stamina);
        const weapon = (combat && combat.attackHandler ? combat.attackHandler.weapon : (combat && combat.playerAttack ? combat.playerAttack.weapon : null)) as WeaponLike | null;
        const isRanged = weapon && weapon.isRanged === true;
        const isBow = isRanged && weapon.isBow === true;
        const isStaff = weapon && (weapon.isStaff === true || (weapon.name && String(weapon.name).toLowerCase().includes('staff')));
        const isCrossbow = isRanged && !isBow && !isStaff;
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
                    if (isBow && combat && movement && transform) {
                        const bowChargeLevel = getBowChargeLevelForRender(inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null, (GameConfig.player as { bow?: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } })?.bow);
                        PlayerCombatRenderer.drawBow(ctx, screenX, screenY, transform, movement, combat, camera, bowChargeLevel);
                    } else if (isRanged && !isStaff && combat && movement && transform) {
                        PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                    } else if (isMace && combat && movement && transform) {
                        PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                    } else if (isStaff && combat && movement && transform) {
                        PlayerCombatRenderer.drawStaff(ctx, screenX, screenY, transform, movement, combat, camera);
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
                if (isBow && combat && movement && transform) {
                    const bowChargeLevel = getBowChargeLevelForRender(inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null, (GameConfig.player as { bow?: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } })?.bow);
                    PlayerCombatRenderer.drawBow(ctx, screenX, screenY, transform, movement, combat, camera, bowChargeLevel);
                } else if (isRanged && !isStaff && combat && movement && transform) {
                    PlayerCombatRenderer.drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isMace && combat && movement && transform) {
                    PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
                } else if (isStaff && combat && movement && transform) {
                    PlayerCombatRenderer.drawStaff(ctx, screenX, screenY, transform, movement, combat, camera);
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
            const progress = Math.min(1, (entity as EntityShape & { crossbowReloadProgress?: number }).crossbowReloadProgress ?? 1);
            ctx.fillStyle = 'rgba(180, 220, 100, 0.4)';
            ctx.fillRect(pBarX + pBarWidth * crossbowConfig.perfectWindowStart, reloadBarY, pBarWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
            ctx.strokeStyle = 'rgba(200, 255, 120, 0.6)';
            ctx.strokeRect(pBarX + pBarWidth * crossbowConfig.perfectWindowStart, reloadBarY, pBarWidth * (crossbowConfig.perfectWindowEnd - crossbowConfig.perfectWindowStart), reloadBarHeight);
            ctx.fillStyle = '#4a6040';
            ctx.fillRect(pBarX, reloadBarY, pBarWidth * progress, reloadBarHeight);
        }
        const bowConfig = (GameConfig.player as { bow?: { chargeLevel1: number; chargeLevel2: number; chargeLevel3: number } })?.bow;
        if (isBow && (inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null)?.isCharging && bowConfig && transform) {
            const chargeDuration = (inputSystem as { getChargeDuration?: () => number }).getChargeDuration?.() ?? 0;
            const barWidth = 40 * camera.zoom;
            const barHeight = 4 * camera.zoom;
            const barX = screenX - barWidth / 2;
            let barY = screenY - (transform.height + 10) * camera.zoom + 5 * camera.zoom + 3 * camera.zoom;
            if (stamina) barY += (4 * camera.zoom) + 3 * camera.zoom;
            const maxT = bowConfig.chargeLevel3;
            const fillRatio = Math.min(1, chargeDuration / maxT);
            ctx.fillStyle = 'rgba(20, 25, 15, 0.9)';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.strokeStyle = '#3d4a35';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            const w1 = (bowConfig.chargeLevel1 / maxT) * barWidth;
            const w2 = (bowConfig.chargeLevel2 / maxT) * barWidth;
            ctx.strokeStyle = 'rgba(80, 100, 60, 0.8)';
            ctx.beginPath();
            ctx.moveTo(barX + w1, barY);
            ctx.lineTo(barX + w1, barY + barHeight);
            ctx.moveTo(barX + w2, barY);
            ctx.lineTo(barX + w2, barY + barHeight);
            ctx.stroke();
            ctx.fillStyle = '#5a7a40';
            ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
        }
        const chargeAttackConfig = combat && weapon && weapon.chargeAttack ? weapon.chargeAttack : null;
        const inputLikeLocal = inputSystem as { isCharging?: boolean; getChargeDuration?: () => number } | null;
        if (inputLikeLocal && inputLikeLocal.isCharging && transform && chargeAttackConfig) {
            const chargeDuration = inputLikeLocal.getChargeDuration?.() ?? 0;
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

