// Player combat visuals (attack arc, sword, mace, crossbow, shield). Procedural drawing only.
// Animation (anticipation, easing, follow-through) applies to all melee weapon types:
// sword, greatsword, mace, and spin attacks — all use getSweepProgress + getAnticipationPullBack.

const PlayerCombatRenderer = {
    SWEEP_SPEED: 1,
    /** Anticipation: fraction of attack used as wind-up before the swing (exaggerated for style). */
    ANTICIPATION_RATIO: 0.24,
    /** Pull-back of the blade during wind-up in radians (exaggerated for readable wind-up). */
    PULL_BACK_RADIANS: 0.48,
    /** Extra sweep multiplier for weapon follow-through (e.g. 0.14 = 14% past hitbox). */
    FOLLOW_THROUGH_EXTRA: 0.14,
    /** Fraction of attack (after swing starts) after which follow-through kicks in. */
    FOLLOW_THROUGH_START: 0.72,

    /** Thrust: longer wind-up, no angle change — only position back then forward. */
    THRUST_ANTICIPATION_RATIO: 0.32,
    /** Thrust: world-unit offset. Negative = grip pulled back, positive = lunge forward. */
    THRUST_PULL_BACK_WORLD: 28,
    THRUST_LUNGE_FORWARD_WORLD: 32,
    /** Thrust: very snappy forward (ease-out power 5). */
    easeOutQuint(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 5);
    },

    /** Cubic ease-out: fast start, slow end — snappy release, follow-through. */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    },
    /** Strong ease-out (power 4): snappier impact out of wind-up. */
    easeOutQuart(t) {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 4);
    },

    /** Resolve a visual constant: weapon.attackVisual override if present (camelCase or UPPER_SNAKE), else renderer default. */
    v(combat, key) {
        const visual = combat && combat.weapon && combat.weapon.attackVisual;
        if (!visual) return this[key];
        const parts = key.split('_');
        const camel = parts[0].toLowerCase() + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
        const value = visual[camel] !== undefined && visual[camel] !== null ? visual[camel] : visual[key];
        return value !== undefined && value !== null ? value : this[key];
    },

    /** Raw linear progress 0..1 over the attack duration. */
    getRawProgress(combat) {
        const duration = combat.attackDuration > 0 ? combat.attackDuration : 0.001;
        return Math.min(1, Math.max(0, (combat.attackTimer || 0) / duration));
    },

    /** Visual sweep progress: anticipation then snappy ease-out (hitbox/arc use this, no overshoot). */
    getSweepProgress(combat) {
        const raw = this.getRawProgress(combat);
        const anticipationRatio = this.v(combat, 'ANTICIPATION_RATIO');
        if (raw <= anticipationRatio) return 0;
        const swingPhase = (raw - anticipationRatio) / (1 - anticipationRatio);
        const eased = this.easeOutQuart(swingPhase);
        const sweepSpeed = this.v(combat, 'SWEEP_SPEED');
        return Math.min(1, eased * sweepSpeed);
    },

    /** Weapon-only sweep (includes follow-through overshoot for blade/mace angle). */
    getWeaponSweepProgress(combat) {
        const raw = this.getRawProgress(combat);
        const anticipationRatio = this.v(combat, 'ANTICIPATION_RATIO');
        if (raw <= anticipationRatio) return 0;
        const swingPhase = (raw - anticipationRatio) / (1 - anticipationRatio);
        const eased = this.easeOutQuart(swingPhase);
        const followThroughStart = this.v(combat, 'FOLLOW_THROUGH_START');
        const followThroughExtra = this.v(combat, 'FOLLOW_THROUGH_EXTRA');
        const followThrough = swingPhase >= followThroughStart
            ? this.easeOutCubic((swingPhase - followThroughStart) / (1 - followThroughStart))
            : 0;
        return Math.min(1, eased) + followThrough * followThroughExtra;
    },

    /** Angle offset in radians during anticipation (pull-back); 0 when not in wind-up. */
    getAnticipationPullBack(combat) {
        const raw = this.getRawProgress(combat);
        const anticipationRatio = this.v(combat, 'ANTICIPATION_RATIO');
        if (raw >= anticipationRatio) return 0;
        const pullBackRadians = this.v(combat, 'PULL_BACK_RADIANS');
        return -pullBackRadians * (1 - raw / anticipationRatio);
    },

    /** Thrust: grip offset in world units (negative = back, positive = forward). No angle change. */
    getThrustGripOffset(combat) {
        const raw = this.getRawProgress(combat);
        const thrustAnticipation = this.v(combat, 'THRUST_ANTICIPATION_RATIO');
        const thrustPullBack = this.v(combat, 'THRUST_PULL_BACK_WORLD');
        const thrustLunge = this.v(combat, 'THRUST_LUNGE_FORWARD_WORLD');
        if (raw < thrustAnticipation) {
            const t = 1 - raw / thrustAnticipation;
            return -thrustPullBack * t;
        }
        const thrustPhase = (raw - thrustAnticipation) / (1 - thrustAnticipation);
        return thrustLunge * this.easeOutQuint(thrustPhase);
    },

    drawAttackArc(ctx, screenX, screenY, combat, movement, camera, options) {
        const isTelegraph = options && options.telegraph && combat && combat.isWindingUp;
        if (!combat || (!combat.isAttacking && !isTelegraph)) return;
        const range = (combat.attackRange || 80) * camera.zoom;
        // Optional override for enemies: pass options.sweepProgress (0..1) and options.pullBack (radians, e.g. 0)
        const sweepProgress = (options && typeof options.sweepProgress === 'number') ? options.sweepProgress : (isTelegraph ? 0 : this.getSweepProgress(combat));
        const pullBackOverride = (options && typeof options.pullBack === 'number');
        const useComboColors = options && options.comboColors;
        const animKey = (combat && (combat.currentAttackAnimationKey || 'melee')) || 'melee';
        const lw = 3 / camera.zoom;
        const lwCombo = 4 / camera.zoom;
        // Medieval palette: steel edge, shadow/vellum fill; combo = bronze/gold; telegraph = dimmer
        let edgeColor = '#5a5a62';
        let edgeHighlight = 'rgba(180, 175, 165, 0.9)';
        let fillStyle = isTelegraph ? 'rgba(50, 45, 40, 0.18)' : 'rgba(40, 35, 30, 0.22)';
        if (!isTelegraph && useComboColors) {
            if (combat.currentAttackIsDashAttack) {
                edgeColor = '#c99830';
                edgeHighlight = 'rgba(255, 220, 100, 0.9)';
                fillStyle = 'rgba(100, 70, 20, 0.35)';
            } else if (animKey === 'meleeSpin') {
                edgeColor = '#8b7340';
                edgeHighlight = 'rgba(220, 200, 120, 0.85)';
                fillStyle = 'rgba(80, 60, 30, 0.28)';
            } else if (animKey === 'melee2') {
                edgeColor = '#6b5b4a';
                edgeHighlight = 'rgba(200, 160, 100, 0.85)';
                fillStyle = 'rgba(60, 45, 30, 0.24)';
            } else if (animKey === 'meleeChop') {
                edgeColor = '#4a3a2a';
                edgeHighlight = 'rgba(180, 120, 60, 0.9)';
                fillStyle = 'rgba(50, 35, 20, 0.28)';
            }
        }
        const facingAngle = movement ? movement.facingAngle : 0;
        if (combat.currentAttackIsCircular) {
            const currentRadius = range * sweepProgress;
            if (currentRadius <= 0) return; // skip arc on first frame to avoid spin blink (no zero-radius draw)
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
        } else if (animKey === 'meleeChop') {
            // Overhead chop: canvas-drawn blade sweeping from raised to down (no thrust rectangle)
            const chopLength = range * sweepProgress;
            const chopHalfWidth = ((combat.currentAttackThrustWidth || 28) * camera.zoom) / 2;
            // Blade angle: from raised (facingAngle - 90°) to down/forward (facingAngle)
            const chopAngle = facingAngle - (1 - sweepProgress) * (Math.PI / 2);
            const cosA = Math.cos(chopAngle);
            const sinA = Math.sin(chopAngle);
            const backLeftX = screenX - chopHalfWidth * sinA;
            const backLeftY = screenY + chopHalfWidth * cosA;
            const backRightX = screenX + chopHalfWidth * sinA;
            const backRightY = screenY - chopHalfWidth * cosA;
            const frontLeftX = screenX + chopLength * cosA - chopHalfWidth * sinA;
            const frontLeftY = screenY + chopLength * sinA + chopHalfWidth * cosA;
            const frontRightX = screenX + chopLength * cosA + chopHalfWidth * sinA;
            const frontRightY = screenY + chopLength * sinA - chopHalfWidth * cosA;
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.moveTo(backLeftX, backLeftY);
            ctx.lineTo(frontLeftX, frontLeftY);
            ctx.lineTo(frontRightX, frontRightY);
            ctx.lineTo(backRightX, backRightY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.5);
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(screenX + chopLength * cosA, screenY + chopLength * sinA);
            ctx.stroke();
        } else if (combat.currentAttackIsThrust) {
            // Thrust: rectangle thrust forward from player (stab)
            const thrustLength = range * sweepProgress;
            const thrustHalfWidth = ((combat.currentAttackThrustWidth || 40) * camera.zoom) / 2;
            const cosA = Math.cos(facingAngle);
            const sinA = Math.sin(facingAngle);
            const backLeftX = screenX - thrustHalfWidth * sinA;
            const backLeftY = screenY + thrustHalfWidth * cosA;
            const backRightX = screenX + thrustHalfWidth * sinA;
            const backRightY = screenY - thrustHalfWidth * cosA;
            const frontLeftX = screenX + thrustLength * cosA - thrustHalfWidth * sinA;
            const frontLeftY = screenY + thrustLength * sinA + thrustHalfWidth * cosA;
            const frontRightX = screenX + thrustLength * cosA + thrustHalfWidth * sinA;
            const frontRightY = screenY + thrustLength * sinA - thrustHalfWidth * cosA;
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.moveTo(backLeftX, backLeftY);
            ctx.lineTo(frontLeftX, frontLeftY);
            ctx.lineTo(frontRightX, frontRightY);
            ctx.lineTo(backRightX, backRightY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            // Center line highlight (blade edge)
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.5);
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(screenX + thrustLength * cosA, screenY + thrustLength * sinA);
            ctx.stroke();
        } else {
            const attackArc = (combat.attackArc != null && combat.attackArc > 0) ? combat.attackArc : (typeof Utils !== 'undefined' ? Utils.degToRad(90) : Math.PI / 2);
            const arcCenter = facingAngle + (combat.attackArcOffset ?? 0);
            const halfArc = attackArc / 2;
            let startAngle, endAngle;
            if (isTelegraph) {
                // Telegraph: show full cone (entire danger zone)
                startAngle = arcCenter - halfArc;
                endAngle = arcCenter + halfArc;
            } else {
                const pullBack = pullBackOverride ? options.pullBack : this.getAnticipationPullBack(combat);
                const reverseSweep = combat.currentAttackReverseSweep === true;
                if (reverseSweep) {
                    // Slash originates from the opposite side (right), sweeps toward left
                    startAngle = arcCenter + halfArc - sweepProgress * attackArc;
                    endAngle = arcCenter + halfArc - pullBack;
                } else {
                    // Default: slash from left, sweeps toward right
                    startAngle = arcCenter - halfArc + pullBack;
                    endAngle = arcCenter - halfArc + sweepProgress * attackArc;
                }
            }
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.arc(screenX, screenY, range, startAngle, endAngle);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            // Inner blade-edge highlight along the sweeping arc
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.5);
            ctx.beginPath();
            ctx.arc(screenX, screenY, range - 3 / camera.zoom, startAngle, endAngle);
            ctx.stroke();
        }
    },

    /**
     * Returns grip position and sword angle for the current combat state (used by drawSword).
     * @returns {{ gripX: number, gripY: number, swordAngle: number, facingAngle: number, gripOrbitRadius: number } | null}
     */
    getSwordGrip(screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return null;
        const sideOffset = (transform.width / 2 + 4) * camera.zoom;
        const gripOrbitRadius = sideOffset;
        const facingAngle = movement.facingAngle;
        let gripX = screenX + Math.cos(facingAngle + Math.PI / 2) * gripOrbitRadius;
        let gripY = screenY + Math.sin(facingAngle + Math.PI / 2) * gripOrbitRadius;
        const animKey = combat.currentAttackAnimationKey || 'melee';
        const isMeleeSpinWithPlayer = animKey === 'meleeSpin';
        const isChop = animKey === 'meleeChop';
        const isThrust = combat.currentAttackIsThrust === true && !isChop;
        let swordAngle = facingAngle;
        if (combat.isAttacking && combat.attackDuration > 0 && !isMeleeSpinWithPlayer) {
            if (isChop) {
                // Overhead chop: blade sweeps from raised (-90°) to forward (0°); pull-back during anticipation
                const weaponSweep = this.getWeaponSweepProgress(combat);
                const pullBack = this.getAnticipationPullBack(combat) || 0;
                swordAngle = facingAngle - (1 - weaponSweep) * (Math.PI / 2) + pullBack;
                gripX = screenX + Math.cos(facingAngle + Math.PI / 2) * gripOrbitRadius;
                gripY = screenY + Math.sin(facingAngle + Math.PI / 2) * gripOrbitRadius;
            } else if (isThrust) {
                swordAngle = facingAngle;
                const thrustOffset = this.getThrustGripOffset(combat);
                gripX = screenX + thrustOffset * Math.cos(facingAngle) * camera.zoom;
                gripY = screenY + thrustOffset * Math.sin(facingAngle) * camera.zoom;
            } else {
                const weaponSweep = this.getWeaponSweepProgress(combat);
                const pullBack = this.getAnticipationPullBack(combat);
                const defaultArc = combat.weapon ? Utils.degToRad(combat.weapon.baseArcDegrees) : Math.PI / 3;
                const halfArc = ((combat.attackArc ?? defaultArc) / 2);
                const attackArc = combat.attackArc ?? defaultArc;
                let gripAngle;
                if (combat.currentAttackIsCircular) {
                    swordAngle = facingAngle + pullBack + Math.min(1, weaponSweep) * Math.PI * 2;
                    gripAngle = swordAngle;
                } else if (combat.currentAttackReverseSweep) {
                    swordAngle = facingAngle + halfArc - pullBack - weaponSweep * attackArc;
                    gripAngle = swordAngle;
                } else {
                    swordAngle = facingAngle - halfArc + pullBack + weaponSweep * attackArc;
                    gripAngle = swordAngle;
                }
                gripX = screenX + Math.cos(gripAngle) * gripOrbitRadius;
                gripY = screenY + Math.sin(gripAngle) * gripOrbitRadius;
            }
        }
        if (isMeleeSpinWithPlayer) {
            swordAngle = facingAngle + Math.PI / 2;
        }
        return { gripX, gripY, swordAngle, facingAngle, gripOrbitRadius };
    },

    /**
     * Draw the one-handed sword/dagger shape at a given grip and angle.
     * Shared by player (dagger/sword-and-shield) and goblin. options.style === 'goblin' draws a Goblin Shiv (jagged, rusty).
     * part: 'handle' = pommel + grip only; 'blade' = guard + blade only; 'all' = full (default).
     */
    drawDaggerAt(ctx, gripX, gripY, angle, baseLength, camera, options = {}) {
        if (options.style === 'goblin') {
            this._drawGoblinShivAt(ctx, gripX, gripY, angle, baseLength, camera, options);
            return;
        }
        const part = options.part || 'all';
        const swordLength = baseLength * camera.zoom;
        const bladeWidthAtGuard = 7;
        const lw = 1;
        const gripScale = 1;
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(angle);
        ctx.lineWidth = lw;

        if (part === 'handle' || part === 'all') {
            const pommelX = -16 * gripScale;
            const pommelR = 3;
            ctx.fillStyle = '#4a4a52';
            ctx.strokeStyle = '#3a3a42';
            ctx.beginPath();
            ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const hiltHalfLen = 14 * gripScale;
            const hiltThickness = 6;
            ctx.fillStyle = '#8b4513';
            ctx.strokeStyle = '#5d2e0c';
            ctx.fillRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
            ctx.strokeRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
        }

        if (part === 'blade' || part === 'all') {
            const guardHalfW = 6;
            const guardThick = 2;
            ctx.fillStyle = '#6b6b75';
            ctx.strokeStyle = '#4a4a52';
            ctx.fillRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            ctx.strokeRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            const hw = bladeWidthAtGuard / 2;
            const tipWidth = hw * 0.65;
            const tipLength = tipWidth * 1.8;
            ctx.fillStyle = '#a8a8b0';
            ctx.strokeStyle = '#3d3d42';
            ctx.beginPath();
            ctx.moveTo(0, -hw);
            ctx.lineTo(0, hw);
            ctx.lineTo(swordLength, tipWidth);
            ctx.lineTo(swordLength + tipLength, 0);
            ctx.lineTo(swordLength, -tipWidth);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(120, 118, 110, 0.55)';
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            ctx.moveTo(hw * 0.5, 0);
            ctx.lineTo(swordLength + tipLength, 0);
            ctx.stroke();
        }

        ctx.restore();
    },

    /** Goblin Shiv: short jagged blade, rusty metal, wrapped bone/leather grip. */
    _drawGoblinShivAt(ctx, gripX, gripY, angle, baseLength, camera, options = {}) {
        const part = options.part || 'all';
        const swordLength = baseLength * camera.zoom;
        const scale = camera.zoom;
        const lw = Math.max(1, 1.5 / scale);
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(angle);
        ctx.lineWidth = lw;

        if (part === 'handle' || part === 'all') {
            const pommelX = -12;
            const pommelR = 2.5;
            ctx.fillStyle = '#5c4a3a';
            ctx.strokeStyle = '#3d3228';
            ctx.beginPath();
            ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const hiltHalfLen = 10;
            const hiltThickness = 5;
            ctx.fillStyle = '#6b5344';
            ctx.strokeStyle = '#4a3d32';
            ctx.fillRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
            ctx.strokeRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
            for (let i = -1; i <= 1; i += 2) {
                ctx.fillStyle = '#5a4a3a';
                ctx.fillRect(-hiltHalfLen + 2, (hiltThickness / 2) * i - 1, 4, 2);
            }
        }

        if (part === 'blade' || part === 'all') {
            const guardHalfW = 4;
            const guardThick = 1.5;
            ctx.fillStyle = '#6b5a48';
            ctx.strokeStyle = '#4a4035';
            ctx.fillRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            ctx.strokeRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            const hw = 3.5;
            const tipWidth = 1.2;
            ctx.fillStyle = '#6d6b5e';
            ctx.strokeStyle = '#4a4840';
            const jagSteps = 5;
            const step = swordLength / jagSteps;
            ctx.beginPath();
            ctx.moveTo(0, -hw);
            for (let i = 1; i <= jagSteps; i++) {
                const x = i * step;
                const y = (i === jagSteps) ? (i % 2 === 0 ? -tipWidth : tipWidth) : ((i % 2 === 0 ? -hw : hw) * 0.85);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(swordLength, tipWidth);
            for (let i = jagSteps - 1; i >= 0; i--) {
                const x = i * step;
                const y = (i === 0) ? hw : ((i % 2 === 0 ? hw : -hw) * 0.85);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(80, 75, 65, 0.6)';
            ctx.lineWidth = lw * 0.5;
            ctx.beginPath();
            ctx.moveTo(hw * 0.6, 0);
            for (let i = 1; i <= jagSteps; i++) ctx.lineTo(i * step, 0);
            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * part: 'handle' = pommel + grip only (draw under helmet); 'blade' = guard + blade only (draw over); 'all' = full sword (default).
     */
    drawSword(ctx, screenX, screenY, transform, movement, combat, camera, options = {}) {
        const part = options.part || 'all';
        if (!movement || !combat || !transform) return;
        const grip = this.getSwordGrip(screenX, screenY, transform, movement, combat, camera);
        if (!grip) return;
        const { gripX, gripY, swordAngle } = grip;
        const twoHanded = combat.weapon && combat.weapon.twoHanded;
        const defaultRange = combat.weapon ? combat.weapon.baseRange : 100;
        const baseLength = (combat.weapon && combat.weapon.weaponLength != null) ? combat.weapon.weaponLength : (combat.attackRange ?? defaultRange) * 0.48;

        if (!twoHanded) {
            this.drawDaggerAt(ctx, gripX, gripY, swordAngle, baseLength, camera, { part });
            return;
        }

        const lengthMult = 1.55;
        const widthMult = 1.4;
        const swordLength = baseLength * camera.zoom * lengthMult;
        const bladeWidthAtGuard = 7 * widthMult;
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(swordAngle);
        const lw = 1;
        ctx.lineWidth = lw;
        const gripScale = 1.35;

        if (part === 'handle' || part === 'all') {
            const pommelX = -16 * gripScale;
            const pommelR = 3 * 1.2;
            ctx.fillStyle = '#4a4a52';
            ctx.strokeStyle = '#3a3a42';
            ctx.beginPath();
            ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const hiltHalfLen = 14 * gripScale;
            const hiltThickness = 6 * 1.15;
            ctx.fillStyle = '#8b4513';
            ctx.strokeStyle = '#5d2e0c';
            ctx.fillRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
            ctx.strokeRect(-hiltHalfLen, -hiltThickness / 2, hiltHalfLen * 2, hiltThickness);
        }

        if (part === 'blade' || part === 'all') {
            const guardHalfW = 6 * 1.4;
            const guardThick = 2 * 1.3;
            ctx.fillStyle = '#6b6b75';
            ctx.strokeStyle = '#4a4a52';
            ctx.fillRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            ctx.strokeRect(-guardThick / 2, -guardHalfW, guardThick, guardHalfW * 2);
            const hw = bladeWidthAtGuard / 2;
            const tipWidth = hw * 0.65;
            const tipLength = tipWidth * 1.8;
            ctx.fillStyle = '#a8a8b0';
            ctx.strokeStyle = '#3d3d42';
            ctx.beginPath();
            ctx.moveTo(0, -hw);
            ctx.lineTo(0, hw);
            ctx.lineTo(swordLength, tipWidth);
            ctx.lineTo(swordLength + tipLength, 0);
            ctx.lineTo(swordLength, -tipWidth);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(120, 118, 110, 0.55)';
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            ctx.moveTo(hw * 0.5, 0);
            ctx.lineTo(swordLength + tipLength, 0);
            ctx.stroke();
        }

        ctx.restore();
    },

    drawMace(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        const zoom = camera.zoom;
        const defaultRange = combat.weapon ? combat.weapon.baseRange : 100;
        const baseLength = (combat.weapon && combat.weapon.weaponLength != null) ? combat.weapon.weaponLength : (combat.attackRange ?? defaultRange) * 0.5;
        const maceLength = baseLength * zoom * 1.5;
        const sideOffset = (transform.width / 2 + 4) * zoom;
        const gripX = screenX + Math.cos(movement.facingAngle + Math.PI / 2) * sideOffset;
        const gripY = screenY + Math.sin(movement.facingAngle + Math.PI / 2) * sideOffset;
        const animKey = combat.currentAttackAnimationKey || 'melee';
        const isMeleeSpinWithPlayer = animKey === 'meleeSpin';
        let maceAngle = movement.facingAngle;
        if (combat.isAttacking && combat.attackDuration > 0 && !isMeleeSpinWithPlayer) {
            const weaponSweep = this.getWeaponSweepProgress(combat);
            const pullBack = this.getAnticipationPullBack(combat);
            const defaultArc = combat.weapon ? Utils.degToRad(combat.weapon.baseArcDegrees) : Math.PI / 3;
            const attackArc = combat.attackArc ?? defaultArc;
            const halfArc = attackArc / 2;
            if (combat.currentAttackIsCircular) {
                maceAngle = movement.facingAngle + pullBack + Math.min(1, weaponSweep) * Math.PI * 2;
            } else {
                if (combat.currentAttackReverseSweep) {
                    maceAngle = movement.facingAngle + halfArc - pullBack - weaponSweep * attackArc;
                } else {
                    maceAngle = movement.facingAngle - halfArc + pullBack + weaponSweep * attackArc;
                }
            }
        }
        if (isMeleeSpinWithPlayer) {
            maceAngle = movement.facingAngle + Math.PI / 2;
        }
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(maceAngle);
        const lw = 1;

        // Pommel / end cap (behind grip, -X) — thickness constant when zooming
        const pommelX = -16 * zoom;
        const pommelR = 4;
        ctx.fillStyle = '#4a4a52';
        ctx.strokeStyle = '#3a3a42';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Grip (leather wrap)
        const gripLen = 18 * zoom;
        const gripW = 5;
        ctx.fillStyle = '#6b4423';
        ctx.strokeStyle = '#4a2e14';
        ctx.fillRect(pommelX, -gripW / 2, gripLen, gripW);
        ctx.strokeRect(pommelX, -gripW / 2, gripLen, gripW);

        // Shaft (metal), from grip to head
        const shaftStart = pommelX + gripLen;
        const shaftLen = maceLength * 0.5;
        const shaftW = 4;
        ctx.fillStyle = '#5a5a62';
        ctx.strokeStyle = '#3a3a42';
        ctx.fillRect(shaftStart, -shaftW / 2, shaftLen, shaftW);
        ctx.strokeRect(shaftStart, -shaftW / 2, shaftLen, shaftW);

        // Mace head: flanged metal ball at end of shaft
        const headCenterX = shaftStart + shaftLen;
        const headR = 12 * zoom;
        const flangeCount = 6;
        const flangeOut = 3;
        ctx.fillStyle = '#4a4a52';
        ctx.strokeStyle = '#2a2a32';
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i <= flangeCount; i++) {
            const a = (i / flangeCount) * Math.PI * 2;
            const x = headCenterX + Math.cos(a) * (headR + flangeOut);
            const y = Math.sin(a) * (headR + flangeOut);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5a5a62';
        ctx.strokeStyle = '#3a3a42';
        ctx.beginPath();
        ctx.arc(headCenterX, 0, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(180, 175, 165, 0.4)';
        ctx.lineWidth = lw * 0.5;
        ctx.beginPath();
        ctx.arc(headCenterX, 0, headR - 2, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    },

    drawCrossbow(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        const zoom = camera.zoom;
        const lw = 1;
        const dist = (transform.width / 2 + 12) * zoom;
        const cx = screenX + Math.cos(movement.facingAngle) * dist;
        const cy = screenY + Math.sin(movement.facingAngle) * dist;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(movement.facingAngle);

        const stockLen = 28 * zoom;
        const limbHalf = 22 * zoom;
        const stockW = 5;
        const limbW = 7;

        // Stock (body) – dark wood
        ctx.fillStyle = '#3d2817';
        ctx.strokeStyle = '#2a1a0c';
        ctx.lineWidth = lw;
        ctx.fillRect(-stockLen * 0.5, -stockW / 2, stockLen, stockW);
        ctx.strokeRect(-stockLen * 0.5, -stockW / 2, stockLen, stockW);

        // Limbs (curved arms at front)
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = limbW;
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.35, 0);
        ctx.quadraticCurveTo(stockLen * 0.55, -limbHalf, stockLen * 0.5, -limbHalf * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.35, 0);
        ctx.quadraticCurveTo(stockLen * 0.55, limbHalf, stockLen * 0.5, limbHalf * 0.6);
        ctx.stroke();

        // Stirrup (metal at front) — thickness constant when zooming
        ctx.fillStyle = '#5a5a62';
        ctx.strokeStyle = '#3a3a42';
        ctx.beginPath();
        ctx.arc(stockLen * 0.5, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // String
        ctx.strokeStyle = '#c0b090';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.5, -limbHalf * 0.5);
        ctx.lineTo(stockLen * 0.5, limbHalf * 0.5);
        ctx.stroke();

        // Trigger area (metal) — thickness constant when zooming
        ctx.fillStyle = '#4a4a52';
        ctx.fillRect(-8 * zoom, -stockW / 2 - 2, 6, stockW + 4);
        ctx.strokeStyle = '#3a3a42';
        ctx.strokeRect(-8 * zoom, -stockW / 2 - 2, 6, stockW + 4);

        ctx.restore();
    },

    drawShield(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        if (combat.weapon && combat.weapon.twoHanded) return;
        const shieldDist = (transform.width / 2 + 8) * camera.zoom;
        const shieldW = 40 * camera.zoom;
        const shieldH = 8; // thickness constant when zooming
        if (combat.isBlocking) {
            const shieldX = screenX + Math.cos(movement.facingAngle) * shieldDist;
            const shieldY = screenY + Math.sin(movement.facingAngle) * shieldDist;
            ctx.save();
            ctx.translate(shieldX, shieldY);
            ctx.rotate(movement.facingAngle + Math.PI / 2);
            ctx.fillStyle = '#8b6914';
            ctx.strokeStyle = '#5d4a0c';
            ctx.lineWidth = 2;
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
            ctx.lineWidth = 1;
            ctx.fillRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.strokeRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH);
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }
};
