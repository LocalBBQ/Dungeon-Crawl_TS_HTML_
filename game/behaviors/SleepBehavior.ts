/**
 * Sleep / inactive behavior: don't move until player is within wakeRadius (or attacks).
 * Config is used by AI.sleep() when idleBehavior === 'sleep'.
 *
 * @param {number} wakeRadius - Distance at which enemy wakes and starts normal AI (chase/attack)
 * @param {Object} [options]
 */
export function createSleepConfig(wakeRadius?: number, _options?: unknown) {
    return {
        type: 'sleep',
        wakeRadius: wakeRadius != null ? wakeRadius : 120,
    };
}

export const SleepBehavior = { createSleepConfig };
