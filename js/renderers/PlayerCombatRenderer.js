// Player combat visuals (attack arc, sword, shield). Procedural drawing only.
// SWEEP_SPEED: 1 = sword/arc fill the full attack duration (committal feel).

const PlayerCombatRenderer = {
    SWEEP_SPEED: 1,

    getSweepProgress(combat) {
        const duration = combat.attackDuration > 0 ? combat.attackDuration : 0.001;
        const progress = Math.min(1, Math.max(0, (combat.attackTimer || 0) / duration));
        return Math.min(1, progress * this.SWEEP_SPEED);
    },

    drawAttackArc(ctx, screenX, screenY, combat, movement, camera, options) {
        if (!combat || !combat.isAttacking) return;
        const range = combat.attackRange * camera.zoom;
        const sweepProgress = this.getSweepProgress(combat);
        const useComboColors = options && options.comboColors;
        let attackColor = 'rgba(255, 100, 100, 0.8)';
        let fillAlpha = '0.2';
        if (useComboColors) {
            const animKey = combat.currentAttackAnimationKey || 'melee';
            if (animKey === 'meleeSpin') {
                attackColor = 'rgba(255, 255, 100, 0.9)';
                fillAlpha = '0.3';
            } else if (animKey === 'melee2') {
                attackColor = 'rgba(255, 200, 100, 0.8)';
            }
        }
        const facingAngle = movement ? movement.facingAngle : 0;
        if (combat.currentAttackIsCircular) {
            const currentRadius = range * sweepProgress;
            ctx.strokeStyle = attackColor;
            ctx.lineWidth = useComboColors ? 4 / camera.zoom : 3 / camera.zoom;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = attackColor.replace('0.9', fillAlpha);
            ctx.fill();
        } else {
            const halfArc = combat.attackArc / 2;
            const baseAngle = facingAngle - halfArc;
            const sweepEndAngle = baseAngle + sweepProgress * combat.attackArc;
            ctx.strokeStyle = attackColor;
            ctx.lineWidth = useComboColors ? 4 / camera.zoom : 3 / camera.zoom;
            ctx.beginPath();
            ctx.arc(screenX, screenY, range, baseAngle, sweepEndAngle);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = attackColor.replace('0.8', fillAlpha);
            ctx.fill();
        }
    },

    drawSword(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        const swordLength = (combat.attackRange || 100) * 0.32 * camera.zoom;
        const bladeWidth = Math.max(2, 4 / camera.zoom);
        const sideOffset = (transform.width / 2 + 4) * camera.zoom;
        const gripX = screenX + Math.cos(movement.facingAngle + Math.PI / 2) * sideOffset;
        const gripY = screenY + Math.sin(movement.facingAngle + Math.PI / 2) * sideOffset;
        let swordAngle = movement.facingAngle;
        if (combat.isAttacking && combat.attackDuration > 0) {
            const sweepProgress = this.getSweepProgress(combat);
            if (combat.currentAttackIsCircular) {
                swordAngle = movement.facingAngle + sweepProgress * Math.PI * 2;
            } else {
                const halfArc = (combat.attackArc || Math.PI / 3) / 2;
                swordAngle = movement.facingAngle - halfArc + sweepProgress * (combat.attackArc || Math.PI / 3);
            }
        }
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(swordAngle);
        const hiltHalfLen = 14 / camera.zoom;
        const hiltThickness = 6 / camera.zoom;
        ctx.lineWidth = 1 / camera.zoom;
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5d2e0c';
        ctx.fillRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
        ctx.strokeRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
        ctx.fillStyle = '#c0c0c0';
        ctx.strokeStyle = '#606060';
        ctx.fillRect(0, -bladeWidth / 2, swordLength, bladeWidth);
        ctx.strokeRect(0, -bladeWidth / 2, swordLength, bladeWidth);
        ctx.restore();
    },

    drawShield(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        const shieldDist = (transform.width / 2 + 8) * camera.zoom;
        const shieldW = 22 * camera.zoom;
        const shieldH = 8 * camera.zoom;
        if (combat.isBlocking) {
            const shieldX = screenX + Math.cos(movement.facingAngle) * shieldDist;
            const shieldY = screenY + Math.sin(movement.facingAngle) * shieldDist;
            ctx.save();
            ctx.translate(shieldX, shieldY);
            ctx.rotate(movement.facingAngle + Math.PI / 2);
            ctx.fillStyle = '#8b6914';
            ctx.strokeStyle = '#5d4a0c';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.fillRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.strokeRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.restore();
        } else {
            const leftAngle = movement.facingAngle - Math.PI / 2;
            const leftX = screenX + Math.cos(leftAngle) * (transform.width / 2 + 2) * camera.zoom;
            const leftY = screenY + Math.sin(leftAngle) * (transform.height / 2 + 2) * camera.zoom;
            ctx.save();
            ctx.translate(leftX, leftY);
            ctx.rotate(leftAngle + Math.PI / 2);
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#8b6914';
            ctx.strokeStyle = '#5d4a0c';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.fillRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.strokeRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }
};
