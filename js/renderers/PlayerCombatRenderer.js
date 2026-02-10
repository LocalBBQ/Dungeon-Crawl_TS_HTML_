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
        const lw = 3 / camera.zoom;
        const lwCombo = 4 / camera.zoom;
        // Medieval palette: steel edge, shadow/vellum fill; combo = bronze/gold
        let edgeColor = '#5a5a62';
        let edgeHighlight = 'rgba(180, 175, 165, 0.9)';
        let fillStyle = 'rgba(40, 35, 30, 0.22)';
        if (useComboColors) {
            const animKey = combat.currentAttackAnimationKey || 'melee';
            if (animKey === 'meleeSpin') {
                edgeColor = '#8b7340';
                edgeHighlight = 'rgba(220, 200, 120, 0.85)';
                fillStyle = 'rgba(80, 60, 30, 0.28)';
            } else if (animKey === 'melee2') {
                edgeColor = '#6b5b4a';
                edgeHighlight = 'rgba(200, 160, 100, 0.85)';
                fillStyle = 'rgba(60, 45, 30, 0.24)';
            }
        }
        const facingAngle = movement ? movement.facingAngle : 0;
        if (combat.currentAttackIsCircular) {
            const currentRadius = range * sweepProgress;
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.45);
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRadius - 2 / camera.zoom, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            const halfArc = combat.attackArc / 2;
            const baseAngle = facingAngle - halfArc;
            const sweepEndAngle = baseAngle + sweepProgress * combat.attackArc;
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.arc(screenX, screenY, range, baseAngle, sweepEndAngle);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            // Inner blade-edge highlight along the sweeping arc
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.5);
            ctx.beginPath();
            ctx.arc(screenX, screenY, range - 3 / camera.zoom, baseAngle, sweepEndAngle);
            ctx.stroke();
        }
    },

    drawSword(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        const twoHanded = combat.weapon && combat.weapon.twoHanded;
        const lengthMult = twoHanded ? 1.55 : 1;
        const widthMult = twoHanded ? 1.4 : 1;
        const swordLength = (combat.attackRange || 100) * 0.48 * camera.zoom * lengthMult;
        const bladeWidthAtGuard = Math.max(3.5, 7 / camera.zoom) * widthMult;
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
        const lw = Math.max(1, 1 / camera.zoom);
        ctx.lineWidth = lw;
        const gripScale = twoHanded ? 1.35 : 1;

        // Pommel (back of grip) – dark metal
        const pommelX = (-14 / camera.zoom - 2 / camera.zoom) * gripScale;
        const pommelR = (3 / camera.zoom) * (twoHanded ? 1.2 : 1);
        ctx.fillStyle = '#4a4a52';
        ctx.strokeStyle = '#3a3a42';
        ctx.beginPath();
        ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Grip (leather wrap)
        const hiltHalfLen = (14 / camera.zoom) * gripScale;
        const hiltThickness = (6 / camera.zoom) * (twoHanded ? 1.15 : 1);
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5d2e0c';
        ctx.fillRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
        ctx.strokeRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);

        // Cross-guard (quillon) at base of blade
        const guardHalfW = (6 / camera.zoom) * (twoHanded ? 1.4 : 1);
        const guardThick = (2 / camera.zoom) * (twoHanded ? 1.3 : 1);
        ctx.fillStyle = '#6b6b75';
        ctx.strokeStyle = '#4a4a52';
        ctx.fillRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
        ctx.strokeRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);

        // Blade – tapered to a point (long rhombus), medieval steel
        const hw = bladeWidthAtGuard / 2;
        ctx.fillStyle = '#a8a8b0';
        ctx.strokeStyle = '#3d3d42';
        ctx.beginPath();
        ctx.moveTo(0, -hw);
        ctx.lineTo(0, hw);
        ctx.lineTo(swordLength, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Fuller (center line) for a bit of depth
        ctx.strokeStyle = 'rgba(120, 118, 110, 0.55)';
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.moveTo(hw * 0.5, 0);
        ctx.lineTo(swordLength - hw, 0);
        ctx.stroke();

        ctx.restore();
    },

    drawShield(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        if (combat.weapon && combat.weapon.twoHanded) return;
        const shieldDist = (transform.width / 2 + 8) * camera.zoom;
        const shieldW = 40 * camera.zoom;
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
