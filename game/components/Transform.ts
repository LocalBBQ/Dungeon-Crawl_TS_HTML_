// Transform component - position, rotation, scale
import type { Component } from '../types/component.js';

export class Transform implements Component {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  entity?: unknown;

  constructor(x = 0, y = 0, width = 30, height = 30) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0;
    this.scale = 1;
  }

  get centerX(): number {
    return this.x;
  }
  get centerY(): number {
    return this.y;
  }
  get left(): number {
    return this.x - this.width / 2;
  }
  get right(): number {
    return this.x + this.width / 2;
  }
  get top(): number {
    return this.y - this.height / 2;
  }
  get bottom(): number {
    return this.y + this.height / 2;
  }
}
