/**
 * Renderable component shape: type and visual config.
 */
export interface RenderableShape {
  type: 'player' | 'enemy' | 'obstacle' | string;
  color: string;
  entity?: unknown;
  setColor(color: string): void;
}
