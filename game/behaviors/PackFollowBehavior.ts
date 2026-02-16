/**
 * Pack follow behavior: when idle, move toward pack center with offset.
 */
export interface PackFollowOptions {
  offsetAngle?: number;
}

export interface PackFollowConfig {
  type: 'packFollow';
  centerX: number;
  centerY: number;
  followRadius: number;
  offsetAngle: number;
}

export function createPackFollowConfig(
  centerX: number,
  centerY: number,
  followRadius: number,
  options?: PackFollowOptions
): PackFollowConfig {
  const opts = options ?? {};
  return {
    type: 'packFollow',
    centerX,
    centerY,
    followRadius: followRadius ?? 50,
    offsetAngle: opts.offsetAngle ?? Math.random() * Math.PI * 2,
  };
}

export const PackFollowBehavior = { createPackFollowConfig };
