// Utility functions for the game

const FULL_CIRCLE_DEGREES = 360;

export interface Vec2 {
  x: number;
  y: number;
}

const Utils = {
  degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  },

  distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  normalize(x: number, y: number): Vec2 {
    const length = Math.sqrt(x * x + y * y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  },

  lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  },

  easeInQuad(t: number): number {
    const x = Math.max(0, Math.min(1, t));
    return x * x;
  },

  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  rectCollision(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  },

  random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  },

  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  angleTo(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  },

  normalizeAngle(angle: number): number {
    let a = angle;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  },

  pointInArc(
    px: number,
    py: number,
    centerX: number,
    centerY: number,
    facingAngle: number,
    arcAngle: number,
    maxDistance: number
  ): boolean {
    const dist = Utils.distance(px, py, centerX, centerY);
    if (dist > maxDistance) return false;
    const angleToPoint = Utils.angleTo(centerX, centerY, px, py);
    const angleDiff = Utils.normalizeAngle(angleToPoint - facingAngle);
    return Math.abs(angleDiff) <= arcAngle / 2;
  },

  pointInSweptArc(
    px: number,
    py: number,
    centerX: number,
    centerY: number,
    facingAngle: number,
    arcAngle: number,
    sweepProgress: number,
    maxDistance: number
  ): boolean {
    const dist = Utils.distance(px, py, centerX, centerY);
    if (dist > maxDistance) return false;
    if (sweepProgress <= 0) return false;
    const halfArc = arcAngle / 2;
    const sweepStart = facingAngle - halfArc;
    const angleToPoint = Utils.angleTo(centerX, centerY, px, py);
    const rel = Utils.normalizeAngle(angleToPoint - sweepStart);
    const sweptAngle = sweepProgress * arcAngle;
    return rel >= 0 && rel <= sweptAngle;
  },

  pointInThrustRect(
    px: number,
    py: number,
    originX: number,
    originY: number,
    facingAngle: number,
    length: number,
    halfWidth: number
  ): boolean {
    const dx = px - originX;
    const dy = py - originY;
    const along = dx * Math.cos(facingAngle) + dy * Math.sin(facingAngle);
    const perp = -dx * Math.sin(facingAngle) + dy * Math.cos(facingAngle);
    return along >= 0 && along <= length && Math.abs(perp) <= halfWidth;
  },
};

export { Utils, FULL_CIRCLE_DEGREES };
