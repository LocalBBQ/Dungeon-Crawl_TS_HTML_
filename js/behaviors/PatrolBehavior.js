/**
 * Generic patrol behavior for packs. Produces patrol configs compatible with the AI component
 * ({ startX, startY, endX, endY }) so any pack can use back-and-forth patrol when idle.
 *
 * Usage: pass the result of createPatrolConfigForPack() as patrolConfig when spawning an enemy.
 */
const PatrolBehavior = (function () {
    /**
     * Create a patrol config for a pack. All enemies in the pack can share this config
     * for a shared path, or call once per pack and pass the same config to each spawn.
     *
     * @param {number} centerX - Pack center X
     * @param {number} centerY - Pack center Y
     * @param {number} radius - Pack radius (patrol segment length = 2 * radius)
     * @param {Object} [options]
     * @param {number} [options.angle] - Line angle in radians (0 = horizontal). If omitted, random.
     * @param {number} [options.length] - Override segment length (default 2 * radius)
     * @returns {{ startX: number, startY: number, endX: number, endY: number }}
     */
    function createPatrolConfigForPack(centerX, centerY, radius, options) {
        const opts = options || {};
        const angle = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
        const halfLen = (opts.length != null ? opts.length / 2 : radius);

        const startX = centerX + Math.cos(angle) * (-halfLen);
        const startY = centerY + Math.sin(angle) * (-halfLen);
        const endX = centerX + Math.cos(angle) * halfLen;
        const endY = centerY + Math.sin(angle) * halfLen;

        return { startX, startY, endX, endY };
    }

    return {
        createPatrolConfigForPack
    };
})();

if (typeof window !== 'undefined') {
    window.PatrolBehavior = PatrolBehavior;
}
