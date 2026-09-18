// Turns combat state into ground decals.
//
// Attack cones, wind-up telegraphs, lunge rings and slam zones are gameplay information, not
// decoration, so they are reproduced here with the same geometry, colours and timing as the 2D
// renderers. The sweep and wind-up curves are imported from the 2D renderers directly rather than
// re-derived, so the 3D decals stay in lockstep with the hitboxes they represent.
import { Transform } from '../../game/components/Transform.js';
import { Movement } from '../../game/components/Movement.js';
import { Combat } from '../../game/components/Combat.js';
import { Renderable } from '../../game/components/Renderable.js';
import { AI } from '../../game/components/AI.js';
import { Health } from '../../game/components/Health.js';
import { GameConfig } from '../../game/config/GameConfig.js';
import { Utils } from '../../game/utils/Utils.js';
import { PlayerCombatRenderer } from '../../game/systems/renderers/PlayerCombatRenderer.js';
import { EnemyCombatRenderer } from '../../game/systems/renderers/EnemyCombatRenderer.js';
import type { DecalRenderer3D } from './DecalRenderer3D.js';
import type { EntityLike } from '../characters/CharacterRenderer3D.js';

const FULL_CIRCLE = Math.PI * 2;

interface CombatLike {
    isAttacking: boolean;
    isWindingUp: boolean;
    isLunging: boolean;
    attackRange: number;
    attackArc: number;
    attackArcOffset: number;
    windUpProgress: number;
    enemySlashSweepProgress: number;
    currentAttackIsCircular: boolean;
    currentAttackIsThrust: boolean;
    currentAttackAoeInFront: boolean;
    currentAttackAoeOffset: number;
    currentAttackAoeRadius: number;
    currentAttackThrustWidth: number;
    currentAttackReverseSweep: boolean;
    currentAttackAnimationKey: string | null;
    currentAttackIsDashAttack: boolean;
    enemyAttackHandler?: { getSlashSweepProgress?(): number; hasChargeRelease?(): boolean } | null;
}

/** Combo-tinted arc fills, matching PlayerCombatRenderer.drawAttackArc. */
function playerArcFill(combat: CombatLike): string {
    if (combat.currentAttackIsDashAttack) return 'rgba(100, 70, 20, 0.35)';
    switch (combat.currentAttackAnimationKey) {
        case 'meleeSpin':
            return 'rgba(80, 60, 30, 0.28)';
        case 'melee2':
            return 'rgba(60, 45, 30, 0.24)';
        case 'meleeChop':
            return 'rgba(50, 35, 20, 0.28)';
        default:
            return 'rgba(40, 35, 30, 0.22)';
    }
}

/**
 * Emit every ground decal the current frame calls for.
 *
 * `settings` gates the player and enemy hitbox indicators exactly as the 2D renderers do, so turning
 * the indicators off in the settings screen removes them here too.
 */
export function emitCombatTelegraphs(
    decals: DecalRenderer3D,
    entities: EntityLike[] | null | undefined,
    settings: Record<string, unknown>,
    playerPosition: { x: number; y: number } | null
): void {
    if (!entities) return;
    const showPlayer = settings.showPlayerHitboxIndicators !== false;
    const showEnemy = settings.showEnemyHitboxIndicators !== false;

    for (const entity of entities) {
        if (!entity.active) continue;
        const renderable = entity.getComponent(Renderable);
        const transform = entity.getComponent(Transform);
        if (!renderable || !transform) continue;
        const health = entity.getComponent(Health);
        if (health?.isDead) continue;

        const isPlayer = renderable.type === 'player';
        if (isPlayer && !showPlayer) continue;
        if (!isPlayer && renderable.type !== 'enemy') continue;
        if (!isPlayer && !showEnemy) continue;

        const combat = entity.getComponent(Combat) as unknown as CombatLike | null;
        const movement = entity.getComponent(Movement);
        const ai = entity.getComponent(AI);
        const facing = movement ? movement.facingAngle : 0;

        if (ai?.isCastingPillar && playerPosition) {
            emitPillarTelegraph(decals, ai, playerPosition);
        }

        if (ai?.isChargingLunge) {
            emitLungeRing(decals, ai, transform);
        }

        if (!combat) continue;

        if (isPlayer) {
            emitPlayerArc(decals, combat, transform, facing);
            continue;
        }

        emitEnemyArc(decals, combat, transform, facing);
    }
}

