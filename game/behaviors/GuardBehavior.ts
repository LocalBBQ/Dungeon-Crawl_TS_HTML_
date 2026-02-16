/**
 * Guard / sentry behavior: stay near a point, optionally turn slowly.
 * Config is used by AI.guard() when idleBehavior === 'guard'.
 *
 * @param {number} centerX - Guard post X
 * @param {number} centerY - Guard post Y
 * @param {number} radius - Max distance from post (stay within this circle)
 * @param {Object} [options]
 * @param {number} [options.turnSpeed] - Radians per second to rotate (0 = face one direction). If omitted, no turning.
 * @param {number} [options.faceAngle] - Initial facing in radians. If omitted, random.
 */
export function createGuardConfig(
    centerX: number,
    centerY: number,
    radius: number,
    options?: { turnSpeed?: number; faceAngle?: number }
) {
    const opts = options || {};
    return {
        type: 'guard',
        centerX,
        centerY,
        radius: radius != null ? radius : 60,
        turnSpeed: opts.turnSpeed != null ? opts.turnSpeed : 0,
        faceAngle: opts.faceAngle != null ? opts.faceAngle : Math.random() * Math.PI * 2,
    };
}

export const GuardBehavior = { createGuardConfig };
