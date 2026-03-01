// Obstacle/Environment objects for collision
import { Utils } from '../utils/Utils.js';
import { Transform } from '../components/Transform.js';

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
  /** If true, obstacle can be damaged by attacks and removed when hp reaches 0. */
  breakable?: boolean;
  /** Current hit points; when <= 0 the obstacle is removed. Only used when breakable is true. */
  hp?: number;
  /** Max hit points (for health bar). Set when breakable; defaults to initial hp. */
  maxHp?: number;
  /** Unique id for this obstacle (set by ObstacleManager). Used to avoid double-hits in one attack. */
  id?: string;
  /** If true, entity movement is not blocked (e.g. hub decorations that may not render). */
  passable?: boolean;
  /** For caveEntrance: level to transition to when entering (e.g. 12 = Ogre's Den). */
  targetLevel?: number;
  /** For caveEntrance: level to return to when leaving the target (e.g. 1 = Village Outskirts). */
  returnLevel?: number;

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