function emitPillarTelegraph(decals: DecalRenderer3D, ai: AI, playerPosition: { x: number; y: number }): void {
    const config = (GameConfig.enemy?.types?.greaterDemon as { pillarFlame?: { radius?: number; castDelay?: number } } | undefined)
        ?.pillarFlame;
    const radius = config?.radius ?? 45;
    const progress = config?.castDelay ? 1 - ai.pillarCastTimer / config.castDelay : 0;
    decals.draw({
        x: playerPosition.x,
        y: playerPosition.y,
        radius,
        centerAngle: 0,
        arc: FULL_CIRCLE,
        fill: 'rgba(200, 80, 30, 0.15)',
    });
    if (progress > 0) {
        // Filling wedge counts down to the cast, as in 2D.
        decals.draw({
            x: playerPosition.x,
            y: playerPosition.y,
            radius,
            centerAngle: -Math.PI / 2 + (progress * FULL_CIRCLE) / 2,
            arc: progress * FULL_CIRCLE,
            fill: 'rgba(255, 100, 40, 0.25)',
        });
    }
}

function emitLungeRing(decals: DecalRenderer3D, ai: AI, transform: Transform): void {
    const config = (ai.enemyType ? GameConfig.enemy?.types?.[ai.enemyType] : null) as
        | { lunge?: { chargeTime: number } }
        | undefined;
    const lunge = config?.lunge;
    if (!lunge) return;
    const progress = 1 - Math.max(0, ai.lungeChargeTimer) / lunge.chargeTime;
    const radius = (transform.width / 2 + 10) * (1 + progress * 0.5);
    const alpha = 0.8 - progress * 0.4;
    decals.draw({
        x: transform.x,
        y: transform.y,
        radius,
        centerAngle: 0,
        arc: FULL_CIRCLE,
        fill: `rgba(120, 40, 35, ${alpha.toFixed(3)})`,
        innerRatio: 0.88,
    });
    decals.draw({
        x: transform.x,
        y: transform.y,
        radius: transform.width / 2 + 5,
        centerAngle: progress * Math.PI,
        arc: Math.max(0.001, progress * FULL_CIRCLE),
        fill: `rgba(160, 80, 40, ${(0.5 + progress * 0.4).toFixed(3)})`,
        innerRatio: 0.82,
    });
}

function emitPlayerArc(decals: DecalRenderer3D, combat: CombatLike, transform: Transform, facing: number): void {
    if (!combat.isAttacking) return;
    const range = combat.attackRange || 80;
    const sweep = PlayerCombatRenderer.getSweepProgress(combat);
    const fill = playerArcFill(combat);

    if (combat.currentAttackAnimationKey === 'blockAttack' || combat.currentAttackIsThrust) {
        // Shove and thrust are rectangles in 2D; a narrow cone of the same reach reads the same here.
        const width = combat.currentAttackThrustWidth || 40;
        const length = Math.max(1, range * sweep);
        decals.draw({
            x: transform.x,
            y: transform.y,
            radius: length,
            centerAngle: facing,
            arc: Math.min(Math.PI, 2 * Math.atan2(width / 2, length)),
            fill,
        });
        return;
    }

    if (combat.currentAttackIsCircular) {
        const radius = range * sweep;
        if (radius <= 0) return;
        decals.draw({ x: transform.x, y: transform.y, radius, centerAngle: 0, arc: FULL_CIRCLE, fill });
        return;
    }

    if (combat.currentAttackAnimationKey === 'meleeChop') {
        const length = Math.max(1, range * sweep);
        const width = combat.currentAttackThrustWidth || 28;
        const angle = facing - (1 - sweep) * (Math.PI / 2);
        decals.draw({
            x: transform.x,
            y: transform.y,
            radius: length,
            centerAngle: angle,
            arc: Math.min(Math.PI, 2 * Math.atan2(width / 2, length)),
            fill,
        });
        return;
    }

    const arc = combat.attackArc > 0 ? combat.attackArc : Utils.degToRad(90);
    const center = facing + (combat.attackArcOffset ?? 0);
    const half = arc / 2;
    const pullBack = PlayerCombatRenderer.getAnticipationPullBack(combat);
    let start: number;
    let end: number;
    if (combat.currentAttackReverseSweep) {
        start = center + half - sweep * arc;
        end = center + half - pullBack;
    } else {
        start = center - half + pullBack;
        end = center - half + sweep * arc;
    }
    const span = end - start;
    if (span <= 0) return;
    decals.draw({
        x: transform.x,
        y: transform.y,
        radius: range,
        centerAngle: start + span / 2,
        arc: span,
        fill,
    });
}

