// Obstacle/Environment objects for collision
import { Utils } from '../utils/Utils.ts';
import { Transform } from '../components/Transform.ts';

interface EntityWithTransform {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

export class Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  sprite: unknown;
  spritePath: string | null;
  spriteFrameIndex?: number;

  constructor(x: number, y: number, width: number, height: number, type = 'tree') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.sprite = null;
    this.spritePath = null;
  }

  checkCollision(entity: EntityWithTransform): boolean {
    const transform = entity.getComponent(Transform);
    if (!transform) return false;
    return Utils.rectCollision(
      this.x,
      this.y,
      this.width,
      this.height,
      transform.left,
      transform.top,
      transform.width,
      transform.height
    );
  }
}

declare global {
  interface Window {
    Obstacle?: typeof Obstacle;
  }
}
if (typeof window !== 'undefined') {
  (window as Window).Obstacle = Obstacle;
}
