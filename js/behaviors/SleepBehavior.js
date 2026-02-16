/**
 * Sleep / inactive behavior: don't move until player is within wakeRadius (or attacks).
 * Config is used by AI.sleep() when idleBehavior === 'sleep'.
 *
 * @param {number} wakeRadius - Distance at which enemy wakes and starts normal AI (chase/attack)
 * @param {Object} [options]
 */
function createSleepConfig(wakeRadius, options) {
    return {
        type: 'sleep',
        wakeRadius: wakeRadius != null ? wakeRadius : 120
    };
}

if (typeof window !== 'undefined') {
    window.SleepBehavior = { createSleepConfig };
}
