/**
 * Pack follow behavior: when idle, move toward pack center with a random offset so enemies
 * loosely cluster rather than all standing on one point. Use with roamConfig for bounds.
 *
 * @param {number} centerX - Pack/home center X
 * @param {number} centerY - Pack/home center Y
 * @param {number} followRadius - How close to get to center (target = center + offset within this)
 * @param {Object} [options]
 * @param {number} [options.offsetAngle] - Fixed angle offset in radians. If omitted, each enemy gets random.
 */
function createPackFollowConfig(centerX, centerY, followRadius, options) {
    const opts = options || {};
    return {
        type: 'packFollow',
        centerX,
        centerY,
        followRadius: followRadius != null ? followRadius : 50,
        offsetAngle: opts.offsetAngle != null ? opts.offsetAngle : Math.random() * Math.PI * 2
    };
}

if (typeof window !== 'undefined') {
    window.PackFollowBehavior = { createPackFollowConfig };
}
