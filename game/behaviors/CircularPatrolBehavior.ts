/**
 * Circular patrol behavior: walk around a circle or arc.
 */
export interface CircularPatrolOptions {
  clockwise?: boolean;
  numWaypoints?: number;
  startAngle?: number;
}

export interface CircularPatrolConfig {
  type: 'circularPatrol';
  centerX: number;
  centerY: number;
  radius: number;
  clockwise: boolean;
  waypoints: { x: number; y: number }[];
  reachedThreshold: number;
}

export function createCircularPatrolConfig(
  centerX: number,
  centerY: number,
  radius: number,
  options?: CircularPatrolOptions
): CircularPatrolConfig {
  const opts = options ?? {};
  const numWaypoints = opts.numWaypoints != null ? Math.max(4, opts.numWaypoints) : 8;
  const clockwise = opts.clockwise !== false;
  const startAngle = opts.startAngle ?? Math.random() * Math.PI * 2;
  const waypoints: { x: number; y: number }[] = [];
  for (let i = 0; i < numWaypoints; i++) {
    const angle = startAngle + (clockwise ? -1 : 1) * (i / numWaypoints) * Math.PI * 2;
    waypoints.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }
  return {
    type: 'circularPatrol',
    centerX,
    centerY,
    radius,
    clockwise,
    waypoints,
    reachedThreshold: 12,
  };
}

export const CircularPatrolBehavior = { createCircularPatrolConfig };
