/**
 * Shared easing functions for combat and animation (single source of truth).
 * t is in 0..1; returns eased value in 0..1.
 */

/** Ease-in cubic: slow start, then accelerates. */
export function easeInCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x;
}

/** Ease-out cubic: fast start, slow end — snappy release, follow-through. */
export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

/** Ease-out quartic (power 4): snappier impact out of wind-up. */
export function easeOutQuart(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 4);
}

/** Ease-out quint (power 5): very snappy forward (e.g. thrust lunge). */
export function easeOutQuint(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 5);
}
