/**
 * Minimal game reference for systems/managers that need canvas, settings, or
 * entity list without pulling in the full Game class (avoids circular deps).
 */
export interface GameRef {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  entities: { get: (id: string) => unknown; getAll: (group?: string) => unknown[] };
  settings: Record<string, boolean | undefined>;
  gold?: number;
  playerInGatherableRange?: boolean;
}
