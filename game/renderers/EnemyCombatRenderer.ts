// Enemy combat visuals: wind-up and attack telegraphing.
// Uses 12 principles: anticipation (wind-up), staging (clear phases), timing (eased so "when" is readable).

export const EnemyCombatRenderer = {
    /** Ease-in cubic: subtle for most of wind-up, then ramps sharply so "about to hit" is clear (staging + anticipation). */
    easeInCubic(t: number): number {
        const x = Math.max(0, Math.min(1, t));
        return x * x * x;
    },

    /** Visual progress for wind-up drawing (0..1). Eased so the warning intensifies in the last portion. */
    getWindUpVisualProgress(combat: unknown): number {
        if (!combat || !combat.isWindingUp) return 0;
        const raw = combat.windUpProgress;
        return this.easeInCubic(raw);
    },

    /** Danger phase 0..1 in the last DANGER_RATIO of wind-up — for "about to strike" highlight (staging). */
    DANGER_RATIO: 0.25,
    getWindUpDangerPhase(combat: unknown): number {
        if (!combat || !combat.isWindingUp) return 0;
        const raw = combat.windUpProgress;
        if (raw < 1 - this.DANGER_RATIO) return 0;
        return (raw - (1 - this.DANGER_RATIO)) / this.DANGER_RATIO;
    }
};

