/**
 * Generic patrol behavior for packs. Produces patrol configs compatible with the AI component
 * ({ startX, startY, endX, endY }) so any pack can use back-and-forth patrol when idle.
 *
 * Usage: pass the result of createPatrolConfigForPack() as patrolConfig when spawning an enemy.
 */
function createPatrolConfigForPack(
    centerX: number,
    centerY: number,
    radius: number,
    options?: { angle?: number; length?: number }
): { startX: number; startY: number; endX: number; endY: number } {
    const opts = options || {};
    const angle = opts.angle != null ? opts.angle : Math.random() * Math.PI * 2;
    const halfLen = opts.length != null ? opts.length / 2 : radius;
    return {
        startX: centerX + Math.cos(angle) * -halfLen,
        startY: centerY + Math.sin(angle) * -halfLen,
        endX: centerX + Math.cos(angle) * halfLen,
        endY: centerY + Math.sin(angle) * halfLen,
    };
}

export const PatrolBehavior = { createPatrolConfigForPack };
