// Sprite-sheet entity rendering: frame selection, draw frame, then effects (shadow, weapon overlay, bars).
// Fallback when sprite not loaded: delegates to PlayerEntityRenderer or EnemyEntityRenderer.
class EntitySpriteRenderer {
    constructor() {
        this._debugLogged = false;
    }

    render(context, entity, screenX, screenY) {
        const { ctx, canvas, camera, systems, settings } = context;
        const spriteManager = systems ? systems.get('sprites') : null;
        const transform = entity.getComponent(Transform);
        const sprite = entity.getComponent(Sprite);
        const animation = entity.getComponent(Animation);
        const movement = entity.getComponent(Movement);
        if (!sprite || !transform) return;

        const combat = entity.getComponent(Combat);
        const renderable = entity.getComponent(Renderable);
        let spriteSheet = sprite.getSpriteSheet(spriteManager, animation);
        const useSpinSheetForPlayer = !!(renderable && renderable.type === 'player' && combat && combat.isAttacking && combat.currentAttackAnimationKey === 'meleeSpin' && animation && animation.animations && animation.animations.meleeSpin);
        if (useSpinSheetForPlayer && spriteManager) {
            const spinSheet = spriteManager.getSpriteSheet(animation.animations.meleeSpin.spriteSheetKey);
            if (spinSheet && spinSheet.image) spriteSheet = spinSheet;
        }

        if (!spriteSheet || !spriteSheet.image) {
            if (renderable) {
                if (renderable.type === 'player' && typeof PlayerEntityRenderer !== 'undefined') PlayerEntityRenderer.render(context, entity, screenX, screenY);
                else if (renderable.type === 'enemy' && typeof EnemyEntityRenderer !== 'undefined') EnemyEntityRenderer.render(context, entity, screenX, screenY);
            }
            return;
        }

        let row = 0, col = 0;
        if (useSpinSheetForPlayer && combat && (combat.playerAttack || combat.attackHandler) && combat.attackDuration > 0) {
            const progress = Math.min(1, (combat.playerAttack ? combat.playerAttack.attackTimer : combat.attackHandler.attackTimer) / combat.attackDuration);
            const spinFrames = animation.animations.meleeSpin.frames;
            const numFrames = spinFrames ? spinFrames.length : 1;
            const frameIndex = Math.min(Math.floor(progress * numFrames), numFrames - 1);
            if (spriteSheet.rows > 1) {
                row = Math.floor(frameIndex / spriteSheet.cols);
                col = frameIndex % spriteSheet.cols;
            } else {
                col = frameIndex;
            }
        } else if (animation && animation.currentAnimation) {
            const anim = animation.animations[animation.currentAnimation];
            if (anim && anim.frames) {
                const frameIndex = animation.getCurrentFrameIndex();
                if (anim.useDirection && movement) {
                    const direction = SpriteUtils.angleTo8Direction(movement.facingAngle);
                    const directionToFrame = [2, 1, 0, 7, 6, 5, 4, 3];
                    const frameDir = directionToFrame[direction];
                    if (anim.useDirectionAsColumn) {
                        row = 0;
                        col = frameDir;
                    } else {
                        row = frameDir;
                        col = frameIndex;
                    }
                } else if (spriteSheet.rows > 1) {
                    row = Math.floor(frameIndex / spriteSheet.cols);
                    col = frameIndex % spriteSheet.cols;
                } else {
                    col = frameIndex;
                }
                if (entity.id === 'player' && frameIndex === 0) {
                    console.log(`Animation: ${animation.currentAnimation}, frameIndex: ${frameIndex}, col: ${col}, frames array:`, anim.frames);
                }
            }
        } else if (movement) {
            row = SpriteUtils.angleToDirection(movement.facingAngle);
            const isMoving = movement.velocityX !== 0 || movement.velocityY !== 0;
            col = isMoving ? Math.floor((performance.now() / 1000) / 0.2) % 4 : 0;
        }

        if (spriteSheet) {
            row = Math.max(0, Math.min(row, spriteSheet.rows - 1));
            col = Math.max(0, Math.min(col, spriteSheet.cols - 1));
        }

        const frameCoords = SpriteUtils.getFrameCoords(spriteSheet, row, col);
        if (!frameCoords || frameCoords.sourceWidth <= 0 || frameCoords.sourceHeight <= 0) {
            if (!frameCoords) console.warn('No frame coordinates found for sprite sheet');
            return;
        }

        if (renderable && renderable.type === 'enemy' && typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.drawPackModifierGlow(context, entity, screenX, screenY);
        }

        if (entity.id === 'player' && col === 0 && row === 0 && !this._debugLogged) {
            this._debugLogged = true;
            console.log('=== Sprite Frame Extraction Debug ===', 'Entity:', entity.id, 'Row:', row, 'Col:', col, 'Frame Coords:', frameCoords, '=====================================');
        }

        const drawX = screenX + sprite.offsetX * camera.zoom;
        const drawY = screenY + sprite.offsetY * camera.zoom;
        const frameAspectRatio = frameCoords.sourceWidth / frameCoords.sourceHeight;
        const baseSize = sprite.width * camera.zoom * sprite.scaleX;
        const drawWidth = baseSize;
        const drawHeight = baseSize / frameAspectRatio;

        const appliedMeleeSpin = !!(renderable && renderable.type === 'player' && combat && combat.isAttacking && combat.currentAttackAnimationKey === 'meleeSpin');
        ctx.save();
        try {
            ctx.translate(drawX, drawY);
            if (appliedMeleeSpin) {
                const sweepProgress = PlayerCombatRenderer.getSweepProgress(combat);
                const raw = combat.attackDuration > 0 ? Math.min(1, (combat.attackTimer || 0) / combat.attackDuration) : 0;
                const rotationBlend = raw < 0.08 ? Utils.easeInQuad(raw / 0.08) : 1;
                ctx.rotate(sweepProgress * rotationBlend * Math.PI * 2);
            }
            ctx.scale(sprite.scaleX * (sprite.flipX ? -1 : 1), sprite.scaleY);
            ctx.rotate(sprite.rotation);
            const oldImageSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            if (spriteSheet.cols > 1 && frameCoords.sourceWidth >= spriteSheet.image.width) {
                ctx.restore();
                return;
            }
            const sx = Math.floor(frameCoords.sourceX);
            const sy = Math.floor(frameCoords.sourceY);
            const sWidth = Math.floor(frameCoords.sourceWidth);
            const sHeight = Math.floor(frameCoords.sourceHeight);
            ctx.drawImage(spriteSheet.image, sx, sy, sWidth, sHeight, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            ctx.imageSmoothingEnabled = oldImageSmoothing;
            if (sprite.tint) {
                ctx.globalCompositeOperation = 'multiply';
                ctx.fillStyle = sprite.tint;
                ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
                ctx.globalCompositeOperation = 'source-over';
            }
        } finally {
            ctx.restore();
        }

        if (typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.drawShadow(ctx, screenX, screenY, transform, camera);
            EntityEffectsRenderer.drawHealingVial(context, entity, screenX, screenY);
        }
        if (renderable && renderable.type === 'enemy') {
            const ai = entity.getComponent(AI);
            const needsWeaponOverlay = ai && (ai.enemyType === 'goblin' || ai.enemyType === 'goblinChieftain' || ai.enemyType === 'banditDagger') && typeof EnemyEntityRenderer !== 'undefined';
            if (needsWeaponOverlay) {
                const r = (transform.width / 2) * camera.zoom;
                const h = (transform.height / 2) * camera.zoom;
                // Goblin shiv: same miniature slash arc as player dagger
                if (ai.enemyType === 'goblin' && combat && combat.isAttacking && !combat.isWindingUp && typeof PlayerCombatRenderer !== 'undefined') {
                    PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, camera, {
                        sweepProgress: combat.enemySlashSweepProgress,
                        pullBack: 0,
                        comboColors: false
                    });
                }
                // Bandit dagger: arc and weapon so attack redraws when using sprite path
                if (ai.enemyType === 'banditDagger' && combat && typeof PlayerCombatRenderer !== 'undefined') {
                    if (combat.isWindingUp) {
                        PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, camera, { telegraph: true, sweepProgress: 0, pullBack: 0, comboColors: false });
                    }
                    if (combat.isAttacking && !combat.isWindingUp) {
                        const slashSweep = (combat.enemyAttackHandler && typeof combat.enemyAttackHandler.getSlashSweepProgress === 'function') ? combat.enemyAttackHandler.getSlashSweepProgress() : combat.enemySlashSweepProgress;
                        PlayerCombatRenderer.drawAttackArc(ctx, screenX, screenY, combat, movement || { facingAngle: 0 }, camera, { sweepProgress: slashSweep, pullBack: 0, comboColors: false });
                    }
                }
                EnemyEntityRenderer.drawWeapon(context, ai.enemyType, screenX, screenY, movement ? movement.facingAngle : 0, r, h, combat);
            }
        }
        if (typeof EntityEffectsRenderer !== 'undefined') {
            EntityEffectsRenderer.renderBarsAndEffects(context, entity, screenX, screenY, { isPlayer: renderable && renderable.type === 'player' });
        }
        if (renderable && renderable.type === 'player' && typeof PlayerEntityRenderer !== 'undefined') {
            PlayerEntityRenderer.drawWeaponAndMetersForSpritePath(context, entity, screenX, screenY);
        }
    }
}

if (typeof window !== 'undefined') {
    window.EntitySpriteRenderer = EntitySpriteRenderer;
}
