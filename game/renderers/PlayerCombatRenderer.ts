// Player combat visuals (attack arc, sword, mace, crossbow, shield). Procedural drawing only.
// Animation (anticipation, easing, follow-through) applies to all melee weapon types:
// sword, greatsword, mace, and spin attacks — all use getSweepProgress + getAnticipationPullBack.
import { Utils } from '../utils/Utils.ts';
import { isBlockable } from '../weapons/weaponBehavior.ts';

export const PlayerCombatRenderer = {
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
    easeOutQuint(t: number): number {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 5);
    },

    /** Cubic ease-out: fast start, slow end — snappy release, follow-through. */
    easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
    },
    /** Strong ease-out (power 4): snappier impact out of wind-up. */
    easeOutQuart(t: number): number {
        return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 4);
    },

    /** Resolve a visual constant: weapon.attackVisual override if present (camelCase or UPPER_SNAKE), else renderer default. */
    v(combat: unknown, key: string): number {
        const visual = combat && combat.weapon && combat.weapon.attackVisual;
        if (!visual) return this[key];
        const parts = key.split('_');
        const camel = parts[0].toLowerCase() + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
        const value = visual[camel] !== undefined && visual[camel] !== null ? visual[camel] : visual[key];
        return value !== undefined && value !== null ? value : this[key];
    },

    /** Resolve weapon metal color: if weapon has color use it (and darkened stroke), else return defaults. */
    weaponMetalColors(combat: unknown, defaultFill: string, defaultStroke: string): { fill: string; stroke: string } {
        const w = combat?.weapon;
        const hex = w?.color;
        if (!hex || typeof hex !== 'string') return { fill: defaultFill, stroke: defaultStroke };
        const m = hex.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
        if (!m) return { fill: hex, stroke: defaultStroke };
        const r = Math.max(0, Math.floor(parseInt(m[1], 16) * 0.55));
        const g = Math.max(0, Math.floor(parseInt(m[2], 16) * 0.55));
        const b = Math.max(0, Math.floor(parseInt(m[3], 16) * 0.55));
        return { fill: hex, stroke: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}` };
    },

    /** Raw linear progress 0..1 over the attack duration. */
    getRawProgress(combat: unknown): number {
        const duration = combat.attackDuration > 0 ? combat.attackDuration : 0.001;
        return Math.min(1, Math.max(0, (combat.attackTimer || 0) / duration));
    },

    /** Visual sweep progress: anticipation then snappy ease-out (hitbox/arc use this, no overshoot). */
    getSweepProgress(combat: unknown): number {
        const raw = this.getRawProgress(combat);
        const anticipationRatio = this.v(combat, 'ANTICIPATION_RATIO');
        if (raw <= anticipationRatio) return 0;
        const swingPhase = (raw - anticipationRatio) / (1 - anticipationRatio);
        const eased = this.easeOutQuart(swingPhase);
        const sweepSpeed = this.v(combat, 'SWEEP_SPEED');
        return Math.min(1, eased * sweepSpeed);
    },

    /** Weapon-only sweep (includes follow-through overshoot for blade/mace angle). */
    getWeaponSweepProgress(combat: unknown): number {
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
    getAnticipationPullBack(combat: unknown): number {
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
        const enemySwing = options && options.enemySwing;
        if (!combat || (!combat.isAttacking && !isTelegraph && !enemySwing)) return;
        const rangeRaw = (options && typeof options.range === 'number') ? options.range : (combat.attackRange || 80);
        const range = rangeRaw * camera.zoom;
        // Optional override for enemies: pass options.sweepProgress (0..1), options.pullBack (radians), options.range, options.arc
        const sweepProgress = (options && typeof options.sweepProgress === 'number') ? options.sweepProgress : (isTelegraph ? 0 : this.getSweepProgress(combat));
        const pullBackOverride = (options && typeof options.pullBack === 'number');
        const useComboColors = options && options.comboColors;
        const animKey = (combat && (combat.currentAttackAnimationKey || 'melee')) || 'melee';
        const lw = 3 / camera.zoom;
        const lwCombo = 4 / camera.zoom;
        // Weapon tier color for arc edge when present; else medieval steel palette
        const weaponEdge = combat?.weapon?.color;
        let edgeColor = (weaponEdge && typeof weaponEdge === 'string') ? weaponEdge : '#5a5a62';
        let edgeHighlight = (weaponEdge && typeof weaponEdge === 'string') ? `rgba(${parseInt(weaponEdge.slice(1, 3), 16)}, ${parseInt(weaponEdge.slice(3, 5), 16)}, ${parseInt(weaponEdge.slice(5, 7), 16)}, 0.9)` : 'rgba(180, 175, 165, 0.9)';
        let fillStyle = isTelegraph ? 'rgba(50, 45, 40, 0.18)' : 'rgba(40, 35, 30, 0.22)';
        if (!isTelegraph && useComboColors && !weaponEdge) {
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
            const attackArc = (options && typeof options.arc === 'number' && options.arc > 0) ? options.arc : ((combat.attackArc != null && combat.attackArc > 0) ? combat.attackArc : (typeof Utils !== 'undefined' ? Utils.degToRad(90) : Math.PI / 2));
            const arcOffset = (options && typeof options.arcOffset === 'number') ? options.arcOffset : (combat.attackArcOffset ?? 0);
            const arcCenter = facingAngle + arcOffset;
            const halfArc = attackArc / 2;
            let startAngle, endAngle;
            if (isTelegraph) {
                // Telegraph: show full cone (entire danger zone)
                startAngle = arcCenter - halfArc;
                endAngle = arcCenter + halfArc;
            } else {
                const pullBack = pullBackOverride ? options.pullBack : this.getAnticipationPullBack(combat);
                const reverseSweep = (options && typeof options.reverseSweep === 'boolean') ? options.reverseSweep : (combat.currentAttackReverseSweep === true);
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
            // Cone at full range; only the angle sweeps (windshield wiper)
            const currentRange = range;
            ctx.lineWidth = useComboColors ? lwCombo : lw;
            ctx.fillStyle = fillStyle;
            ctx.beginPath();
            ctx.arc(screenX, screenY, currentRange, startAngle, endAngle);
            ctx.lineTo(screenX, screenY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = edgeColor;
            ctx.stroke();
            // Inner blade-edge highlight along the sweeping arc
            ctx.strokeStyle = edgeHighlight;
            ctx.lineWidth = Math.max(1, (useComboColors ? lwCombo : lw) * 0.5);
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(0, currentRange - 3 / camera.zoom), startAngle, endAngle);
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
        let swordAngle = facingAngle;

        if (combat.isBlocking && !isBlockable(combat.offhandWeapon)) {
            const blockGripDist = (transform.width / 2 + 10) * camera.zoom;
            gripX = screenX + Math.cos(facingAngle) * blockGripDist;
            gripY = screenY + Math.sin(facingAngle) * blockGripDist;
            swordAngle = facingAngle + Math.PI / 3;
            return { gripX, gripY, swordAngle, facingAngle, gripOrbitRadius };
        }

        const animKey = combat.currentAttackAnimationKey || 'melee';
        const isMeleeSpinWithPlayer = animKey === 'meleeSpin';
        const isChop = animKey === 'meleeChop';
        const isThrust = combat.currentAttackIsThrust === true && !isChop;
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
     * Shared by player (e.g. dagger, sword; off-hand shield when equipped) and goblin. options.style === 'goblin' draws a Goblin Shiv (jagged, rusty).
     * part: 'handle' = pommel + grip only; 'blade' = guard + blade only; 'all' = full (default).
     */
    drawDaggerAt(ctx, gripX, gripY, angle, baseLength, camera, options = {}) {
        if (options.style === 'goblin') {
            this._drawGoblinShivAt(ctx, gripX, gripY, angle, baseLength, camera, options);
            return;
        }
        const part = options.part || 'all';
        const weaponColor = options.weaponColor;
        const bladeFill = (weaponColor && typeof weaponColor === 'string') ? weaponColor : '#a8a8b0';
        const m = weaponColor && typeof weaponColor === 'string' && weaponColor.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
        const bladeStroke = m ? `#${Math.max(0, Math.floor(parseInt(m[1], 16) * 0.55)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[2], 16) * 0.55)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[3], 16) * 0.55)).toString(16).padStart(2, '0')}` : '#3d3d42';
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
            ctx.fillStyle = bladeFill;
            ctx.strokeStyle = bladeStroke;
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
     * Blessed Winds: slender curved blade, ornate wind-themed guard and pommel, warm grip.
     * part: 'handle' = pommel + grip; 'blade' = guard + blade; 'all' = full.
     */
    drawBlessedWindsAt(ctx, gripX, gripY, angle, baseLength, camera, options = {}) {
        const part = options.part || 'all';
        const z = camera.zoom;
        const swordLength = baseLength * z * 1.05;
        const lw = Math.max(0.8, 1.2 / z);
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(angle);
        ctx.lineWidth = lw;

        if (part === 'handle' || part === 'all') {
            const pommelX = -18 * z;
            const pommelR = 2.8 * z;
            ctx.fillStyle = '#2a2835';
            ctx.strokeStyle = '#4a4565';
            ctx.beginPath();
            ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(180, 160, 220, 0.5)';
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            ctx.arc(pommelX, 0, pommelR * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = lw;
            const spiralTipX = pommelX - pommelR * 1.4;
            ctx.strokeStyle = '#3d3850';
            ctx.fillStyle = '#352f45';
            ctx.beginPath();
            ctx.moveTo(pommelX - pommelR, 0);
            ctx.quadraticCurveTo(pommelX - pommelR * 1.2, -pommelR * 0.8, spiralTipX, -pommelR * 0.3);
            ctx.quadraticCurveTo(pommelX - pommelR * 0.9, 0, spiralTipX, pommelR * 0.3);
            ctx.quadraticCurveTo(pommelX - pommelR * 1.2, pommelR * 0.8, pommelX - pommelR, 0);
            ctx.fill();
            ctx.stroke();

            const hiltHalfLen = 14 * z;
            const hiltThick = 5.5 * z;
            ctx.fillStyle = '#8b6914';
            ctx.strokeStyle = '#5c4810';
            ctx.fillRect(-hiltHalfLen, -hiltThick / 2, hiltHalfLen * 2, hiltThick);
            ctx.strokeRect(-hiltHalfLen, -hiltThick / 2, hiltHalfLen * 2, hiltThick);
            for (let i = -2; i <= 2; i++) {
                const dx = i * 5 * z;
                ctx.fillStyle = '#a07818';
                ctx.fillRect(-hiltHalfLen + 4 + dx, -hiltThick / 2 + 1, 2.5 * z, hiltThick - 2);
                ctx.fillStyle = '#6b5012';
                ctx.fillRect(-hiltHalfLen + 5.5 + dx, -hiltThick / 2 + 1.5, 1 * z, hiltThick - 3);
            }
        }

        if (part === 'blade' || part === 'all') {
            const guardHalfW = 8 * z;
            const guardThick = 2.5 * z;
            ctx.fillStyle = '#2a2838';
            ctx.strokeStyle = '#4a4568';
            ctx.beginPath();
            ctx.moveTo(-guardThick / 2, -guardHalfW * 0.5);
            ctx.lineTo(-guardThick / 2, -guardHalfW);
            ctx.quadraticCurveTo(guardThick, -guardHalfW * 1.1, guardThick * 2, 0);
            ctx.quadraticCurveTo(guardThick, guardHalfW * 1.1, -guardThick / 2, guardHalfW);
            ctx.lineTo(-guardThick / 2, guardHalfW * 0.5);
            ctx.lineTo(guardThick / 2, guardHalfW * 0.4);
            ctx.quadraticCurveTo(guardThick * 0.8, 0, guardThick / 2, -guardHalfW * 0.4);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(200, 180, 255, 0.35)';
            ctx.lineWidth = lw * 0.5;
            ctx.beginPath();
            ctx.moveTo(0, -guardHalfW * 0.6);
            ctx.quadraticCurveTo(guardThick, 0, 0, guardHalfW * 0.6);
            ctx.stroke();
            ctx.lineWidth = lw;

            const bladeW = 3.2 * z;
            const curveAmp = swordLength * 0.04;
            const tipLen = bladeW * 2.2;
            const totalLen = swordLength + tipLen;
            ctx.fillStyle = '#383b42';
            ctx.strokeStyle = '#25272c';
            ctx.beginPath();
            const pts = [];
            const steps = 14;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = t * totalLen;
                const yOff = Math.sin(t * Math.PI) * curveAmp;
                const w = (1 - t) * bladeW + t * 0;
                pts.push({ x, yTop: -w + yOff, yBot: w + yOff });
            }
            ctx.moveTo(pts[0].x, pts[0].yTop);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].yTop);
            for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].yBot);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#5c5f6a';
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            ctx.moveTo(bladeW * 0.25, 0);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].yTop / 2 + pts[i].yBot / 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 248, 230, 0.55)';
            ctx.lineWidth = lw * 0.4;
            ctx.beginPath();
            ctx.moveTo(totalLen * 0.08, -bladeW * 0.45);
            ctx.lineTo(totalLen * 0.5, -bladeW * 0.2);
            ctx.lineTo(totalLen, 0);
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

        if (combat.weapon && combat.weapon.name === 'Blessed Winds') {
            this.drawBlessedWindsAt(ctx, gripX, gripY, swordAngle, baseLength, camera, { part });
            return;
        }
        if (!twoHanded) {
            this.drawDaggerAt(ctx, gripX, gripY, swordAngle, baseLength, camera, { part, weaponColor: combat.weapon?.color });
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

        const bladeMetal = this.weaponMetalColors(combat, '#a8a8b0', '#3d3d42');
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
            ctx.fillStyle = bladeMetal.fill;
            ctx.strokeStyle = bladeMetal.stroke;
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

    drawMace(ctx, screenX, screenY, transform, movement, combat, camera, options?: { sweepProgress?: number; pullBack?: number }) {
        if (!movement || !combat || !transform) return;
        const zoom = camera.zoom;
        const defaultRange = combat.weapon ? combat.weapon.baseRange : 100;
        const baseLength = (combat.weapon && combat.weapon.weaponLength != null) ? combat.weapon.weaponLength : (combat.attackRange ?? defaultRange) * 0.5;
        const maceLength = baseLength * zoom * 1.5;
        const sideOffset = (transform.width / 2 + 4) * zoom;
        let gripX = screenX + Math.cos(movement.facingAngle + Math.PI / 2) * sideOffset;
        let gripY = screenY + Math.sin(movement.facingAngle + Math.PI / 2) * sideOffset;
        const animKey = combat.currentAttackAnimationKey || 'melee';
        const isMeleeSpinWithPlayer = animKey === 'meleeSpin';
        let maceAngle = movement.facingAngle;
        if (combat.isBlocking && !isBlockable(combat.offhandWeapon)) {
            const blockGripDist = (transform.width / 2 + 10) * zoom;
            gripX = screenX + Math.cos(movement.facingAngle) * blockGripDist;
            gripY = screenY + Math.sin(movement.facingAngle) * blockGripDist;
            maceAngle = movement.facingAngle + Math.PI / 3;
        } else {
        const useOverrideSweep = options && typeof options.sweepProgress === 'number';
        if (combat.isAttacking && (combat.attackDuration > 0 || useOverrideSweep) && !isMeleeSpinWithPlayer) {
            const weaponSweep = useOverrideSweep ? options.sweepProgress! : this.getWeaponSweepProgress(combat);
            const pullBack = useOverrideSweep ? (options.pullBack ?? 0) : this.getAnticipationPullBack(combat);
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
        }
        ctx.save();
        ctx.translate(gripX, gripY);
        ctx.rotate(maceAngle);
        const lw = 1;
        const headMetal = this.weaponMetalColors(combat, '#5a5a62', '#3a3a42');

        // Pommel / end cap (behind grip) — hilt, default metal
        const pommelX = -16 * zoom;
        const pommelR = 4;
        ctx.fillStyle = '#4a4a52';
        ctx.strokeStyle = '#3a3a42';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(pommelX, 0, pommelR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Grip (leather wrap) — hilt
        const gripLen = 18 * zoom;
        const gripW = 5;
        ctx.fillStyle = '#6b4423';
        ctx.strokeStyle = '#4a2e14';
        ctx.fillRect(pommelX, -gripW / 2, gripLen, gripW);
        ctx.strokeRect(pommelX, -gripW / 2, gripLen, gripW);

        // Shaft (metal), from grip to head — hilt, default metal
        const shaftStart = pommelX + gripLen;
        const shaftLen = maceLength * 0.5;
        const shaftW = 4;
        ctx.fillStyle = '#5a5a62';
        ctx.strokeStyle = '#3a3a42';
        ctx.fillRect(shaftStart, -shaftW / 2, shaftLen, shaftW);
        ctx.strokeRect(shaftStart, -shaftW / 2, shaftLen, shaftW);

        // Mace head: flanged metal ball — tier color
        const headCenterX = shaftStart + shaftLen;
        const headR = 12 * zoom;
        const flangeCount = 6;
        const flangeOut = 3;
        ctx.fillStyle = headMetal.fill;
        ctx.strokeStyle = headMetal.stroke;
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
        ctx.fillStyle = headMetal.fill;
        ctx.strokeStyle = headMetal.stroke;
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
        let cx = screenX + Math.cos(movement.facingAngle) * dist;
        let cy = screenY + Math.sin(movement.facingAngle) * dist;
        let drawAngle = movement.facingAngle;
        if (combat.isBlocking && !isBlockable(combat.offhandWeapon)) {
            const blockDist = (transform.width / 2 + 16) * zoom;
            cx = screenX + Math.cos(movement.facingAngle) * blockDist;
            cy = screenY + Math.sin(movement.facingAngle) * blockDist;
            drawAngle = movement.facingAngle + Math.PI / 4;
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(drawAngle);

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

        // Limbs (curved arms at front) — flipped: top limb curves down, bottom curves up
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = limbW;
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.35, 0);
        ctx.quadraticCurveTo(stockLen * 0.55, limbHalf, stockLen * 0.5, limbHalf * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.35, 0);
        ctx.quadraticCurveTo(stockLen * 0.55, -limbHalf, stockLen * 0.5, -limbHalf * 0.6);
        ctx.stroke();

        // Stirrup and trigger (metal) — use weapon tier color when present
        const metal = this.weaponMetalColors(combat, '#5a5a62', '#3a3a42');
        ctx.fillStyle = metal.fill;
        ctx.strokeStyle = metal.stroke;
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
        ctx.fillStyle = metal.fill;
        ctx.fillRect(-8 * zoom, -stockW / 2 - 2, 6, stockW + 4);
        ctx.strokeStyle = metal.stroke;
        ctx.strokeRect(-8 * zoom, -stockW / 2 - 2, 6, stockW + 4);

        ctx.restore();
    },

    /** Draw traditional longbow. bowChargeLevel 0 = relaxed; 1–3 = more pulled back and tighter limbs. */
    drawBow(ctx, screenX, screenY, transform, movement, combat, camera, bowChargeLevel = 0) {
        if (!movement || !combat || !transform) return;
        const zoom = camera.zoom;
        const dist = (transform.width / 2 + 12) * zoom;
        let cx = screenX + Math.cos(movement.facingAngle) * dist;
        let cy = screenY + Math.sin(movement.facingAngle) * dist;
        let drawAngle = movement.facingAngle;
        if (combat.isBlocking && !isBlockable(combat.offhandWeapon)) {
            const blockDist = (transform.width / 2 + 16) * zoom;
            cx = screenX + Math.cos(movement.facingAngle) * blockDist;
            cy = screenY + Math.sin(movement.facingAngle) * blockDist;
            drawAngle = movement.facingAngle + Math.PI / 4;
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(drawAngle);
        ctx.scale(-1, 1);

        const halfLen = 28 * zoom;
        const gripLen = 5 * zoom;
        const staveW = Math.max(2.5, 3.5 * zoom);
        const t = Math.min(3, Math.max(0, bowChargeLevel)) / 3;
        const nockY = (45 * (1 - t * 0.32)) * zoom;
        const limbCurve = 0.52 - t * 0.07;

        // Stave (back of bow): control at ~midpoint so limbs are almost straight
        ctx.strokeStyle = '#3d2817';
        ctx.fillStyle = '#4a3520';
        ctx.lineWidth = staveW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(halfLen, nockY);
        ctx.quadraticCurveTo(halfLen * 0.5, nockY * limbCurve, 0, 0);
        ctx.quadraticCurveTo(halfLen * 0.5, -nockY * limbCurve, halfLen, -nockY);
        ctx.stroke();

        // Belly: follows same charge state (tighter when drawn)
        ctx.strokeStyle = '#5a4030';
        ctx.lineWidth = Math.max(1, staveW * 0.4);
        const bellyCurve = limbCurve + 0.02;
        ctx.beginPath();
        ctx.moveTo(halfLen, nockY * 0.98);
        ctx.quadraticCurveTo(halfLen * 0.5, nockY * bellyCurve, 0, 0);
        ctx.quadraticCurveTo(halfLen * 0.5, -nockY * bellyCurve, halfLen, -nockY * 0.98);
        ctx.stroke();

        // Leather grip wrap (center)
        ctx.fillStyle = '#2a1a0c';
        ctx.strokeStyle = '#1a1008';
        ctx.lineWidth = .8;
        const gw = gripLen / 1.25;
        const gh = staveW + 5 ;
        ctx.fillRect(-gw, -gh / 2, gripLen, gh);
        ctx.strokeRect(-gw, -gh / 2, gripLen, gh);

        // Nocks (small notches at tips)
        ctx.fillStyle = '#3d2817';
        ctx.strokeStyle = '#2a1a0c';
        ctx.beginPath();
        ctx.ellipse(halfLen, -nockY, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(halfLen, nockY, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // String (taut between nocks)
        ctx.strokeStyle = '#b8a888';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(halfLen, -nockY);
        ctx.lineTo(halfLen, nockY);
        ctx.stroke();

        ctx.restore();
    },

    /** Draw Defender offhand as a simple small dagger (not the shield rect). Uses offhand weapon tier color when present. */
    drawDefenderDagger(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, transform: { width: number; height: number }, movement: { facingAngle: number }, combat: { isBlocking: boolean; offhandWeapon?: { color?: string } }, camera: { zoom: number }) {
        const off = (transform.width / 2 + 6) * camera.zoom;
        const bladeLen = 14 * camera.zoom;
        const guardW = 4 * camera.zoom;
        let x: number, y: number, angle: number;
        if (combat.isBlocking) {
            x = screenX + Math.cos(movement.facingAngle) * off;
            y = screenY + Math.sin(movement.facingAngle) * off;
            angle = movement.facingAngle + Math.PI / 2;
        } else {
            const leftAngle = movement.facingAngle - Math.PI / 2;
            x = screenX + Math.cos(leftAngle) * (transform.width / 2 + 2) * camera.zoom;
            y = screenY + Math.sin(leftAngle) * (transform.height / 2 + 2) * camera.zoom;
            angle = leftAngle + Math.PI / 2;
        }
        const weaponColor = combat.offhandWeapon?.color;
        const bladeFill = (weaponColor && typeof weaponColor === 'string') ? weaponColor : '#7a7a88';
        const m = weaponColor && typeof weaponColor === 'string' && weaponColor.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
        const bladeStroke = m ? `#${Math.max(0, Math.floor(parseInt(m[1], 16) * 0.55)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[2], 16) * 0.55)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[3], 16) * 0.55)).toString(16).padStart(2, '0')}` : '#4a4a52';
        const guardFill = m ? `#${Math.max(0, Math.floor(parseInt(m[1], 16) * 0.7)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[2], 16) * 0.7)).toString(16).padStart(2, '0')}${Math.max(0, Math.floor(parseInt(m[3], 16) * 0.7)).toString(16).padStart(2, '0')}` : '#5a5a62';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        if (!combat.isBlocking) ctx.globalAlpha = 0.85;
        ctx.strokeStyle = bladeStroke;
        ctx.fillStyle = bladeFill;
        ctx.lineWidth = Math.max(1, 1.5 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(0, -guardW);
        ctx.lineTo(0, guardW);
        ctx.lineTo(bladeLen, guardW * 0.4);
        ctx.lineTo(bladeLen + 2, 0);
        ctx.lineTo(bladeLen, -guardW * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = guardFill;
        ctx.strokeStyle = bladeStroke;
        ctx.fillRect(-3, -guardW * 0.5, 4, guardW);
        ctx.strokeRect(-3, -guardW * 0.5, 4, guardW);
        ctx.globalAlpha = 1;
        ctx.restore();
    },

    drawShield(ctx, screenX, screenY, transform, movement, combat, camera) {
        if (!movement || !combat || !transform) return;
        if (!isBlockable(combat.offhandWeapon)) return;
        if (combat.weapon && combat.weapon.twoHanded) return;
        const offhandName = combat.offhandWeapon && (combat.offhandWeapon as { name?: string }).name;
        if (offhandName?.includes('Defender')) {
            PlayerCombatRenderer.drawDefenderDagger(ctx, screenX, screenY, transform, movement, combat, camera);
            return;
        }
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

