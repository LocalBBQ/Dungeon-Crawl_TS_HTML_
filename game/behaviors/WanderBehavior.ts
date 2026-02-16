/**
 * Wander behavior: move randomly within a circle (e.g. the scene tile the pack was spawned in).
 * Config is used by AI.wander() when idleBehavior === 'wander'.
 *
 * @param centerX - Center of wander area (e.g. tile center)
 * @param centerY - Center of wander area
 * @param radius - Max distance from center; enemy picks random points within this circle
 */
export function createWanderConfig(
    centerX: number,
    centerY: number,
    radius: number
): { type: 'wander'; centerX: number; centerY: number; radius: number } {
    return {
        type: 'wander',
        centerX,
        centerY,
        radius: radius > 0 ? radius : 400
    };
}

export const WanderBehavior = { createWanderConfig };