function emitEnemyArc(decals: DecalRenderer3D, combat: CombatLike, transform: Transform, facing: number): void {
    const hasChargeRelease = combat.enemyAttackHandler?.hasChargeRelease?.() ?? false;
    const hasSlashSweep = typeof combat.enemyAttackHandler?.getSlashSweepProgress === 'function';

    // Charge-release attacks (chieftain club, ogre smash) show their full zone as they charge.
    if (hasChargeRelease && combat.isAttacking) {
        const aoeInFront = combat.currentAttackAoeInFront && combat.currentAttackAoeRadius > 0;
        const charge = combat.windUpProgress ?? 0;
        const x = aoeInFront ? transform.x + Math.cos(facing) * (combat.currentAttackAoeOffset || 0) : transform.x;
        const y = aoeInFront ? transform.y + Math.sin(facing) * (combat.currentAttackAoeOffset || 0) : transform.y;
        const radius = aoeInFront ? combat.currentAttackAoeRadius : combat.attackRange || 70;
        const circular = combat.currentAttackIsCircular || aoeInFront;
        const arc = circular ? FULL_CIRCLE : combat.attackArc || Utils.degToRad(90);
        decals.draw({
            x,
            y,
            radius,
            centerAngle: circular ? 0 : facing + (combat.attackArcOffset ?? 0),
            arc,
            fill: `rgba(30, 45, 25, ${(0.15 + charge * 0.2).toFixed(3)})`,
        });
        return;
    }

    if (combat.isWindingUp && !hasSlashSweep) {
        const progress = EnemyCombatRenderer.getWindUpVisualProgress(
            combat as Parameters<typeof EnemyCombatRenderer.getWindUpVisualProgress>[0]
        );
        const dangerPhase = EnemyCombatRenderer.getWindUpDangerPhase(
            combat as Parameters<typeof EnemyCombatRenderer.getWindUpDangerPhase>[0]
        );
        const aoeInFront = combat.currentAttackAoeInFront && combat.currentAttackAoeRadius > 0;
        const x = aoeInFront ? transform.x + Math.cos(facing) * (combat.currentAttackAoeOffset || 0) : transform.x;
        const y = aoeInFront ? transform.y + Math.sin(facing) * (combat.currentAttackAoeOffset || 0) : transform.y;
        const radius = aoeInFront ? combat.currentAttackAoeRadius : combat.attackRange;
        const circular = combat.currentAttackIsCircular || aoeInFront;
        const arc = circular ? FULL_CIRCLE : combat.attackArc || Utils.degToRad(90);
        decals.draw({
            x,
            y,
            radius,
            centerAngle: circular ? 0 : facing + (combat.attackArcOffset ?? 0),
            arc,
            fill: `rgba(35, 30, 28, ${(progress * 0.28).toFixed(3)})`,
        });
        if (dangerPhase > 0) {
            decals.draw({
                x,
                y,
                radius,
                centerAngle: circular ? 0 : facing + (combat.attackArcOffset ?? 0),
                arc,
                fill: `rgba(220, 60, 40, ${(dangerPhase * 0.35).toFixed(3)})`,
                innerRatio: 0.9,
            });
        }
        return;
    }

    if (combat.isAttacking && !combat.isWindingUp) {
        const arc = combat.attackArc || Utils.degToRad(90);
        const center = facing + (combat.attackArcOffset ?? 0);
        const half = arc / 2;
        const sweep = hasSlashSweep ? combat.enemySlashSweepProgress : 1;
        let start = center - half;
        let end = center + half;
        if (hasSlashSweep) {
            if (combat.currentAttackReverseSweep) start = center + half - sweep * arc;
            else end = center - half + sweep * arc;
        }
        const span = end - start;
        if (span <= 0) return;
        // The cone grows with the swing, matching the 2D "windshield wiper" behaviour.
        const radius = (combat.attackRange || 70) * Math.max(0.02, sweep);
        decals.draw({
            x: transform.x,
            y: transform.y,
            radius,
            centerAngle: start + span / 2,
            arc: span,
            fill: 'rgba(50, 40, 35, 0.32)',
        });
    }
}
