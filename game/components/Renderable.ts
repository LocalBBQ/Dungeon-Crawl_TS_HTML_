// Renderable component - defines how entity should be rendered
import type { Component } from '../types/component.js';

export class Renderable implements Component {
  type: string;
  color: string;
  entity?: unknown;

  constructor(type: string, config: { color?: string } = {}) {
    this.type = type;
    this.color = config.color ?? '#ffffff';
  }

  setColor(color: string): void {
    this.color = color;
  }
}
