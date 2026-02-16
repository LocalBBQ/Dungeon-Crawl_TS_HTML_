// Sprite component - defines sprite rendering properties
import type { Component } from '../types/component.js';

export interface SpriteConfig {
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  flipX?: boolean;
  tint?: string | null;
}

export class Sprite implements Component {
  defaultSpriteSheetKey: string;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  tint: string | null;
  entity?: unknown;

  constructor(spriteSheetKey: string, width: number, height: number, config: SpriteConfig = {}) {
    this.defaultSpriteSheetKey = spriteSheetKey;
    this.width = width;
    this.height = height;
    this.offsetX = config.offsetX ?? 0;
    this.offsetY = config.offsetY ?? 0;
    this.scaleX = config.scaleX ?? 1;
    this.scaleY = config.scaleY ?? 1;
    this.rotation = config.rotation ?? 0;
    this.flipX = config.flipX ?? false;
    this.tint = config.tint ?? null;
  }

  getSpriteSheet(
    spriteManager: { getSpriteSheet(key: string): unknown },
    animation?: { getCurrentSpriteSheetKey(): string | null } | null
  ): unknown {
    if (!spriteManager) return null;
    if (animation) {
      const key = animation.getCurrentSpriteSheetKey();
      if (key) {
        const sheet = spriteManager.getSpriteSheet(key);
        if (sheet) return sheet;
      }
    }
    return spriteManager.getSpriteSheet(this.defaultSpriteSheetKey);
  }
}
