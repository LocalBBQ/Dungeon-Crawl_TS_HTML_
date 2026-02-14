/**
 * Circular patrol behavior: walk around a circle or arc.
 * Config is used by AI.circularPatrol() when idleBehavior === 'circularPatrol'.
 * AI will move along waypoints on the circle.
 *
 * @param {number} centerX - Circle center X
 * @param {number} centerY - Circle center Y
 * @param {number} radius - Circle radius
 * @param {Object} [options]
 * @param {boolean} [options.clockwise] - true = clockwise, false = counter-clockwise
 * @param {number} [options.numWaypoints] - Number of points on the circle (default 8)
 * @param {number} [options.startAngle] - Start angle in radians (0 = east). If omitted, random.
 */
function createCircularPatrolConfig(centerX, centerY, radius, options) {
    const opts = options || {};
    const numWaypoints = opts.numWaypoints != null ? Math.max(4, opts.numWaypoints) : 8;
    const clockwise = opts.clockwise !== false;
    const startAngle = opts.startAngle != null ? opts.startAngle : Math.random() * Math.PI * 2;
    const waypoints = [];
    for (let i = 0; i < numWaypoints; i++) {
        const angle = startAngle + (clockwise ? -1 : 1) * (i / numWaypoints) * Math.PI * 2;
        waypoints.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        });
    }
    return {
        type: 'circularPatrol',
        centerX,
        centerY,
        radius,
        clockwise,
        waypoints,
        reachedThreshold: 12
    };
}

if (typeof window !== 'undefined') {
    window.CircularPatrolBehavior = { createCircularPatrolConfig };
}
