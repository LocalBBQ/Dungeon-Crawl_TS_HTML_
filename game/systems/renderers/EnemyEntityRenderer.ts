// Enemy procedural rendering: telegraphs, indicators, body shapes (goblin, chieftain, demon, skeleton), weapon, bars.
// Used by EntityLayerRenderer when useCharacterSprites is false or entity has no sprite.
import { Movement } from '../../components/Movement.ts';
import { GameConfig } from '../../config/GameConfig.ts';
import { Utils } from '../../utils/Utils.ts';
import { Transform } from '../../components/Transform.ts';
import { Combat } from '../../components/Combat.ts';
import { Health } from '../../components/Health.ts';
import { Renderable } from '../../components/Renderable.ts';
import { AI } from '../../components/AI.ts';
import { PlayerCombatRenderer } from '../../renderers/PlayerCombatRenderer.ts';
import { EnemyCombatRenderer } from '../../renderers/EnemyCombatRenderer.ts';
import type { RenderContext } from './RenderContext.ts';
import type { EntityShape } from '../../types/entity.ts';

export const EnemyEntityRenderer = {
    drawWeapon(context: RenderContext, enemyType: string, screenX: number, screenY: number, facingAngle: number, r: number, h: number, combat: unknown): void {
        const { ctx, camera } = context;
        const scale = camera.zoom;
        const handOffset = 0.55;

        if (enemyType === 'fireDragon') {
            return;
        }
        if (enemyType === 'goblinChieftain') {
            const headRad = 11 * scale;
            const handleLen = 14 * scale;
            const handleW = 6 * scale;
            // Grip on the side like the player (same as goblin)
            const sideAngle = facingAngle + Math.PI / 2;
            const sideOffset = 0.78;
            let baseX = screenX + Math.cos(sideAngle) * r * sideOffset;
            let baseY = screenY + Math.sin(sideAngle) * h * sideOffset;
            // Idle: club extends forward from side grip (like player). Attack: wind-up then slam (raised higher).
            let clubAngle = facingAngle;
            if (combat && (combat.isWindingUp || combat.isAttacking)) {
                const chargeProgress = combat.chargeProgress != null ? combat.chargeProgress : 0;
                // Draw club higher on screen during slam (lift grip upward)
                const lift = 18 * scale;
                baseY -= lift;
                if (combat.isWindingUp) {
                    clubAngle = facingAngle - Math.PI * 0.85; // raised well overhead
                } else {
                    clubAngle = facingAngle - Math.PI * 0.85 + chargeProgress * Math.PI * 0.85; // slam down from high
                }
            }
            // Grip at end of handle: origin is club head, so translate so handle end (-handleLen-headRad, 0) is at (baseX, baseY)
            const gripOffset = handleLen + headRad;
            ctx.save();
            ctx.translate(baseX + gripOffset * Math.cos(clubAngle), baseY + gripOffset * Math.sin(clubAngle));
            ctx.rotate(clubAngle);
            ctx.fillStyle = '#3d3228';
            ctx.strokeStyle = '#2a2218';
            ctx.lineWidth = Math.max(1, 2 / scale);
            ctx.beginPath();
            ctx.ellipse(0, 0, headRad, headRad * 1.05, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const nubRad = 3.5 * scale;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * headRad * 0.85, Math.sin(a) * headRad * 0.85, nubRad, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#4a3d32';
            ctx.fillRect(-handleLen - headRad, -handleW / 2, handleLen, handleW);
            ctx.strokeRect(-handleLen - headRad, -handleW / 2, handleLen, handleW);
            ctx.restore();
            return;
        }

        const isGoblin = enemyType === 'goblin';
        const isBanditDagger = enemyType === 'banditDagger';
        let baseX, baseY;
        if (isGoblin) {
            const sideAngle = facingAngle + Math.PI / 2;
            const sideOffset = 0.78;
            baseX = screenX + Math.cos(sideAngle) * r * sideOffset;
            baseY = screenY + Math.sin(sideAngle) * h * sideOffset;
        } else if (isBanditDagger) {
            baseX = screenX + Math.cos(facingAngle) * r * handOffset;
            baseY = screenY + Math.sin(facingAngle) * h * handOffset;
        } else {
            baseX = screenX + Math.cos(facingAngle) * r * handOffset;
            baseY = screenY + Math.sin(facingAngle) * h * handOffset;
        }

        let drawAngle = facingAngle;
        if ((isGoblin || isBanditDagger) && combat) {
            const handler = combat.enemyAttackHandler;
            const attackArc = (handler && handler.attackArc != null) ? handler.attackArc : (combat.attackArc != null ? combat.attackArc : Math.PI / 2);
            const halfArc = attackArc / 2;
            const arcCenter = facingAngle + (combat.attackArcOffset ?? 0);
            // For banditDagger read sweep from handler each frame so attack redraws (handler uses _slashStartTime)
            const sweepProgress = combat.isWindingUp ? 0 : (handler && typeof handler.getSlashSweepProgress === 'function' ? handler.getSlashSweepProgress() : combat.enemySlashSweepProgress);
            if (combat.currentAttackReverseSweep) {
                drawAngle = arcCenter + halfArc - sweepProgress * attackArc;
            } else {
                drawAngle = arcCenter - halfArc + sweepProgress * attackArc;
            }
        }

        if (isGoblin) {
            const weapon = combat && combat.weapon;
            const daggerLength = (weapon && weapon.weaponLength != null) ? weapon.weaponLength : 35;
            const style = (weapon && weapon.visual === 'goblinDagger') ? 'goblin' : undefined;
            PlayerCombatRenderer.drawDaggerAt(ctx, baseX, baseY, drawAngle, daggerLength, camera, style ? { style } : {});
            return;
        }
        if (isBanditDagger) {
            const weapon = combat && combat.weapon;
            const daggerLength = (weapon && weapon.weaponLength != null) ? weapon.weaponLength : 35;
            PlayerCombatRenderer.drawDaggerAt(ctx, baseX, baseY, drawAngle, daggerLength, camera, {});
            return;
        }

        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate(drawAngle);
        ctx.restore();
    },

    render(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { ctx, canvas, camera, systems, settings } = context;
        const showEnemyHitboxIndicators = settings && settings.showEnemyHitboxIndicators !== false;

        const transform = entity.getComponent(Transform);
        const movement = entity.getComponent(Movement);
        const combat = entity.getComponent(Combat);
        const health = entity.getComponent(Health);
        const renderable = entity.getComponent(Renderable);
        const ai = entity.getComponent(AI);

        if (ai && ai.isCastingPillar) {
            const player = systems && systems.get('entities') ? systems.get('entities').get('player') : null;
            const playerTransform = player ? player.getComponent(Transform) : null;
            if (playerTransform) {
                const pillarConfig = GameConfig.enemy.types.greaterDemon && GameConfig.enemy.types.greaterDemon.pillarFlame;
                const radius = (pillarConfig && pillarConfig.radius ? pillarConfig.radius : 45) * camera.zoom;
                const telegraphX = camera.toScreenX(playerTransform.x);
                const telegraphY = camera.toScreenY(playerTransform.y);
                const progress = pillarConfig && pillarConfig.castDelay ? 1 - (ai.pillarCastTimer / pillarConfig.castDelay) : 0;
                ctx.strokeStyle = 'rgba(255, 120, 40, 0.6)';
                ctx.lineWidth = 2 / camera.zoom;
                ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
                ctx.beginPath();
                ctx.arc(telegraphX, telegraphY, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(200, 80, 30, 0.15)';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(telegraphX, telegraphY, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
                ctx.lineTo(telegraphX, telegraphY);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 100, 40, 0.25)';
                ctx.fill();
            }
        }

        const hasChargeRelease = combat && combat.enemyAttackHandler && combat.enemyAttackHandler.hasChargeRelease && combat.enemyAttackHandler.hasChargeRelease();
        if (showEnemyHitboxIndicators && combat && hasChargeRelease && combat.isAttacking) {
            const chargeProgress = combat.chargeProgress || 0;
            const aoeInFront = combat.currentAttackAoeInFront && transform && movement;
            const facingAngle = movement ? movement.facingAngle : 0;
            let drawX = screenX;
            let drawY = screenY;
            let range = (combat.attackRange || 70) * camera.zoom;
            if (aoeInFront && combat.currentAttackAoeRadius > 0) {
                const slamWorldX = transform.x + Math.cos(facingAngle) * (combat.currentAttackAoeOffset || 0);
                const slamWorldY = transform.y + Math.sin(facingAngle) * (combat.currentAttackAoeOffset || 0);
                drawX = camera.toScreenX(slamWorldX);
                drawY = camera.toScreenY(slamWorldY);
                range = combat.currentAttackAoeRadius * camera.zoom;
            }
            const isCircular = combat.currentAttackIsCircular || aoeInFront;
            ctx.fillStyle = `rgba(30, 45, 25, ${0.15 + chargeProgress * 0.2})`;
            ctx.beginPath();
            if (isCircular) {
                ctx.arc(drawX, drawY, range, 0, Math.PI * 2);
            } else {
                const arc = combat.attackArc != null ? combat.attackArc : Utils.degToRad(90);
                const arcCenter = facingAngle + (combat.attackArcOffset ?? 0);
                const halfArc = arc / 2;
                ctx.arc(drawX, drawY, range, arcCenter - halfArc, arcCenter + halfArc);
                ctx.lineTo(drawX, drawY);
                ctx.closePath();
            }
            ctx.fill();
            ctx.strokeStyle = 'rgba(60, 80, 40, 0.8)';
            ctx.lineWidth = 3 / camera.zoom;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(120, 100, 50, 0.7)';
            ctx.lineWidth = Math.max(1, 1.5 / camera.zoom);
            ctx.beginPath();
            if (isCircular) {
                ctx.arc(drawX, drawY, range - 3 / camera.zoom, 0, Math.PI * 2);
            } else {
                const arc = combat.attackArc != null ? combat.attackArc : Utils.degToRad(90);
                const arcCenter = facingAngle + (combat.attackArcOffset ?? 0);
                const halfArc = arc / 2;
                ctx.arc(drawX, drawY, range - 3 / camera.zoom, arcCenter - halfArc, arcCenter + halfArc);
            }
            ctx.stroke();
        }

        if (showEnemyHitboxIndicators && ai && ai.isChargingLunge) {
            const enemyConfig = ai.enemyType ? GameConfig.enemy.types[ai.enemyType] : null;
            const lungeConfig = enemyConfig && enemyConfig.lunge ? enemyConfig.lunge : null;
            if (lungeConfig) {
                const maxChargeTime = lungeConfig.chargeTime;
                const remainingTime = Math.max(0, ai.lungeChargeTimer);
                const chargeProgress = 1 - (remainingTime / maxChargeTime);
                const pulseSize = (transform.width / 2 + 10) * camera.zoom * (1 + chargeProgress * 0.5);
                const alpha = 0.8 - chargeProgress * 0.4;
                ctx.strokeStyle = `rgba(120, 40, 35, ${alpha})`;
                ctx.lineWidth = 4 / camera.zoom;
                ctx.beginPath();
                ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = `rgba(160, 80, 40, ${0.5 + chargeProgress * 0.4})`;
                ctx.lineWidth = 3 / camera.zoom;
                ctx.beginPath();
                ctx.arc(screenX, screenY, (transform.width / 2 + 5) * camera.zoom, 0, Math.PI * 2 * chargeProgress);
                ctx.stroke();
            }
        }

        // Wind-up telegraph: full cone for charge/AOE attacks; skip full cone for slash-sweep (e.g. bandit mace) so hitbox only appears during swing
        const hasSlashSweepWindUp = combat && combat.enemyAttackHandler && typeof combat.enemyAttackHandler.getSlashSweepProgress === 'function';
        if (showEnemyHitboxIndicators && combat && combat.isWindingUp && !hasSlashSweepWindUp) {
            const visualProgress = EnemyCombatRenderer.getWindUpVisualProgress(combat);
            const dangerPhase = EnemyCombatRenderer.getWindUpDangerPhase(combat);
            const facingAngle = movement ? movement.facingAngle : 0;
            const arcOffset = combat.attackArcOffset ?? 0;
            const arcCenter = facingAngle + arcOffset;
            const arc = combat.attackArc != null ? combat.attackArc : Utils.degToRad(90);
            const halfArc = arc / 2;
            const aoeInFrontWindUp = combat.currentAttackAoeInFront && transform && movement && combat.currentAttackAoeRadius > 0;
            let zoneX = screenX;
            let zoneY = screenY;
            let range = combat.attackRange * camera.zoom;
            if (aoeInFrontWindUp) {
                zoneX = camera.toScreenX(transform.x + Math.cos(facingAngle) * (combat.currentAttackAoeOffset || 0));
                zoneY = camera.toScreenY(transform.y + Math.sin(facingAngle) * (combat.currentAttackAoeOffset || 0));
                range = combat.currentAttackAoeRadius * camera.zoom;
            }
            const isCircularWindUp = combat.currentAttackIsCircular || aoeInFrontWindUp;
            const startAngle = arcCenter - halfArc;
            const endAngle = arcCenter + halfArc;
            const pulseSize = (transform.width / 2 + 5) * camera.zoom * (1 + visualProgress * 0.4);
            const alpha = 0.5 - visualProgress * 0.35;
            ctx.strokeStyle = dangerPhase > 0 ? `rgba(200, 80, 50, ${0.5 + dangerPhase * 0.5})` : `rgba(140, 100, 50, ${alpha})`;
            ctx.lineWidth = dangerPhase > 0 ? (3 + dangerPhase * 2) / camera.zoom : 3 / camera.zoom;
            ctx.beginPath();
            ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = `rgba(35, 30, 28, ${visualProgress * 0.28})`;
            ctx.beginPath();
            if (isCircularWindUp) {
                ctx.arc(zoneX, zoneY, range, 0, Math.PI * 2);
            } else {
                ctx.arc(zoneX, zoneY, range, startAngle, endAngle);
                ctx.lineTo(zoneX, zoneY);
                ctx.closePath();
            }
            ctx.fill();
            ctx.strokeStyle = dangerPhase > 0 ? `rgba(180, 70, 50, ${0.5 + dangerPhase * 0.5})` : `rgba(80, 70, 60, ${visualProgress * 0.8})`;
            ctx.lineWidth = dangerPhase > 0 ? (2 + dangerPhase * 1.5) / camera.zoom : 2 / camera.zoom;
            ctx.stroke();
            if (dangerPhase > 0) {
                ctx.strokeStyle = `rgba(220, 60, 40, ${dangerPhase * 0.9})`;
                ctx.lineWidth = Math.max(1, 2.5 / camera.zoom);
                ctx.beginPath();
                if (isCircularWindUp) {
                    ctx.arc(zoneX, zoneY, range - 4 / camera.zoom, 0, Math.PI * 2);
                } else {
                    ctx.arc(zoneX, zoneY, range - 4 / camera.zoom, startAngle, endAngle);
                }
                ctx.stroke();
            }
        }

        // Generic slash hitbox (skip bandit — they use same path as player mace in the bandit block below)
        if (showEnemyHitboxIndicators && combat && combat.isAttacking && !combat.isWindingUp && !hasChargeRelease && !(ai && ai.enemyType === 'bandit')) {
            const facingAngle = movement ? movement.facingAngle : 0;
            const arcOffset = combat.attackArcOffset ?? 0;
            const arcCenter = facingAngle + arcOffset;
            const arc = combat.attackArc != null ? combat.attackArc : Utils.degToRad(90);
            const halfArc = arc / 2;
            const fullRange = combat.attackRange * camera.zoom;
            const hasSlashSweep = combat.enemyAttackHandler && typeof combat.enemyAttackHandler.getSlashSweepProgress === 'function';
            const sweepProgress = hasSlashSweep ? combat.enemySlashSweepProgress : 1;
            let startAngle = arcCenter - halfArc;
            let endAngle = arcCenter + halfArc;
            if (hasSlashSweep) {
                if (combat.currentAttackReverseSweep) {
                    startAngle = arcCenter + halfArc - sweepProgress * arc;
                    endAngle = arcCenter + halfArc;
                } else {
                    endAngle = arcCenter - halfArc + sweepProgress * arc;
                }
            }
            // Scale radius with sweep so the cone grows with the swing (not full range instantly)
            const currentRange = fullRange * Math.max(0.02, sweepProgress);
            ctx.fillStyle = 'rgba(50, 40, 35, 0.32)';
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRange, startAngle, endAngle);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#5a4a52';
            ctx.lineWidth = 4 / camera.zoom;
            ctx.stroke();
            ctx.strokeStyle = 'rgba(200, 140, 100, 0.85)';
            ctx.lineWidth = Math.max(1, 2 / camera.zoom);
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(0, currentRange - 3 / camera.zoom), startAngle, endAngle);
            ctx.stroke();
        }

        // Chieftain slam: white ground-impact zone (visual only, not hitbox)
        if (ai && ai.enemyType === 'goblinChieftain' && combat && combat.isAttacking && !combat.isWindingUp &&
            combat.currentAttackAoeInFront && combat.currentAttackAoeRadius > 0 && transform && movement) {
            const facingAngle = movement.facingAngle;
            const slamWorldX = transform.x + Math.cos(facingAngle) * (combat.currentAttackAoeOffset || 0);
            const slamWorldY = transform.y + Math.sin(facingAngle) * (combat.currentAttackAoeOffset || 0);
            const impactScreenX = camera.toScreenX(slamWorldX);
            const impactScreenY = camera.toScreenY(slamWorldY);
            const impactRadius = combat.currentAttackAoeRadius * camera.zoom;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.beginPath();
            ctx.arc(impactScreenX, impactScreenY, impactRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.lineWidth = Math.max(1, 2 / camera.zoom);
            ctx.stroke();
        }

        if (typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.drawShadow(ctx, screenX, screenY, transform, camera, { fillStyle: 'rgba(0, 0, 0, 0.3)' });
            EntityEffectsRenderer.drawPackModifierGlow(context, entity, screenX, screenY);
        }
        if (typeof EntityEffectsRenderer === 'undefined') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + (transform.height / 2 + 5) * camera.zoom, (transform.width / 2) * camera.zoom, (transform.height / 4) * camera.zoom, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        let bodyColor = renderable.color;
        if (ai && ai.isChargingLunge) {
            const enemyConfig = ai.enemyType ? GameConfig.enemy.types[ai.enemyType] : null;
            const lungeConfig = enemyConfig && enemyConfig.lunge ? enemyConfig.lunge : null;
            if (lungeConfig) {
                const remainingTime = Math.max(0, ai.lungeChargeTimer);
                const chargeProgress = 1 - (remainingTime / lungeConfig.chargeTime);
                bodyColor = `rgba(255, ${Math.floor(100 + (1 - chargeProgress) * 100)}, ${Math.floor(50 + (1 - chargeProgress) * 50)}, 1)`;
            }
        } else if (combat && combat.isWindingUp) {
            const intensity = EnemyCombatRenderer.getWindUpVisualProgress(combat);
            bodyColor = `rgba(255, ${Math.floor(100 + (1 - intensity) * 100)}, ${Math.floor(50 + (1 - intensity) * 50)}, 1)`;
        } else if (combat && combat.isLunging) {
            bodyColor = '#ff0000';
        }

        const sizeMultiplier = combat && combat.isWindingUp ? (1 + EnemyCombatRenderer.getWindUpVisualProgress(combat) * 0.12) : 1;
        const r = (transform.width / 2) * camera.zoom * sizeMultiplier;
        const h = (transform.height / 2) * camera.zoom * sizeMultiplier;
        // Use base shape for tier-2 variants (goblinBrute → goblin, skeletonVeteran → skeleton); symbol is drawn by EntityEffectsRenderer
        const rawType = ai && ai.enemyType ? ai.enemyType : 'goblin';
        const enemyType = rawType === 'goblinBrute' ? 'goblin' : rawType === 'skeletonVeteran' ? 'skeleton' : rawType;
        const strokeColor = (combat && (combat.isWindingUp || combat.isAttacking)) ? '#ff0000' : (ai && ai.state === 'attack') ? '#ff0000' : '#000000';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2 / camera.zoom;

        if (enemyType === 'goblin') {
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + h * 0.15, r * 0.95, h * 1.0, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(screenX - r * 0.6, screenY - h * 0.6);
            ctx.lineTo(screenX - r * 0.95, screenY - h * 1.15);
            ctx.lineTo(screenX - r * 0.35, screenY - h * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + r * 0.6, screenY - h * 0.6);
            ctx.lineTo(screenX + r * 0.95, screenY - h * 1.15);
            ctx.lineTo(screenX + r * 0.35, screenY - h * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const eyeSize = 2.5 / camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff3300' : '#1a1a0a';
            ctx.beginPath();
            ctx.arc(screenX - r * 0.35, screenY - h * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.arc(screenX + r * 0.35, screenY - h * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            // Goblin shiv: same miniature slash arc as player dagger (DaggerWeapon/renderer logic)
            if (combat && combat.isAttacking && !combat.isWindingUp && typeof PlayerCombatRenderer !== 'undefined') {
                PlayerCombatRenderer.drawAttackArc(context.ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, context.camera, {
                    sweepProgress: combat.enemySlashSweepProgress,
                    pullBack: 0,
                    comboColors: false
                });
            }
            this.drawWeapon(context, 'goblin', screenX, screenY, movement ? movement.facingAngle : 0, r, h, combat);
        } else if (enemyType === 'bandit') {
            // Knight-like: same silhouette as player (torso, steel pauldrons, helmet with visor), tarnished steel to read as enemy
            const lw = Math.max(1, 2 / camera.zoom);
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + h * 0.08, r * 0.92, h * 0.88, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(movement ? movement.facingAngle : 0);
            const helmetRx = r * 0.42;
            const helmetRy = h * 0.38;
            const paulOffsetY = helmetRy * 0.72;
            const paulRx = r * 0.22;
            const paulRy = h * 0.28;
            const steel = combat && combat.isAttacking ? '#7a6b6b' : '#6a6a78';
            const steelDark = '#4a4a58';
            const steelDarker = '#3a3a48';
            ctx.fillStyle = steel;
            ctx.strokeStyle = steelDarker;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(0, paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.ellipse(0, -paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = steelDark;
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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = lw * 0.5;
            ctx.beginPath();
            ctx.moveTo(-helmetRx * 0.5, 0);
            ctx.lineTo(helmetRx * 0.5, 0);
            ctx.stroke();
            ctx.restore();
            // Bandit mace: same path as player (arc and mace from PlayerCombatRenderer)
            if (typeof PlayerCombatRenderer !== 'undefined' && combat && combat.weapon && combat.weapon.name && String(combat.weapon.name).toLowerCase().includes('mace')) {
                if (showEnemyHitboxIndicators && combat.isAttacking && movement) {
                    PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement, camera, { comboColors: false });
                }
                PlayerCombatRenderer.drawMace(ctx, screenX, screenY, transform, movement, combat, camera);
            }
        } else if (enemyType === 'banditDagger') {
            // Knight-like: same silhouette as player (torso, steel pauldrons, helmet with visor), tarnished steel to read as enemy
            const lw = Math.max(1, 2 / camera.zoom);
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + h * 0.08, r * 0.92, h * 0.88, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(movement ? movement.facingAngle : 0);
            const helmetRx = r * 0.42;
            const helmetRy = h * 0.38;
            const paulOffsetY = helmetRy * 0.72;
            const paulRx = r * 0.22;
            const paulRy = h * 0.28;
            const steel = combat && combat.isAttacking ? '#7a6b6b' : '#6a6a78';
            const steelDark = '#4a4a58';
            const steelDarker = '#3a3a48';
            ctx.fillStyle = steel;
            ctx.strokeStyle = steelDarker;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(0, paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.ellipse(0, -paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = steelDark;
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
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = lw * 0.5;
            ctx.beginPath();
            ctx.moveTo(-helmetRx * 0.5, 0);
            ctx.lineTo(helmetRx * 0.5, 0);
            ctx.stroke();
            ctx.restore();
            // Dagger swipe arc and weapon: use handler sweep each frame so attack redraws
            const handler = combat && combat.enemyAttackHandler;
            const slashSweep = (handler && typeof handler.getSlashSweepProgress === 'function') ? handler.getSlashSweepProgress() : (combat.enemySlashSweepProgress || 0);
            if (typeof PlayerCombatRenderer !== 'undefined' && combat) {
                if (combat.isWindingUp) {
                    PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, camera, { telegraph: true, sweepProgress: 0, pullBack: 0, comboColors: false });
                }
                if (combat.isAttacking && !combat.isWindingUp) {
                    PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, camera, {
                        sweepProgress: slashSweep,
                        pullBack: 0,
                        comboColors: false
                    });
                }
            }
            this.drawWeapon(context, 'banditDagger', screenX, screenY, movement ? movement.facingAngle : 0, r, h, combat);
        } else if (enemyType === 'goblinChieftain') {
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY + h * 0.12, r * 1.0, h * 1.05, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(screenX - r * 0.55, screenY - h * 0.55);
            ctx.lineTo(screenX - r * 0.9, screenY - h * 1.05);
            ctx.lineTo(screenX - r * 0.3, screenY - h * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + r * 0.55, screenY - h * 0.55);
            ctx.lineTo(screenX + r * 0.9, screenY - h * 1.05);
            ctx.lineTo(screenX + r * 0.3, screenY - h * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#8b7355';
            ctx.strokeStyle = '#5c4a38';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(screenX - r * 0.5, screenY - h * 0.95);
            ctx.lineTo(screenX - r * 0.2, screenY - h * 1.25);
            ctx.lineTo(screenX, screenY - h * 1.15);
            ctx.lineTo(screenX + r * 0.2, screenY - h * 1.25);
            ctx.lineTo(screenX + r * 0.5, screenY - h * 0.95);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const eyeSize = 2.8 / camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff3300' : '#1a1a0a';
            ctx.beginPath();
            ctx.arc(screenX - r * 0.32, screenY - h * 0.18, eyeSize, 0, Math.PI * 2);
            ctx.arc(screenX + r * 0.32, screenY - h * 0.18, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            this.drawWeapon(context, 'goblinChieftain', screenX, screenY, movement ? movement.facingAngle : 0, r, h, combat);
        } else if (enemyType === 'lesserDemon') {
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, r * 0.85, h * 0.9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#3a1a1a';
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(screenX - r * 0.6, screenY - h * 0.6);
            ctx.lineTo(screenX - r * 0.95, screenY - h * 1.15);
            ctx.lineTo(screenX - r * 0.35, screenY - h * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + r * 0.6, screenY - h * 0.6);
            ctx.lineTo(screenX + r * 0.95, screenY - h * 1.15);
            ctx.lineTo(screenX + r * 0.35, screenY - h * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const eyeSize = 2.5 / camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff4400' : '#2a0a0a';
            ctx.beginPath();
            ctx.arc(screenX - r * 0.35, screenY - h * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.arc(screenX + r * 0.35, screenY - h * 0.2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        } else if (enemyType === 'skeleton') {
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, r * 0.9, h * 0.95, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2a2520';
            ctx.beginPath();
            ctx.ellipse(screenX - r * 0.28, screenY - h * 0.15, r * 0.2, h * 0.25, 0, 0, Math.PI * 2);
            ctx.ellipse(screenX + r * 0.28, screenY - h * 0.15, r * 0.2, h * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1a1510';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.stroke();
            ctx.lineWidth = 2 / camera.zoom;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(screenX - r * 0.25, screenY + h * 0.4);
            ctx.lineTo(screenX, screenY + h * 0.75);
            ctx.lineTo(screenX + r * 0.25, screenY + h * 0.4);
            ctx.stroke();
        } else if (enemyType === 'greaterDemon') {
            const dr = r * 1.0;
            const dh = h * 1.05;
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.ellipse(screenX, screenY, dr * 1.15, dh * 1.0, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2a0a12';
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(screenX - dr * 0.4, screenY - dh * 0.5);
            ctx.quadraticCurveTo(screenX - dr * 0.9, screenY - dh * 1.2, screenX - dr * 0.55, screenY - dh * 0.35);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + dr * 0.4, screenY - dh * 0.5);
            ctx.quadraticCurveTo(screenX + dr * 0.9, screenY - dh * 1.2, screenX + dr * 0.55, screenY - dh * 0.35);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#1a0508';
            ctx.beginPath();
            ctx.moveTo(screenX, screenY + dh * 0.6);
            ctx.lineTo(screenX + 4 / camera.zoom, screenY + dh * 1.15);
            ctx.lineTo(screenX - 4 / camera.zoom, screenY + dh * 1.15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            const eyeSize = 4 / camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff2222' : '#ff5533';
            ctx.shadowColor = ai && ai.state === 'chase' ? '#ff4444' : 'rgba(255, 80, 50, 0.8)';
            ctx.shadowBlur = 6 / camera.zoom;
            ctx.beginPath();
            ctx.arc(screenX - dr * 0.3, screenY - dh * 0.12, eyeSize, 0, Math.PI * 2);
            ctx.arc(screenX + dr * 0.3, screenY - dh * 0.12, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (enemyType === 'fireDragon') {
            // Dragon: body, head, prominent bat-like wings (fingers + membrane), tail, horns, fangs; local space (head +x)
            const face = movement ? movement.facingAngle : 0;
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(face);
            const lw = Math.max(2, 4 / camera.zoom);
            const bodyLen = r * 1.5;
            const bodyW = h * 0.82;
            const wingSpan = bodyW * 2.2;
            const wingDepth = bodyLen * 1.05;
            // Draw wings first (behind body) – large bat-like wings with visible fingers
            const wingShoulderX = bodyLen * 0.08;
            const wingRootY = bodyW * 0.75;
            const wingMembrane = 'rgba(160, 50, 28, 0.88)';
            const wingBone = '#4a2818';
            ctx.strokeStyle = wingBone;
            ctx.lineWidth = lw * 1.1;
            // Left wing: membrane then bones
            ctx.fillStyle = wingMembrane;
            ctx.beginPath();
            ctx.moveTo(wingShoulderX, -wingRootY);
            ctx.lineTo(wingShoulderX - wingDepth * 0.5, -wingSpan);
            ctx.lineTo(wingShoulderX + wingDepth * 0.55, -wingSpan * 0.5);
            ctx.lineTo(wingShoulderX + wingDepth * 0.35, -wingRootY * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(wingShoulderX, -wingRootY);
            ctx.lineTo(wingShoulderX - wingDepth * 0.25, -wingSpan * 0.85);
            ctx.moveTo(wingShoulderX, -wingRootY);
            ctx.lineTo(wingShoulderX + wingDepth * 0.2, -wingSpan * 0.7);
            ctx.moveTo(wingShoulderX, -wingRootY);
            ctx.lineTo(wingShoulderX + wingDepth * 0.5, -wingSpan * 0.45);
            ctx.stroke();
            // Right wing
            ctx.fillStyle = wingMembrane;
            ctx.beginPath();
            ctx.moveTo(wingShoulderX, wingRootY);
            ctx.lineTo(wingShoulderX - wingDepth * 0.5, wingSpan);
            ctx.lineTo(wingShoulderX + wingDepth * 0.55, wingSpan * 0.5);
            ctx.lineTo(wingShoulderX + wingDepth * 0.35, wingRootY * 0.6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(wingShoulderX, wingRootY);
            ctx.lineTo(wingShoulderX - wingDepth * 0.25, wingSpan * 0.85);
            ctx.moveTo(wingShoulderX, wingRootY);
            ctx.lineTo(wingShoulderX + wingDepth * 0.2, wingSpan * 0.7);
            ctx.moveTo(wingShoulderX, wingRootY);
            ctx.lineTo(wingShoulderX + wingDepth * 0.5, wingSpan * 0.45);
            ctx.stroke();
            // Underbelly (darker band)
            ctx.fillStyle = '#5c2218';
            ctx.strokeStyle = '#3d1810';
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyLen, bodyW, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Main body
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, bodyLen * 0.9, bodyW * 0.88, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Tail (thick, tapering)
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(-bodyLen * 0.72, 0);
            ctx.quadraticCurveTo(-bodyLen * 1.4, -bodyW * 0.55, -bodyLen * 1.22, 0);
            ctx.quadraticCurveTo(-bodyLen * 1.4, bodyW * 0.55, -bodyLen * 0.72, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Head
            ctx.fillStyle = bodyColor;
            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.ellipse(bodyLen * 0.7, 0, r * 0.5, h * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Snout
            ctx.beginPath();
            ctx.ellipse(bodyLen * 1.02, 0, r * 0.26, h * 0.26, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Horns (swept back)
            ctx.strokeStyle = '#9a6b4a';
            ctx.lineWidth = lw * 1.15;
            ctx.beginPath();
            ctx.moveTo(bodyLen * 0.48, -h * 0.38);
            ctx.lineTo(bodyLen * 0.92, -h * 0.62);
            ctx.moveTo(bodyLen * 0.48, h * 0.38);
            ctx.lineTo(bodyLen * 0.92, h * 0.62);
            ctx.stroke();
            // Fangs
            ctx.strokeStyle = '#e8e0d8';
            ctx.lineWidth = lw * 0.7;
            ctx.beginPath();
            ctx.moveTo(bodyLen * 0.92, -h * 0.12);
            ctx.lineTo(bodyLen * 1.06, h * 0.08);
            ctx.moveTo(bodyLen * 0.92, h * 0.12);
            ctx.lineTo(bodyLen * 1.06, -h * 0.08);
            ctx.stroke();
            // Eyes
            const eyeSize = 5.5 / camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff2200' : '#ff5522';
            ctx.shadowColor = 'rgba(255, 60, 0, 0.95)';
            ctx.shadowBlur = 5 / camera.zoom;
            ctx.beginPath();
            ctx.arc(bodyLen * 0.55, -h * 0.16, eyeSize, 0, Math.PI * 2);
            ctx.arc(bodyLen * 0.55, h * 0.16, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            // Forelimb claws (simple strokes under body)
            ctx.strokeStyle = '#9a6b4a';
            ctx.lineWidth = lw * 0.9;
            ctx.beginPath();
            ctx.moveTo(bodyLen * 0.25, -bodyW * 0.7);
            ctx.lineTo(bodyLen * 0.42, -bodyW * 0.88);
            ctx.moveTo(bodyLen * 0.25, bodyW * 0.7);
            ctx.lineTo(bodyLen * 0.42, bodyW * 0.88);
            ctx.stroke();
            ctx.restore();
            this.drawWeapon(context, 'fireDragon', screenX, screenY, movement ? movement.facingAngle : 0, r, h, combat);
        } else {
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const eyeSize = 2 / camera.zoom;
            const eyeOffset = 5 * camera.zoom;
            ctx.fillStyle = ai && ai.state === 'chase' ? '#ff0000' : '#ffffff';
            ctx.beginPath();
            ctx.arc(screenX - eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
            ctx.arc(screenX + eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        if (typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.renderBarsAndEffects(context, entity, screenX, screenY, { isPlayer: false });
        }
    }
};
